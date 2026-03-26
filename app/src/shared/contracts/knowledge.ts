import { z } from 'zod'
import { AuditFieldsSchema, EntityIdSchema, IsoDateTimeSchema } from '@shared/contracts/base'

const StringListSchema = z.array(z.string().min(1))

export const KnowledgeSourceTypeSchema = z.enum(['book', 'article', 'course-note', 'user-note', 'review-derived'])
export const KnowledgeImportJobStatusSchema = z.enum(['queued', 'processing', 'completed', 'failed'])
export const KnowledgeImportJobTypeSchema = z.enum(['manual-ingest', 'document-import', 'gemini-extract'])
export const KnowledgeCardTypeSchema = z.enum([
  'concept',
  'setup',
  'entry-rule',
  'invalidation-rule',
  'risk-rule',
  'management-rule',
  'mistake-pattern',
  'review-principle',
  'checklist',
])
export const KnowledgeCardStatusSchema = z.enum(['draft', 'approved', 'archived'])
export const KnowledgeReviewActionSchema = z.enum(['approve', 'edit-approve', 'archive'])
export const ComposerSuggestionTypeSchema = z.enum(['phrase', 'template', 'completion'])
export const ComposerSuggestionSourceSchema = z.enum(['rule', 'knowledge'])
export const AnnotationSemanticTypeSchema = z.enum([
  'support',
  'resistance',
  'liquidity',
  'fvg',
  'imbalance',
  'entry',
  'invalidation',
  'target',
  'path',
  'context',
])
export const MarketAnchorStatusSchema = z.enum(['active', 'invalidated', 'archived'])

export const KnowledgeSourceSchema = AuditFieldsSchema.extend({
  source_type: KnowledgeSourceTypeSchema,
  title: z.string().min(1),
  author: z.string().nullable(),
  language: z.string().nullable(),
  content_md: z.string(),
  checksum: z.string().nullable(),
})

export const KnowledgeImportJobSchema = AuditFieldsSchema.extend({
  source_id: EntityIdSchema,
  provider: z.string().nullable(),
  model: z.string().nullable(),
  job_type: KnowledgeImportJobTypeSchema,
  status: KnowledgeImportJobStatusSchema,
  input_snapshot_json: z.string(),
  output_summary: z.string(),
  finished_at: IsoDateTimeSchema.nullable(),
})

export const KnowledgeFragmentSchema = AuditFieldsSchema.extend({
  source_id: EntityIdSchema,
  job_id: EntityIdSchema,
  sequence_no: z.number().int().positive(),
  chapter_label: z.string().nullable(),
  page_from: z.number().int().positive().nullable(),
  page_to: z.number().int().positive().nullable(),
  content_md: z.string().min(1),
  tokens_estimate: z.number().int().nonnegative(),
})

export const KnowledgeCardSchema = AuditFieldsSchema.extend({
  source_id: EntityIdSchema,
  fragment_id: EntityIdSchema,
  card_type: KnowledgeCardTypeSchema,
  title: z.string().min(1),
  summary: z.string(),
  content_md: z.string(),
  trigger_conditions_md: z.string(),
  invalidation_md: z.string(),
  risk_rule_md: z.string(),
  contract_scope: StringListSchema,
  timeframe_scope: StringListSchema,
  tags: StringListSchema,
  status: KnowledgeCardStatusSchema,
  version: z.number().int().positive(),
})

export const KnowledgeReviewSchema = AuditFieldsSchema.extend({
  knowledge_card_id: EntityIdSchema,
  review_action: KnowledgeReviewActionSchema,
  review_note_md: z.string(),
  reviewed_by: z.string().min(1),
})

export const KnowledgeGroundingSchema = AuditFieldsSchema.extend({
  knowledge_card_id: EntityIdSchema,
  session_id: EntityIdSchema.nullable(),
  trade_id: EntityIdSchema.nullable(),
  screenshot_id: EntityIdSchema.nullable(),
  annotation_id: EntityIdSchema.nullable(),
  anchor_id: EntityIdSchema.nullable(),
  ai_run_id: EntityIdSchema.nullable(),
  match_reason_md: z.string(),
  relevance_score: z.number().min(0).max(1),
})

