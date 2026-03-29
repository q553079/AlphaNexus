import { z } from 'zod'
import {
  AiRunExecutionResultSchema,
  AiProviderConfigSchema,
  PeriodReviewDraftSchema,
  PromptTemplateSchema,
  TradeReviewDraftSchema,
  MockAiRunResultSchema,
  RunAiAnalysisInputSchema,
  RunMockAiAnalysisInputSchema,
  SavePromptTemplateInputSchema,
  SaveAiProviderConfigInputSchema,
} from '@shared/ai/contracts'
import {
  CaptureCommandResultSchema,
  CaptureDisplaySchema,
  CapturePreferencesSchema,
  CaptureResultSchema,
  CaptureTargetContextInputSchema,
  CaptureSessionContextInputSchema,
  ImportScreenshotInputSchema,
  OpenSnipCaptureInputSchema,
  PendingSnipCaptureSchema,
  PasteClipboardImageInputSchema,
  SavePendingSnipInputSchema,
  SavePendingSnipResultSchema,
  SaveCapturePreferencesInputSchema,
  SaveScreenshotAnnotationsInputSchema,
  SnipCaptureSelectionInputSchema,
} from '@shared/capture/contracts'
import {
  AnalysisCardSchema,
  AnnotationSuggestionPayloadSchema,
  AnnotationSuggestionSchema,
  AnchorReviewSuggestionPayloadSchema,
  AnchorReviewSuggestionSchema,
  AiRunSchema,
  SimilarCasePayloadSchema,
  SimilarCaseSchema,
} from '@shared/contracts/analysis'
import {
  AnnotationSchema,
  AnnotationSemanticTypeSchema,
  ContentBlockMoveAuditSchema,
  ContentBlockSchema,
  MovableContentContextTypeSchema,
  ScreenshotSchema,
} from '@shared/contracts/content'
import {
  DisciplineScoreSchema,
  FeedbackItemSchema,
  MemoryProposalPayloadSchema,
  PeriodEvaluationRollupSchema,
  RankingExplanationPayloadSchema,
  ReviewableMemoryActionInputSchema,
  RuleHitSchema,
  RuleRollupEntrySchema,
  SetupLeaderboardEntrySchema,
  TradeEvaluationSummarySchema,
  TrainingInsightSchema,
  UserProfileSchema,
} from '@shared/contracts/evaluation'
import { EventSchema } from '@shared/contracts/event'
import {
  PeriodAiQualitySummarySchema,
  PeriodReviewAiRecordSchema,
  PeriodRollupSchema,
  PeriodTradeMetricSchema,
} from '@shared/contracts/period-review'
import { PeriodSchema, SessionSchema, ContractSchema } from '@shared/contracts/session'
import { EvaluationSchema, TradeSchema } from '@shared/contracts/trade'
import { ExportSessionMarkdownInputSchema, SessionMarkdownExportSchema } from '@shared/export/contracts'
import { EntityIdSchema } from '@shared/contracts/base'
import {
  ContinueSessionInputSchema,
  ContinueSessionResultSchema,
  CreateSessionInputSchema,
  CreateSessionResultSchema,
  LauncherHomePayloadSchema,
} from '@shared/contracts/launcher'
import {
  AddToTradeInputSchema,
  CancelTradeInputSchema,
  CloseTradeInputSchema,
  OpenTradeInputSchema,
  ReduceTradeInputSchema,
  TradeMutationResultSchema,
} from '@shared/contracts/workbench-trade'
import {
  GetReviewCaseInputSchema,
  ListReviewCasesInputSchema,
  ReviewCaseSchema,
  SaveReviewCaseInputSchema,
} from '@shared/contracts/review-case'
import {
  CurrentContextSchema,
  CurrentTargetOptionSchema,
  CurrentTargetOptionsPayloadSchema,
  GetCurrentContextInputSchema,
  ListTargetOptionsInputSchema,
  SetCurrentContextInputSchema,
  TargetOptionGroupsSchema,
} from '@shared/contracts/current-context'
import {
  ActiveMarketAnchorsPayloadSchema,
  AdoptMarketAnchorInputSchema,
  ApprovedKnowledgeRuntimePayloadSchema,
  ComposerShellSchema,
  ComposerSuggestionPayloadSchema,
  GetActiveMarketAnchorsInputSchema,
  GetApprovedKnowledgeRuntimeInputSchema,
  GetKnowledgeGroundingsInputSchema,
  GetKnowledgeReviewDashboardInputSchema,
  IngestKnowledgeSourceInputSchema,
  IngestKnowledgeSourceResultSchema,
  KnowledgeGroundingPayloadSchema,
  KnowledgeReviewDashboardPayloadSchema,
  MarketAnchorMutationResultSchema,
  ReviewKnowledgeCardInputSchema,
  ReviewKnowledgeCardResultSchema,
  UpdateMarketAnchorStatusInputSchema,
} from '@shared/contracts/knowledge'

