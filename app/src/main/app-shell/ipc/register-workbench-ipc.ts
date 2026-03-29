import { ipcMain } from 'electron'
import { listAnchorReviewSuggestions, listComposerAiSuggestions, listSimilarCases, runAnnotationSuggestions } from '@main/ai/service'
import { adoptMarketAnchor, buildActiveAnchorRuntimeSummary, getComposerShellData, updatePersistedMarketAnchorStatus } from '@main/domain/knowledge-service'
import { applySuggestionAction } from '@main/domain/suggestion-action-service'
import {
  addToExistingTrade,
  cancelExistingTrade,
  closeExistingTrade,
  createWorkbenchNoteBlockForContext,
  getWorkbenchReviewCase,
  getCurrentWorkbenchContext,
  getPeriodReview,
  getSessionWorkbench,
  getTradeDetail,
  listWorkbenchTargetOptions,
  listWorkbenchReviewCases,
  reorderWorkbenchNoteBlocks,
  moveScreenshotToTarget,
  openTradeForSession,
  retargetContentBlock,
  saveWorkbenchReviewCase,
  setCurrentWorkbenchContext,
  softDeleteAiRecord,
  softDeleteAnnotation,
  softDeleteContentBlock,
  softDeleteScreenshot,
  reduceExistingTrade,
  undeleteAiRecord,
  undeleteAnnotation,
  undeleteContentBlock,
  undeleteScreenshot,
  updateWorkbenchAnnotation,
  updateSessionRealtimeView,
  updateWorkbenchNoteBlockContent,
} from '@main/domain/workbench-service'
import {
  MemoryProposalPayloadSchema,
  RankingExplanationPayloadSchema,
  ReviewableMemoryActionInputSchema,
  TrainingInsightSchema,
  UserProfileSchema,
} from '@shared/contracts/evaluation'
import { getTradeEvaluationSummary } from '@main/evaluation/evaluation-service'
import { getTradeFeedbackBundle } from '@main/feedback/feedback-service'
import { approveMemoryProposal, listMemoryProposals, rejectMemoryProposal } from '@main/memory/memory-service'
import { getRankingExplanations, getUserProfileSnapshot } from '@main/profile/profile-service'
import { getTrainingInsightFeed } from '@main/training/training-service'
import {
  GetActiveMarketAnchorsInputSchema,
  GetKnowledgeGroundingsInputSchema,
  AdoptMarketAnchorInputSchema,
  UpdateMarketAnchorStatusInputSchema,
} from '@shared/contracts/knowledge'
import {
  AiRecordMutationResultSchema,
  AnnotationMutationResultSchema,
  ApplySuggestionActionInputSchema,
  ContentBlockMoveResultSchema,
  ContentBlockMutationResultSchema,
  CreateWorkbenchNoteBlockInputSchema,
  CurrentContextSchema,
  CurrentTargetOptionsPayloadSchema,
  GetCurrentContextInputSchema,
  GetReviewCaseInputSchema,
  GetAnchorReviewSuggestionsInputSchema,
  GetComposerSuggestionsInputSchema,
  GetRankingExplanationsInputSchema,
  GetSimilarCasesInputSchema,
  GetTrainingInsightsInputSchema,
  GetUserProfileInputSchema,
  ListReviewCasesInputSchema,
  ListTargetOptionsInputSchema,
  ListMemoryProposalsInputSchema,
  MoveContentBlockInputSchema,
  ReorderContentBlocksInputSchema,
  MoveScreenshotInputSchema,
  OpenTradeInputSchema,
  PeriodReviewPayloadSchema,
  ReduceTradeInputSchema,
  CancelTradeInputSchema,
  RunAnnotationSuggestionsInputSchema,
  SaveReviewCaseInputSchema,
  SaveSessionRealtimeViewInputSchema,
  SessionWorkbenchPayloadSchema,
  SetCurrentContextInputSchema,
  SetAiRecordDeletedInputSchema,
  SetAnnotationDeletedInputSchema,
  SetContentBlockDeletedInputSchema,
  SetScreenshotDeletedInputSchema,
  ScreenshotMutationResultSchema,
  SuggestionActionResultSchema,
  TradeMutationResultSchema,
  TradeDetailPayloadSchema,
  AddToTradeInputSchema,
  CloseTradeInputSchema,
  UpdateAnnotationInputSchema,
  UpdateWorkbenchNoteBlockInputSchema,
} from '@shared/contracts/workbench'
import type { AppContext } from './shared'
import {
  emptyActiveAnchorsPayload,
  emptyAnnotationSuggestionPayload,
  emptyComposerShell,
  emptyKnowledgeGroundingPayload,
  logWorkbenchSessionContextFailure,
  resolveKnowledgeGroundings,
  toMarketAnchorMutationResult,
  toPublicActiveAnchorsPayload,
  toPublicAnchorReviewSuggestionsPayload,
  toPublicAnnotationSuggestionsPayload,
  toPublicComposerAiSuggestionsPayload,
  toPublicComposerShell,
  toPublicSimilarCasePayload,
} from './shared'

