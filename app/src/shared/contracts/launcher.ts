import { z } from 'zod'
import { EntityIdSchema, IsoDateTimeSchema } from '@shared/contracts/base'
import { ContractSchema, SessionSchema } from '@shared/contracts/session'

export const SessionBucketSchema = z.enum(['am', 'pm', 'night', 'custom'])

export const LauncherSessionSummarySchema = z.object({
  id: EntityIdSchema,
  title: z.string().min(1),
  status: SessionSchema.shape.status,
  started_at: IsoDateTimeSchema,
  contract_symbol: z.string().min(1),
  event_count: z.number().int().min(0),
  trade_count: z.number().int().min(0),
})

export const LauncherHomePayloadSchema = z.object({
  contracts: z.array(ContractSchema),
  active_session: LauncherSessionSummarySchema.nullable(),
  recent_sessions: z.array(LauncherSessionSummarySchema),
})

export const CreateSessionInputSchema = z.object({
  contract_id: EntityIdSchema,
  bucket: SessionBucketSchema,
  title: z.string().trim().min(1).optional(),
  market_bias: SessionSchema.shape.market_bias.default('neutral'),
  context_focus: z.string().default(''),
  trade_plan_md: z.string().default(''),
  tags: z.array(z.string().trim().min(1)).default([]),
})

export const CreateSessionResultSchema = z.object({
  session: SessionSchema,
})

export type SessionBucket = z.infer<typeof SessionBucketSchema>
export type LauncherSessionSummary = z.infer<typeof LauncherSessionSummarySchema>
export type LauncherHomePayload = z.infer<typeof LauncherHomePayloadSchema>
export type CreateSessionInput = z.infer<typeof CreateSessionInputSchema>
export type CreateSessionResult = z.infer<typeof CreateSessionResultSchema>