export const EnvironmentInfoSchema = z.object({
  hasDeepSeekKey: z.boolean(),
  hasOpenAiKey: z.boolean(),
  hasAnthropicKey: z.boolean(),
  hasCustomAiKey: z.boolean(),
  customAiApiBaseUrl: z.string().nullable(),
  dataDir: z.string().min(1),
  vaultDir: z.string().min(1),
})

export const GetSessionWorkbenchInputSchema = z.object({
  session_id: z.string().min(1).optional(),
}).optional()

export const AiRecordChainSchema = z.object({
  ai_run: AiRunSchema,
  analysis_card: AnalysisCardSchema.nullable(),
  event: EventSchema.nullable(),
  content_block: ContentBlockSchema.nullable(),
})

export const TradeDetailAiRecordSchema = AiRecordChainSchema.extend({
  trade_review_structured: TradeReviewDraftSchema.nullable().default(null),
})

export const TradeDetailAiGroupsSchema = z.object({
  market_analysis: z.array(TradeDetailAiRecordSchema).default([]),
  trade_review: z.array(TradeDetailAiRecordSchema).default([]),
  latest_market_analysis: TradeDetailAiRecordSchema.nullable().default(null),
  latest_trade_review: TradeDetailAiRecordSchema.nullable().default(null),
})

export const SessionWorkbenchPayloadSchema = z.object({
  contract: ContractSchema,
  period: PeriodSchema,
  session: SessionSchema,
  trades: z.array(TradeSchema),
  events: z.array(EventSchema),
  screenshots: z.array(ScreenshotSchema),
  deleted_screenshots: z.array(ScreenshotSchema).default([]),
  content_blocks: z.array(ContentBlockSchema),
  ai_runs: z.array(AiRunSchema),
  analysis_cards: z.array(AnalysisCardSchema),
  deleted_ai_records: z.array(AiRecordChainSchema).default([]),
  evaluations: z.array(EvaluationSchema),
  panels: z.object({
    my_realtime_view: z.string(),
    ai_summary: z.string(),
    trade_plan: z.string(),
  }),
  composer_shell: ComposerShellSchema,
  context_memory: z.object({
    active_anchors: ActiveMarketAnchorsPayloadSchema.shape.anchors,
    latest_grounding_hits: KnowledgeGroundingPayloadSchema.shape.hits,
  }),
  suggestion_layer: z.object({
    annotation_suggestions: z.array(AnnotationSuggestionSchema),
    anchor_review_suggestions: z.array(AnchorReviewSuggestionSchema),
    similar_cases: z.array(SimilarCaseSchema),
  }),
  current_context: CurrentContextSchema,
  target_options: z.array(CurrentTargetOptionSchema),
  target_option_groups: TargetOptionGroupsSchema.default({
    current: [],
    recent: [],
    history: [],
    previous_period_trades: [],
  }),
})

export const GetTradeDetailInputSchema = z.object({
  trade_id: z.string().min(1).optional(),
}).optional()

export const TradeDetailInsightToneSchema = z.enum(['neutral', 'positive', 'warning', 'critical'])

export const TradeDetailInsightItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string(),
  evidence: z.array(z.string()).default([]),
  tone: TradeDetailInsightToneSchema.default('neutral'),
})

export const TradeDetailReviewSectionsSchema = z.object({
  deviation_analysis: z.array(TradeDetailInsightItemSchema).default([]),
  result_assessment: z.array(TradeDetailInsightItemSchema).default([]),
  next_improvements: z.array(TradeDetailInsightItemSchema).default([]),
})