export const registerWorkbenchIpc = ({ paths }: AppContext) => {
  ipcMain.handle('workbench:get-session', async(_event, input) => {
    const workbench = await getSessionWorkbench(paths, input)
    let composerShell = emptyComposerShell()
    let activeAnchors = emptyActiveAnchorsPayload()
    let groundings = emptyKnowledgeGroundingPayload()

    const anchorFilters = {
      contract_id: workbench.contract.id,
      session_id: workbench.session.id,
      trade_id: workbench.current_context.trade_id,
      status: 'active' as const,
      limit: 6,
    }
    const composerAnchorFilters = {
      ...anchorFilters,
      limit: 4,
    }
    const [anchorResult, groundingResult, composerResult] = await Promise.allSettled([
      buildActiveAnchorRuntimeSummary(paths, anchorFilters),
      resolveKnowledgeGroundings(paths, {
        session_id: workbench.session.id,
        limit: 6,
      }),
      getComposerShellData(paths, {
        contract_scope: workbench.contract.symbol,
        limit: 4,
      }, composerAnchorFilters),
    ])

    if (anchorResult.status === 'fulfilled') {
      activeAnchors = toPublicActiveAnchorsPayload(anchorResult.value)
    } else {
      logWorkbenchSessionContextFailure('anchors', workbench.session.id, anchorResult.reason)
    }

    if (groundingResult.status === 'fulfilled') {
      groundings = groundingResult.value
    } else {
      logWorkbenchSessionContextFailure('groundings', workbench.session.id, groundingResult.reason)
    }

    if (composerResult.status === 'fulfilled') {
      composerShell = toPublicComposerShell(composerResult.value, activeAnchors.anchors)
    } else {
      logWorkbenchSessionContextFailure('composer', workbench.session.id, composerResult.reason)
    }

    return SessionWorkbenchPayloadSchema.parse({
      ...workbench,
      composer_shell: composerShell,
      context_memory: {
        active_anchors: activeAnchors.anchors,
        latest_grounding_hits: groundings.hits,
      },
      suggestion_layer: {
        annotation_suggestions: [],
        anchor_review_suggestions: [],
        similar_cases: [],
      },
    })
  })

  ipcMain.handle('trade:get-detail', async(_event, input) => {
    const detail = await getTradeDetail(paths, input)
    const [evaluationSummary, feedbackBundle] = await Promise.all([
      getTradeEvaluationSummary(paths, detail.trade.id),
      getTradeFeedbackBundle(paths, detail.trade.id),
    ])

    return TradeDetailPayloadSchema.parse({
      ...detail,
      evaluation_summary: evaluationSummary,
      feedback_items: feedbackBundle.feedback_items,
      discipline_score: feedbackBundle.discipline_score,
      rule_hits: feedbackBundle.rule_hits,
    })
  })

  ipcMain.handle('review:get-period', async(_event, input) => {
    return PeriodReviewPayloadSchema.parse(await getPeriodReview(paths, input))
  })

  ipcMain.handle('workbench:get-active-anchors', async(_event, input) => {
    const parsed = GetActiveMarketAnchorsInputSchema.parse(input)
    return toPublicActiveAnchorsPayload(await buildActiveAnchorRuntimeSummary(paths, {
      contract_id: parsed?.contract_id ?? null,
      session_id: parsed?.session_id ?? null,
      trade_id: parsed?.trade_id ?? null,
      status: parsed?.status ?? 'active',
      limit: parsed?.limit ?? 12,
    }))
  })

  ipcMain.handle('workbench:adopt-anchor', async(_event, input) => {
    const parsed = AdoptMarketAnchorInputSchema.parse(input)
    return toMarketAnchorMutationResult(await adoptMarketAnchor(paths, parsed))
  })

  ipcMain.handle('workbench:update-anchor-status', async(_event, input) => {
    const parsed = UpdateMarketAnchorStatusInputSchema.parse(input)
    return toMarketAnchorMutationResult(await updatePersistedMarketAnchorStatus(paths, parsed))
  })

  ipcMain.handle('workbench:get-groundings', async(_event, input) => {
    const parsed = GetKnowledgeGroundingsInputSchema.parse(input)
    return resolveKnowledgeGroundings(paths, {
      session_id: parsed?.session_id,
      ai_run_id: parsed?.ai_run_id,
      anchor_id: parsed?.anchor_id,
      limit: parsed?.limit,
    })
  })

  ipcMain.handle('workbench:run-annotation-suggestions', async(_event, input) => {
    const parsed = RunAnnotationSuggestionsInputSchema.parse(input)
    const workbench = await getSessionWorkbench(paths, { session_id: parsed.session_id })
    const screenshotId = parsed.screenshot_id ?? workbench.screenshots[0]?.id
    if (!screenshotId) {
      return emptyAnnotationSuggestionPayload()
    }
    const payload = await runAnnotationSuggestions(paths, {
      session_id: parsed.session_id,
      screenshot_id: screenshotId,
      max_items: parsed.limit,
    })
    return toPublicAnnotationSuggestionsPayload(payload, screenshotId)
  })

  ipcMain.handle('workbench:get-composer-suggestions', async(_event, input) => {
    const parsed = GetComposerSuggestionsInputSchema.parse(input)
    return toPublicComposerAiSuggestionsPayload(await listComposerAiSuggestions(paths, {
      session_id: parsed.session_id,
      draft_text: parsed.draft_text,
      selected_anchor_id: parsed.anchor_id ?? null,
      selected_annotation_id: parsed.annotation_id ?? null,
      max_items: parsed.limit,
    }))
  })

  ipcMain.handle('workbench:get-anchor-review-suggestions', async(_event, input) => {
    const parsed = GetAnchorReviewSuggestionsInputSchema.parse(input)
    return toPublicAnchorReviewSuggestionsPayload(await listAnchorReviewSuggestions(paths, {
      session_id: parsed?.session_id ?? null,
      limit: parsed?.limit ?? 6,
    }))
  })

  ipcMain.handle('workbench:get-similar-cases', async(_event, input) => {
    const parsed = GetSimilarCasesInputSchema.parse(input)
    return toPublicSimilarCasePayload(await listSimilarCases(paths, {
      session_id: parsed?.session_id ?? null,
      contract_id: parsed?.contract_id ?? null,
      timeframe_scope: parsed?.timeframe_scope ?? null,
      semantic_tags: parsed?.semantic_tags,
      trade_context: parsed?.trade_context ?? null,
      limit: parsed?.limit ?? 6,
    }))
  })

  ipcMain.handle('workbench:apply-suggestion-action', async(_event, input) => {
    return SuggestionActionResultSchema.parse(await applySuggestionAction(paths, ApplySuggestionActionInputSchema.parse(input)))
  })

  ipcMain.handle('workbench:get-current-context', async(_event, input) => {
    return CurrentContextSchema.parse(await getCurrentWorkbenchContext(paths, GetCurrentContextInputSchema.parse(input)))
  })

  ipcMain.handle('workbench:set-current-context', async(_event, input) => {
    return CurrentContextSchema.parse(await setCurrentWorkbenchContext(paths, SetCurrentContextInputSchema.parse(input)))
  })

  ipcMain.handle('workbench:list-target-options', async(_event, input) => {
    return CurrentTargetOptionsPayloadSchema.parse(await listWorkbenchTargetOptions(paths, ListTargetOptionsInputSchema.parse(input)))
  })

  ipcMain.handle('workbench:get-user-profile', async(_event, input) => {
    const parsed = GetUserProfileInputSchema.parse(input)
    return UserProfileSchema.parse(await getUserProfileSnapshot(paths, parsed?.period_id))
  })

  ipcMain.handle('workbench:get-training-insights', async(_event, input) => {
    const parsed = GetTrainingInsightsInputSchema.parse(input)
    return (await getTrainingInsightFeed(paths, parsed?.period_id)).map((item) => TrainingInsightSchema.parse(item))
  })

  ipcMain.handle('workbench:get-ranking-explanations', async(_event, input) => {
    const parsed = GetRankingExplanationsInputSchema.parse(input)
    return RankingExplanationPayloadSchema.parse(await getRankingExplanations(paths, parsed?.session_id))
  })

  ipcMain.handle('workbench:list-memory-proposals', async(_event, input) => {
    const parsed = ListMemoryProposalsInputSchema.parse(input)
    return MemoryProposalPayloadSchema.parse(await listMemoryProposals(paths, parsed?.status))
  })

  ipcMain.handle('workbench:approve-memory-proposal', async(_event, input) => {
    const parsed = ReviewableMemoryActionInputSchema.parse(input)
    return MemoryProposalPayloadSchema.parse(await approveMemoryProposal(paths, parsed.proposal_id))
  })

  ipcMain.handle('workbench:reject-memory-proposal', async(_event, input) => {
    const parsed = ReviewableMemoryActionInputSchema.parse(input)
    return MemoryProposalPayloadSchema.parse(await rejectMemoryProposal(paths, parsed.proposal_id))
  })

  ipcMain.handle('workbench:save-realtime-view', async(_event, input) => {
    const result = await updateSessionRealtimeView(paths, SaveSessionRealtimeViewInputSchema.parse(input))
    return ContentBlockMutationResultSchema.parse({ block: result })
  })

  ipcMain.handle('workbench:create-note-block', async(_event, input) => {
    const result = await createWorkbenchNoteBlockForContext(paths, CreateWorkbenchNoteBlockInputSchema.parse(input))
    return ContentBlockMutationResultSchema.parse({ block: result })
  })

  ipcMain.handle('workbench:update-note-block', async(_event, input) => {
    const result = await updateWorkbenchNoteBlockContent(paths, UpdateWorkbenchNoteBlockInputSchema.parse(input))
    return ContentBlockMutationResultSchema.parse({ block: result })
  })

  ipcMain.handle('workbench:save-review-case', async(_event, input) => {
    return saveWorkbenchReviewCase(paths, SaveReviewCaseInputSchema.parse(input))
  })

  ipcMain.handle('workbench:get-review-case', async(_event, input) => {
    return getWorkbenchReviewCase(paths, GetReviewCaseInputSchema.parse(input))
  })

  ipcMain.handle('workbench:list-review-cases', async(_event, input) => {
    return listWorkbenchReviewCases(paths, ListReviewCasesInputSchema.parse(input))
  })

  ipcMain.handle('workbench:move-content-block', async(_event, input) => {
    return ContentBlockMoveResultSchema.parse(await retargetContentBlock(paths, MoveContentBlockInputSchema.parse(input)))
  })

  ipcMain.handle('workbench:reorder-content-blocks', async(_event, input) => {
    const result = await reorderWorkbenchNoteBlocks(paths, ReorderContentBlocksInputSchema.parse(input))
    return ContentBlockMutationResultSchema.parse({ block: result })
  })

  ipcMain.handle('workbench:move-screenshot', async(_event, input) => {
    const result = await moveScreenshotToTarget(paths, MoveScreenshotInputSchema.parse(input))
    return ScreenshotMutationResultSchema.parse({ screenshot: result })
  })

  ipcMain.handle('workbench:open-trade', async(_event, input) => {
    return TradeMutationResultSchema.parse(await openTradeForSession(paths, OpenTradeInputSchema.parse(input)))
  })

  ipcMain.handle('workbench:add-trade', async(_event, input) => {
    return TradeMutationResultSchema.parse(await addToExistingTrade(paths, AddToTradeInputSchema.parse(input)))
  })

  ipcMain.handle('workbench:reduce-trade', async(_event, input) => {
    return TradeMutationResultSchema.parse(await reduceExistingTrade(paths, ReduceTradeInputSchema.parse(input)))
  })

  ipcMain.handle('workbench:close-trade', async(_event, input) => {
    return TradeMutationResultSchema.parse(await closeExistingTrade(paths, CloseTradeInputSchema.parse(input)))
  })

  ipcMain.handle('workbench:cancel-trade', async(_event, input) => {
    return TradeMutationResultSchema.parse(await cancelExistingTrade(paths, CancelTradeInputSchema.parse(input)))
  })

  ipcMain.handle('workbench:delete-content-block', async(_event, input) => {
    const result = await softDeleteContentBlock(paths, SetContentBlockDeletedInputSchema.parse(input))
    return ContentBlockMutationResultSchema.parse({ block: result })
  })

  ipcMain.handle('workbench:restore-content-block', async(_event, input) => {
    const result = await undeleteContentBlock(paths, SetContentBlockDeletedInputSchema.parse(input))
    return ContentBlockMutationResultSchema.parse({ block: result })
  })

  ipcMain.handle('workbench:delete-screenshot', async(_event, input) => {
    const result = await softDeleteScreenshot(paths, SetScreenshotDeletedInputSchema.parse(input))
    return ScreenshotMutationResultSchema.parse({ screenshot: result })
  })

  ipcMain.handle('workbench:restore-screenshot', async(_event, input) => {
    const result = await undeleteScreenshot(paths, SetScreenshotDeletedInputSchema.parse(input))
    return ScreenshotMutationResultSchema.parse({ screenshot: result })
  })

  ipcMain.handle('workbench:delete-annotation', async(_event, input) => {
    const result = await softDeleteAnnotation(paths, SetAnnotationDeletedInputSchema.parse(input))
    return AnnotationMutationResultSchema.parse({ annotation: result })
  })

  ipcMain.handle('workbench:update-annotation', async(_event, input) => {
    const result = await updateWorkbenchAnnotation(paths, UpdateAnnotationInputSchema.parse(input))
    return AnnotationMutationResultSchema.parse({ annotation: result })
  })

  ipcMain.handle('workbench:restore-annotation', async(_event, input) => {
    const result = await undeleteAnnotation(paths, SetAnnotationDeletedInputSchema.parse(input))
    return AnnotationMutationResultSchema.parse({ annotation: result })
  })

  ipcMain.handle('workbench:delete-ai-record', async(_event, input) => {
    const result = await softDeleteAiRecord(paths, SetAiRecordDeletedInputSchema.parse(input))
    return AiRecordMutationResultSchema.parse({ ai_record: result })
  })

  ipcMain.handle('workbench:restore-ai-record', async(_event, input) => {
    const result = await undeleteAiRecord(paths, SetAiRecordDeletedInputSchema.parse(input))
    return AiRecordMutationResultSchema.parse({ ai_record: result })
  })
}
