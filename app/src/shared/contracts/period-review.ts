import { z } from 'zod'
import { PeriodReviewDraftSchema } from '@shared/ai/contracts'
import { AiProviderKindSchema, AiRunSchema, AnalysisCardSchema } from '@shared/contracts/analysis'
import { SchemaVersionSchema, EntityIdSchema, IsoDateTimeSchema } from '@shared/contracts/base'
import { ContentBlockSchema } from '@shared/contracts/content'
import { PeriodSchema } from '@shared/contracts/session'
import { TradeSchema } from '@shared/contracts/trade'

export const TradeMetricResultLabelSchema = z.enum(['win', 'loss', 'flat', 'pending', 'canceled'])
export const PeriodTagCategorySchema = z.enum(['setup', 'context', 'mistake', 'emotion'])
export const PeriodTagSourceSchema = z.enum(['user', 'system', 'ai'])

export const PeriodTradeTagSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  category: PeriodTagCategorySchema,
  source: PeriodTagSourceSchema,
  evidence: z.string().min(1),
})

export const PeriodTradeMetricSchema = z.object({
  trade_id: EntityIdSchema,
  session_id: EntityIdSchema,
  session_title: z.string().min(1),
  trade: TradeSchema,
  pnl_r: z.number().nullable(),
  holding_minutes: z.number().int().nonnegative().nullable(),
  result_label: TradeMetricResultLabelSchema,
  plan_adherence_score: z.number().min(0).max(100).nullable(),
  ai_alignment_score: z.number().min(0).max(100).nullable(),
  thesis_excerpt: z.string(),
  tags: z.array(PeriodTradeTagSchema).default([]),
})

export const PeriodPnlCurvePointSchema = z.object({
  trade_id: EntityIdSchema,
  session_id: EntityIdSchema,
  point_at: IsoDateTimeSchema,
  pnl_r: z.number(),
  cumulative_pnl_r: z.number(),
})

export const PeriodTagSummarySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  category: PeriodTagCategorySchema,
  source: PeriodTagSourceSchema,
  count: z.number().int().nonnegative(),
  trade_ids: z.array(EntityIdSchema),
})

export const PeriodRollupStatsSchema = z.object({
  trade_count: z.number().int().nonnegative(),
  resolved_trade_count: z.number().int().nonnegative(),
  pending_trade_count: z.number().int().nonnegative(),
  canceled_trade_count: z.number().int().nonnegative(),
  win_count: z.number().int().nonnegative(),
  loss_count: z.number().int().nonnegative(),
  flat_count: z.number().int().nonnegative(),
  total_pnl_r: z.number(),
  avg_pnl_r: z.number().nullable(),
  win_rate_pct: z.number().min(0).max(100).nullable(),
  avg_holding_minutes: z.number().int().nonnegative().nullable(),
  plan_adherence_avg_pct: z.number().min(0).max(100).nullable(),
  ai_alignment_avg_pct: z.number().min(0).max(100).nullable(),
})

export const PeriodRollupSchema = z.object({
  schema_version: SchemaVersionSchema,
  period: PeriodSchema,
  period_key: z.string().min(1),
  generated_at: IsoDateTimeSchema,
  generation_strategy: z.literal('rebuild-from-local-records'),
  session_ids: z.array(EntityIdSchema),
  trade_ids: z.array(EntityIdSchema),
  stats: PeriodRollupStatsSchema,
  pnl_curve: z.array(PeriodPnlCurvePointSchema),
  tag_summary: z.array(PeriodTagSummarySchema),
  best_trade_ids: z.array(EntityIdSchema),
  worst_trade_ids: z.array(EntityIdSchema),
  latest_period_review_ai_run_id: EntityIdSchema.nullable(),
  latest_period_review_generated_at: IsoDateTimeSchema.nullable(),
})

export const PeriodReviewAiRecordSchema = z.object({
  ai_run: AiRunSchema,
  analysis_card: AnalysisCardSchema.nullable(),
  content_block: ContentBlockSchema.nullable(),
  structured: PeriodReviewDraftSchema.nullable(),
})

export const PeriodAiFailureSchema = z.object({
  ai_run_id: EntityIdSchema,
  provider: AiProviderKindSchema,
  prompt_kind: z.enum(['market-analysis', 'trade-review', 'period-review']),
  created_at: IsoDateTimeSchema,
  reason: z.string().min(1),
})

export const PeriodAiProviderQualitySchema = z.object({
  provider: AiProviderKindSchema,
  total_runs: z.number().int().nonnegative(),
  structured_success_count: z.number().int().nonnegative(),
  structured_failure_count: z.number().int().nonnegative(),
  success_rate_pct: z.number().min(0).max(100).nullable(),
  last_failure_reason: z.string().nullable(),
})

export const PeriodAiQualitySummarySchema = z.object({
  schema_version: SchemaVersionSchema,
  period_id: EntityIdSchema,
  total_runs: z.number().int().nonnegative(),
  structured_success_count: z.number().int().nonnegative(),
  structured_failure_count: z.number().int().nonnegative(),
  success_rate_pct: z.number().min(0).max(100).nullable(),
  providers: z.array(PeriodAiProviderQualitySchema),
  recent_failures: z.array(PeriodAiFailureSchema),
})

export type TradeMetricResultLabel = z.infer<typeof TradeMetricResultLabelSchema>
export type PeriodTagCategory = z.infer<typeof PeriodTagCategorySchema>
export type PeriodTagSource = z.infer<typeof PeriodTagSourceSchema>
export type PeriodTradeTag = z.infer<typeof PeriodTradeTagSchema>
export type PeriodTradeMetric = z.infer<typeof PeriodTradeMetricSchema>
export type PeriodPnlCurvePoint = z.infer<typeof PeriodPnlCurvePointSchema>
export type PeriodTagSummary = z.infer<typeof PeriodTagSummarySchema>
export type PeriodRollupStats = z.infer<typeof PeriodRollupStatsSchema>
export type PeriodRollup = z.infer<typeof PeriodRollupSchema>
export type PeriodReviewAiRecord = z.infer<typeof PeriodReviewAiRecordSchema>
export type PeriodAiFailure = z.infer<typeof PeriodAiFailureSchema>
export type PeriodAiProviderQuality = z.infer<typeof PeriodAiProviderQualitySchema>
export type PeriodAiQualitySummary = z.infer<typeof PeriodAiQualitySummarySchema>