export const TradeDetailPayloadSchema = z.object({
  session: SessionSchema,
  trade: TradeSchema,
  related_events: z.array(EventSchema),
  analysis_cards: z.array(AnalysisCardSchema),
  latest_analysis_card: AnalysisCardSchema.nullable(),
  ai_groups: TradeDetailAiGroupsSchema.default({
    market_analysis: [],
    trade_review: [],
    latest_market_analysis: null,
    latest_trade_review: null,
  }),
  screenshots: z.array(ScreenshotSchema).default([]),
  setup_screenshot: ScreenshotSchema.nullable(),
  setup_screenshots: z.array(ScreenshotSchema).default([]),
  manage_screenshots: z.array(ScreenshotSchema).default([]),
  exit_screenshot: ScreenshotSchema.nullable(),
  exit_screenshots: z.array(ScreenshotSchema).default([]),
  content_blocks: z.array(ContentBlockSchema).default([]),
  original_plan_blocks: z.array(ContentBlockSchema).default([]),
  linked_ai_cards: z.array(AnalysisCardSchema).default([]),
  execution_events: z.array(EventSchema).default([]),
  review_blocks: z.array(ContentBlockSchema).default([]),
  review_draft_block: ContentBlockSchema.nullable(),
  review_sections: TradeDetailReviewSectionsSchema.default({
    deviation_analysis: [],
    result_assessment: [],
    next_improvements: [],
  }),
  evaluation: EvaluationSchema.nullable(),
  evaluation_summary: TradeEvaluationSummarySchema.nullable(),
  feedback_items: z.array(FeedbackItemSchema),
  discipline_score: DisciplineScoreSchema.nullable(),
  rule_hits: z.array(RuleHitSchema),
})

export const GetPeriodReviewInputSchema = z.object({
  period_id: z.string().min(1).optional(),
}).optional()

export const PeriodReviewPayloadSchema = z.object({
  period: PeriodSchema,
  contract: ContractSchema,
  sessions: z.array(SessionSchema),
  period_rollup: PeriodRollupSchema,
  trade_metrics: z.array(PeriodTradeMetricSchema),
  highlight_cards: z.array(AnalysisCardSchema),
  latest_period_ai_review: PeriodReviewAiRecordSchema.nullable(),
  ai_quality_summary: PeriodAiQualitySummarySchema,
  evaluations: z.array(EvaluationSchema),
  content_blocks: z.array(ContentBlockSchema).default([]),
  evaluation_rollup: PeriodEvaluationRollupSchema,
  feedback_items: z.array(FeedbackItemSchema),
  rule_rollup: z.array(RuleRollupEntrySchema),
  setup_leaderboard: z.array(SetupLeaderboardEntrySchema),
  profile_snapshot: UserProfileSchema.nullable(),
  training_insights: z.array(TrainingInsightSchema),
})

export const SaveSessionRealtimeViewInputSchema = z.object({
  session_id: EntityIdSchema,
  trade_id: EntityIdSchema.nullable().optional(),
  content_md: z.string(),
})

export const CreateWorkbenchNoteBlockInputSchema = z.object({
  session_id: EntityIdSchema,
  trade_id: EntityIdSchema.nullable().optional(),
  event_id: EntityIdSchema.nullable().optional(),
  title: z.string().trim().min(1).max(120).default('用户笔记'),
  content_md: z.string().default(''),
})

export const UpdateWorkbenchNoteBlockInputSchema = z.object({
  block_id: EntityIdSchema,
  title: z.string().trim().min(1).max(120),
  content_md: z.string(),
})

export {
  CurrentContextSchema,
  CurrentTargetOptionSchema,
  CurrentTargetOptionsPayloadSchema,
  GetCurrentContextInputSchema,
  ListTargetOptionsInputSchema,
  SetCurrentContextInputSchema,
  resolveTradeForCurrentContext,
} from '@shared/contracts/current-context'
export {
  AddToTradeInputSchema,
  CancelTradeInputSchema,
  CloseTradeInputSchema,
  OpenTradeInputSchema,
  ReduceTradeInputSchema,
  TradeMutationResultSchema,
  selectCurrentTrade,
  selectLatestTrade,
} from '@shared/contracts/workbench-trade'

export const SetContentBlockDeletedInputSchema = z.object({
  block_id: EntityIdSchema,
})

export const ContentBlockMutationResultSchema = z.object({
  block: ContentBlockSchema,
})

export const MoveContentBlockInputSchema = z.object({
  block_id: EntityIdSchema,
  target_kind: MovableContentContextTypeSchema,
  session_id: EntityIdSchema,
  period_id: EntityIdSchema.optional(),
  trade_id: EntityIdSchema.nullable().optional(),
})

export const ReorderContentBlocksInputSchema = z.object({
  session_id: EntityIdSchema,
  context_type: z.enum(['session', 'trade']),
  context_id: EntityIdSchema,
  ordered_block_ids: z.array(EntityIdSchema).min(1),
})

export const ContentBlockMoveResultSchema = z.object({
  block: ContentBlockSchema,
  move_audit: ContentBlockMoveAuditSchema,
})

export const SetScreenshotDeletedInputSchema = z.object({
  screenshot_id: EntityIdSchema,
})

