import { z } from 'zod'
import { AuditFieldsSchema, EntityIdSchema, IsoDateTimeSchema } from '@shared/contracts/base'

export const ContractSchema = AuditFieldsSchema.extend({
  symbol: z.string().min(1),
  name: z.string().min(1),
  venue: z.string().min(1),
  asset_class: z.enum(['future', 'equity', 'crypto', 'fx', 'index']),
  quote_currency: z.string().min(1),
})

export const PeriodSchema = AuditFieldsSchema.extend({
  kind: z.enum(['day', 'week', 'month']),
  label: z.string().min(1),
  start_at: IsoDateTimeSchema,
  end_at: IsoDateTimeSchema,
})

export const SessionSchema = AuditFieldsSchema.extend({
  contract_id: EntityIdSchema,
  period_id: EntityIdSchema,
  title: z.string().min(1),
  status: z.enum(['planned', 'active', 'closed']),
  started_at: IsoDateTimeSchema,
  ended_at: IsoDateTimeSchema.nullable(),
  market_bias: z.enum(['bullish', 'bearish', 'range', 'neutral']),
  tags: z.array(z.string()),
  my_realtime_view: z.string(),
  trade_plan_md: z.string(),
  context_focus: z.string(),
})

export type ContractRecord = z.infer<typeof ContractSchema>
export type PeriodRecord = z.infer<typeof PeriodSchema>
export type SessionRecord = z.infer<typeof SessionSchema>
