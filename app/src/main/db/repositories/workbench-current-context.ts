import type Database from 'better-sqlite3'
import { z } from 'zod'
import {
  CurrentContextSchema,
  CurrentTargetOptionSchema,
  CurrentTargetOptionsPayloadSchema,
  TargetOptionGroupsSchema,
  type CurrentContext,
  type CurrentTargetOption,
  type ListTargetOptionsInput,
  type SetCurrentContextInput,
} from '@shared/contracts/current-context'
import { type TradeRecord } from '@shared/contracts/trade'
import { mapSession, mapTrade } from '@main/db/repositories/workbench-mappers'
import { REALTIME_VIEW_TITLE, currentIso, resolveDefaultSessionId, selectRows } from '@main/db/repositories/workbench-utils'

const CURRENT_CONTEXT_ID = 'current_context'

const sideLabels = {
  long: '做多',
  short: '做空',
} as const

const statusLabels = {
  planned: '计划中',
  open: '持仓中',
  closed: '已关闭',
} as const

const loadCurrentContextRow = (db: Database.Database) =>
  db.prepare('SELECT * FROM current_context WHERE id = ? LIMIT 1').get(CURRENT_CONTEXT_ID) as Record<string, unknown> | undefined

const loadSessionScope = (db: Database.Database, sessionId: string) => {
  const row = db.prepare(`
    SELECT sessions.*, contracts.id AS contract_id, periods.id AS period_id
    FROM sessions
    INNER JOIN contracts ON contracts.id = sessions.contract_id
    INNER JOIN periods ON periods.id = sessions.period_id
    WHERE sessions.id = ?
    LIMIT 1
  `).get(sessionId) as Record<string, unknown> | undefined

  if (!row) {
    throw new Error(`未找到 Session ${sessionId}。`)
  }

  return {
    session: mapSession(row),
    contract_id: String(row.contract_id),
    period_id: String(row.period_id),
  }
}

const loadTradesForSession = (db: Database.Database, sessionId: string) =>
  selectRows(
    db,
    `
      SELECT *
      FROM trades
      WHERE session_id = ? AND deleted_at IS NULL
      ORDER BY CASE WHEN status = 'open' THEN 0 ELSE 1 END, opened_at DESC, created_at DESC
    `,
    [sessionId],
  ).map(mapTrade)

type SessionTargetScope = {
  session_id: string
  contract_id: string
  period_id: string
  period_label: string
  session_title: string
  started_at: string
}

const loadSessionHistoryForContract = (db: Database.Database, contractId: string) => (
  selectRows(db, `
    SELECT
      sessions.id AS session_id,
      sessions.contract_id,
      sessions.period_id,
      periods.label AS period_label,
      sessions.title AS session_title,
      sessions.started_at
    FROM sessions
    INNER JOIN periods ON periods.id = sessions.period_id
    WHERE sessions.contract_id = ? AND sessions.deleted_at IS NULL
    ORDER BY sessions.started_at DESC, sessions.created_at DESC
  `, [contractId]).map((row) => ({
    session_id: String(row.session_id),
    contract_id: String(row.contract_id),
    period_id: String(row.period_id),
    period_label: String(row.period_label),
    session_title: String(row.session_title),
    started_at: String(row.started_at),
  } satisfies SessionTargetScope))
)

const loadTradesForSessions = (db: Database.Database, sessionIds: string[]) => {
  if (sessionIds.length === 0) {
    return new Map<string, TradeRecord[]>()
  }

  const placeholders = sessionIds.map(() => '?').join(', ')
  const rows = selectRows(db, `
    SELECT *
    FROM trades
    WHERE session_id IN (${placeholders}) AND deleted_at IS NULL
    ORDER BY opened_at DESC, created_at DESC
  `, sessionIds).map(mapTrade)

  const grouped = new Map<string, TradeRecord[]>()
  for (const trade of rows) {
    const list = grouped.get(trade.session_id) ?? []
    list.push(trade)
    grouped.set(trade.session_id, list)
  }

  return grouped
}

const loadPreviousPeriodTradeIds = (
  db: Database.Database,
  contractId: string,
  currentPeriodId: string,
) => {
  const currentPeriod = db.prepare('SELECT start_at FROM periods WHERE id = ? LIMIT 1').get(currentPeriodId) as { start_at: string } | undefined
  if (!currentPeriod) {
    return []
  }

  const previousPeriod = db.prepare(`
    SELECT periods.id
    FROM periods
    INNER JOIN sessions ON sessions.period_id = periods.id
    WHERE sessions.contract_id = ?
      AND sessions.deleted_at IS NULL
      AND periods.start_at < ?
    GROUP BY periods.id, periods.start_at
    ORDER BY periods.start_at DESC
    LIMIT 1
  `).get(contractId, currentPeriod.start_at) as { id: string } | undefined

  if (!previousPeriod) {
    return []
  }

  return selectRows(db, `
    SELECT trades.id
    FROM trades
    INNER JOIN sessions ON sessions.id = trades.session_id
    WHERE sessions.contract_id = ?
      AND sessions.period_id = ?
      AND sessions.deleted_at IS NULL
      AND trades.deleted_at IS NULL
    ORDER BY trades.opened_at ASC, trades.created_at ASC
  `, [contractId, previousPeriod.id]).map((row) => String(row.id))
}

