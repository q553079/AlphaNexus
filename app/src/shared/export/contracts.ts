import { z } from 'zod'
import { EntityIdSchema } from '@shared/contracts/base'

export const ExportSessionMarkdownInputSchema = z.object({
  session_id: EntityIdSchema,
})

export const SessionExportEventSchema = z.object({
  label: z.string().min(1),
  timestamp: z.string().min(1),
  summary: z.string(),
  screenshotIds: z.array(EntityIdSchema).optional(),
})

export const SessionExportInsightSchema = z.object({
  providerId: EntityIdSchema,
  summary: z.string(),
  detailsMarkdown: z.string().optional(),
})

export const SessionExportPayloadSchema = z.object({
  sessionId: EntityIdSchema,
  title: z.string().min(1),
  notes: z.string(),
  events: z.array(SessionExportEventSchema),
  aiInsights: z.array(SessionExportInsightSchema).optional(),
})

export const MarkdownExportOptionsSchema = z.object({
  includeEvents: z.boolean(),
  includeAiSummaries: z.boolean(),
})

export const SessionMarkdownExportSchema = z.object({
  file_path: z.string().min(1),
  markdown: z.string(),
})

export type ExportSessionMarkdownInput = z.infer<typeof ExportSessionMarkdownInputSchema>
export type SessionExportPayload = z.infer<typeof SessionExportPayloadSchema>
export type MarkdownExportOptions = z.infer<typeof MarkdownExportOptionsSchema>
export type SessionMarkdownExport = z.infer<typeof SessionMarkdownExportSchema>

export const defaultMarkdownExportOptions: MarkdownExportOptions = {
  includeEvents: true,
  includeAiSummaries: true,
}
