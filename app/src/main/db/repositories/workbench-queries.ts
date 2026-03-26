import type Database from 'better-sqlite3'
import type { AiRecordChain, PeriodReviewPayload, SessionWorkbenchPayload, TradeDetailPayload } from '@shared/contracts/workbench'
import { AiRecordChainSchema, PeriodReviewPayloadSchema, SessionWorkbenchPayloadSchema, TradeDetailPayloadSchema } from '@shared/contracts/workbench'
import { resolveTradeForCurrentContext, type CurrentContext, type CurrentTargetOption, type TargetOptionGroups } from '@shared/contracts/current-context'
import { REALTIME_VIEW_TITLE, getFirstId, groupAnnotations, resolveDefaultSessionId, selectRows } from '@main/db/repositories/workbench-utils'
import {
  mapAiRun,
  mapAnalysisCard,
  mapAnnotation,
  mapContentBlock,
  mapContract,
  mapEvaluation,
  mapEvent,
  mapPeriod,
  mapScreenshot,
  mapSession,
  mapTrade,
} from '@main/db/repositories/workbench-mappers'
import { loadContentBlockMoveHistory, loadContentBlockMoveHistoryForBlock } from '@main/db/repositories/workbench-block-move-history'
import {
  ensureCurrentContext,
  getCurrentContext,
  listCurrentTargetOptions,
  loadRealtimeViewBlockForCurrentContext,
} from '@main/db/repositories/workbench-current-context'
import { TRADE_REVIEW_DRAFT_TITLE } from '@main/db/repositories/workbench-review-drafts'

const loadAnnotationsForScreenshots = (db: Database.Database, screenshotIds: string[]) => {
  if (screenshotIds.length === 0) {
    return {
      active: new Map(),
      deleted: new Map(),
    }
  }

  const placeholders = screenshotIds.map(() => '?').join(', ')
  const annotations = selectRows(
    db,
    `SELECT * FROM annotations WHERE screenshot_id IN (${placeholders}) ORDER BY created_at ASC`,
    screenshotIds,
  ).map(mapAnnotation)

  return {
    active: groupAnnotations(annotations.filter((annotation) => annotation.deleted_at == null)),
    deleted: groupAnnotations(annotations.filter((annotation) => annotation.deleted_at != null)),
  }
}

export const loadAnnotationById = (db: Database.Database, annotationId: string) => {
  const row = db.prepare('SELECT * FROM annotations WHERE id = ? LIMIT 1').get(annotationId) as Record<string, unknown> | undefined
  if (!row) {
    throw new Error(`未找到标注 ${annotationId}。`)
  }

  return mapAnnotation(row)
}