const buildSessionOption = (
  input: SessionTargetScope & {
    is_current: boolean
    depth?: number
    parent_target_id?: string | null
  },
) => CurrentTargetOptionSchema.parse({
  id: `target_session_${input.session_id}`,
  target_kind: 'session',
  contract_id: input.contract_id,
  period_id: input.period_id,
  session_id: input.session_id,
  trade_id: null,
  label: input.session_title,
  subtitle: `${input.period_label} · Session 级目标 · ${input.started_at}`,
  is_current: input.is_current,
  trade_status: null,
  trade_side: null,
  depth: input.depth ?? 0,
  parent_target_id: input.parent_target_id ?? null,
  period_label: input.period_label,
  session_title: input.session_title,
  search_text: `${input.period_label} ${input.session_title} ${input.started_at}`,
  previous_period_trade_index: null,
})

const buildTradeOption = (
  input: {
    trade: TradeRecord
    contract_id: string
    period_id: string
    period_label: string
    session_title: string
    is_current: boolean
    depth?: number
    parent_target_id?: string | null
    previous_period_trade_index?: number | null
  },
) => CurrentTargetOptionSchema.parse({
  id: `target_trade_${input.trade.id}`,
  target_kind: 'trade',
  contract_id: input.contract_id,
  period_id: input.period_id,
  session_id: input.trade.session_id,
  trade_id: input.trade.id,
  label: `${input.trade.symbol} ${sideLabels[input.trade.side]}`,
  subtitle: `${input.period_label} · ${input.session_title} · ${statusLabels[input.trade.status]} · 数量 ${input.trade.quantity} · 开始 ${input.trade.opened_at}`,
  is_current: input.is_current,
  trade_status: input.trade.status,
  trade_side: input.trade.side,
  depth: input.depth ?? 0,
  parent_target_id: input.parent_target_id ?? null,
  period_label: input.period_label,
  session_title: input.session_title,
  search_text: [
    input.period_label,
    input.session_title,
    input.trade.symbol,
    input.trade.side,
    input.trade.status,
    input.trade.thesis,
    input.trade.opened_at,
    input.previous_period_trade_index != null ? `上一周期 第${input.previous_period_trade_index}笔 trade` : '',
  ].filter(Boolean).join(' '),
  previous_period_trade_index: input.previous_period_trade_index ?? null,
})

const buildPeriodOption = (
  input: {
    period_id: string
    period_label: string
    contract_id: string
    session_id: string
    session_title: string
  },
) => CurrentTargetOptionSchema.parse({
  id: `target_period_${input.period_id}`,
  target_kind: 'period',
  contract_id: input.contract_id,
  period_id: input.period_id,
  session_id: input.session_id,
  trade_id: null,
  label: input.period_label,
  subtitle: `Period 级目标 · 代表 Session ${input.session_title}`,
  is_current: false,
  trade_status: null,
  trade_side: null,
  depth: 0,
  parent_target_id: null,
  period_label: input.period_label,
  session_title: input.session_title,
  search_text: `${input.period_label} ${input.session_title} period`,
  previous_period_trade_index: null,
})

const toTargetCatalog = (groups: z.infer<typeof TargetOptionGroupsSchema>) => {
  const catalog = new Map<string, CurrentTargetOption>()
  for (const option of [...groups.current, ...groups.recent, ...groups.history, ...groups.previous_period_trades]) {
    if (!catalog.has(option.id)) {
      catalog.set(option.id, option)
    }
  }

  return [...catalog.values()]
}

const validateTradeTarget = (
  sessionId: string,
  trades: TradeRecord[],
  tradeId?: string | null,
) => {
  if (!tradeId) {
    return null
  }

  const trade = trades.find((item) => item.id === tradeId)
  if (!trade) {
    throw new Error(`交易 ${tradeId} 不属于 Session ${sessionId}。`)
  }

  return trade.id
}

