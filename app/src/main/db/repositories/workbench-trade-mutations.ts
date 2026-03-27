import type Database from 'better-sqlite3'
import type {
  AddToTradeInput,
  CancelTradeInput,
  CloseTradeInput,
  OpenTradeInput,
  ReduceTradeInput,
  TradeMutationResult,
} from '@shared/contracts/workbench-trade'
import { TradeMutationResultSchema } from '@shared/contracts/workbench-trade'
import { mapEvent } from '@main/db/repositories/workbench-mappers'
import { loadTradeById } from '@main/db/repositories/workbench-queries'
import { createId, currentIso } from '@main/db/repositories/workbench-utils'

const sideLabels = {
  long: '做多',
  short: '做空',
} as const

const formatNumber = (value: number) => {
  if (Number.isInteger(value)) {
    return String(value)
  }

  return value.toFixed(4).replace(/\.?0+$/, '')
}

const roundTo = (value: number, digits = 6) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

const loadEventById = (db: Database.Database, eventId: string) => {
  const row = db.prepare('SELECT * FROM events WHERE id = ? LIMIT 1').get(eventId) as Record<string, unknown> | undefined
  if (!row) {
    throw new Error(`未找到事件 ${eventId}。`)
  }

  return mapEvent(row)
}

const loadSessionTradeContext = (db: Database.Database, sessionId: string) => {
  const row = db.prepare(`
    SELECT sessions.id AS session_id, contracts.symbol AS symbol
    FROM sessions
    INNER JOIN contracts ON contracts.id = sessions.contract_id
    WHERE sessions.id = ?
    LIMIT 1
  `).get(sessionId) as { session_id: string, symbol: string } | undefined

  if (!row) {
    throw new Error(`未找到 Session ${sessionId}。`)
  }

  return row
}

const requireOpenTrade = (db: Database.Database, tradeId: string) => {
  const trade = loadTradeById(db, tradeId)
  if (trade.status !== 'open') {
    throw new Error(`交易 ${tradeId} 当前不是 open 状态，无法继续管理。`)
  }

  return trade
}

const requireCancelableTrade = (db: Database.Database, tradeId: string) => {
  const trade = loadTradeById(db, tradeId)
  if (trade.status === 'closed') {
    throw new Error(`交易 ${tradeId} 已经 closed，不能再取消。`)
  }
  if (trade.status === 'canceled') {
    throw new Error(`交易 ${tradeId} 已经 canceled。`)
  }

  return trade
}

const ensureNoOpenTradeForSession = (db: Database.Database, sessionId: string) => {
  const row = db.prepare(`
    SELECT id
    FROM trades
    WHERE session_id = ? AND status = 'open' AND deleted_at IS NULL
    ORDER BY opened_at DESC, created_at DESC
    LIMIT 1
  `).get(sessionId) as { id: string } | undefined

  if (row) {
    throw new Error(`Session ${sessionId} 已有未平仓交易 ${row.id}。如需继续管理，请使用加仓/减仓/平仓。`)
  }
}

const insertTradeEvent = (
  db: Database.Database,
  input: {
    created_at: string
    occurred_at: string
    session_id: string
    trade_id: string
    event_type: 'trade_open' | 'trade_add' | 'trade_reduce' | 'trade_close' | 'trade_cancel'
    title: string
    summary: string
  },
) => {
  const eventId = createId('event')
  db.prepare(`
    INSERT INTO events (
      id, schema_version, created_at, session_id, trade_id, event_type, title, summary, author_kind,
      occurred_at, content_block_ids_json, screenshot_id, ai_run_id, deleted_at
    ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, 'user', ?, '[]', NULL, NULL, NULL)
  `).run(
    eventId,
    input.created_at,
    input.session_id,
    input.trade_id,
    input.event_type,
    input.title,
    input.summary,
    input.occurred_at,
  )

  return loadEventById(db, eventId)
}

const computeWeightedEntryPrice = (
  currentQuantity: number,
  currentEntryPrice: number,
  addQuantity: number,
  addPrice: number,
) => roundTo(((currentEntryPrice * currentQuantity) + (addPrice * addQuantity)) / (currentQuantity + addQuantity))

const computeTradePnlR = (
  input: {
    side: 'long' | 'short'
    entry_price: number
    stop_loss: number
  },
  exitPrice: number,
) => {
  const riskPerUnit = Math.abs(input.entry_price - input.stop_loss)
  if (riskPerUnit <= Number.EPSILON) {
    return 0
  }

  const realizedMove = input.side === 'long'
    ? exitPrice - input.entry_price
    : input.entry_price - exitPrice

  return roundTo(realizedMove / riskPerUnit)
}

export const openTrade = (db: Database.Database, input: OpenTradeInput): TradeMutationResult => {
  const context = loadSessionTradeContext(db, input.session_id)
  const createdAt = currentIso()
  const openedAt = input.opened_at ?? createdAt

  const transaction = db.transaction(() => {
    ensureNoOpenTradeForSession(db, input.session_id)

    const tradeId = createId('trade')
    db.prepare(`
      INSERT INTO trades (
        id, schema_version, created_at, session_id, symbol, side, status, quantity, entry_price,
        stop_loss, take_profit, exit_price, pnl_r, opened_at, closed_at, thesis, deleted_at
      ) VALUES (?, 1, ?, ?, ?, ?, 'open', ?, ?, ?, ?, NULL, NULL, ?, NULL, ?, NULL)
    `).run(
      tradeId,
      createdAt,
      input.session_id,
      context.symbol,
      input.side,
      input.quantity,
      input.entry_price,
      input.stop_loss,
      input.take_profit,
      openedAt,
      input.thesis,
    )

    const event = insertTradeEvent(db, {
      created_at: createdAt,
      occurred_at: openedAt,
      session_id: input.session_id,
      trade_id: tradeId,
      event_type: 'trade_open',
      title: `${context.symbol} ${sideLabels[input.side]} 开仓 x${formatNumber(input.quantity)}`,
      summary: `入场 ${formatNumber(input.entry_price)}，止损 ${formatNumber(input.stop_loss)}，止盈 ${formatNumber(input.take_profit)}。${input.thesis}`,
    })

    return TradeMutationResultSchema.parse({
      trade: loadTradeById(db, tradeId),
      event,
    })
  })

  return transaction()
}