export const MoveScreenshotInputSchema = z.object({
  screenshot_id: EntityIdSchema,
  target_kind: z.enum(['session', 'trade']),
  session_id: EntityIdSchema,
  trade_id: EntityIdSchema.nullable().optional(),
})

export const ScreenshotMutationResultSchema = z.object({
  screenshot: ScreenshotSchema,
})

export const SetAnnotationDeletedInputSchema = z.object({
  annotation_id: EntityIdSchema,
})

export const AnnotationMutationResultSchema = z.object({
  annotation: AnnotationSchema,
})

export const UpdateAnnotationInputSchema = z.object({
  annotation_id: EntityIdSchema,
  label: z.string().trim().min(1).max(32),
  title: z.string().trim().min(1).max(120),
  semantic_type: AnnotationSemanticTypeSchema.nullable().optional(),
  text: z.string().nullable().optional(),
  note_md: z.string().default(''),
  add_to_memory: z.boolean().default(false),
})

export const SetAiRecordDeletedInputSchema = z.object({
  ai_run_id: EntityIdSchema,
})

export const AiRecordMutationResultSchema = z.object({
  ai_record: AiRecordChainSchema,
})

export const RunAnnotationSuggestionsInputSchema = z.object({
  session_id: EntityIdSchema,
  screenshot_id: EntityIdSchema.nullable().optional(),
  ai_run_id: EntityIdSchema.nullable().optional(),
  limit: z.number().int().positive().max(12).default(6),
})

export const GetComposerSuggestionsInputSchema = z.object({
  session_id: EntityIdSchema,
  draft_text: z.string().optional(),
  annotation_id: EntityIdSchema.nullable().optional(),
  anchor_id: EntityIdSchema.nullable().optional(),
  limit: z.number().int().positive().max(12).default(6),
})

export const GetAnchorReviewSuggestionsInputSchema = z.object({
  session_id: EntityIdSchema.optional(),
  ai_run_id: EntityIdSchema.optional(),
  limit: z.number().int().positive().max(12).default(6),
}).optional()

export const GetSimilarCasesInputSchema = z.object({
  session_id: EntityIdSchema.optional(),
  contract_id: EntityIdSchema.optional(),
  timeframe_scope: z.string().min(1).optional(),
  semantic_tags: z.array(z.string().min(1)).optional(),
  trade_context: z.string().min(1).optional(),
  limit: z.number().int().positive().max(12).default(6),
}).optional()

export const ApplySuggestionActionInputSchema = z.object({
  suggestion_id: EntityIdSchema,
  suggestion_kind: z.enum(['annotation', 'composer', 'anchor-review']),
  action: z.enum(['keep', 'merge', 'discard']),
  target_annotation_id: EntityIdSchema.nullable().optional(),
  target_anchor_id: EntityIdSchema.nullable().optional(),
})

export const SuggestionActionResultSchema = z.object({
  ok: z.literal(true),
  suggestion_id: EntityIdSchema,
  suggestion_kind: z.enum(['annotation', 'composer', 'anchor-review']),
  action: z.enum(['keep', 'merge', 'discard']),
  status: z.enum(['kept', 'merged', 'discarded']),
  applied_effect: z.enum(['audit-only', 'created-annotation', 'merged-annotation']),
  audit_id: EntityIdSchema,
  screenshot_id: EntityIdSchema.nullable(),
  annotation_id: EntityIdSchema.nullable(),
  target_annotation_id: EntityIdSchema.nullable(),
})

export const GetUserProfileInputSchema = z.object({
  period_id: EntityIdSchema.optional(),
}).optional()

export const GetTrainingInsightsInputSchema = z.object({
  period_id: EntityIdSchema.optional(),
}).optional()

export const GetRankingExplanationsInputSchema = z.object({
  session_id: EntityIdSchema.optional(),
  target_kind: z.enum(['composer', 'feedback', 'rule-warning']).optional(),
}).optional()

export const ListMemoryProposalsInputSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
}).optional()

