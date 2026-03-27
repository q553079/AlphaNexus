import type { ContentBlockMoveAuditRecord, ContentBlockRecord } from '@shared/contracts/content'
import type {
  CurrentContext,
  CurrentTargetOption,
  CurrentTargetOptionsPayload,
  ListTargetOptionsInput,
  TargetOptionGroups,
  SessionWorkbenchPayload,
} from '@shared/contracts/workbench'

const sideLabels = {
  long: '做多',
  short: '做空',
} as const

const statusLabels = {
  planned: '计划中',
  open: '持仓中',
  closed: '已关闭',
  canceled: '已取消',
} as const

const buildSessionOption = (
  payload: SessionWorkbenchPayload,
  input: {
    is_current: boolean
    depth?: number
    parent_target_id?: string | null
  },
): CurrentTargetOption => ({
  id: `target_session_${payload.session.id}`,
  target_kind: 'session',
  contract_id: payload.contract.id,
  period_id: payload.period.id,
  session_id: payload.session.id,
  trade_id: null,
  label: payload.session.title,
  subtitle: `${payload.period.label} · Session 级目标 · ${payload.session.started_at}`,
  is_current: input.is_current,
  trade_status: null,
  trade_side: null,
  depth: input.depth ?? 0,
  parent_target_id: input.parent_target_id ?? null,
  period_label: payload.period.label,
  session_title: payload.session.title,
  search_text: `${payload.contract.symbol} ${payload.period.label} ${payload.session.title} ${payload.session.started_at}`,
  previous_period_trade_index: null,
})

const buildTradeOption = (
  payload: SessionWorkbenchPayload,
  trade: SessionWorkbenchPayload['trades'][number],
  input: {
    is_current: boolean
    depth?: number
    parent_target_id?: string | null
    previous_period_trade_index?: number | null
  },
): CurrentTargetOption => ({
  id: `target_trade_${trade.id}`,
  target_kind: 'trade',
  contract_id: payload.contract.id,
  period_id: payload.period.id,
  session_id: payload.session.id,
  trade_id: trade.id,
  label: `${trade.symbol} ${sideLabels[trade.side]}`,
  subtitle: `${payload.period.label} · ${payload.session.title} · ${statusLabels[trade.status]} · 数量 ${trade.quantity} · 开始 ${trade.opened_at}`,
  is_current: input.is_current,
  trade_status: trade.status,
  trade_side: trade.side,
  depth: input.depth ?? 0,
  parent_target_id: input.parent_target_id ?? null,
  period_label: payload.period.label,
  session_title: payload.session.title,
  search_text: [
    payload.contract.symbol,
    payload.period.label,
    payload.session.title,
    trade.symbol,
    trade.side,
    trade.status,
    trade.thesis,
    trade.opened_at,
    input.previous_period_trade_index != null ? `上一周期 第${input.previous_period_trade_index}笔 trade` : '',
  ].filter(Boolean).join(' '),
  previous_period_trade_index: input.previous_period_trade_index ?? null,
})

const buildPeriodOption = (payload: SessionWorkbenchPayload): CurrentTargetOption => ({
  id: `target_period_${payload.period.id}`,
  target_kind: 'period',
  contract_id: payload.contract.id,
  period_id: payload.period.id,
  session_id: payload.session.id,
  trade_id: null,
  label: payload.period.label,
  subtitle: `Period 级目标 · 代表 Session ${payload.session.title}`,
  is_current: false,
  trade_status: null,
  trade_side: null,
  depth: 0,
  parent_target_id: null,
  period_label: payload.period.label,
  session_title: payload.session.title,
  search_text: `${payload.contract.symbol} ${payload.period.label} ${payload.session.title} period`,
  previous_period_trade_index: null,
})

const sortSessionHistory = (payloads: SessionWorkbenchPayload[]) => (
  [...payloads].sort((left, right) =>
    new Date(right.session.started_at).getTime() - new Date(left.session.started_at).getTime())
)

const sortTradesAscending = (trades: SessionWorkbenchPayload['trades']) => (
  [...trades].sort((left, right) => new Date(left.opened_at).getTime() - new Date(right.opened_at).getTime())
)

const sortTradesDescending = (trades: SessionWorkbenchPayload['trades']) => (
  [...trades].sort((left, right) => new Date(right.opened_at).getTime() - new Date(left.opened_at).getTime())
)

const toCatalog = (groups: TargetOptionGroups) => {
  const catalog = new Map<string, CurrentTargetOption>()
  for (const option of [...groups.current, ...groups.recent, ...groups.history, ...groups.previous_period_trades]) {
    if (!catalog.has(option.id)) {
      catalog.set(option.id, option)
    }
  }
  return [...catalog.values()]
}

