import { z } from 'zod'
import { EntityIdSchema, IsoDateTimeSchema } from '@shared/contracts/base'

export const JudgmentVerdictSchema = z.enum(['correct', 'partially-correct', 'incorrect', 'pending', 'insufficient'])
export const OutcomeDirectionSchema = z.enum(['up', 'down', 'range', 'unknown'])
export const FeedbackPrioritySchema = z.enum(['high', 'medium', 'low'])
export const FeedbackTypeSchema = z.enum([
  'discipline',
  'setup-selection',
  'execution',
  'risk',
  'anchor-usage',
  'knowledge-gap',
])
export const RuleSeveritySchema = z.enum(['info', 'warning', 'critical'])
export const MemoryProposalTypeSchema = z.enum(['knowledge-refine', 'rule-adjust', 'anchor-pattern', 'mistake-pattern'])
export const MemoryProposalStatusSchema = z.enum(['pending', 'approved', 'rejected'])
export const RankingTargetKindSchema = z.enum(['composer', 'feedback', 'rule-warning'])

export const OutcomeSnapshotSchema = z.object({
  trade_id: EntityIdSchema.nullable(),
  outcome_direction: OutcomeDirectionSchema,
  pnl_r: z.number().nullable(),
  status: z.enum(['pending', 'resolved', 'insufficient']),
  summary: z.string(),
})

export const TradeJudgmentSummarySchema = z.object({
  source: z.enum(['human', 'ai']),
  bias: z.enum(['bullish', 'bearish', 'range', 'neutral']).nullable(),
  confidence_pct: z.number().min(0).max(100).nullable(),
  verdict: JudgmentVerdictSchema,
  reason_summary: z.string(),
})

export const TradeEvaluationSummarySchema = z.object({
  ai_judgment: TradeJudgmentSummarySchema.nullable(),
  human_judgment: TradeJudgmentSummarySchema.nullable(),
  outcome: OutcomeSnapshotSchema,
  plan_adherence_pct: z.number().min(0).max(100).nullable(),
  disagreement_summary: z.string().nullable(),
})

export const CalibrationBucketSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  confidence_min: z.number().min(0).max(100),
  confidence_max: z.number().min(0).max(100),
  sample_count: z.number().int().nonnegative(),
  resolved_count: z.number().int().nonnegative(),
  hit_rate_pct: z.number().min(0).max(100).nullable(),
  avg_confidence_pct: z.number().min(0).max(100),
  calibration_gap_pct: z.number().min(-100).max(100).nullable(),
  status: z.enum(['ok', 'sparse', 'pending']),
})

export const ComparisonMetricSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  ai_value_pct: z.number().min(0).max(100).nullable(),
  human_value_pct: z.number().min(0).max(100).nullable(),
  delta_pct: z.number().min(-100).max(100).nullable(),
  sample_count: z.number().int().nonnegative(),
})

export const PatternInsightSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  count: z.number().int().nonnegative(),
  summary: z.string(),
})

export const EffectiveKnowledgeInsightSchema = z.object({
  card_id: EntityIdSchema,
  title: z.string().min(1),
  hit_count: z.number().int().nonnegative(),
  quality_score_pct: z.number().min(0).max(100),
})

export const PeriodEvaluationRollupSchema = z.object({
  calibration_buckets: z.array(CalibrationBucketSchema),
  ai_vs_human: z.array(ComparisonMetricSchema),
  error_patterns: z.array(PatternInsightSchema),
  effective_knowledge: z.array(EffectiveKnowledgeInsightSchema),
  pending_count: z.number().int().nonnegative(),
  evaluated_count: z.number().int().nonnegative(),
})

export const FeedbackItemSchema = z.object({
  id: z.string().min(1),
  type: FeedbackTypeSchema,
  title: z.string().min(1),
  summary: z.string(),
  priority: FeedbackPrioritySchema,
  evidence: z.array(z.string()),
})

export const DisciplineDimensionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  score_pct: z.number().min(0).max(100),
  summary: z.string(),
  evidence: z.array(z.string()),
})

export const DisciplineScoreSchema = z.object({
  overall_pct: z.number().min(0).max(100),
  summary: z.string(),
  dimensions: z.array(DisciplineDimensionSchema),
})