export const ActiveMarketAnchorSchema = AuditFieldsSchema.extend({
  contract_id: EntityIdSchema,
  session_id: EntityIdSchema.nullable(),
  trade_id: EntityIdSchema.nullable(),
  origin_annotation_id: EntityIdSchema.nullable(),
  origin_annotation_label: z.string().nullable().optional(),
  origin_screenshot_id: EntityIdSchema.nullable(),
  title: z.string().min(1),
  semantic_type: AnnotationSemanticTypeSchema.nullable(),
  price_low: z.number().nullable(),
  price_high: z.number().nullable(),
  timeframe_scope: z.string().nullable(),
  thesis_md: z.string(),
  invalidation_rule_md: z.string(),
  status: MarketAnchorStatusSchema,
  carry_forward: z.boolean(),
})

export const ActiveMarketAnchorSummarySchema = z.object({
  id: EntityIdSchema,
  title: z.string().min(1),
  semantic_type: AnnotationSemanticTypeSchema.nullable(),
  status: MarketAnchorStatusSchema,
  origin_annotation_id: EntityIdSchema.nullable(),
  origin_annotation_label: z.string().nullable().optional(),
  origin_screenshot_id: EntityIdSchema.nullable(),
  timeframe_scope: z.string().nullable(),
  price_low: z.number().nullable(),
  price_high: z.number().nullable(),
  thesis_md: z.string().optional(),
  invalidation_rule_md: z.string().optional(),
})

export const KnowledgeGroundingHitSchema = z.object({
  id: EntityIdSchema,
  knowledge_card_id: EntityIdSchema,
  ai_run_id: EntityIdSchema.nullable(),
  annotation_id: EntityIdSchema.nullable(),
  anchor_id: EntityIdSchema.nullable(),
  title: z.string().min(1),
  summary: z.string(),
  card_type: KnowledgeCardTypeSchema.optional(),
  match_reason_md: z.string(),
  relevance_score: z.number().min(0).max(1),
})

export const KnowledgeCardPatchSchema = z.object({
  card_type: KnowledgeCardTypeSchema.optional(),
  title: z.string().min(1).optional(),
  summary: z.string().optional(),
  content_md: z.string().optional(),
  trigger_conditions_md: z.string().optional(),
  invalidation_md: z.string().optional(),
  risk_rule_md: z.string().optional(),
  contract_scope: StringListSchema.optional(),
  timeframe_scope: StringListSchema.optional(),
  tags: StringListSchema.optional(),
})

export const IngestKnowledgeSourceInputSchema = z.object({
  source_type: KnowledgeSourceTypeSchema,
  title: z.string().min(1),
  author: z.string().min(1).nullable().optional(),
  contract_scope: z.string().min(1).optional(),
  timeframe_scope: z.string().min(1).optional(),
  tags: StringListSchema.optional(),
  import_mode: z.enum(['manual', 'gemini']).default('manual'),
  file_path: z.string().min(1).optional(),
  content: z.string().min(1),
})

export const IngestKnowledgeSourceResultSchema = z.object({
  source: KnowledgeSourceSchema,
  import_job: KnowledgeImportJobSchema,
  fragments: z.array(KnowledgeFragmentSchema),
  draft_cards: z.array(KnowledgeCardSchema),
})

export const GetKnowledgeReviewDashboardInputSchema = z.object({
  source_id: EntityIdSchema.optional(),
}).optional()

export const KnowledgeReviewQueueItemSchema = z.object({
  card: KnowledgeCardSchema,
  fragment: KnowledgeFragmentSchema,
  source: KnowledgeSourceSchema,
  latest_review: KnowledgeReviewSchema.nullable(),
})

export const KnowledgeReviewDashboardStatsSchema = z.object({
  source_count: z.number().int().nonnegative(),
  fragment_count: z.number().int().nonnegative(),
  draft_count: z.number().int().nonnegative(),
  approved_count: z.number().int().nonnegative(),
  archived_count: z.number().int().nonnegative(),
})

