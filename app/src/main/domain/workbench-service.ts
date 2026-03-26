import type { LocalFirstPaths } from '@main/app-shell/paths'
import {
  deleteAiRecord,
  deleteAnnotation,
  deleteScreenshot,
  deleteContentBlock,
  fetchPeriodReview,
  fetchSessionWorkbench,
  fetchTradeDetail,
  restoreAiRecord,
  restoreAnnotation,
  restoreScreenshot,
  restoreContentBlock,
  saveAiAnalysisArtifacts,
  saveSessionRealtimeView,
} from '@main/storage/workbench'
import type {
  GetPeriodReviewInput,
  GetSessionWorkbenchInput,
  GetTradeDetailInput,
  SaveSessionRealtimeViewInput,
  SetAiRecordDeletedInput,
  SetAnnotationDeletedInput,
  SetContentBlockDeletedInput,
  SetScreenshotDeletedInput,
} from '@shared/contracts/workbench'

export const getSessionWorkbench = async(paths: LocalFirstPaths, input?: GetSessionWorkbenchInput) =>
  fetchSessionWorkbench(paths, input?.session_id)

export const getTradeDetail = async(paths: LocalFirstPaths, input?: GetTradeDetailInput) =>
  fetchTradeDetail(paths, input?.trade_id)

export const getPeriodReview = async(paths: LocalFirstPaths, input?: GetPeriodReviewInput) =>
  fetchPeriodReview(paths, input?.period_id)

export const updateSessionRealtimeView = async(paths: LocalFirstPaths, input: SaveSessionRealtimeViewInput) =>
  saveSessionRealtimeView(paths, input)

export const softDeleteContentBlock = async(paths: LocalFirstPaths, input: SetContentBlockDeletedInput) =>
  deleteContentBlock(paths, input.block_id)

export const undeleteContentBlock = async(paths: LocalFirstPaths, input: SetContentBlockDeletedInput) =>
  restoreContentBlock(paths, input.block_id)

export const softDeleteScreenshot = async(paths: LocalFirstPaths, input: SetScreenshotDeletedInput) =>
  deleteScreenshot(paths, input.screenshot_id)

export const undeleteScreenshot = async(paths: LocalFirstPaths, input: SetScreenshotDeletedInput) =>
  restoreScreenshot(paths, input.screenshot_id)

export const softDeleteAnnotation = async(paths: LocalFirstPaths, input: SetAnnotationDeletedInput) =>
  deleteAnnotation(paths, input.annotation_id)

export const undeleteAnnotation = async(paths: LocalFirstPaths, input: SetAnnotationDeletedInput) =>
  restoreAnnotation(paths, input.annotation_id)

export const softDeleteAiRecord = async(paths: LocalFirstPaths, input: SetAiRecordDeletedInput) =>
  deleteAiRecord(paths, input.ai_run_id)

export const undeleteAiRecord = async(paths: LocalFirstPaths, input: SetAiRecordDeletedInput) =>
  restoreAiRecord(paths, input.ai_run_id)

export const recordAiAnalysis = async(
  paths: LocalFirstPaths,
  input: Parameters<typeof saveAiAnalysisArtifacts>[1],
) => saveAiAnalysisArtifacts(paths, input)