export type EnvironmentInfo = z.infer<typeof EnvironmentInfoSchema>
export type GetSessionWorkbenchInput = z.infer<typeof GetSessionWorkbenchInputSchema>
export type SessionWorkbenchPayload = z.infer<typeof SessionWorkbenchPayloadSchema>
export type GetTradeDetailInput = z.infer<typeof GetTradeDetailInputSchema>
export type TradeDetailInsightItem = z.infer<typeof TradeDetailInsightItemSchema>
export type TradeDetailReviewSections = z.infer<typeof TradeDetailReviewSectionsSchema>
export type TradeDetailPayload = z.infer<typeof TradeDetailPayloadSchema>
export type GetPeriodReviewInput = z.infer<typeof GetPeriodReviewInputSchema>
export type PeriodReviewPayload = z.infer<typeof PeriodReviewPayloadSchema>
export type SaveSessionRealtimeViewInput = z.infer<typeof SaveSessionRealtimeViewInputSchema>
export type CreateWorkbenchNoteBlockInput = z.infer<typeof CreateWorkbenchNoteBlockInputSchema>
export type UpdateWorkbenchNoteBlockInput = z.infer<typeof UpdateWorkbenchNoteBlockInputSchema>
export type GetCurrentContextInput = z.infer<typeof GetCurrentContextInputSchema>
export type SetCurrentContextInput = z.infer<typeof SetCurrentContextInputSchema>
export type ListTargetOptionsInput = z.infer<typeof ListTargetOptionsInputSchema>
export type CurrentContext = z.infer<typeof CurrentContextSchema>
export type CurrentTargetOption = z.infer<typeof CurrentTargetOptionSchema>
export type CurrentTargetOptionsPayload = z.infer<typeof CurrentTargetOptionsPayloadSchema>
export type TargetOptionGroups = z.infer<typeof TargetOptionGroupsSchema>
export type OpenTradeInput = z.infer<typeof OpenTradeInputSchema>
export type AddToTradeInput = z.infer<typeof AddToTradeInputSchema>
export type ReduceTradeInput = z.infer<typeof ReduceTradeInputSchema>
export type CloseTradeInput = z.infer<typeof CloseTradeInputSchema>
export type CancelTradeInput = z.infer<typeof CancelTradeInputSchema>
export type TradeMutationResult = z.infer<typeof TradeMutationResultSchema>
export type SetContentBlockDeletedInput = z.infer<typeof SetContentBlockDeletedInputSchema>
export type ContentBlockMutationResult = z.infer<typeof ContentBlockMutationResultSchema>
export type MoveContentBlockInput = z.infer<typeof MoveContentBlockInputSchema>
export type ReorderContentBlocksInput = z.infer<typeof ReorderContentBlocksInputSchema>
export type ContentBlockMoveResult = z.infer<typeof ContentBlockMoveResultSchema>
export type SetScreenshotDeletedInput = z.infer<typeof SetScreenshotDeletedInputSchema>
export type MoveScreenshotInput = z.infer<typeof MoveScreenshotInputSchema>
export type ScreenshotMutationResult = z.infer<typeof ScreenshotMutationResultSchema>
export type SetAnnotationDeletedInput = z.infer<typeof SetAnnotationDeletedInputSchema>
export type AnnotationMutationResult = z.infer<typeof AnnotationMutationResultSchema>
export type UpdateAnnotationInput = z.infer<typeof UpdateAnnotationInputSchema>
export type AiRecordChain = z.infer<typeof AiRecordChainSchema>
export type SetAiRecordDeletedInput = z.infer<typeof SetAiRecordDeletedInputSchema>
export type AiRecordMutationResult = z.infer<typeof AiRecordMutationResultSchema>
export type TradeDetailAiRecord = z.infer<typeof TradeDetailAiRecordSchema>
export type TradeDetailAiGroups = z.infer<typeof TradeDetailAiGroupsSchema>
export type RunAnnotationSuggestionsInput = z.infer<typeof RunAnnotationSuggestionsInputSchema>
export type GetComposerSuggestionsInput = z.infer<typeof GetComposerSuggestionsInputSchema>
export type GetAnchorReviewSuggestionsInput = z.infer<typeof GetAnchorReviewSuggestionsInputSchema>
export type GetSimilarCasesInput = z.infer<typeof GetSimilarCasesInputSchema>
export type ApplySuggestionActionInput = z.infer<typeof ApplySuggestionActionInputSchema>
export type SuggestionActionResult = z.infer<typeof SuggestionActionResultSchema>
export type GetUserProfileInput = z.infer<typeof GetUserProfileInputSchema>
export type GetTrainingInsightsInput = z.infer<typeof GetTrainingInsightsInputSchema>
export type GetRankingExplanationsInput = z.infer<typeof GetRankingExplanationsInputSchema>
export type ListMemoryProposalsInput = z.infer<typeof ListMemoryProposalsInputSchema>
export type GetKnowledgeReviewDashboardInput = z.infer<typeof GetKnowledgeReviewDashboardInputSchema>
export type IngestKnowledgeSourceInput = z.infer<typeof IngestKnowledgeSourceInputSchema>
export type IngestKnowledgeSourceResult = z.infer<typeof IngestKnowledgeSourceResultSchema>
export type ReviewKnowledgeCardInput = z.infer<typeof ReviewKnowledgeCardInputSchema>
export type ReviewKnowledgeCardResult = z.infer<typeof ReviewKnowledgeCardResultSchema>
export type GetApprovedKnowledgeRuntimeInput = z.infer<typeof GetApprovedKnowledgeRuntimeInputSchema>
export type ApprovedKnowledgeRuntimePayload = z.infer<typeof ApprovedKnowledgeRuntimePayloadSchema>
export type KnowledgeReviewDashboardPayload = z.infer<typeof KnowledgeReviewDashboardPayloadSchema>
export type GetActiveMarketAnchorsInput = z.infer<typeof GetActiveMarketAnchorsInputSchema>
export type ActiveMarketAnchorsPayload = z.infer<typeof ActiveMarketAnchorsPayloadSchema>
export type AdoptMarketAnchorInput = z.infer<typeof AdoptMarketAnchorInputSchema>
export type UpdateMarketAnchorStatusInput = z.infer<typeof UpdateMarketAnchorStatusInputSchema>
export type MarketAnchorMutationResult = z.infer<typeof MarketAnchorMutationResultSchema>
export type GetKnowledgeGroundingsInput = z.infer<typeof GetKnowledgeGroundingsInputSchema>
export type KnowledgeGroundingPayload = z.infer<typeof KnowledgeGroundingPayloadSchema>

