import type { AnalysisCardRecord } from '@shared/contracts/analysis'
import type { ContentBlockRecord, ScreenshotRecord } from '@shared/contracts/content'
import type { EventRecord } from '@shared/contracts/event'
import type { SessionWorkbenchPayload } from '@shared/contracts/workbench'
import type { TradeRecord } from '@shared/contracts/trade'

export const MOCK_TRADE_REVIEW_DRAFT_TITLE = 'Exit review draft'
const MOCK_TRADE_REVIEW_EVENT_TITLE = 'Trade review draft'

const compact = (value: string | null | undefined, fallback = '待补充') => {
  const text = value?.replace(/\s+/g, ' ').trim()
  return text && text.length > 0 ? text : fallback
}

const excerpt = (value: string | null | undefined) => {
  const text = compact(value, '')
  if (!text) {
    return '待补充'
  }

  return text.length > 120 ? `${text.slice(0, 117)}...` : text
}

const eventTypeLabels = {
  trade_open: '开仓',
  trade_add: '加仓',
  trade_reduce: '减仓',
  trade_close: '平仓',
} as const

const groupTradeScreenshots = (
  trade: TradeRecord,
  relatedEvents: EventRecord[],
  screenshots: ScreenshotRecord[],
) => {
  const eventById = new Map(relatedEvents.map((event) => [event.id, event]))
  const exitScreenshots = screenshots.filter((screenshot) => screenshot.kind === 'exit')
  const nonExitScreenshots = screenshots.filter((screenshot) => screenshot.kind !== 'exit')
  const openedAt = new Date(trade.opened_at).getTime()

  let setupScreenshots = nonExitScreenshots.filter((screenshot) => {
    const occurredAt = screenshot.event_id
      ? eventById.get(screenshot.event_id)?.occurred_at
      : screenshot.created_at
    return occurredAt ? new Date(occurredAt).getTime() <= openedAt : false
  })

  if (setupScreenshots.length === 0 && nonExitScreenshots.length > 0) {
    setupScreenshots = [nonExitScreenshots[0]]
  }

  const setupIds = new Set(setupScreenshots.map((screenshot) => screenshot.id))
  const exitIds = new Set(exitScreenshots.map((screenshot) => screenshot.id))
  const manageScreenshots = screenshots.filter((screenshot) => !setupIds.has(screenshot.id) && !exitIds.has(screenshot.id))

  return {
    setup_screenshots: setupScreenshots,
    manage_screenshots: manageScreenshots,
    exit_screenshots: exitScreenshots,
  }
}

const selectPreferredSetupScreenshot = (screenshots: ScreenshotRecord[]) =>
  screenshots.find((screenshot) => screenshot.kind === 'chart')
  ?? screenshots[0]
  ?? null

const selectPreferredExitScreenshot = (screenshots: ScreenshotRecord[]) =>
  screenshots.find((screenshot) => screenshot.kind === 'exit')
  ?? screenshots[screenshots.length - 1]
  ?? null