export const RuleHitSchema = z.object({
  id: z.string().min(1),
  rule_id: z.string().min(1),
  label: z.string().min(1),
  severity: RuleSeveritySchema,
  matched: z.boolean(),
  reason: z.string(),
  evidence: z.array(z.string()),
})

export const RuleRollupEntrySchema = z.object({
  id: z.string().min(1),
  rule_id: z.string().min(1),
  label: z.string().min(1),
  severity: RuleSeveritySchema,
  match_count: z.number().int().nonnegative(),
  total_count: z.number().int().nonnegative(),
  match_rate_pct: z.number().min(0).max(100).nullable(),
  summary: z.string(),
  evidence: z.array(z.string()),
})

export const SetupLeaderboardEntrySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  sample_count: z.number().int().nonnegative(),
  win_rate_pct: z.number().min(0).max(100).nullable(),
  avg_r: z.number().nullable(),
  discipline_avg_pct: z.number().min(0).max(100).nullable(),
  ai_alignment_pct: z.number().min(0).max(100).nullable(),
})

export const UserProfileSchema = z.object({
  strengths: z.array(PatternInsightSchema),
  weaknesses: z.array(PatternInsightSchema),
  execution_style: z.array(PatternInsightSchema),
  ai_collaboration: z.array(PatternInsightSchema),
})

export const TrainingInsightSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string(),
  priority: FeedbackPrioritySchema,
  evidence: z.array(z.string()),
})

export const RankingExplanationSchema = z.object({
  id: z.string().min(1),
  target_id: z.string().min(1),
  target_kind: RankingTargetKindSchema,
  reason_summary: z.string(),
  factors: z.array(z.string()),
})

export const RankingExplanationPayloadSchema = z.object({
  explanations: z.array(RankingExplanationSchema),
})

export const MemoryUpdateProposalSchema = z.object({
  id: z.string().min(1),
  proposal_type: MemoryProposalTypeSchema,
  title: z.string().min(1),
  summary: z.string(),
  evidence: z.array(z.string()),
  status: MemoryProposalStatusSchema,
  created_at: IsoDateTimeSchema,
  reviewed_at: IsoDateTimeSchema.nullable(),
})

export const MemoryProposalPayloadSchema = z.object({
  proposals: z.array(MemoryUpdateProposalSchema),
})

export const ReviewableMemoryActionInputSchema = z.object({
  proposal_id: z.string().min(1),
})

export type JudgmentVerdict = z.infer<typeof JudgmentVerdictSchema>
export type OutcomeDirection = z.infer<typeof OutcomeDirectionSchema>
export type OutcomeSnapshot = z.infer<typeof OutcomeSnapshotSchema>
export type TradeJudgmentSummary = z.infer<typeof TradeJudgmentSummarySchema>
export type TradeEvaluationSummary = z.infer<typeof TradeEvaluationSummarySchema>
export type CalibrationBucket = z.infer<typeof CalibrationBucketSchema>
export type ComparisonMetric = z.infer<typeof ComparisonMetricSchema>
export type PatternInsight = z.infer<typeof PatternInsightSchema>
export type EffectiveKnowledgeInsight = z.infer<typeof EffectiveKnowledgeInsightSchema>
export type PeriodEvaluationRollup = z.infer<typeof PeriodEvaluationRollupSchema>
export type FeedbackItem = z.infer<typeof FeedbackItemSchema>
export type DisciplineDimension = z.infer<typeof DisciplineDimensionSchema>
export type DisciplineScore = z.infer<typeof DisciplineScoreSchema>
export type RuleHit = z.infer<typeof RuleHitSchema>
export type RuleRollupEntry = z.infer<typeof RuleRollupEntrySchema>
export type SetupLeaderboardEntry = z.infer<typeof SetupLeaderboardEntrySchema>
export type UserProfile = z.infer<typeof UserProfileSchema>
export type TrainingInsight = z.infer<typeof TrainingInsightSchema>
export type RankingExplanation = z.infer<typeof RankingExplanationSchema>
export type RankingExplanationPayload = z.infer<typeof RankingExplanationPayloadSchema>
export type MemoryUpdateProposal = z.infer<typeof MemoryUpdateProposalSchema>
export type MemoryProposalPayload = z.infer<typeof MemoryProposalPayloadSchema>
export type ReviewableMemoryActionInput = z.infer<typeof ReviewableMemoryActionInputSchema>