const buildCurrentContextRecord = (
  db: Database.Database,
  input: {
    session_id?: string
    source_view?: CurrentContext['source_view']
    capture_kind?: CurrentContext['capture_kind']
    trade_id?: string | null
  },
): CurrentContext => {
  const sessionId = input.session_id ?? resolveDefaultSessionId(db)
  const sessionScope = loadSessionScope(db, sessionId)
  const existingRow = loadCurrentContextRow(db)
  const trades = loadTradesForSession(db, sessionId)
  const tradeId = validateTradeTarget(sessionId, trades, input.trade_id ?? null)
  const timestamp = currentIso()
  const existing = existingRow ? CurrentContextSchema.parse(existingRow) : null

  return CurrentContextSchema.parse({
    id: CURRENT_CONTEXT_ID,
    schema_version: 1,
    created_at: existing?.created_at ?? timestamp,
    updated_at: timestamp,
    contract_id: sessionScope.contract_id,
    period_id: sessionScope.period_id,
    session_id: sessionScope.session.id,
    trade_id: tradeId,
    source_view: input.source_view ?? existing?.source_view ?? 'session-workbench',
    capture_kind: input.capture_kind ?? existing?.capture_kind ?? 'chart',
  })
}

export const ensureCurrentContext = (
  db: Database.Database,
  input?: {
    session_id?: string
    source_view?: CurrentContext['source_view']
  },
): CurrentContext => {
  const existingRow = loadCurrentContextRow(db)
  const existing = existingRow ? CurrentContextSchema.parse(existingRow) : null
  const shouldResetSession = input?.session_id != null && existing?.session_id !== input.session_id
  const shouldSyncSourceView = input?.source_view != null && existing?.source_view !== input.source_view
  if (!existing || shouldResetSession || shouldSyncSourceView) {
    const nextContext = buildCurrentContextRecord(db, {
      session_id: input?.session_id,
      source_view: input?.source_view ?? existing?.source_view ?? 'session-workbench',
      capture_kind: existing?.capture_kind ?? 'chart',
      trade_id: shouldResetSession ? null : existing?.trade_id ?? null,
    })
    upsertCurrentContext(db, nextContext)
    return nextContext
  }

  return existing
}

export const getCurrentContext = (
  db: Database.Database,
  input?: {
    session_id?: string
    source_view?: CurrentContext['source_view']
  },
) => ensureCurrentContext(db, input)

export const upsertCurrentContext = (
  db: Database.Database,
  input: CurrentContext | SetCurrentContextInput,
) => {
  const nextContext = CurrentContextSchema.safeParse(input).success
    ? CurrentContextSchema.parse(input)
    : buildCurrentContextRecord(db, input)

  db.prepare(`
    INSERT INTO current_context (
      id, schema_version, created_at, updated_at, contract_id, period_id, session_id, trade_id, source_view, capture_kind
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      schema_version = excluded.schema_version,
      updated_at = excluded.updated_at,
      contract_id = excluded.contract_id,
      period_id = excluded.period_id,
      session_id = excluded.session_id,
      trade_id = excluded.trade_id,
      source_view = excluded.source_view,
      capture_kind = excluded.capture_kind
  `).run(
    nextContext.id,
    nextContext.schema_version,
    nextContext.created_at,
    nextContext.updated_at,
    nextContext.contract_id,
    nextContext.period_id,
    nextContext.session_id,
    nextContext.trade_id,
    nextContext.source_view,
    nextContext.capture_kind,
  )

  return CurrentContextSchema.parse(nextContext)
}

const resolveTargetListingContext = (
  db: Database.Database,
  input?: ListTargetOptionsInput,
) => {
  const existingRow = loadCurrentContextRow(db)
  const existing = existingRow ? CurrentContextSchema.parse(existingRow) : null
  if (!input?.session_id) {
    return ensureCurrentContext(db, {
      source_view: 'session-workbench',
    })
  }

  return buildCurrentContextRecord(db, {
    session_id: input.session_id,
    source_view: 'session-workbench',
    capture_kind: existing?.capture_kind ?? 'chart',
    trade_id: existing?.session_id === input.session_id ? existing.trade_id : null,
  })
}

