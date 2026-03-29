import { z } from 'zod'
import { AuditFieldsSchema, EntityIdSchema } from '@shared/contracts/base'

export const AnnotationShapeSchema = z.enum([
  'rectangle',
  'ellipse',
  'line',
  'arrow',
  'text',
  'brush',
  'fib_retracement',
])
export const AnnotationSemanticTypeSchema = z.enum([
  'support',
  'resistance',
  'liquidity',
  'fvg',
  'imbalance',
  'entry',
  'invalidation',
  'target',
  'path',
  'context',
])
export const ContentContextTypeSchema = z.enum(['session', 'event', 'trade', 'period'])
export const MovableContentContextTypeSchema = z.enum(['session', 'trade', 'period'])
export const ScreenshotAnalysisRoleSchema = z.enum(['event', 'background'])
export const ScreenshotBackgroundLayerSchema = z.enum(['macro', 'htf', 'structure', 'execution', 'custom'])

export const AnnotationSchema = AuditFieldsSchema.extend({
  screenshot_id: EntityIdSchema,
  shape: AnnotationShapeSchema,
  label: z.string().min(1),
  title: z.string().min(1),
  semantic_type: AnnotationSemanticTypeSchema.nullable(),
  color: z.string().min(1),
  x1: z.number(),
  y1: z.number(),
  x2: z.number(),
  y2: z.number(),
  text: z.string().nullable(),
  note_md: z.string(),
  add_to_memory: z.boolean(),
  stroke_width: z.number().positive(),
})

export const ScreenshotSchema = AuditFieldsSchema.extend({
  session_id: EntityIdSchema,
  event_id: EntityIdSchema.nullable(),
  kind: z.enum(['chart', 'execution', 'exit']),
  analysis_role: ScreenshotAnalysisRoleSchema.default('event'),
  analysis_session_id: EntityIdSchema.nullable().default(null),
  background_layer: ScreenshotBackgroundLayerSchema.nullable().default(null),
  background_label: z.string().nullable().default(null),
  background_note_md: z.string().default(''),
  file_path: z.string().min(1),
  asset_url: z.string().min(1),
  raw_file_path: z.string().min(1),
  raw_asset_url: z.string().min(1),
  annotated_file_path: z.string().nullable(),
  annotated_asset_url: z.string().nullable(),
  annotations_json_path: z.string().nullable(),
  caption: z.string().nullable(),
  width: z.number().positive(),
  height: z.number().positive(),
  annotations: z.array(AnnotationSchema),
  deleted_annotations: z.array(AnnotationSchema).default([]),
})

export const ContentBlockMoveAuditSchema = z.object({
  id: EntityIdSchema,
  schema_version: z.number().int().positive(),
  block_id: EntityIdSchema,
  from_context_type: ContentContextTypeSchema,
  from_context_id: EntityIdSchema,
  to_context_type: MovableContentContextTypeSchema,
  to_context_id: EntityIdSchema,
  from_session_id: EntityIdSchema,
  to_session_id: EntityIdSchema,
  moved_at: z.string().min(1),
})

export const ContentBlockSchema = AuditFieldsSchema.extend({
  session_id: EntityIdSchema,
  event_id: EntityIdSchema.nullable(),
  block_type: z.enum(['markdown', 'checklist', 'quote', 'ai-summary']),
  title: z.string().min(1),
  content_md: z.string(),
  sort_order: z.number().int(),
  context_type: ContentContextTypeSchema,
  context_id: EntityIdSchema,
  soft_deleted: z.boolean(),
  move_history: z.array(ContentBlockMoveAuditSchema).default([]),
})

export type AnnotationRecord = z.infer<typeof AnnotationSchema>
export type ScreenshotRecord = z.infer<typeof ScreenshotSchema>
export type ScreenshotAnalysisRole = z.infer<typeof ScreenshotAnalysisRoleSchema>
export type ScreenshotBackgroundLayer = z.infer<typeof ScreenshotBackgroundLayerSchema>
export type ContentBlockMoveAuditRecord = z.infer<typeof ContentBlockMoveAuditSchema>
export type ContentBlockRecord = z.infer<typeof ContentBlockSchema>