export type ImportScreenshotInput = z.infer<typeof ImportScreenshotInputSchema>
export type SaveScreenshotAnnotationsInput = z.infer<typeof SaveScreenshotAnnotationsInputSchema>
export type CaptureSessionContextInput = z.infer<typeof CaptureSessionContextInputSchema>
export type CaptureTargetContextInput = z.infer<typeof CaptureTargetContextInputSchema>
export type OpenSnipCaptureInput = z.infer<typeof OpenSnipCaptureInputSchema>
export type CaptureDisplay = z.infer<typeof CaptureDisplaySchema>
export type CapturePreferences = z.infer<typeof CapturePreferencesSchema>
export type SaveCapturePreferencesInput = z.infer<typeof SaveCapturePreferencesInputSchema>
export type PendingSnipCapture = z.infer<typeof PendingSnipCaptureSchema>
export type SnipCaptureSelectionInput = z.infer<typeof SnipCaptureSelectionInputSchema>
export type SavePendingSnipInput = z.infer<typeof SavePendingSnipInputSchema>
export type PasteClipboardImageInput = z.infer<typeof PasteClipboardImageInputSchema>
export type RunAiAnalysisInput = z.infer<typeof RunAiAnalysisInputSchema>
export type RunMockAiAnalysisInput = z.infer<typeof RunMockAiAnalysisInputSchema>
export type PeriodReviewDraft = z.infer<typeof PeriodReviewDraftSchema>
export type PromptTemplate = z.infer<typeof PromptTemplateSchema>
export type SavePromptTemplateInput = z.infer<typeof SavePromptTemplateInputSchema>
export type SaveAiProviderConfigInput = z.infer<typeof SaveAiProviderConfigInputSchema>
export type ExportSessionMarkdownInput = z.infer<typeof ExportSessionMarkdownInputSchema>
export type ContinueSessionInput = z.infer<typeof ContinueSessionInputSchema>
export type ContinueSessionResult = z.infer<typeof ContinueSessionResultSchema>
export type ReviewCaseRecord = z.infer<typeof ReviewCaseSchema>
export type SaveReviewCaseInput = z.infer<typeof SaveReviewCaseInputSchema>
export type GetReviewCaseInput = z.infer<typeof GetReviewCaseInputSchema>
export type ListReviewCasesInput = z.infer<typeof ListReviewCasesInputSchema>

export {
  ReviewCaseSelectionModeSchema,
  ReviewCaseEventSelectionSnapshotSchema,
  ReviewCaseAnalysisTraySnapshotSchema,
  ReviewCaseSnapshotSchema,
  ReviewCaseSchema,
  SaveReviewCaseInputSchema,
  GetReviewCaseInputSchema,
  ListReviewCasesInputSchema,
} from '@shared/contracts/review-case'