export const KnowledgeReviewDashboardPayloadSchema = z.object({
  sources: z.array(KnowledgeSourceSchema),
  fragments: z.array(KnowledgeFragmentSchema),
  draft_cards: z.array(KnowledgeCardSchema),
  approved_cards: z.array(KnowledgeCardSchema),
  stats: KnowledgeReviewDashboardStatsSchema.optional(),
  import_jobs: z.array(KnowledgeImportJobSchema).optional(),
  review_queue: z.array(KnowledgeReviewQueueItemSchema).optional(),
})

export const ReviewKnowledgeCardInputSchema = z.object({
  card_id: EntityIdSchema,
  action: KnowledgeReviewActionSchema,
  review_note_md: z.string().optional(),
  reviewed_by: z.string().min(1).default('local-user'),
  edit_payload: KnowledgeCardPatchSchema.optional(),
})

export const ReviewKnowledgeCardResultSchema = z.object({
  card: KnowledgeCardSchema,
  review: KnowledgeReviewSchema,
})

export const GetApprovedKnowledgeRuntimeInputSchema = z.object({
  contract_scope: z.string().min(1).optional(),
  timeframe_scope: z.string().min(1).optional(),
  tags: StringListSchema.optional(),
  annotation_semantic: AnnotationSemanticTypeSchema.optional(),
  trade_state: z.string().min(1).optional(),
  context_tags: StringListSchema.optional(),
  limit: z.number().int().positive().max(12).default(6),
}).optional()

export const KnowledgeRuntimeHitSchema = z.object({
  card_id: EntityIdSchema,
  title: z.string().min(1),
  summary: z.string(),
  relevance_score: z.number().min(0).max(1).optional(),
  card_type: KnowledgeCardTypeSchema.optional(),
  tags: StringListSchema.optional(),
  contract_scope: StringListSchema.optional(),
  timeframe_scope: StringListSchema.optional(),
  fragment_excerpt: z.string().optional(),
  match_reasons: z.array(z.string()).optional(),
})

export const ApprovedKnowledgeRuntimePayloadSchema = z.object({
  hits: z.array(KnowledgeRuntimeHitSchema),
})

export const ComposerSuggestionSchema = z.object({
  id: EntityIdSchema,
  type: ComposerSuggestionTypeSchema,
  label: z.string().min(1),
  text: z.string().min(1),
  source: ComposerSuggestionSourceSchema.optional(),
  rationale: z.string().optional(),
  confidence_pct: z.number().min(0).max(100).optional(),
  ranking_reason: z.string().optional(),
  knowledge_card_id: EntityIdSchema.nullable().optional(),
})

export const ComposerSuggestionPayloadSchema = z.object({
  suggestions: z.array(ComposerSuggestionSchema),
})

export const ComposerShellSchema = z.object({
  active_anchor_labels: z.array(z.string()),
  active_anchors: z.array(ActiveMarketAnchorSummarySchema).optional(),
  approved_knowledge_hits: z.array(KnowledgeRuntimeHitSchema),
  suggestions: z.array(ComposerSuggestionSchema),
  context_summary: z.string().optional(),
})

export const GetActiveMarketAnchorsInputSchema = z.object({
  contract_id: EntityIdSchema.optional(),
  session_id: EntityIdSchema.optional(),
  trade_id: EntityIdSchema.optional(),
  status: MarketAnchorStatusSchema.optional(),
  limit: z.number().int().positive().max(24).default(12),
}).optional()

export const ActiveMarketAnchorsPayloadSchema = z.object({
  anchors: z.array(ActiveMarketAnchorSummarySchema),
})

export const AdoptMarketAnchorInputSchema = z.object({
  contract_id: EntityIdSchema,
  session_id: EntityIdSchema,
  trade_id: EntityIdSchema.nullable().optional(),
  source_annotation_id: EntityIdSchema.nullable().optional(),
  source_annotation_label: z.string().min(1).nullable().optional(),
  source_screenshot_id: EntityIdSchema.nullable().optional(),
  title: z.string().min(1),
  semantic_type: AnnotationSemanticTypeSchema.nullable().optional(),
  timeframe_scope: z.string().min(1).nullable().optional(),
  price_low: z.number().nullable().optional(),
  price_high: z.number().nullable().optional(),
  thesis_md: z.string().default(''),
  invalidation_rule_md: z.string().default(''),
  carry_forward: z.boolean().default(true),
})