export const listCurrentTargetOptions = (
  db: Database.Database,
  input?: ListTargetOptionsInput,
) => {
  const currentContext = resolveTargetListingContext(db, input)
  const sessionHistory = loadSessionHistoryForContract(db, currentContext.contract_id)
  const tradesBySession = loadTradesForSessions(db, sessionHistory.map((session) => session.session_id))
  const previousPeriodTradeIds = loadPreviousPeriodTradeIds(db, currentContext.contract_id, currentContext.period_id)
  const previousPeriodTradeIndex = new Map(previousPeriodTradeIds.map((tradeId, index) => [tradeId, index + 1] as const))

  const currentSessionScope = sessionHistory.find((session) => session.session_id === currentContext.session_id)
    ?? {
      session_id: currentContext.session_id,
      contract_id: currentContext.contract_id,
      period_id: currentContext.period_id,
      period_label: currentContext.period_id,
      session_title: loadSessionScope(db, currentContext.session_id).session.title,
      started_at: loadSessionScope(db, currentContext.session_id).session.started_at,
    }

  const currentOption = currentContext.trade_id
    ? (() => {
      const trade = (tradesBySession.get(currentContext.session_id) ?? []).find((item) => item.id === currentContext.trade_id)
      return trade
        ? buildTradeOption({
          trade,
          contract_id: currentSessionScope.contract_id,
          period_id: currentSessionScope.period_id,
          period_label: currentSessionScope.period_label,
          session_title: currentSessionScope.session_title,
          is_current: true,
          previous_period_trade_index: previousPeriodTradeIndex.get(trade.id) ?? null,
        })
        : buildSessionOption({
          ...currentSessionScope,
          is_current: true,
        })
    })()
    : buildSessionOption({
      ...currentSessionScope,
      is_current: true,
    })

  const recentSessionOptions = sessionHistory
    .filter((session) => session.session_id !== currentContext.session_id)
    .slice(0, 3)
    .map((session) => buildSessionOption({
      ...session,
      is_current: false,
    }))

  const recentTradeOptions = sessionHistory
    .flatMap((session) => (tradesBySession.get(session.session_id) ?? []).map((trade) => ({ session, trade })))
    .filter(({ trade }) => trade.id !== currentContext.trade_id)
    .slice(0, 5)
    .map(({ session, trade }) => buildTradeOption({
      trade,
      contract_id: session.contract_id,
      period_id: session.period_id,
      period_label: session.period_label,
      session_title: session.session_title,
      is_current: false,
      previous_period_trade_index: previousPeriodTradeIndex.get(trade.id) ?? null,
    }))

  const historyOptions = sessionHistory.flatMap((session) => {
    const sessionOption = buildSessionOption({
      ...session,
      is_current: currentContext.trade_id == null && currentContext.session_id === session.session_id,
      depth: 0,
    })
    const tradeOptions = [...(tradesBySession.get(session.session_id) ?? [])]
      .sort((left, right) => new Date(left.opened_at).getTime() - new Date(right.opened_at).getTime())
      .map((trade) => buildTradeOption({
        trade,
        contract_id: session.contract_id,
        period_id: session.period_id,
        period_label: session.period_label,
        session_title: session.session_title,
        is_current: currentContext.trade_id === trade.id,
        depth: 1,
        parent_target_id: sessionOption.id,
        previous_period_trade_index: previousPeriodTradeIndex.get(trade.id) ?? null,
      }))
    return [sessionOption, ...tradeOptions]
  })

  const previousPeriodTrades = sessionHistory
    .flatMap((session) => (tradesBySession.get(session.session_id) ?? []).map((trade) => ({ session, trade })))
    .filter(({ trade }) => previousPeriodTradeIndex.has(trade.id))
    .sort((left, right) => (previousPeriodTradeIndex.get(left.trade.id) ?? 0) - (previousPeriodTradeIndex.get(right.trade.id) ?? 0))
    .map(({ session, trade }) => buildTradeOption({
      trade,
      contract_id: session.contract_id,
      period_id: session.period_id,
      period_label: session.period_label,
      session_title: session.session_title,
      is_current: currentContext.trade_id === trade.id,
      previous_period_trade_index: previousPeriodTradeIndex.get(trade.id) ?? null,
    }))

  const periodOptions = input?.include_period_targets
    ? sessionHistory.reduce<CurrentTargetOption[]>((list, session) => {
      if (list.some((item) => item.period_id === session.period_id && item.target_kind === 'period')) {
        return list
      }
      list.push(buildPeriodOption({
        period_id: session.period_id,
        period_label: session.period_label,
        contract_id: session.contract_id,
        session_id: session.session_id,
        session_title: session.session_title,
      }))
      return list
    }, [])
    : []

  const groups = TargetOptionGroupsSchema.parse({
    current: [currentOption],
    recent: [...recentSessionOptions, ...recentTradeOptions].slice(0, 8),
    history: [...periodOptions, ...historyOptions],
    previous_period_trades: previousPeriodTrades,
  })

  return CurrentTargetOptionsPayloadSchema.parse({
    current_context: currentContext,
    options: toTargetCatalog(groups),
    groups,
  })
}

export const loadRealtimeViewBlockForCurrentContext = (
  db: Database.Database,
  currentContext: CurrentContext,
) => {
  const contextType = currentContext.trade_id ? 'trade' : 'session'
  const contextId = currentContext.trade_id ?? currentContext.session_id
  const row = db.prepare(`
    SELECT * FROM content_blocks
    WHERE session_id = ? AND context_type = ? AND context_id = ? AND title = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(currentContext.session_id, contextType, contextId, REALTIME_VIEW_TITLE) as Record<string, unknown> | undefined

  return row
}
