import { z } from 'zod'
import { AuditFieldsSchema, EntityIdSchema, IsoDateTimeSchema } from '@shared/contracts/base'

export const EventTypeSchema = z.enum([
  'observation',
  'thesis',
  'trade_open',
  'trade_add',
  'trade_reduce',
  'trade_close',
  'trade_cancel',
  'screenshot',
  'ai_summary',
  'review',
])

export const EventSchema = AuditFieldsSchema.extend({
  session_id: EntityIdSchema,
  trade_id: EntityIdSchema.nullable(),
  event_type: EventTypeSchema,
  title: z.string().min(1),
  summary: z.string(),
  author_kind: z.enum(['user', 'ai', 'system']),
  occurred_at: IsoDateTimeSchema,
  content_block_ids: z.array(EntityIdSchema),
  screenshot_id: EntityIdSchema.nullable(),
  ai_run_id: EntityIdSchema.nullable(),
})

export type EventRecord = z.infer<typeof EventSchema>
