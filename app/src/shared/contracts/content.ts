import { z } from 'zod'
import { AuditFieldsSchema, EntityIdSchema } from '@shared/contracts/base'

export const AnnotationShapeSchema = z.enum(['rectangle', 'ellipse', 'line', 'arrow', 'text'])

export const AnnotationSchema = AuditFieldsSchema.extend({
  screenshot_id: EntityIdSchema,
  shape: AnnotationShapeSchema,
  label: z.string().min(1),
  color: z.string().min(1),
  x1: z.number(),
  y1: z.number(),
  x2: z.number(),
  y2: z.number(),
  text: z.string().nullable(),
  stroke_width: z.number().positive(),
})

export const ScreenshotSchema = AuditFieldsSchema.extend({
  session_id: EntityIdSchema,
  event_id: EntityIdSchema.nullable(),
  kind: z.enum(['chart', 'execution', 'exit']),
  file_path: z.string().min(1),
  asset_url: z.string().min(1),
  caption: z.string().nullable(),
  width: z.number().positive(),
  height: z.number().positive(),
  annotations: z.array(AnnotationSchema),
  deleted_annotations: z.array(AnnotationSchema).default([]),
})

export const ContentBlockSchema = AuditFieldsSchema.extend({
  session_id: EntityIdSchema,
  event_id: EntityIdSchema.nullable(),
  block_type: z.enum(['markdown', 'checklist', 'quote', 'ai-summary']),
  title: z.string().min(1),
  content_md: z.string(),
  sort_order: z.number().int(),
  context_type: z.enum(['session', 'event', 'trade']),
  context_id: EntityIdSchema,
  soft_deleted: z.boolean(),
})

export type AnnotationRecord = z.infer<typeof AnnotationSchema>
export type ScreenshotRecord = z.infer<typeof ScreenshotSchema>
export type ContentBlockRecord = z.infer<typeof ContentBlockSchema>
