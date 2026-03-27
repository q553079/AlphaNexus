import type { LocalFirstPaths } from '@main/app-shell/paths'
import { getDatabase } from '@main/db/connection'
import { getFirstId } from '@main/db/repositories/workbench-utils'
import {
  addToTrade,
  cancelTrade,
  closeTrade,
  createWorkbenchNoteBlock,
  createAiAnalysisArtifacts,
  ensureCurrentContext,
  getCurrentContext,
  listCurrentTargetOptions,
  moveContentBlock,
  moveScreenshot,
  openTrade,
  upsertCurrentContext,
  upsertRealtimeViewBlockForCurrentContext,
  setAiRecordDeletedState,
  setAnnotationDeletedState,
  loadPeriodReview,
  loadSessionWorkbench,
  loadTradeDetail,
  reduceTrade,
  setContentBlockDeletedState,
  setScreenshotDeletedState,
  updateAnnotationMetadata,
  updateWorkbenchNoteBlock,
} from '@main/db/repositories/workbench-repository'
import { getTradeEvaluationSummary } from '@main/evaluation/evaluation-service'
import { getTradeFeedbackBundle } from '@main/feedback/feedback-service'
import { buildTradeDetailReviewSections, ensureTradeReviewDraft, getPeriodReviewInsights } from '@main/review/review-service'
import type {
  GetCurrentContextInput,
  ListTargetOptionsInput,
  MoveContentBlockInput,
  MoveScreenshotInput,
  SaveSessionRealtimeViewInput,
  SetCurrentContextInput,
} from '@shared/contracts/workbench'
import { TradeDetailPayloadSchema } from '@shared/contracts/workbench'

const hasOwn = <T extends object>(value: T, key: keyof T) =>
  Object.prototype.hasOwnProperty.call(value, key)

export const fetchSessionWorkbench = async(paths: LocalFirstPaths, sessionId?: string) => {
  const db = await getDatabase(paths)
  const currentContext = ensureCurrentContext(db, {
    session_id: sessionId,
    source_view: 'session-workbench',
  })
  const targetOptions = listCurrentTargetOptions(db, {
    session_id: currentContext.session_id,
    include_period_targets: false,
  })
  return loadSessionWorkbench(db, currentContext.session_id, {
    current_context: currentContext,
    target_options: targetOptions.options,
    target_option_groups: targetOptions.groups,
  })
}

export const fetchTradeDetail = async(paths: LocalFirstPaths, tradeId?: string) => {
  const db = await getDatabase(paths)
  const detail = loadTradeDetail(db, tradeId)
  const evaluationSummary = await getTradeEvaluationSummary(paths, detail.trade.id)
  const feedbackBundle = await getTradeFeedbackBundle(paths, detail.trade.id, {
    detail,
    summary: evaluationSummary,
  })

  return TradeDetailPayloadSchema.parse({
    ...detail,
    evaluation_summary: evaluationSummary,
    feedback_items: feedbackBundle.feedback_items,
    discipline_score: feedbackBundle.discipline_score,
    rule_hits: feedbackBundle.rule_hits,
    review_sections: buildTradeDetailReviewSections({
      detail,
      evaluation_summary: evaluationSummary,
      feedback_items: feedbackBundle.feedback_items,
      discipline_score: feedbackBundle.discipline_score,
      rule_hits: feedbackBundle.rule_hits,
    }),
  })
}

export const fetchPeriodReview = async(paths: LocalFirstPaths, periodId?: string) => {
  const db = await getDatabase(paths)
  const resolvedPeriodId = periodId ?? getFirstId(db, 'periods', 'start_at')
  const insights = await getPeriodReviewInsights(paths, resolvedPeriodId)
  return loadPeriodReview(db, resolvedPeriodId, insights)
}

export const fetchCurrentContext = async(paths: LocalFirstPaths, input?: GetCurrentContextInput) => {
  const db = await getDatabase(paths)
  return getCurrentContext(db, input)
}

export const saveCurrentContext = async(paths: LocalFirstPaths, input: SetCurrentContextInput) => {
  const db = await getDatabase(paths)
  return upsertCurrentContext(db, input)
}

export const fetchTargetOptions = async(paths: LocalFirstPaths, input?: ListTargetOptionsInput) => {
  const db = await getDatabase(paths)
  return listCurrentTargetOptions(db, input)
}

export const createTrade = async(paths: LocalFirstPaths, input: Parameters<typeof openTrade>[1]) => {
  const db = await getDatabase(paths)
  return openTrade(db, input)
}

export const addTradePosition = async(paths: LocalFirstPaths, input: Parameters<typeof addToTrade>[1]) => {
  const db = await getDatabase(paths)
  return addToTrade(db, input)
}

