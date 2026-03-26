import type Database from 'better-sqlite3'
import type { AiRecordChain, PeriodReviewPayload, SessionWorkbenchPayload, TradeDetailPayload } from '@shared/contracts/workbench'
import { AiRecordChainSchema, PeriodReviewPayloadSchema, SessionWorkbenchPayloadSchema, TradeDetailPayloadSchema } from '@shared/contracts/workbench'
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

export const loadSessionWorkbench = (db: Database.Database, sessionId?: string): SessionWorkbenchPayload => {
  const resolvedSessionId = sessionId ?? resolveDefaultSessionId(db)
  const session = mapSession(db.prepare('SELECT * FROM sessions WHERE id = ? LIMIT 1').get(resolvedSessionId) as Record<string, unknown>)
  const contract = mapContract(db.prepare('SELECT * FROM contracts WHERE id = ? LIMIT 1').get(session.contract_id) as Record<string, unknown>)
  const period = mapPeriod(db.prepare('SELECT * FROM periods WHERE id = ? LIMIT 1').get(session.period_id) as Record<string, unknown>)
  const trades = selectRows(db, 'SELECT * FROM trades WHERE session_id = ? AND deleted_at IS NULL ORDER BY opened_at ASC', [session.id]).map(mapTrade)
  const events = selectRows(db, 'SELECT * FROM events WHERE session_id = ? AND deleted_at IS NULL ORDER BY occurred_at ASC', [session.id]).map(mapEvent)
  const contentBlocks = selectRows(db, 'SELECT * FROM content_blocks WHERE session_id = ? ORDER BY sort_order ASC, created_at ASC', [session.id]).map(mapContentBlock)
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
  const realtimeViewBlock = contentBlocks.find((block) =>
    block.context_type === 'session'
    && block.context_id === session.id
    && block.title === REALTIME_VIEW_TITLE
    && !block.soft_deleted)

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
      my_realtime_view: realtimeViewBlock?.content_md ?? session.my_realtime_view,
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
  })
}

export const loadTradeDetail = (db: Database.Database, tradeId?: string): TradeDetailPayload => {
  const resolvedTradeId = tradeId ?? getFirstId(db, 'trades', 'opened_at')
  const trade = mapTrade(db.prepare('SELECT * FROM trades WHERE id = ? LIMIT 1').get(resolvedTradeId) as Record<string, unknown>)
  const session = mapSession(db.prepare('SELECT * FROM sessions WHERE id = ? LIMIT 1').get(trade.session_id) as Record<string, unknown>)
  const relatedEvents = selectRows(db, 'SELECT * FROM events WHERE trade_id = ? AND deleted_at IS NULL ORDER BY occurred_at ASC', [trade.id]).map(mapEvent)
  const analysisCards = selectRows(db, 'SELECT * FROM analysis_cards WHERE trade_id = ? AND deleted_at IS NULL ORDER BY created_at ASC', [trade.id]).map(mapAnalysisCard)
  const evaluationRow = db.prepare('SELECT * FROM evaluations WHERE trade_id = ? AND deleted_at IS NULL LIMIT 1').get(trade.id) as Record<string, unknown> | undefined

  return TradeDetailPayloadSchema.parse({
    session,
    trade,
    related_events: relatedEvents,
    analysis_cards: analysisCards,
    evaluation: evaluationRow ? mapEvaluation(evaluationRow) : null,
    evaluation_summary: null,
    feedback_items: [],
    discipline_score: null,
    rule_hits: [],
  })
}

export const loadPeriodReview = (db: Database.Database, periodId?: string): PeriodReviewPayload => {
  const resolvedPeriodId = periodId ?? getFirstId(db, 'periods', 'start_at')
  const period = mapPeriod(db.prepare('SELECT * FROM periods WHERE id = ? LIMIT 1').get(resolvedPeriodId) as Record<string, unknown>)
  const sessions = selectRows(db, 'SELECT * FROM sessions WHERE period_id = ? AND deleted_at IS NULL ORDER BY started_at ASC', [period.id]).map(mapSession)
  const contract = mapContract(db.prepare('SELECT * FROM contracts WHERE id = ? LIMIT 1').get(sessions[0].contract_id) as Record<string, unknown>)
  const sessionIds = sessions.map((session) => session.id)
  const placeholders = sessionIds.map(() => '?').join(', ')
  const analysisCards = sessionIds.length === 0
    ? []
    : selectRows(db, `SELECT * FROM analysis_cards WHERE session_id IN (${placeholders}) AND deleted_at IS NULL ORDER BY created_at ASC`, sessionIds).map(mapAnalysisCard)
  const evaluations = sessionIds.length === 0
    ? []
    : selectRows(db, `SELECT * FROM evaluations WHERE session_id IN (${placeholders}) AND deleted_at IS NULL ORDER BY created_at ASC`, sessionIds).map(mapEvaluation)

  return PeriodReviewPayloadSchema.parse({
    period,
    contract,
    sessions,
    highlight_cards: analysisCards,
    evaluations,
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
}

export const loadContentBlockById = (db: Database.Database, blockId: string) => {
  const row = db.prepare('SELECT * FROM content_blocks WHERE id = ? LIMIT 1').get(blockId) as Record<string, unknown> | undefined
  if (!row) {
    throw new Error(`未找到内容块 ${blockId}。`)
  }

  return mapContentBlock(row)
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
