import { AnalysisCardSchema, AiRunSchema } from '@shared/contracts/analysis'
import { AnnotationSchema, ContentBlockSchema, ScreenshotSchema, type AnnotationRecord } from '@shared/contracts/content'
import { EventSchema } from '@shared/contracts/event'
import { ContractSchema, PeriodSchema, SessionSchema } from '@shared/contracts/session'
import { EvaluationSchema, TradeSchema } from '@shared/contracts/trade'
import { parseJsonArray } from '@main/db/repositories/workbench-utils'

export const mapContract = (row: Record<string, unknown>) => ContractSchema.parse(row)
export const mapPeriod = (row: Record<string, unknown>) => PeriodSchema.parse(row)
export const mapSession = (row: Record<string, unknown>) => SessionSchema.parse({ ...row, tags: parseJsonArray<string>(row.tags_json) })
export const mapTrade = (row: Record<string, unknown>) => TradeSchema.parse(row)
export const mapEvent = (row: Record<string, unknown>) => EventSchema.parse({ ...row, content_block_ids: parseJsonArray<string>(row.content_block_ids_json) })
export const mapContentBlock = (row: Record<string, unknown>) => ContentBlockSchema.parse({ ...row, soft_deleted: Boolean(row.soft_deleted) })
export const mapAiRun = (row: Record<string, unknown>) => AiRunSchema.parse({
  ...row,
  prompt_preview: typeof row.prompt_preview === 'string' ? row.prompt_preview : '',
  raw_response_text: typeof row.raw_response_text === 'string' ? row.raw_response_text : '',
  structured_response_json: typeof row.structured_response_json === 'string' ? row.structured_response_json : '{}',
})
export const mapAnalysisCard = (row: Record<string, unknown>) => AnalysisCardSchema.parse({ ...row, supporting_factors: parseJsonArray<string>(row.supporting_factors_json) })
export const mapEvaluation = (row: Record<string, unknown>) => EvaluationSchema.parse(row)
export const mapAnnotation = (row: Record<string, unknown>) => AnnotationSchema.parse({
  ...row,
  title: typeof row.title === 'string' && row.title.trim().length > 0
    ? row.title
    : String(row.label),
  semantic_type: typeof row.semantic_type === 'string' && row.semantic_type.trim().length > 0
    ? row.semantic_type
    : null,
  note_md: typeof row.note_md === 'string'
    ? row.note_md
    : typeof row.text === 'string'
      ? row.text
      : '',
  add_to_memory: Boolean(row.add_to_memory),
})

export const mapScreenshot = (
  row: Record<string, unknown>,
  annotationsByShot: Map<string, AnnotationRecord[]>,
  deletedAnnotationsByShot: Map<string, AnnotationRecord[]> = new Map(),
) => ScreenshotSchema.parse({
  ...row,
  raw_file_path: typeof row.raw_file_path === 'string' && row.raw_file_path.length > 0
    ? row.raw_file_path
    : String(row.file_path),
  raw_asset_url: typeof row.raw_asset_url === 'string' && row.raw_asset_url.length > 0
    ? row.raw_asset_url
    : String(row.asset_url),
  annotated_file_path: typeof row.annotated_file_path === 'string' && row.annotated_file_path.length > 0
    ? row.annotated_file_path
    : null,
  annotated_asset_url: typeof row.annotated_asset_url === 'string' && row.annotated_asset_url.length > 0
    ? row.annotated_asset_url
    : null,
  annotations_json_path: typeof row.annotations_json_path === 'string' && row.annotations_json_path.length > 0
    ? row.annotations_json_path
    : null,
  annotations: annotationsByShot.get(String(row.id)) ?? [],
  deleted_annotations: deletedAnnotationsByShot.get(String(row.id)) ?? [],
})