export const buildMockTargetOptionsPayload = (
  sessionPayloads: SessionWorkbenchPayload[],
  currentContext: CurrentContext,
  input?: ListTargetOptionsInput,
): CurrentTargetOptionsPayload => {
  const currentPayload = sessionPayloads.find((payload) => payload.session.id === currentContext.session_id) ?? sessionPayloads[0]
  const contractHistory = sortSessionHistory(
    sessionPayloads.filter((payload) => payload.contract.id === currentPayload.contract.id),
  )
  const currentOption = currentContext.trade_id
    ? (() => {
      const currentTrade = currentPayload.trades.find((trade) => trade.id === currentContext.trade_id)
      return currentTrade
        ? buildTradeOption(currentPayload, currentTrade, { is_current: true })
        : buildSessionOption(currentPayload, { is_current: true })
    })()
    : buildSessionOption(currentPayload, { is_current: true })

  const recentSessionOptions = contractHistory
    .filter((payload) => payload.session.id !== currentPayload.session.id)
    .slice(0, 3)
    .map((payload) => buildSessionOption(payload, { is_current: false }))

  const recentTradeOptions = contractHistory
    .flatMap((payload) => sortTradesDescending(payload.trades).map((trade) => ({ payload, trade })))
    .filter(({ trade }) => trade.id !== currentContext.trade_id)
    .slice(0, 5)
    .map(({ payload, trade }) => buildTradeOption(payload, trade, { is_current: false }))

  const currentPeriodStart = new Date(currentPayload.period.start_at).getTime()
  const previousPeriodPayload = contractHistory
    .filter((payload) => new Date(payload.period.start_at).getTime() < currentPeriodStart)
    .sort((left, right) => new Date(right.period.start_at).getTime() - new Date(left.period.start_at).getTime())[0]
  const previousPeriodTradeIndex = new Map<string, number>(
    previousPeriodPayload
      ? sortTradesAscending(
        contractHistory
          .filter((payload) => payload.period.id === previousPeriodPayload.period.id)
          .flatMap((payload) => payload.trades),
      ).map((trade, index) => [trade.id, index + 1] as const)
      : [],
  )

  const historyOptions = contractHistory.flatMap((payload) => {
    const sessionOption = buildSessionOption(payload, {
      is_current: currentContext.trade_id == null && currentContext.session_id === payload.session.id,
      depth: 0,
    })
    const tradeOptions = sortTradesAscending(payload.trades).map((trade) => buildTradeOption(payload, trade, {
      is_current: currentContext.trade_id === trade.id,
      depth: 1,
      parent_target_id: sessionOption.id,
      previous_period_trade_index: previousPeriodTradeIndex.get(trade.id) ?? null,
    }))

    return [sessionOption, ...tradeOptions]
  })

  const previousPeriodTrades = previousPeriodPayload
    ? contractHistory
      .filter((payload) => payload.period.id === previousPeriodPayload.period.id)
      .flatMap((payload) => sortTradesAscending(payload.trades).map((trade) => ({ payload, trade })))
      .sort((left, right) =>
        (previousPeriodTradeIndex.get(left.trade.id) ?? 0) - (previousPeriodTradeIndex.get(right.trade.id) ?? 0))
      .map(({ payload, trade }) => buildTradeOption(payload, trade, {
        is_current: currentContext.trade_id === trade.id,
        previous_period_trade_index: previousPeriodTradeIndex.get(trade.id) ?? null,
      }))
    : []

  const periodOptions = input?.include_period_targets
    ? contractHistory.reduce<CurrentTargetOption[]>((list, payload) => {
      if (!list.some((option) => option.period_id === payload.period.id && option.target_kind === 'period')) {
        list.push(buildPeriodOption(payload))
      }
      return list
    }, [])
    : []

  const groups: TargetOptionGroups = {
    current: [currentOption],
    recent: [...recentSessionOptions, ...recentTradeOptions].slice(0, 8),
    history: [...periodOptions, ...historyOptions],
    previous_period_trades: previousPeriodTrades,
  }

  return {
    current_context: currentContext,
    options: toCatalog(groups),
    groups,
  }
}

const sortContentBlocks = (blocks: ContentBlockRecord[]) => (
  [...blocks].sort((left, right) => {
    const sortOrderDelta = left.sort_order - right.sort_order
    if (sortOrderDelta !== 0) {
      return sortOrderDelta
    }
    return left.created_at.localeCompare(right.created_at)
  })
)

const createMoveAuditRecord = (
  block: ContentBlockRecord,
  target: {
    session_id: string
    context_type: 'session' | 'trade' | 'period'
    context_id: string
  },
  timestamp: string,
): ContentBlockMoveAuditRecord => ({
  id: `block_move_mock_${block.id}_${timestamp}`,
  schema_version: 1,
  block_id: block.id,
  from_context_type: block.context_type,
  from_context_id: block.context_id,
  to_context_type: target.context_type,
  to_context_id: target.context_id,
  from_session_id: block.session_id,
  to_session_id: target.session_id,
  moved_at: timestamp,
})

