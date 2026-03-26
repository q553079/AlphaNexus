import { z } from 'zod'
import { AuditFieldsSchema, EntityIdSchema } from '@shared/contracts/base'
import { TradeSideSchema, TradeStatusSchema, type TradeRecord } from '@shared/contracts/trade'
import { selectCurrentTrade } from '@shared/contracts/workbench-trade'
import { MovableContentContextTypeSchema } from '@shared/contracts/content'

export const CaptureKindSchema = z.enum(['chart', 'execution', 'exit'])

export const SourceViewSchema = z.enum([
  'launcher',
  'session-workbench',
  'trade-detail',
  'period-review',
  'capture-overlay',
])

export const CurrentContextSchema = AuditFieldsSchema.extend({
  contract_id: EntityIdSchema,
  period_id: EntityIdSchema,
  session_id: EntityIdSchema,
  trade_id: EntityIdSchema.nullable(),
  source_view: SourceViewSchema,
  capture_kind: CaptureKindSchema,
})

export const CurrentTargetOptionSchema = z.object({
  id: z.string().min(1),
  target_kind: MovableContentContextTypeSchema,
  contract_id: EntityIdSchema,
  period_id: EntityIdSchema,
  session_id: EntityIdSchema,
  trade_id: EntityIdSchema.nullable(),
  label: z.string().min(1),
  subtitle: z.string(),
  is_current: z.boolean(),
  trade_status: TradeStatusSchema.nullable(),
  trade_side: TradeSideSchema.nullable(),
  depth: z.number().int().nonnegative().default(0),
  parent_target_id: z.string().min(1).nullable().default(null),
  period_label: z.string().nullable().default(null),
  session_title: z.string().nullable().default(null),
  search_text: z.string().default(''),
  previous_period_trade_index: z.number().int().positive().nullable().default(null),
})

export const GetCurrentContextInputSchema = z.object({
  session_id: EntityIdSchema.optional(),
  source_view: SourceViewSchema.optional(),
}).optional()

export const SetCurrentContextInputSchema = z.object({
  session_id: EntityIdSchema,
  contract_id: EntityIdSchema.optional(),
  period_id: EntityIdSchema.optional(),
  trade_id: EntityIdSchema.nullable().optional(),
  source_view: SourceViewSchema.default('session-workbench'),
  capture_kind: CaptureKindSchema.default('chart'),
})

export const ListTargetOptionsInputSchema = z.object({
  session_id: EntityIdSchema.optional(),
  include_period_targets: z.boolean().default(false),
}).optional()

export const TargetOptionGroupsSchema = z.object({
  current: z.array(CurrentTargetOptionSchema).default([]),
  recent: z.array(CurrentTargetOptionSchema).default([]),
  history: z.array(CurrentTargetOptionSchema).default([]),
  previous_period_trades: z.array(CurrentTargetOptionSchema).default([]),
})

export const CurrentTargetOptionsPayloadSchema = z.object({
  current_context: CurrentContextSchema,
  options: z.array(CurrentTargetOptionSchema),
  groups: TargetOptionGroupsSchema,
})

export const resolveTradeForCurrentContext = (
  trades: TradeRecord[],
  tradeId?: string | null,
): TradeRecord | null =>
  (tradeId ? trades.find((trade) => trade.id === tradeId) ?? null : null) ?? selectCurrentTrade(trades)

export type CaptureKind = z.infer<typeof CaptureKindSchema>
export type SourceView = z.infer<typeof SourceViewSchema>
export type CurrentContext = z.infer<typeof CurrentContextSchema>
export type CurrentTargetOption = z.infer<typeof CurrentTargetOptionSchema>
export type GetCurrentContextInput = z.infer<typeof GetCurrentContextInputSchema>
export type SetCurrentContextInput = z.infer<typeof SetCurrentContextInputSchema>
export type ListTargetOptionsInput = z.infer<typeof ListTargetOptionsInputSchema>
export type CurrentTargetOptionsPayload = z.infer<typeof CurrentTargetOptionsPayloadSchema>
export type TargetOptionGroups = z.infer<typeof TargetOptionGroupsSchema>
