import { z } from 'zod'
import { AnnotationSchema, ScreenshotSchema } from '@shared/contracts/content'
import { EntityIdSchema } from '@shared/contracts/base'

export const CaptureKindSchema = z.enum(['chart', 'execution', 'exit'])

export const ImportScreenshotInputSchema = z.object({
  session_id: EntityIdSchema,
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

export const CaptureResultSchema = z.object({
  screenshot: ScreenshotSchema,
  created_event_id: EntityIdSchema.nullable(),
})

export const CaptureCommandResultSchema = z.object({
  ok: z.literal(true),
})

export const CaptureSessionContextInputSchema = z.object({
  session_id: EntityIdSchema.nullable().optional(),
  kind: CaptureKindSchema.default('chart'),
})

export const OpenSnipCaptureInputSchema = z.object({
  session_id: EntityIdSchema.optional(),
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
  kind: CaptureKindSchema,
  display_label: z.string().min(1),
  source_width: z.number().positive(),
  source_height: z.number().positive(),
  source_data_url: z.string().min(1),
})

export const SnipCaptureSelectionInputSchema = z.object({
  selection: CaptureSelectionSchema,
})

export type ImportScreenshotInput = z.infer<typeof ImportScreenshotInputSchema>
export type SaveScreenshotAnnotationsInput = z.infer<typeof SaveScreenshotAnnotationsInputSchema>
export type CaptureResult = z.infer<typeof CaptureResultSchema>
export type CaptureCommandResult = z.infer<typeof CaptureCommandResultSchema>
export type CaptureSessionContextInput = z.infer<typeof CaptureSessionContextInputSchema>
export type OpenSnipCaptureInput = z.infer<typeof OpenSnipCaptureInputSchema>
export type CaptureSelection = z.infer<typeof CaptureSelectionSchema>
export type PendingSnipCapture = z.infer<typeof PendingSnipCaptureSchema>
export type SnipCaptureSelectionInput = z.infer<typeof SnipCaptureSelectionInputSchema>