export type AlphaNexusApi = {
  app: {
    ping: () => Promise<string>
    getEnvironment: () => Promise<EnvironmentInfo>
    initializeDatabase: () => Promise<{ ok: true }>
  }
  launcher: {
    getHome: () => Promise<z.infer<typeof LauncherHomePayloadSchema>>
    createSession: (input: z.infer<typeof CreateSessionInputSchema>) => Promise<z.infer<typeof CreateSessionResultSchema>>
    continueSession: (input: z.infer<typeof ContinueSessionInputSchema>) => Promise<z.infer<typeof ContinueSessionResultSchema>>
  }
  workbench: {
    getSession: (input?: GetSessionWorkbenchInput) => Promise<SessionWorkbenchPayload>
    getTradeDetail: (input?: GetTradeDetailInput) => Promise<TradeDetailPayload>
    getPeriodReview: (input?: GetPeriodReviewInput) => Promise<PeriodReviewPayload>
    getActiveAnchors: (input?: GetActiveMarketAnchorsInput) => Promise<z.infer<typeof ActiveMarketAnchorsPayloadSchema>>
    adoptAnchor: (input: AdoptMarketAnchorInput) => Promise<z.infer<typeof MarketAnchorMutationResultSchema>>
    updateAnchorStatus: (input: UpdateMarketAnchorStatusInput) => Promise<z.infer<typeof MarketAnchorMutationResultSchema>>
    getGroundings: (input?: GetKnowledgeGroundingsInput) => Promise<z.infer<typeof KnowledgeGroundingPayloadSchema>>
    runAnnotationSuggestions: (input: RunAnnotationSuggestionsInput) => Promise<z.infer<typeof AnnotationSuggestionPayloadSchema>>
    getComposerSuggestions: (input: GetComposerSuggestionsInput) => Promise<z.infer<typeof ComposerSuggestionPayloadSchema>>
    getAnchorReviewSuggestions: (input?: GetAnchorReviewSuggestionsInput) => Promise<z.infer<typeof AnchorReviewSuggestionPayloadSchema>>
    getSimilarCases: (input?: GetSimilarCasesInput) => Promise<z.infer<typeof SimilarCasePayloadSchema>>
    applySuggestionAction: (input: ApplySuggestionActionInput) => Promise<z.infer<typeof SuggestionActionResultSchema>>
    getUserProfile: (input?: GetUserProfileInput) => Promise<z.infer<typeof UserProfileSchema>>
    getTrainingInsights: (input?: GetTrainingInsightsInput) => Promise<z.infer<typeof TrainingInsightSchema>[]>
    getRankingExplanations: (input?: GetRankingExplanationsInput) => Promise<z.infer<typeof RankingExplanationPayloadSchema>>
    listMemoryProposals: (input?: ListMemoryProposalsInput) => Promise<z.infer<typeof MemoryProposalPayloadSchema>>
    approveMemoryProposal: (input: z.infer<typeof ReviewableMemoryActionInputSchema>) => Promise<z.infer<typeof MemoryProposalPayloadSchema>>
    rejectMemoryProposal: (input: z.infer<typeof ReviewableMemoryActionInputSchema>) => Promise<z.infer<typeof MemoryProposalPayloadSchema>>
    getCurrentContext: (input?: GetCurrentContextInput) => Promise<CurrentContext>
    setCurrentContext: (input: SetCurrentContextInput) => Promise<CurrentContext>
    listTargetOptions: (input?: ListTargetOptionsInput) => Promise<CurrentTargetOptionsPayload>
    openTrade: (input: OpenTradeInput) => Promise<TradeMutationResult>
    addToTrade: (input: AddToTradeInput) => Promise<TradeMutationResult>
    reduceTrade: (input: ReduceTradeInput) => Promise<TradeMutationResult>
    closeTrade: (input: CloseTradeInput) => Promise<TradeMutationResult>
    cancelTrade: (input: CancelTradeInput) => Promise<TradeMutationResult>
    saveRealtimeView: (input: SaveSessionRealtimeViewInput) => Promise<ContentBlockMutationResult>
    createNoteBlock: (input: CreateWorkbenchNoteBlockInput) => Promise<ContentBlockMutationResult>
    updateNoteBlock: (input: UpdateWorkbenchNoteBlockInput) => Promise<ContentBlockMutationResult>
    saveReviewCase: (input: SaveReviewCaseInput) => Promise<ReviewCaseRecord>
    getReviewCase: (input: GetReviewCaseInput) => Promise<ReviewCaseRecord>
    listReviewCases: (input?: ListReviewCasesInput) => Promise<ReviewCaseRecord[]>
    moveContentBlock: (input: MoveContentBlockInput) => Promise<ContentBlockMoveResult>
    reorderContentBlocks: (input: ReorderContentBlocksInput) => Promise<z.infer<typeof ContentBlockMutationResultSchema>>
    deleteContentBlock: (input: SetContentBlockDeletedInput) => Promise<ContentBlockMutationResult>
    restoreContentBlock: (input: SetContentBlockDeletedInput) => Promise<ContentBlockMutationResult>
    moveScreenshot: (input: MoveScreenshotInput) => Promise<ScreenshotMutationResult>
    deleteScreenshot: (input: SetScreenshotDeletedInput) => Promise<ScreenshotMutationResult>
    restoreScreenshot: (input: SetScreenshotDeletedInput) => Promise<ScreenshotMutationResult>
    updateAnnotation: (input: UpdateAnnotationInput) => Promise<AnnotationMutationResult>
    deleteAnnotation: (input: SetAnnotationDeletedInput) => Promise<AnnotationMutationResult>
    restoreAnnotation: (input: SetAnnotationDeletedInput) => Promise<AnnotationMutationResult>
    deleteAiRecord: (input: SetAiRecordDeletedInput) => Promise<AiRecordMutationResult>
    restoreAiRecord: (input: SetAiRecordDeletedInput) => Promise<AiRecordMutationResult>
  }
  capture: {
    importImage: (input: ImportScreenshotInput) => Promise<z.infer<typeof CaptureResultSchema>>
    saveAnnotations: (input: SaveScreenshotAnnotationsInput) => Promise<z.infer<typeof CaptureResultSchema>>
    setSessionContext: (input: CaptureSessionContextInput) => Promise<z.infer<typeof CaptureCommandResultSchema>>
    openSnipCapture: (input?: OpenSnipCaptureInput) => Promise<z.infer<typeof CaptureCommandResultSchema>>
    listDisplays: () => Promise<z.infer<typeof CaptureDisplaySchema>[]>
    getPreferences: () => Promise<z.infer<typeof CapturePreferencesSchema>>
    savePreferences: (input: SaveCapturePreferencesInput) => Promise<z.infer<typeof CapturePreferencesSchema>>
    getPendingSnip: () => Promise<z.infer<typeof PendingSnipCaptureSchema> | null>
    copyPendingSnip: (input: SnipCaptureSelectionInput) => Promise<z.infer<typeof CaptureCommandResultSchema>>
    savePendingSnip: (input: SavePendingSnipInput) => Promise<z.infer<typeof SavePendingSnipResultSchema>>
    cancelPendingSnip: () => Promise<z.infer<typeof CaptureCommandResultSchema>>
    pasteClipboardImage: (input: PasteClipboardImageInput) => Promise<z.infer<typeof SavePendingSnipResultSchema>>
    onSaved: (listener: (result: z.infer<typeof SavePendingSnipResultSchema>) => void) => () => void
  }
  ai: {
    listProviders: () => Promise<z.infer<typeof AiProviderConfigSchema>[]>
    saveProviderConfig: (input: SaveAiProviderConfigInput) => Promise<z.infer<typeof AiProviderConfigSchema>[]>
    listPromptTemplates: () => Promise<z.infer<typeof PromptTemplateSchema>[]>
    savePromptTemplate: (input: SavePromptTemplateInput) => Promise<z.infer<typeof PromptTemplateSchema>[]>
    runAnalysis: (input: RunAiAnalysisInput) => Promise<z.infer<typeof AiRunExecutionResultSchema>>
    runMockAnalysis: (input: RunMockAiAnalysisInput) => Promise<z.infer<typeof MockAiRunResultSchema>>
  }
  knowledge: {
    getReviewDashboard: (input?: GetKnowledgeReviewDashboardInput) => Promise<z.infer<typeof KnowledgeReviewDashboardPayloadSchema>>
    ingestSource: (input: IngestKnowledgeSourceInput) => Promise<z.infer<typeof KnowledgeReviewDashboardPayloadSchema>>
    reviewCard: (input: ReviewKnowledgeCardInput) => Promise<z.infer<typeof KnowledgeReviewDashboardPayloadSchema>>
    getApprovedRuntime: (input?: GetApprovedKnowledgeRuntimeInput) => Promise<z.infer<typeof ApprovedKnowledgeRuntimePayloadSchema>>
    getActiveAnchors: (input?: GetActiveMarketAnchorsInput) => Promise<z.infer<typeof ActiveMarketAnchorsPayloadSchema>>
    adoptAnchor: (input: AdoptMarketAnchorInput) => Promise<z.infer<typeof MarketAnchorMutationResultSchema>>
    updateAnchorStatus: (input: UpdateMarketAnchorStatusInput) => Promise<z.infer<typeof MarketAnchorMutationResultSchema>>
    getGroundings: (input?: GetKnowledgeGroundingsInput) => Promise<z.infer<typeof KnowledgeGroundingPayloadSchema>>
  }
  export: {
    sessionMarkdown: (input: ExportSessionMarkdownInput) => Promise<z.infer<typeof SessionMarkdownExportSchema>>
  }
}
