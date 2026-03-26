import type { LocalFirstPaths } from '@main/app-shell/paths'
import { getDatabase } from '@main/db/connection'
import {
  createAiAnalysisArtifacts,
  setAiRecordDeletedState,
  setAnnotationDeletedState,
  loadPeriodReview,
  loadSessionWorkbench,
  loadTradeDetail,
  setContentBlockDeletedState,
  setScreenshotDeletedState,
  upsertSessionRealtimeViewBlock,
} from '@main/db/repositories/workbench-repository'

export const fetchSessionWorkbench = async(paths: LocalFirstPaths, sessionId?: string) => {
  const db = await getDatabase(paths)
  return loadSessionWorkbench(db, sessionId)
}

export const fetchTradeDetail = async(paths: LocalFirstPaths, tradeId?: string) => {
  const db = await getDatabase(paths)
  return loadTradeDetail(db, tradeId)
}

export const fetchPeriodReview = async(paths: LocalFirstPaths, periodId?: string) => {
  const db = await getDatabase(paths)
  return loadPeriodReview(db, periodId)
}

export const saveSessionRealtimeView = async(paths: LocalFirstPaths, input: { session_id: string, content_md: string }) => {
  const db = await getDatabase(paths)
  return upsertSessionRealtimeViewBlock(db, input)
}

export const deleteContentBlock = async(paths: LocalFirstPaths, blockId: string) => {
  const db = await getDatabase(paths)
  return setContentBlockDeletedState(db, { block_id: blockId, deleted: true })
}

export const restoreContentBlock = async(paths: LocalFirstPaths, blockId: string) => {
  const db = await getDatabase(paths)
  return setContentBlockDeletedState(db, { block_id: blockId, deleted: false })
}

export const deleteScreenshot = async(paths: LocalFirstPaths, screenshotId: string) => {
  const db = await getDatabase(paths)
  return setScreenshotDeletedState(db, { screenshot_id: screenshotId, deleted: true })
}

export const restoreScreenshot = async(paths: LocalFirstPaths, screenshotId: string) => {
  const db = await getDatabase(paths)
  return setScreenshotDeletedState(db, { screenshot_id: screenshotId, deleted: false })
}

export const deleteAnnotation = async(paths: LocalFirstPaths, annotationId: string) => {
  const db = await getDatabase(paths)
  return setAnnotationDeletedState(db, { annotation_id: annotationId, deleted: true })
}

export const restoreAnnotation = async(paths: LocalFirstPaths, annotationId: string) => {
  const db = await getDatabase(paths)
  return setAnnotationDeletedState(db, { annotation_id: annotationId, deleted: false })
}

export const deleteAiRecord = async(paths: LocalFirstPaths, aiRunId: string) => {
  const db = await getDatabase(paths)
  return setAiRecordDeletedState(db, { ai_run_id: aiRunId, deleted: true })
}

export const restoreAiRecord = async(paths: LocalFirstPaths, aiRunId: string) => {
  const db = await getDatabase(paths)
  return setAiRecordDeletedState(db, { ai_run_id: aiRunId, deleted: false })
}

export const saveAiAnalysisArtifacts = async(
  paths: LocalFirstPaths,
  input: Parameters<typeof createAiAnalysisArtifacts>[1],
) => {
  const db = await getDatabase(paths)
  return createAiAnalysisArtifacts(db, input)
}