export const reduceTradePosition = async(paths: LocalFirstPaths, input: Parameters<typeof reduceTrade>[1]) => {
  const db = await getDatabase(paths)
  return reduceTrade(db, input)
}

export const closeTradePosition = async(paths: LocalFirstPaths, input: Parameters<typeof closeTrade>[1]) => {
  const db = await getDatabase(paths)
  const result = closeTrade(db, input)
  await ensureTradeReviewDraft(paths, result.trade.id)
  return result
}

export const cancelTradePosition = async(paths: LocalFirstPaths, input: Parameters<typeof cancelTrade>[1]) => {
  const db = await getDatabase(paths)
  const result = cancelTrade(db, input)
  await ensureTradeReviewDraft(paths, result.trade.id)
  return result
}

export const saveSessionRealtimeView = async(paths: LocalFirstPaths, input: SaveSessionRealtimeViewInput) => {
  const db = await getDatabase(paths)
  const existingContext = getCurrentContext(db, {
    session_id: input.session_id,
    source_view: 'session-workbench',
  })
  const currentContext = upsertCurrentContext(db, {
    session_id: input.session_id,
    trade_id: hasOwn(input, 'trade_id') ? input.trade_id ?? null : existingContext.trade_id,
    source_view: 'session-workbench',
    capture_kind: existingContext.capture_kind,
  })
  return upsertRealtimeViewBlockForCurrentContext(db, {
    current_context: currentContext,
    content_md: input.content_md,
  })
}

export const createWorkbenchNote = async(paths: LocalFirstPaths, input: Parameters<typeof createWorkbenchNoteBlock>[1]) => {
  const db = await getDatabase(paths)
  return createWorkbenchNoteBlock(db, input)
}

export const updateWorkbenchNote = async(paths: LocalFirstPaths, input: Parameters<typeof updateWorkbenchNoteBlock>[1]) => {
  const db = await getDatabase(paths)
  return updateWorkbenchNoteBlock(db, input)
}

export const moveWorkbenchContentBlock = async(paths: LocalFirstPaths, input: MoveContentBlockInput) => {
  const db = await getDatabase(paths)
  return moveContentBlock(db, input)
}

export const moveWorkbenchScreenshot = async(
  paths: LocalFirstPaths,
  input: MoveScreenshotInput,
) => {
  const db = await getDatabase(paths)
  return moveScreenshot(db, input)
}

export const deleteContentBlock = async(paths: LocalFirstPaths, blockId: string) => {
  const db = await getDatabase(paths)
  return setContentBlockDeletedState(db, { block_id: blockId, deleted: true })
}

export const restoreContentBlock = async(paths: LocalFirstPaths, blockId: string) => {
  const db = await getDatabase(paths)
  return setContentBlockDeletedState(db, { block_id: blockId, deleted: false })
}

export const deleteScreenshot = async(paths: LocalFirstPaths, screenshotId: string) => {
  const db = await getDatabase(paths)
  return setScreenshotDeletedState(db, { screenshot_id: screenshotId, deleted: true })
}

export const restoreScreenshot = async(paths: LocalFirstPaths, screenshotId: string) => {
  const db = await getDatabase(paths)
  return setScreenshotDeletedState(db, { screenshot_id: screenshotId, deleted: false })
}

export const deleteAnnotation = async(paths: LocalFirstPaths, annotationId: string) => {
  const db = await getDatabase(paths)
  return setAnnotationDeletedState(db, { annotation_id: annotationId, deleted: true })
}

export const restoreAnnotation = async(paths: LocalFirstPaths, annotationId: string) => {
  const db = await getDatabase(paths)
  return setAnnotationDeletedState(db, { annotation_id: annotationId, deleted: false })
}

export const updateAnnotation = async(
  paths: LocalFirstPaths,
  input: Parameters<typeof updateAnnotationMetadata>[1],
) => {
  const db = await getDatabase(paths)
  return updateAnnotationMetadata(db, input)
}

export const deleteAiRecord = async(paths: LocalFirstPaths, aiRunId: string) => {
  const db = await getDatabase(paths)
  return setAiRecordDeletedState(db, { ai_run_id: aiRunId, deleted: true })
}

export const restoreAiRecord = async(paths: LocalFirstPaths, aiRunId: string) => {
  const db = await getDatabase(paths)
  return setAiRecordDeletedState(db, { ai_run_id: aiRunId, deleted: false })
}

export const saveAiAnalysisArtifacts = async(
  paths: LocalFirstPaths,
  input: Parameters<typeof createAiAnalysisArtifacts>[1],
) => {
  const db = await getDatabase(paths)
  return createAiAnalysisArtifacts(db, input)
}
