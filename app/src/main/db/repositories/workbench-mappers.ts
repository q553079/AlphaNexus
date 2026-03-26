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
export const mapAiRun = (row: Record<string, unknown>) => AiRunSchema.parse(row)
export const mapAnalysisCard = (row: Record<string, unknown>) => AnalysisCardSchema.parse({ ...row, supporting_factors: parseJsonArray<string>(row.supporting_factors_json) })
export const mapEvaluation = (row: Record<string, unknown>) => EvaluationSchema.parse(row)
export const mapAnnotation = (row: Record<string, unknown>) => AnnotationSchema.parse(row)

export const mapScreenshot = (
  row: Record<string, unknown>,
  annotationsByShot: Map<string, AnnotationRecord[]>,
  deletedAnnotationsByShot: Map<string, AnnotationRecord[]> = new Map(),
) => ScreenshotSchema.parse({
  ...row,
  annotations: annotationsByShot.get(String(row.id)) ?? [],
  deleted_annotations: deletedAnnotationsByShot.get(String(row.id)) ?? [],
})