export const UpdateMarketAnchorStatusInputSchema = z.object({
  anchor_id: EntityIdSchema,
  status: MarketAnchorStatusSchema,
  reason_md: z.string().optional(),
})

export const MarketAnchorMutationResultSchema = z.object({
  anchor: ActiveMarketAnchorSummarySchema,
})

export const GetKnowledgeGroundingsInputSchema = z.object({
  session_id: EntityIdSchema.optional(),
  trade_id: EntityIdSchema.optional(),
  screenshot_id: EntityIdSchema.optional(),
  ai_run_id: EntityIdSchema.optional(),
  anchor_id: EntityIdSchema.optional(),
  limit: z.number().int().positive().max(24).default(12),
}).optional()

export const KnowledgeGroundingPayloadSchema = z.object({
  hits: z.array(KnowledgeGroundingHitSchema),
})

export type KnowledgeSourceRecord = z.infer<typeof KnowledgeSourceSchema>
export type KnowledgeImportJobRecord = z.infer<typeof KnowledgeImportJobSchema>
export type KnowledgeFragmentRecord = z.infer<typeof KnowledgeFragmentSchema>
export type KnowledgeCardRecord = z.infer<typeof KnowledgeCardSchema>
export type KnowledgeReviewRecord = z.infer<typeof KnowledgeReviewSchema>
export type KnowledgeGroundingRecord = z.infer<typeof KnowledgeGroundingSchema>
export type ActiveMarketAnchorRecord = z.infer<typeof ActiveMarketAnchorSchema>
export type ActiveMarketAnchorSummary = z.infer<typeof ActiveMarketAnchorSummarySchema>
export type KnowledgeGroundingHit = z.infer<typeof KnowledgeGroundingHitSchema>
export type IngestKnowledgeSourceInput = z.infer<typeof IngestKnowledgeSourceInputSchema>
export type IngestKnowledgeSourceResult = z.infer<typeof IngestKnowledgeSourceResultSchema>
export type GetKnowledgeReviewDashboardInput = z.infer<typeof GetKnowledgeReviewDashboardInputSchema>
export type KnowledgeReviewQueueItem = z.infer<typeof KnowledgeReviewQueueItemSchema>
export type KnowledgeReviewDashboardPayload = z.infer<typeof KnowledgeReviewDashboardPayloadSchema>
export type KnowledgeCardPatch = z.infer<typeof KnowledgeCardPatchSchema>
export type ReviewKnowledgeCardInput = z.infer<typeof ReviewKnowledgeCardInputSchema>
export type ReviewKnowledgeCardResult = z.infer<typeof ReviewKnowledgeCardResultSchema>
export type GetApprovedKnowledgeRuntimeInput = z.infer<typeof GetApprovedKnowledgeRuntimeInputSchema>
export type KnowledgeRuntimeHit = z.infer<typeof KnowledgeRuntimeHitSchema>
export type ApprovedKnowledgeRuntimePayload = z.infer<typeof ApprovedKnowledgeRuntimePayloadSchema>
export type ComposerSuggestion = z.infer<typeof ComposerSuggestionSchema>
export type ComposerSuggestionPayload = z.infer<typeof ComposerSuggestionPayloadSchema>
export type ComposerShell = z.infer<typeof ComposerShellSchema>
export type GetActiveMarketAnchorsInput = z.infer<typeof GetActiveMarketAnchorsInputSchema>
export type ActiveMarketAnchorsPayload = z.infer<typeof ActiveMarketAnchorsPayloadSchema>
export type AdoptMarketAnchorInput = z.infer<typeof AdoptMarketAnchorInputSchema>
export type UpdateMarketAnchorStatusInput = z.infer<typeof UpdateMarketAnchorStatusInputSchema>
export type MarketAnchorMutationResult = z.infer<typeof MarketAnchorMutationResultSchema>
export type GetKnowledgeGroundingsInput = z.infer<typeof GetKnowledgeGroundingsInputSchema>
export type KnowledgeGroundingPayload = z.infer<typeof KnowledgeGroundingPayloadSchema>
