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

export const RunAiAnalysisInputSchema = z.object({
  session_id: EntityIdSchema,
  screenshot_id: EntityIdSchema.nullable().optional(),
  provider: AiProviderKindSchema.default('deepseek'),
  prompt_kind: z.enum(['market-analysis', 'trade-review', 'period-review']).default('market-analysis'),
})

export const RunMockAiAnalysisInputSchema = z.object({
  session_id: EntityIdSchema,
  screenshot_id: EntityIdSchema.nullable().optional(),
  provider: AiProviderKindSchema.default('deepseek'),
  prompt_kind: z.enum(['market-analysis', 'trade-review', 'period-review']).default('market-analysis'),
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
export type RunAiAnalysisInput = z.infer<typeof RunAiAnalysisInputSchema>
export type RunMockAiAnalysisInput = z.infer<typeof RunMockAiAnalysisInputSchema>
export type SaveAiProviderConfigInput = z.infer<typeof SaveAiProviderConfigInputSchema>
export type MockAiRunResult = z.infer<typeof MockAiRunResultSchema>
export type AiRunExecutionResult = z.infer<typeof AiRunExecutionResultSchema>