export const addToTrade = (db: Database.Database, input: AddToTradeInput): TradeMutationResult => {
  const createdAt = currentIso()
  const occurredAt = input.occurred_at ?? createdAt

  const transaction = db.transaction(() => {
    const trade = requireOpenTrade(db, input.trade_id)
    const nextQuantity = roundTo(trade.quantity + input.quantity)
    const nextEntryPrice = computeWeightedEntryPrice(trade.quantity, trade.entry_price, input.quantity, input.price)

    db.prepare(`
      UPDATE trades
      SET quantity = ?, entry_price = ?
      WHERE id = ?
    `).run(nextQuantity, nextEntryPrice, trade.id)

    const event = insertTradeEvent(db, {
      created_at: createdAt,
      occurred_at: occurredAt,
      session_id: trade.session_id,
      trade_id: trade.id,
      event_type: 'trade_add',
      title: `${trade.symbol} ${sideLabels[trade.side]} 加仓 +${formatNumber(input.quantity)}`,
      summary: `加仓执行价 ${formatNumber(input.price)}，当前仓位 ${formatNumber(nextQuantity)}，更新后均价 ${formatNumber(nextEntryPrice)}。`,
    })

    return TradeMutationResultSchema.parse({
      trade: loadTradeById(db, trade.id),
      event,
    })
  })

  return transaction()
}

export const reduceTrade = (db: Database.Database, input: ReduceTradeInput): TradeMutationResult => {
  const createdAt = currentIso()
  const occurredAt = input.occurred_at ?? createdAt

  const transaction = db.transaction(() => {
    const trade = requireOpenTrade(db, input.trade_id)
    const nextQuantity = roundTo(trade.quantity - input.quantity)
    if (nextQuantity <= 0) {
      throw new Error('减仓后数量不能小于等于 0。全部离场请使用平仓。')
    }

    db.prepare(`
      UPDATE trades
      SET quantity = ?
      WHERE id = ?
    `).run(nextQuantity, trade.id)

    const event = insertTradeEvent(db, {
      created_at: createdAt,
      occurred_at: occurredAt,
      session_id: trade.session_id,
      trade_id: trade.id,
      event_type: 'trade_reduce',
      title: `${trade.symbol} ${sideLabels[trade.side]} 减仓 -${formatNumber(input.quantity)}`,
      summary: `减仓执行价 ${formatNumber(input.price)}，剩余仓位 ${formatNumber(nextQuantity)}。`,
    })

    return TradeMutationResultSchema.parse({
      trade: loadTradeById(db, trade.id),
      event,
    })
  })

  return transaction()
}

export const closeTrade = (db: Database.Database, input: CloseTradeInput): TradeMutationResult => {
  const createdAt = currentIso()
  const closedAt = input.closed_at ?? createdAt

  const transaction = db.transaction(() => {
    const trade = requireOpenTrade(db, input.trade_id)
    const pnlR = computeTradePnlR(trade, input.exit_price)

    db.prepare(`
      UPDATE trades
      SET status = 'closed', exit_price = ?, pnl_r = ?, closed_at = ?
      WHERE id = ?
    `).run(input.exit_price, pnlR, closedAt, trade.id)

    const event = insertTradeEvent(db, {
      created_at: createdAt,
      occurred_at: closedAt,
      session_id: trade.session_id,
      trade_id: trade.id,
      event_type: 'trade_close',
      title: `${trade.symbol} ${sideLabels[trade.side]} 平仓`,
      summary: `平仓价 ${formatNumber(input.exit_price)}，结果 ${formatNumber(pnlR)}R，闭环仓位 ${formatNumber(trade.quantity)}。`,
    })

    return TradeMutationResultSchema.parse({
      trade: loadTradeById(db, trade.id),
      event,
    })
  })

  return transaction()
}

export const cancelTrade = (db: Database.Database, input: CancelTradeInput): TradeMutationResult => {
  const createdAt = currentIso()
  const canceledAt = input.canceled_at ?? createdAt
  const reason = input.reason_md?.trim()

  const transaction = db.transaction(() => {
    const trade = requireCancelableTrade(db, input.trade_id)

    db.prepare(`
      UPDATE trades
      SET status = 'canceled', exit_price = NULL, pnl_r = NULL, closed_at = ?
      WHERE id = ?
    `).run(canceledAt, trade.id)

    const event = insertTradeEvent(db, {
      created_at: createdAt,
      occurred_at: canceledAt,
      session_id: trade.session_id,
      trade_id: trade.id,
      event_type: 'trade_cancel',
      title: `${trade.symbol} ${sideLabels[trade.side]} 取消`,
      summary: reason
        ? `交易已取消，不计入正常离场结果。原因：${reason}`
        : '交易已取消，不计入正常离场结果。',
    })

    return TradeMutationResultSchema.parse({
      trade: loadTradeById(db, trade.id),
      event,
    })
  })

  return transaction()
}
