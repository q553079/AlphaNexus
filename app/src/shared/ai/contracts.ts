import { z } from 'zod'
import { AiProviderKindSchema, AnalysisCardSchema, AiRunSchema } from '@shared/contracts/analysis'
import { EntityIdSchema } from '@shared/contracts/base'
import { ContentBlockSchema } from '@shared/contracts/content'
import { EventSchema } from '@shared/contracts/event'

export const AiProviderConfigSchema = z.object({
  provider: AiProviderKindSchema,
  label: z.string().min(1),
  enabled: z.boolean(),
  configured: z.boolean(),
  model: z.string().min(1),
  base_url: z.string().nullable(),
  configured_via: z.enum(['none', 'env', 'local']).default('none'),
  secret_storage: z.enum(['none', 'env', 'safe-storage', 'local-file']).default('none'),
  supports_base_url_override: z.boolean().default(false),
  supports_local_api_key: z.boolean().default(false),
})

export const AiAnalysisDraftSchema = z.object({
  bias: z.enum(['bullish', 'bearish', 'range', 'neutral']),
  confidence_pct: z.coerce.number().int().min(0).max(100),
  reversal_probability_pct: z.coerce.number().int().min(0).max(100),
  entry_zone: z.string().min(1),
  stop_loss: z.string().min(1),
  take_profit: z.string().min(1),
  invalidation: z.string().min(1),
  summary_short: z.string().min(1),
  deep_analysis_md: z.string().min(1),
  supporting_factors: z.array(z.string().min(1)).min(1).max(8),
})

export const TradeReviewDraftSchema = z.object({
  summary_short: z.string().min(1),
  what_went_well: z.array(z.string().min(1)).min(1).max(5),
  mistakes: z.array(z.string().min(1)).min(1).max(5),
  next_improvements: z.array(z.string().min(1)).min(1).max(5),
  deep_analysis_md: z.string().min(1),
})

export const PeriodReviewDraftSchema = z.object({
  summary_short: z.string().min(1),
  strengths: z.array(z.string().min(1)).min(1).max(6),
  mistakes: z.array(z.string().min(1)).min(1).max(6),
  recurring_patterns: z.array(z.string().min(1)).min(1).max(6),
  action_items: z.array(z.string().min(1)).min(1).max(6),
  deep_analysis_md: z.string().min(1),
})

export const PromptTemplateKindSchema = z.enum(['market-analysis', 'trade-review', 'period-review'])

export const PromptTemplateSchema = z.object({
  schema_version: z.literal(1).default(1),
  template_id: PromptTemplateKindSchema,
  label: z.string().min(1),
  base_system_prompt: z.string().min(1),
  runtime_notes: z.string(),
  output_contract_summary: z.string().min(1),
})

export const SavePromptTemplateInputSchema = z.object({
  template_id: PromptTemplateKindSchema,
  runtime_notes: z.string().max(8_000),
})

export const AiAnalysisAttachmentSchema = z.object({
  id: z.string().trim().min(1).max(120),
  kind: z.enum(['image', 'document']),
  name: z.string().trim().min(1).max(240),
  mime_type: z.string().trim().min(1).max(160).nullable().optional(),
  size_bytes: z.number().int().nonnegative().nullable().optional(),
  data_url: z.string().min(1).optional(),
  text_excerpt: z.string().trim().max(8_000).nullable().optional(),
}).transform((attachment) => ({
  ...attachment,
  mime_type: attachment.mime_type ?? null,
  size_bytes: attachment.size_bytes ?? null,
  text_excerpt: attachment.text_excerpt ?? null,
}))

export const AiAnalysisContextInputSchema = z.object({
  analysis_session_id: EntityIdSchema.optional(),
  analysis_contract_id: EntityIdSchema.optional(),
  analysis_contract_symbol: z.string().trim().min(1).max(64).optional(),
  background_screenshot_ids: z.array(EntityIdSchema).max(8).default([]),
  background_note_md: z.string().trim().max(4_000).optional(),
  attachments: z.array(AiAnalysisAttachmentSchema).max(6).default([]),
})

export const RunAiAnalysisInputSchema = z.object({
  session_id: EntityIdSchema,
  period_id: EntityIdSchema.optional(),
  screenshot_id: EntityIdSchema.nullable().optional(),
  trade_id: EntityIdSchema.nullable().optional(),
  provider: AiProviderKindSchema.default('deepseek'),
  prompt_kind: z.enum(['market-analysis', 'trade-review', 'period-review']).default('market-analysis'),
  analysis_context: AiAnalysisContextInputSchema.optional(),
})

export const RunMockAiAnalysisInputSchema = z.object({
  session_id: EntityIdSchema,
  period_id: EntityIdSchema.optional(),
  screenshot_id: EntityIdSchema.nullable().optional(),
  trade_id: EntityIdSchema.nullable().optional(),
  provider: AiProviderKindSchema.default('deepseek'),
  prompt_kind: z.enum(['market-analysis', 'trade-review', 'period-review']).default('market-analysis'),
  analysis_context: AiAnalysisContextInputSchema.optional(),
})

export const SaveAiProviderConfigInputSchema = z.object({
  provider: AiProviderKindSchema,
  enabled: z.boolean(),
  model: z.string().min(1),
  base_url: z.string().url().nullable().optional(),
  api_key: z.string().trim().min(1).max(4096).nullable().optional(),
})

export const MockAiRunResultSchema = z.object({
  analysis_card: AnalysisCardSchema,
  prompt_preview: z.string(),
})

export const AiRunExecutionResultSchema = z.object({
  ai_run: AiRunSchema,
  analysis_card: AnalysisCardSchema,
  event: EventSchema,
  content_block: ContentBlockSchema,
  prompt_preview: z.string(),
})

export type AiProviderConfig = z.infer<typeof AiProviderConfigSchema>
export type AiAnalysisDraft = z.infer<typeof AiAnalysisDraftSchema>
export type TradeReviewDraft = z.infer<typeof TradeReviewDraftSchema>
export type PeriodReviewDraft = z.infer<typeof PeriodReviewDraftSchema>
export type PromptTemplateKind = z.infer<typeof PromptTemplateKindSchema>
export type PromptTemplate = z.infer<typeof PromptTemplateSchema>
export type SavePromptTemplateInput = z.infer<typeof SavePromptTemplateInputSchema>
export type AiAnalysisAttachment = z.infer<typeof AiAnalysisAttachmentSchema>
export type AiAnalysisContextInput = z.infer<typeof AiAnalysisContextInputSchema>
export type RunAiAnalysisInput = z.infer<typeof RunAiAnalysisInputSchema>
export type RunMockAiAnalysisInput = z.infer<typeof RunMockAiAnalysisInputSchema>
export type SaveAiProviderConfigInput = z.infer<typeof SaveAiProviderConfigInputSchema>
export type MockAiRunResult = z.infer<typeof MockAiRunResultSchema>
export type AiRunExecutionResult = z.infer<typeof AiRunExecutionResultSchema>