const resolveMoveTarget = (
  sessionPayloads: SessionWorkbenchPayload[],
  input: {
    target_kind: 'session' | 'trade' | 'period'
    session_id: string
    period_id?: string
    trade_id?: string | null
  },
) => {
  if (input.target_kind === 'session') {
    const payload = sessionPayloads.find((item) => item.session.id === input.session_id)
    if (!payload) {
      throw new Error(`Missing mock session ${input.session_id}.`)
    }
    return {
      payload,
      session_id: payload.session.id,
      context_type: 'session' as const,
      context_id: payload.session.id,
    }
  }

  if (input.target_kind === 'trade') {
    if (!input.trade_id) {
      throw new Error('Moving to a trade target requires trade_id.')
    }
    const payload = sessionPayloads.find((item) => item.trades.some((trade) => trade.id === input.trade_id))
    if (!payload) {
      throw new Error(`Missing mock trade ${input.trade_id}.`)
    }
    return {
      payload,
      session_id: payload.session.id,
      context_type: 'trade' as const,
      context_id: input.trade_id,
    }
  }

  if (!input.period_id) {
    throw new Error('Moving to a period target requires period_id.')
  }
  const payload = sessionPayloads.find((item) => item.session.id === input.session_id && item.period.id === input.period_id)
  if (!payload) {
    throw new Error(`Missing mock period target ${input.period_id}.`)
  }
  return {
    payload,
    session_id: payload.session.id,
    context_type: 'period' as const,
    context_id: payload.period.id,
  }
}

export const moveMockContentBlock = (
  sessionPayloads: SessionWorkbenchPayload[],
  input: {
    block_id: string
    target_kind: 'session' | 'trade' | 'period'
    session_id: string
    period_id?: string
    trade_id?: string | null
  },
  timestamp = new Date().toISOString(),
) => {
  const sourcePayload = sessionPayloads.find((payload) => payload.content_blocks.some((block) => block.id === input.block_id))
  if (!sourcePayload) {
    throw new Error(`Missing mock content block ${input.block_id}.`)
  }
  const existingBlock = sourcePayload.content_blocks.find((block) => block.id === input.block_id)
  if (!existingBlock) {
    throw new Error(`Missing mock content block ${input.block_id}.`)
  }
  if (existingBlock.soft_deleted) {
    throw new Error(`内容块 ${existingBlock.id} 已删除，无法改挂载。`)
  }
  if (existingBlock.block_type === 'ai-summary') {
    throw new Error('AI 摘要块暂不支持改挂载。')
  }
  if (existingBlock.title === 'Realtime view') {
    throw new Error('Realtime view 块暂不支持改挂载。')
  }

  const target = resolveMoveTarget(sessionPayloads, input)
  if (
    existingBlock.session_id === target.session_id
    && existingBlock.context_type === target.context_type
    && existingBlock.context_id === target.context_id
  ) {
    throw new Error('内容块已经挂在目标上下文上。')
  }

  const moveAudit = createMoveAuditRecord(existingBlock, target, timestamp)
  const nextSortOrder = target.payload.content_blocks.reduce(
    (maxSortOrder, block) => Math.max(maxSortOrder, block.id === existingBlock.id ? maxSortOrder : block.sort_order),
    0,
  ) + 1
  const nextBlock: ContentBlockRecord = {
    ...existingBlock,
    session_id: target.session_id,
    event_id: null,
    sort_order: nextSortOrder,
    context_type: target.context_type,
    context_id: target.context_id,
    soft_deleted: false,
    deleted_at: null,
    updated_at: timestamp,
    move_history: [moveAudit, ...(existingBlock.move_history ?? [])],
  }

  const nextSessionPayloads = sessionPayloads.map((payload) => {
    const detachedEvents = payload.events.map((event) => (
      event.id === existingBlock.event_id
        ? { ...event, content_block_ids: event.content_block_ids.filter((blockId) => blockId !== existingBlock.id) }
        : event
    ))

    if (payload.session.id === sourcePayload.session.id && payload.session.id === target.payload.session.id) {
      return {
        ...payload,
        events: detachedEvents,
        content_blocks: sortContentBlocks(payload.content_blocks.map((block) => block.id === existingBlock.id ? nextBlock : block)),
      }
    }

    if (payload.session.id === sourcePayload.session.id) {
      return {
        ...payload,
        events: detachedEvents,
        content_blocks: payload.content_blocks.filter((block) => block.id !== existingBlock.id),
      }
    }

    if (payload.session.id === target.payload.session.id) {
      return {
        ...payload,
        content_blocks: sortContentBlocks([...payload.content_blocks, nextBlock]),
      }
    }

    return payload
  })

  return {
    session_payloads: nextSessionPayloads,
    result: {
      block: nextBlock,
      move_audit: moveAudit,
    },
  }
}