const buildMockTradeReviewDraftMarkdown = (
  payload: SessionWorkbenchPayload,
  trade: TradeRecord,
  contentBlocks: ContentBlockRecord[],
  executionEvents: EventRecord[],
  latestAnalysisCard: AnalysisCardRecord | null,
  exitScreenshots: ScreenshotRecord[],
) => {
  const originalBlocks = contentBlocks
    .filter((block) => block.title !== MOCK_TRADE_REVIEW_DRAFT_TITLE)
    .filter((block) => block.block_type !== 'ai-summary')
    .slice(0, 4)
  const executionLines = executionEvents.length > 0
    ? executionEvents.map((event) => `- ${eventTypeLabels[event.event_type as keyof typeof eventTypeLabels] ?? event.event_type}: ${event.summary}`)
    : ['- 暂无执行事件。']
  const resultLine = trade.status === 'closed'
    ? `- 当前结果：已平仓，平仓价 ${trade.exit_price ?? '待补充'}，PnL ${trade.pnl_r ?? '待补充'}R。`
    : '- 当前结果：交易尚未闭环，结果待确认。'
  const exitLine = exitScreenshots.length > 0
    ? `- Exit 图：已记录 ${exitScreenshots.length} 张。`
    : '- Exit 图：尚未补齐。'
  const originalRecordLines = originalBlocks.length > 0
    ? originalBlocks.map((block) => `- ${block.title}: ${excerpt(block.content_md)}`)
    : ['- 暂无额外的 trade 原始记录。']

  return [
    '# Exit review draft',
    '',
    '> 这是一份自动生成的复盘草稿，不会覆盖你的原始记录。',
    '',
    '## 计划 vs 实际 vs 结果',
    '',
    '### 原始计划',
    '',
    '#### Trade thesis',
    trade.thesis.trim() || '待补充',
    '',
    '#### Session trade plan',
    payload.session.trade_plan_md.trim() || '待补充',
    '',
    '#### 原始记录',
    ...originalRecordLines,
    '',
    '### AI 当时建议',
    latestAnalysisCard
      ? `- ${compact(latestAnalysisCard.summary_short)}`
      : '- 当时没有关联 AI 建议。',
    '',
    '### 实际执行',
    ...executionLines,
    resultLine,
    exitLine,
    '',
    '## 偏差',
    '',
    '- 计划与执行之间的主要偏差：待补充',
    '- 哪个判断在盘中发生了变化：待补充',
    '- 哪个风险控制动作做得不够：待补充',
    '',
    '## 下次改进',
    '',
    '- 下次还会保留的动作：待补充',
    '- 下次必须提前规避的问题：待补充',
    '- 需要补充验证的 setup / 管理规则：待补充',
  ].join('\n')
}

export const buildMockTradeThread = (payload: SessionWorkbenchPayload, tradeId: string) => {
  const trade = payload.trades.find((item) => item.id === tradeId)
  if (!trade) {
    throw new Error(`Missing mock trade ${tradeId}.`)
  }

  const relatedEvents = payload.events
    .filter((event) => event.trade_id === tradeId && !event.deleted_at)
    .sort((left, right) => left.occurred_at.localeCompare(right.occurred_at))
  const relatedEventIds = new Set(relatedEvents.map((event) => event.id))
  const analysisCards = payload.analysis_cards
    .filter((card) => card.trade_id === tradeId && !card.deleted_at)
    .sort((left, right) => left.created_at.localeCompare(right.created_at))
  const screenshots = payload.screenshots.filter((screenshot) => screenshot.event_id && relatedEventIds.has(screenshot.event_id))
  const contentBlocks = payload.content_blocks.filter((block) =>
    !block.soft_deleted
    && !block.deleted_at
    && (
      (block.context_type === 'trade' && block.context_id === tradeId)
      || (block.event_id && relatedEventIds.has(block.event_id))
    ))
  const executionEvents = relatedEvents.filter((event) => event.event_type.startsWith('trade_'))
  const latestAnalysisCard = analysisCards[analysisCards.length - 1] ?? null
  const screenshotGroups = groupTradeScreenshots(trade, relatedEvents, screenshots)
  const reviewDraftBlock = [...contentBlocks]
    .reverse()
    .find((block) => block.context_type === 'trade' && block.context_id === tradeId && block.title === MOCK_TRADE_REVIEW_DRAFT_TITLE)
    ?? null
  const reviewEventIds = new Set(
    relatedEvents
      .filter((event) => event.event_type === 'review')
      .map((event) => event.id),
  )
  const reviewBlocks = contentBlocks.filter((block) =>
    block.id === reviewDraftBlock?.id
    || (block.event_id != null && reviewEventIds.has(block.event_id)),
  )
  const reviewBlockIds = new Set(reviewBlocks.map((block) => block.id))
  const originalPlanBlocks = contentBlocks.filter((block) =>
    block.block_type !== 'ai-summary'
    && !reviewBlockIds.has(block.id),
  )

  return {
    related_events: relatedEvents,
    analysis_cards: analysisCards,
    latest_analysis_card: latestAnalysisCard,
    screenshots,
    setup_screenshot: selectPreferredSetupScreenshot(screenshotGroups.setup_screenshots),
    content_blocks: contentBlocks,
    original_plan_blocks: originalPlanBlocks,
    linked_ai_cards: analysisCards,
    execution_events: executionEvents,
    review_blocks: reviewBlocks,
    review_draft_block: reviewDraftBlock,
    exit_screenshot: selectPreferredExitScreenshot(screenshotGroups.exit_screenshots),
    ...screenshotGroups,
  }
}

