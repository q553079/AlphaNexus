import { z } from 'zod'
import { AnnotationSchema, ScreenshotSchema } from '@shared/contracts/content'
import { EntityIdSchema } from '@shared/contracts/base'
import { CaptureKindSchema, SourceViewSchema } from '@shared/contracts/current-context'

export const ImportScreenshotInputSchema = z.object({
  session_id: EntityIdSchema,
  trade_id: EntityIdSchema.nullable().optional(),
  contract_id: EntityIdSchema.optional(),
  period_id: EntityIdSchema.optional(),
  source_view: SourceViewSchema.optional(),
  kind: CaptureKindSchema.default('chart'),
})

export const SaveScreenshotAnnotationsInputSchema = z.object({
  screenshot_id: EntityIdSchema,
  annotations: z.array(AnnotationSchema.omit({
    id: true,
    schema_version: true,
    created_at: true,
    updated_at: true,
    deleted_at: true,
  })),
})

export const PendingSnipAnnotationSchema = AnnotationSchema.omit({
  id: true,
  schema_version: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
  screenshot_id: true,
})

export const CaptureResultSchema = z.object({
  screenshot: ScreenshotSchema,
  created_event_id: EntityIdSchema.nullable(),
})

export const CaptureCommandResultSchema = z.object({
  ok: z.literal(true),
})

export const CaptureSessionContextInputSchema = z.object({
  session_id: EntityIdSchema.nullable().optional(),
  contract_id: EntityIdSchema.nullable().optional(),
  period_id: EntityIdSchema.nullable().optional(),
  trade_id: EntityIdSchema.nullable().optional(),
  source_view: SourceViewSchema.optional(),
  kind: CaptureKindSchema.default('chart'),
})

export const CaptureTargetContextInputSchema = z.object({
  session_id: EntityIdSchema.nullable().optional(),
  contract_id: EntityIdSchema.nullable().optional(),
  period_id: EntityIdSchema.nullable().optional(),
  trade_id: EntityIdSchema.nullable().optional(),
  source_view: SourceViewSchema.optional(),
  kind: CaptureKindSchema.optional(),
})

export const OpenSnipCaptureInputSchema = z.object({
  session_id: EntityIdSchema.optional(),
  contract_id: EntityIdSchema.optional(),
  period_id: EntityIdSchema.optional(),
  trade_id: EntityIdSchema.nullable().optional(),
  source_view: SourceViewSchema.optional(),
  kind: CaptureKindSchema.default('chart'),
}).optional()

export const CaptureSelectionSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().positive().max(1),
  height: z.number().positive().max(1),
})

export const PendingSnipCaptureSchema = z.object({
  session_id: EntityIdSchema,
  contract_id: EntityIdSchema.optional(),
  period_id: EntityIdSchema.optional(),
  trade_id: EntityIdSchema.nullable().optional(),
  source_view: SourceViewSchema.optional(),
  kind: CaptureKindSchema,
  display_label: z.string().min(1),
  target_kind: z.enum(['session', 'trade']),
  target_label: z.string().min(1),
  target_subtitle: z.string(),
  session_title: z.string().min(1),
  contract_symbol: z.string().min(1),
  open_trade_id: EntityIdSchema.nullable().optional(),
  open_trade_label: z.string().nullable().optional(),
  source_width: z.number().positive(),
  source_height: z.number().positive(),
  source_data_url: z.string().min(1),
})

export const SnipCaptureSelectionInputSchema = z.object({
  selection: CaptureSelectionSchema,
})

export const SavePendingSnipInputSchema = z.object({
  selection: CaptureSelectionSchema,
  trade_id: EntityIdSchema.nullable().optional(),
  target_context: CaptureTargetContextInputSchema.optional(),
  annotations: z.array(PendingSnipAnnotationSchema).max(64).optional(),
  note_text: z.string().trim().max(12_000).optional(),
  run_ai: z.boolean().default(false),
  kind: CaptureKindSchema.optional(),
})

export const SavePendingSnipResultSchema = CaptureResultSchema.extend({
  created_note_block_id: EntityIdSchema.nullable().optional(),
  ai_run_id: EntityIdSchema.nullable().optional(),
  ai_error: z.string().nullable().optional(),
})

export type ImportScreenshotInput = z.infer<typeof ImportScreenshotInputSchema>
export type SaveScreenshotAnnotationsInput = z.infer<typeof SaveScreenshotAnnotationsInputSchema>
export type PendingSnipAnnotationInput = z.infer<typeof PendingSnipAnnotationSchema>
export type CaptureResult = z.infer<typeof CaptureResultSchema>
export type CaptureCommandResult = z.infer<typeof CaptureCommandResultSchema>
export type CaptureSessionContextInput = z.infer<typeof CaptureSessionContextInputSchema>
export type CaptureTargetContextInput = z.infer<typeof CaptureTargetContextInputSchema>
export type OpenSnipCaptureInput = z.infer<typeof OpenSnipCaptureInputSchema>
export type CaptureSelection = z.infer<typeof CaptureSelectionSchema>
export type PendingSnipCapture = z.infer<typeof PendingSnipCaptureSchema>
export type SnipCaptureSelectionInput = z.infer<typeof SnipCaptureSelectionInputSchema>
export type SavePendingSnipInput = z.infer<typeof SavePendingSnipInputSchema>
export type SavePendingSnipResult = z.infer<typeof SavePendingSnipResultSchema>
