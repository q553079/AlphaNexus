import { z } from 'zod'
import { AuditFieldsSchema, EntityIdSchema, IsoDateTimeSchema } from '@shared/contracts/base'
import { AnnotationShapeSchema } from '@shared/contracts/content'

export const AiProviderKindSchema = z.enum(['deepseek', 'openai', 'anthropic', 'custom-http'])

export const AiRunContextLayerSchema = z.object({
  active_anchor_ids: z.array(EntityIdSchema).optional(),
  grounded_knowledge_card_ids: z.array(EntityIdSchema).optional(),
})

export const SuggestionDecisionStatusSchema = z.enum(['pending', 'kept', 'merged', 'discarded'])

export const AnnotationSuggestionSchema = z.object({
  id: EntityIdSchema,
  ai_run_id: EntityIdSchema.nullable(),
  screenshot_id: EntityIdSchema,
  source_annotation_id: EntityIdSchema.nullable().optional(),
  label: z.string().min(1),
  semantic_type: z.string().min(1).nullable().optional(),
  shape: AnnotationShapeSchema,
  color: z.string().min(1),
  x1: z.number(),
  y1: z.number(),
  x2: z.number(),
  y2: z.number(),
  text: z.string().nullable(),
  stroke_width: z.number().positive(),
  rationale: z.string(),
  confidence_pct: z.number().min(0).max(100).optional(),
  merge_target_annotation_id: EntityIdSchema.nullable().optional(),
  status: SuggestionDecisionStatusSchema.default('pending'),
})

export const AnnotationSuggestionPayloadSchema = z.object({
  suggestions: z.array(AnnotationSuggestionSchema),
})

export const AnchorReviewSuggestedStatusSchema = z.enum(['still_valid', 'weakened', 'invalidated'])

export const AnchorReviewSuggestionSchema = z.object({
  id: EntityIdSchema,
  ai_run_id: EntityIdSchema.nullable(),
  anchor_id: EntityIdSchema,
  anchor_title: z.string().min(1),
  current_status: z.string().min(1),
  suggested_status: AnchorReviewSuggestedStatusSchema,
  reason_summary: z.string(),
  evidence: z.array(z.string()).optional(),
  confidence_pct: z.number().min(0).max(100).optional(),
})

export const AnchorReviewSuggestionPayloadSchema = z.object({
  suggestions: z.array(AnchorReviewSuggestionSchema),
})

export const SimilarCaseSchema = z.object({
  id: EntityIdSchema,
  session_id: EntityIdSchema.nullable(),
  trade_id: EntityIdSchema.nullable(),
  event_id: EntityIdSchema.nullable(),
  title: z.string().min(1),
  summary: z.string(),
  match_reason: z.string(),
  score: z.number().min(0).max(1),
  tags: z.array(z.string()).optional(),
})

export const SimilarCasePayloadSchema = z.object({
  cases: z.array(SimilarCaseSchema),
})

export const AiRunSchema = AuditFieldsSchema.extend({
  session_id: EntityIdSchema,
  event_id: EntityIdSchema.nullable(),
  provider: AiProviderKindSchema,
  model: z.string().min(1),
  status: z.enum(['mocked', 'queued', 'completed', 'failed']),
  prompt_kind: z.enum(['market-analysis', 'trade-review', 'period-review']),
  input_summary: z.string(),
  finished_at: IsoDateTimeSchema.nullable(),
})

export const AnalysisCardSchema = AuditFieldsSchema.extend({
  ai_run_id: EntityIdSchema,
  session_id: EntityIdSchema,
  trade_id: EntityIdSchema.nullable(),
  bias: z.enum(['bullish', 'bearish', 'range', 'neutral']),
  confidence_pct: z.number().min(0).max(100),
  reversal_probability_pct: z.number().min(0).max(100),
  entry_zone: z.string(),
  stop_loss: z.string(),
  take_profit: z.string(),
  invalidation: z.string(),
  summary_short: z.string(),
  deep_analysis_md: z.string(),
  supporting_factors: z.array(z.string()),
  context_layer: AiRunContextLayerSchema.optional(),
})

export type AiRunRecord = z.infer<typeof AiRunSchema>
export type AnalysisCardRecord = z.infer<typeof AnalysisCardSchema>
export type AiRunContextLayer = z.infer<typeof AiRunContextLayerSchema>
export type SuggestionDecisionStatus = z.infer<typeof SuggestionDecisionStatusSchema>
export type AnnotationSuggestion = z.infer<typeof AnnotationSuggestionSchema>
export type AnnotationSuggestionPayload = z.infer<typeof AnnotationSuggestionPayloadSchema>
export type AnchorReviewSuggestedStatus = z.infer<typeof AnchorReviewSuggestedStatusSchema>
export type AnchorReviewSuggestion = z.infer<typeof AnchorReviewSuggestionSchema>
export type AnchorReviewSuggestionPayload = z.infer<typeof AnchorReviewSuggestionPayloadSchema>
export type SimilarCase = z.infer<typeof SimilarCaseSchema>
export type SimilarCasePayload = z.infer<typeof SimilarCasePayloadSchema>