export const loadAiRecordChainByAiRunId = (db: Database.Database, aiRunId: string): AiRecordChain => {
  const aiRunRow = db.prepare('SELECT * FROM ai_runs WHERE id = ? LIMIT 1').get(aiRunId) as Record<string, unknown> | undefined
  if (!aiRunRow) {
    throw new Error(`未找到 AI 记录 ${aiRunId}。`)
  }

  const aiRun = mapAiRun(aiRunRow)
  const analysisCardRow = db.prepare(`
    SELECT * FROM analysis_cards
    WHERE ai_run_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(aiRunId) as Record<string, unknown> | undefined
  const eventRow = db.prepare(`
    SELECT * FROM events
    WHERE ai_run_id = ?
    ORDER BY occurred_at DESC
    LIMIT 1
  `).get(aiRunId) as Record<string, unknown> | undefined
  const contentBlockRow = eventRow
    ? db.prepare(`
      SELECT * FROM content_blocks
      WHERE event_id = ?
      ORDER BY sort_order ASC, created_at ASC
      LIMIT 1
    `).get(eventRow.id) as Record<string, unknown> | undefined
    : undefined

  return AiRecordChainSchema.parse({
    ai_run: aiRun,
    analysis_card: analysisCardRow ? mapAnalysisCard(analysisCardRow) : null,
    event: eventRow ? mapEvent(eventRow) : null,
    content_block: contentBlockRow ? mapContentBlock(contentBlockRow) : null,
  })
}

export const loadTradeById = (db: Database.Database, tradeId: string) => {
  const row = db.prepare('SELECT * FROM trades WHERE id = ? LIMIT 1').get(tradeId) as Record<string, unknown> | undefined
  if (!row) {
    throw new Error(`未找到交易 ${tradeId}。`)
  }

  return mapTrade(row)
}

const loadTradeScreenshots = (db: Database.Database, tradeId: string) => {
  const screenshotRows = selectRows(db, `
    SELECT screenshots.*
    FROM screenshots
    INNER JOIN events ON events.id = screenshots.event_id
    WHERE events.trade_id = ? AND events.deleted_at IS NULL AND screenshots.deleted_at IS NULL
    ORDER BY events.occurred_at ASC, screenshots.created_at ASC
  `, [tradeId])
  const screenshotIds = screenshotRows.map((row) => String(row.id))
  const annotationsByShot = loadAnnotationsForScreenshots(db, screenshotIds)

  return screenshotRows.map((row) => mapScreenshot(row, annotationsByShot.active, annotationsByShot.deleted))
}

type PeriodReviewInsightsInput = Pick<
  PeriodReviewPayload,
  'evaluation_rollup' | 'feedback_items' | 'rule_rollup' | 'setup_leaderboard' | 'profile_snapshot' | 'training_insights'
>

const buildEmptyPeriodReviewInsights = (): PeriodReviewInsightsInput => ({
  evaluation_rollup: {
    calibration_buckets: [],
    ai_vs_human: [],
    error_patterns: [],
    effective_knowledge: [],
    pending_count: 0,
    evaluated_count: 0,
  },
  feedback_items: [],
  rule_rollup: [],
  setup_leaderboard: [],
  profile_snapshot: null,
  training_insights: [],
})

const loadTradeContentBlocks = (db: Database.Database, sessionId: string, tradeId: string) => (
  selectRows(db, `
    SELECT DISTINCT content_blocks.*
    FROM content_blocks
    LEFT JOIN events ON events.id = content_blocks.event_id
    WHERE content_blocks.session_id = ?
      AND content_blocks.soft_deleted = 0
      AND content_blocks.deleted_at IS NULL
      AND (
        (content_blocks.context_type = 'trade' AND content_blocks.context_id = ?)
        OR (content_blocks.context_type = 'event' AND events.trade_id = ? AND events.deleted_at IS NULL)
      )
    ORDER BY COALESCE(events.occurred_at, content_blocks.created_at) ASC, content_blocks.sort_order ASC, content_blocks.created_at ASC
  `, [sessionId, tradeId, tradeId]).map(mapContentBlock)
)

const loadPeriodContentBlocks = (db: Database.Database, periodId: string) => (
  selectRows(db, `
    SELECT content_blocks.*
    FROM content_blocks
    INNER JOIN sessions ON sessions.id = content_blocks.session_id
    WHERE content_blocks.context_type = 'period'
      AND content_blocks.context_id = ?
      AND content_blocks.soft_deleted = 0
      AND content_blocks.deleted_at IS NULL
      AND sessions.deleted_at IS NULL
    ORDER BY content_blocks.sort_order ASC, content_blocks.created_at ASC
  `, [periodId]).map(mapContentBlock)
)

const groupTradeScreenshots = (
  trade: ReturnType<typeof loadTradeById>,
  relatedEvents: ReturnType<typeof mapEvent>[],
  screenshots: ReturnType<typeof loadTradeScreenshots>,
) => {
  const eventById = new Map(relatedEvents.map((event) => [event.id, event]))
  const exitScreenshots = screenshots.filter((screenshot) => screenshot.kind === 'exit')
  const nonExitScreenshots = screenshots.filter((screenshot) => screenshot.kind !== 'exit')
  const tradeOpenedAt = new Date(trade.opened_at).getTime()

  let setupScreenshots = nonExitScreenshots.filter((screenshot) => {
    const occurredAt = screenshot.event_id
      ? eventById.get(screenshot.event_id)?.occurred_at
      : screenshot.created_at
    return occurredAt ? new Date(occurredAt).getTime() <= tradeOpenedAt : false
  })

  if (setupScreenshots.length === 0 && nonExitScreenshots.length > 0) {
    setupScreenshots = [nonExitScreenshots[0]]
  }

  const setupIds = new Set(setupScreenshots.map((screenshot) => screenshot.id))
  const exitIds = new Set(exitScreenshots.map((screenshot) => screenshot.id))
  const manageScreenshots = screenshots.filter((screenshot) => !setupIds.has(screenshot.id) && !exitIds.has(screenshot.id))

  return {
    setupScreenshots,
    manageScreenshots,
    exitScreenshots,
  }
}

const selectPreferredSetupScreenshot = (screenshots: ReturnType<typeof loadTradeScreenshots>) =>
  screenshots.find((screenshot) => screenshot.kind === 'chart')
  ?? screenshots[0]
  ?? null

const selectPreferredExitScreenshot = (screenshots: ReturnType<typeof loadTradeScreenshots>) =>
  screenshots.find((screenshot) => screenshot.kind === 'exit')
  ?? screenshots[screenshots.length - 1]
  ?? null

const splitTradeContentBlocks = (
  contentBlocks: ReturnType<typeof mapContentBlock>[],
  relatedEvents: ReturnType<typeof mapEvent>[],
  reviewDraftBlock: ReturnType<typeof mapContentBlock> | null,
) => {
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
    originalPlanBlocks,
    reviewBlocks,
  }
}

const resolvePeriodReviewContract = (db: Database.Database, sessionContractId?: string) => {
  const contractId = sessionContractId
    ?? (db.prepare('SELECT id FROM contracts ORDER BY created_at ASC LIMIT 1').get() as { id: string } | undefined)?.id

  if (!contractId) {
    throw new Error('当前没有可用于周期复盘的 Contract。')
  }

  return mapContract(db.prepare('SELECT * FROM contracts WHERE id = ? LIMIT 1').get(contractId) as Record<string, unknown>)
}

const selectPeriodHighlightCards = (analysisCards: ReturnType<typeof mapAnalysisCard>[]) => (
  [...analysisCards]
    .sort((left, right) => {
      const tradeScore = Number(right.trade_id != null) - Number(left.trade_id != null)
      if (tradeScore !== 0) {
        return tradeScore
      }

      const confidenceScore = (right.confidence_pct ?? -1) - (left.confidence_pct ?? -1)
      if (confidenceScore !== 0) {
        return confidenceScore
      }

      return new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
    })
    .slice(0, 3)
)

const attachMoveHistory = (
  db: Database.Database,
  blocks: ReturnType<typeof mapContentBlock>[],
) => {
  const historyByBlock = loadContentBlockMoveHistory(db, blocks.map((block) => block.id))
  return blocks.map((block) => ({
    ...block,
    move_history: historyByBlock.get(block.id) ?? [],
  }))
}

export const loadSessionWorkbench = (
  db: Database.Database,
  sessionId?: string,
  input?: {
    current_context?: CurrentContext
    target_options?: CurrentTargetOption[]
    target_option_groups?: TargetOptionGroups
  },
): SessionWorkbenchPayload => {
  const resolvedSessionId = sessionId ?? resolveDefaultSessionId(db)
  const currentContext = input?.current_context ?? ensureCurrentContext(db, {
    session_id: resolvedSessionId,
    source_view: 'session-workbench',
  })
  const targetPayload = listCurrentTargetOptions(db, {
    session_id: currentContext.session_id,
    include_period_targets: false,
  })
  const targetOptions = input?.target_options ?? targetPayload.options
  const targetOptionGroups = input?.target_option_groups ?? targetPayload.groups
  const session = mapSession(db.prepare('SELECT * FROM sessions WHERE id = ? LIMIT 1').get(resolvedSessionId) as Record<string, unknown>)
  const contract = mapContract(db.prepare('SELECT * FROM contracts WHERE id = ? LIMIT 1').get(session.contract_id) as Record<string, unknown>)
  const period = mapPeriod(db.prepare('SELECT * FROM periods WHERE id = ? LIMIT 1').get(session.period_id) as Record<string, unknown>)
  const trades = selectRows(db, 'SELECT * FROM trades WHERE session_id = ? AND deleted_at IS NULL ORDER BY opened_at ASC', [session.id]).map(mapTrade)
  const events = selectRows(db, 'SELECT * FROM events WHERE session_id = ? AND deleted_at IS NULL ORDER BY occurred_at ASC', [session.id]).map(mapEvent)
  const contentBlocks = attachMoveHistory(
    db,
    selectRows(db, 'SELECT * FROM content_blocks WHERE session_id = ? ORDER BY sort_order ASC, created_at ASC', [session.id]).map(mapContentBlock),
  )
  const aiRuns = selectRows(db, 'SELECT * FROM ai_runs WHERE session_id = ? AND deleted_at IS NULL ORDER BY created_at ASC', [session.id]).map(mapAiRun)
  const analysisCards = selectRows(db, 'SELECT * FROM analysis_cards WHERE session_id = ? AND deleted_at IS NULL ORDER BY created_at ASC', [session.id]).map(mapAnalysisCard)
  const deletedAiRuns = selectRows(db, 'SELECT id FROM ai_runs WHERE session_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC, created_at DESC', [session.id])
    .map((row) => String(row.id))
  const evaluations = selectRows(db, 'SELECT * FROM evaluations WHERE session_id = ? AND deleted_at IS NULL ORDER BY created_at ASC', [session.id]).map(mapEvaluation)
  const screenshotRows = selectRows(db, 'SELECT * FROM screenshots WHERE session_id = ? ORDER BY created_at ASC', [session.id])
  const screenshotIds = screenshotRows.map((row) => String(row.id))
  const annotationsByShot = loadAnnotationsForScreenshots(db, screenshotIds)
  const screenshots = screenshotRows
    .filter((row) => row.deleted_at == null)
    .map((row) => mapScreenshot(row, annotationsByShot.active, annotationsByShot.deleted))
  const deletedScreenshots = screenshotRows
    .filter((row) => row.deleted_at != null)
    .map((row) => mapScreenshot(row, annotationsByShot.active, annotationsByShot.deleted))
  const realtimeViewBlockRow = loadRealtimeViewBlockForCurrentContext(db, currentContext)
  const realtimeViewBlock = realtimeViewBlockRow ? mapContentBlock(realtimeViewBlockRow) : null

  return SessionWorkbenchPayloadSchema.parse({
    contract,
    period,
    session,
    trades,
    events,
    screenshots,
    deleted_screenshots: deletedScreenshots,
    content_blocks: contentBlocks,
    ai_runs: aiRuns,
    analysis_cards: analysisCards,
    deleted_ai_records: deletedAiRuns.map((aiRunId) => loadAiRecordChainByAiRunId(db, aiRunId)),
    evaluations,
    panels: {
      my_realtime_view: realtimeViewBlock?.content_md ?? (currentContext.trade_id ? '' : session.my_realtime_view),
      ai_summary: analysisCards[analysisCards.length - 1]?.summary_short ?? '还没有 AI 摘要。',
      trade_plan: session.trade_plan_md,
    },
    composer_shell: {
      active_anchor_labels: [],
      active_anchors: [],
      approved_knowledge_hits: [],
      suggestions: [],
      context_summary: '当前没有可用的 approved knowledge。',
    },
    context_memory: {
      active_anchors: [],
      latest_grounding_hits: [],
    },
    suggestion_layer: {
      annotation_suggestions: [],
      anchor_review_suggestions: [],
      similar_cases: [],
    },
    current_context: currentContext,
    target_options: targetOptions,
    target_option_groups: targetOptionGroups,
  })
}

export const loadTradeDetail = (db: Database.Database, tradeId?: string): TradeDetailPayload => {
  const allTrades = selectRows(db, 'SELECT * FROM trades WHERE deleted_at IS NULL ORDER BY opened_at ASC').map(mapTrade)
  const currentContext = getCurrentContext(db)
  const resolvedTradeId = tradeId ?? resolveTradeForCurrentContext(allTrades, currentContext.trade_id)?.id ?? getFirstId(db, 'trades', 'opened_at')
  const trade = loadTradeById(db, resolvedTradeId)
  const session = mapSession(db.prepare('SELECT * FROM sessions WHERE id = ? LIMIT 1').get(trade.session_id) as Record<string, unknown>)
  const relatedEvents = selectRows(db, 'SELECT * FROM events WHERE trade_id = ? AND deleted_at IS NULL ORDER BY occurred_at ASC', [trade.id]).map(mapEvent)
  const analysisCards = selectRows(db, 'SELECT * FROM analysis_cards WHERE trade_id = ? AND deleted_at IS NULL ORDER BY created_at ASC', [trade.id]).map(mapAnalysisCard)
  const screenshots = loadTradeScreenshots(db, trade.id)
  const contentBlocks = attachMoveHistory(db, loadTradeContentBlocks(db, trade.session_id, trade.id))
  const executionEvents = relatedEvents.filter((event) => event.event_type.startsWith('trade_'))
  const { setupScreenshots, manageScreenshots, exitScreenshots } = groupTradeScreenshots(trade, relatedEvents, screenshots)
  const reviewDraftBlock = [...contentBlocks]
    .reverse()
    .find((block) => block.context_type === 'trade' && block.context_id === trade.id && block.title === TRADE_REVIEW_DRAFT_TITLE)
    ?? null
  const { originalPlanBlocks, reviewBlocks } = splitTradeContentBlocks(contentBlocks, relatedEvents, reviewDraftBlock)
  const evaluationRow = db.prepare('SELECT * FROM evaluations WHERE trade_id = ? AND deleted_at IS NULL LIMIT 1').get(trade.id) as Record<string, unknown> | undefined

  return TradeDetailPayloadSchema.parse({
    session,
    trade,
    related_events: relatedEvents,
    analysis_cards: analysisCards,
    latest_analysis_card: analysisCards[analysisCards.length - 1] ?? null,
    screenshots,
    setup_screenshot: selectPreferredSetupScreenshot(setupScreenshots),
    setup_screenshots: setupScreenshots,
    manage_screenshots: manageScreenshots,
    exit_screenshot: selectPreferredExitScreenshot(exitScreenshots),
    exit_screenshots: exitScreenshots,
    content_blocks: contentBlocks,
    original_plan_blocks: originalPlanBlocks,
    linked_ai_cards: analysisCards,
    execution_events: executionEvents,
    review_blocks: reviewBlocks,
    review_draft_block: reviewDraftBlock,
    review_sections: {
      deviation_analysis: [],
      result_assessment: [],
      next_improvements: [],
    },
    evaluation: evaluationRow ? mapEvaluation(evaluationRow) : null,
    evaluation_summary: null,
    feedback_items: [],
    discipline_score: null,
    rule_hits: [],
  })
}

export const loadPeriodReview = (
  db: Database.Database,
  periodId?: string,
  input?: Partial<PeriodReviewInsightsInput>,
): PeriodReviewPayload => {
  const resolvedPeriodId = periodId ?? getFirstId(db, 'periods', 'start_at')
  const period = mapPeriod(db.prepare('SELECT * FROM periods WHERE id = ? LIMIT 1').get(resolvedPeriodId) as Record<string, unknown>)
  const sessions = selectRows(db, 'SELECT * FROM sessions WHERE period_id = ? AND deleted_at IS NULL ORDER BY started_at ASC', [period.id]).map(mapSession)
  const contract = resolvePeriodReviewContract(db, sessions[0]?.contract_id)
  const sessionIds = sessions.map((session) => session.id)
  const placeholders = sessionIds.map(() => '?').join(', ')
  const analysisCards = sessionIds.length === 0
    ? []
    : selectRows(db, `SELECT * FROM analysis_cards WHERE session_id IN (${placeholders}) AND deleted_at IS NULL ORDER BY created_at ASC`, sessionIds).map(mapAnalysisCard)
  const evaluations = sessionIds.length === 0
    ? []
    : selectRows(db, `SELECT * FROM evaluations WHERE session_id IN (${placeholders}) AND deleted_at IS NULL ORDER BY created_at ASC`, sessionIds).map(mapEvaluation)
  const contentBlocks = attachMoveHistory(db, loadPeriodContentBlocks(db, period.id))
  const insights = {
    ...buildEmptyPeriodReviewInsights(),
    ...input,
  }

  return PeriodReviewPayloadSchema.parse({
    period,
    contract,
    sessions,
    highlight_cards: selectPeriodHighlightCards(analysisCards),
    evaluations,
    content_blocks: contentBlocks,
    ...insights,
  })
}

export const loadContentBlockById = (db: Database.Database, blockId: string) => {
  const row = db.prepare('SELECT * FROM content_blocks WHERE id = ? LIMIT 1').get(blockId) as Record<string, unknown> | undefined
  if (!row) {
    throw new Error(`未找到内容块 ${blockId}。`)
  }

  return mapContentBlock({
    ...row,
    move_history: loadContentBlockMoveHistoryForBlock(db, blockId),
  })
}

export const loadSessionRealtimeViewBlock = (db: Database.Database, sessionId: string) => {
  const row = db.prepare(`
    SELECT * FROM content_blocks
    WHERE session_id = ? AND context_type = 'session' AND context_id = ? AND title = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(sessionId, sessionId, REALTIME_VIEW_TITLE) as Record<string, unknown> | undefined

  return row ? mapContentBlock(row) : null
}

export const loadScreenshotById = (db: Database.Database, screenshotId: string) => {
  const screenshotRow = db.prepare('SELECT * FROM screenshots WHERE id = ? LIMIT 1').get(screenshotId) as Record<string, unknown> | undefined
  if (!screenshotRow) {
    throw new Error(`未找到截图 ${screenshotId}。`)
  }

  const annotations = selectRows(db, 'SELECT * FROM annotations WHERE screenshot_id = ? ORDER BY created_at ASC', [screenshotId]).map(mapAnnotation)
  return mapScreenshot(
    screenshotRow,
    groupAnnotations(annotations.filter((annotation) => annotation.deleted_at == null)),
    groupAnnotations(annotations.filter((annotation) => annotation.deleted_at != null)),
  )
}