export const upsertMockTradeReviewDraft = (payload: SessionWorkbenchPayload, tradeId: string): SessionWorkbenchPayload => {
  const trade = payload.trades.find((item) => item.id === tradeId)
  if (!trade) {
    return payload
  }

  const thread = buildMockTradeThread(payload, tradeId)
  const timestamp = new Date().toISOString()
  const contentMd = buildMockTradeReviewDraftMarkdown(
    payload,
    trade,
    thread.content_blocks,
    thread.execution_events,
    thread.latest_analysis_card,
    thread.exit_screenshots,
  )

  if (thread.review_draft_block) {
    const nextBlock = {
      ...thread.review_draft_block,
      content_md: contentMd,
      deleted_at: null,
      soft_deleted: false,
      updated_at: timestamp,
    }
    const nextEventId = thread.review_draft_block.event_id ?? `event_mock_review_${tradeId}`
    const nextEvent: EventRecord = {
      id: nextEventId,
      schema_version: 1,
      created_at: timestamp,
      deleted_at: null,
      session_id: trade.session_id,
      trade_id: trade.id,
      event_type: 'review',
      title: MOCK_TRADE_REVIEW_EVENT_TITLE,
      summary: '自动生成的离场复盘草稿，供后续补充。',
      author_kind: 'system',
      occurred_at: timestamp,
      content_block_ids: [nextBlock.id],
      screenshot_id: null,
      ai_run_id: null,
    }

    return {
      ...payload,
      content_blocks: payload.content_blocks.map((block) => block.id === nextBlock.id ? nextBlock : block),
      events: payload.events.some((event) => event.id === nextEventId)
        ? payload.events.map((event) => event.id === nextEventId ? nextEvent : event)
        : [...payload.events, nextEvent],
    }
  }

  const blockId = `block_mock_review_${tradeId}_${payload.content_blocks.length + 1}`
  const eventId = `event_mock_review_${tradeId}_${payload.events.length + 1}`
  const block: ContentBlockRecord = {
    id: blockId,
    schema_version: 1,
    created_at: timestamp,
    deleted_at: null,
    session_id: trade.session_id,
    event_id: eventId,
    block_type: 'markdown',
    title: MOCK_TRADE_REVIEW_DRAFT_TITLE,
    content_md: contentMd,
    sort_order: payload.content_blocks.length + 1,
    context_type: 'trade',
    context_id: trade.id,
    soft_deleted: false,
    move_history: [],
  }
  const event: EventRecord = {
    id: eventId,
    schema_version: 1,
    created_at: timestamp,
    deleted_at: null,
    session_id: trade.session_id,
    trade_id: trade.id,
    event_type: 'review',
    title: MOCK_TRADE_REVIEW_EVENT_TITLE,
    summary: '自动生成的离场复盘草稿，供后续补充。',
    author_kind: 'system',
    occurred_at: timestamp,
    content_block_ids: [blockId],
    screenshot_id: null,
    ai_run_id: null,
  }

  return {
    ...payload,
    content_blocks: [...payload.content_blocks, block],
    events: [...payload.events, event],
  }
}
