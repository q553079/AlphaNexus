import { z } from 'zod'
import { EntityIdSchema, IsoDateTimeSchema, SchemaVersionSchema } from '@shared/contracts/base'

export const ReviewCaseSelectionModeSchema = z.enum(['single', 'range', 'pinned'])

export const ReviewCaseEventSelectionSnapshotSchema = z.object({
  mode: ReviewCaseSelectionModeSchema,
  primary_event_id: EntityIdSchema.nullable().default(null),
  selected_event_ids: z.array(EntityIdSchema).default([]),
  range_anchor_id: EntityIdSchema.nullable().default(null),
  pinned_event_ids: z.array(EntityIdSchema).default([]),
})

export const ReviewCaseAnalysisTraySnapshotSchema = z.object({
  event_ids: z.array(EntityIdSchema).default([]),
  screenshot_ids: z.array(EntityIdSchema).default([]),
  primary_event_id: EntityIdSchema.nullable().default(null),
  primary_screenshot_id: EntityIdSchema.nullable().default(null),
  compare_screenshot_id: EntityIdSchema.nullable().default(null),
})

export const ReviewCaseSnapshotSchema = z.object({
  event_selection: ReviewCaseEventSelectionSnapshotSchema,
  analysis_tray: ReviewCaseAnalysisTraySnapshotSchema,
})

export const ReviewCaseSchema = z.object({
  id: EntityIdSchema,
  schema_version: SchemaVersionSchema,
  created_at: IsoDateTimeSchema,
  updated_at: IsoDateTimeSchema,
  source_session_id: EntityIdSchema,
  title: z.string().trim().min(1).max(160),
  summary_md: z.string(),
  ai_summary_md: z.string(),
  selection_mode: ReviewCaseSelectionModeSchema,
  time_range_start: IsoDateTimeSchema.nullable(),
  time_range_end: IsoDateTimeSchema.nullable(),
  event_ids: z.array(EntityIdSchema).default([]),
  screenshot_ids: z.array(EntityIdSchema).default([]),
  snapshot: ReviewCaseSnapshotSchema.nullable().default(null),
})

export const SaveReviewCaseInputSchema = z.object({
  source_session_id: EntityIdSchema,
  title: z.string().trim().min(1).max(160),
  summary_md: z.string().default(''),
  ai_summary_md: z.string().default(''),
  selection_mode: ReviewCaseSelectionModeSchema,
  event_ids: z.array(EntityIdSchema).min(1).max(128),
  screenshot_ids: z.array(EntityIdSchema).max(128).default([]),
  time_range_start: IsoDateTimeSchema.nullable().optional(),
  time_range_end: IsoDateTimeSchema.nullable().optional(),
  snapshot: ReviewCaseSnapshotSchema.optional(),
})

export const GetReviewCaseInputSchema = z.object({
  review_case_id: EntityIdSchema,
})

export const ListReviewCasesInputSchema = z.object({
  session_id: EntityIdSchema.optional(),
}).optional()

export type ReviewCaseSelectionMode = z.infer<typeof ReviewCaseSelectionModeSchema>
export type ReviewCaseEventSelectionSnapshot = z.infer<typeof ReviewCaseEventSelectionSnapshotSchema>
export type ReviewCaseAnalysisTraySnapshot = z.infer<typeof ReviewCaseAnalysisTraySnapshotSchema>
export type ReviewCaseSnapshot = z.infer<typeof ReviewCaseSnapshotSchema>
export type ReviewCaseRecord = z.infer<typeof ReviewCaseSchema>
export type SaveReviewCaseInput = z.infer<typeof SaveReviewCaseInputSchema>
export type GetReviewCaseInput = z.infer<typeof GetReviewCaseInputSchema>
export type ListReviewCasesInput = z.infer<typeof ListReviewCasesInputSchema>
