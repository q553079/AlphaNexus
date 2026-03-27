import { z } from 'zod'
import { AuditFieldsSchema, EntityIdSchema, IsoDateTimeSchema } from '@shared/contracts/base'

export const TradeSideSchema = z.enum(['long', 'short'])
export const TradeStatusSchema = z.enum(['planned', 'open', 'closed', 'canceled'])

export const TradeSchema = AuditFieldsSchema.extend({
  session_id: EntityIdSchema,
  symbol: z.string().min(1),
  side: TradeSideSchema,
  status: TradeStatusSchema,
  quantity: z.number().positive(),
  entry_price: z.number(),
  stop_loss: z.number(),
  take_profit: z.number(),
  exit_price: z.number().nullable(),
  pnl_r: z.number().nullable(),
  opened_at: IsoDateTimeSchema,
  closed_at: IsoDateTimeSchema.nullable(),
  thesis: z.string(),
})

export const EvaluationSchema = AuditFieldsSchema.extend({
  session_id: EntityIdSchema,
  trade_id: EntityIdSchema,
  score: z.number().min(0).max(100),
  note_md: z.string(),
})

export type TradeRecord = z.infer<typeof TradeSchema>
export type EvaluationRecord = z.infer<typeof EvaluationSchema>
