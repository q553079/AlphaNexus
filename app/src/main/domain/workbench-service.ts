import type { LocalFirstPaths } from '@main/app-shell/paths'
import {
  addTradePosition,
  cancelTradePosition,
  closeTradePosition,
  createWorkbenchNote,
  createTrade,
  deleteAiRecord,
  deleteAnnotation,
  deleteScreenshot,
  deleteContentBlock,
  fetchPeriodReview,
  fetchCurrentContext,
  fetchSessionWorkbench,
  fetchTargetOptions,
  fetchTradeDetail,
  reorderWorkbenchNotes,
  moveWorkbenchContentBlock,
  moveWorkbenchScreenshot,
  reduceTradePosition,
  restoreAiRecord,
  restoreAnnotation,
  restoreScreenshot,
  restoreContentBlock,
  saveCurrentContext,
  saveAiAnalysisArtifacts,
  saveAiAnalysisFailure,
  saveSessionRealtimeView,
  updateAnnotation,
  updateWorkbenchNote,
} from '@main/storage/workbench'
import type {
  CreateWorkbenchNoteBlockInput,
  CurrentContext,
  CurrentTargetOptionsPayload,
  GetCurrentContextInput,
  MoveScreenshotInput,
  ReorderContentBlocksInput,
  GetPeriodReviewInput,
  GetSessionWorkbenchInput,
  GetTradeDetailInput,
  ListTargetOptionsInput,
  MoveContentBlockInput,
  OpenTradeInput,
  AddToTradeInput,
  CancelTradeInput,
  CloseTradeInput,
  ReduceTradeInput,
  SaveSessionRealtimeViewInput,
  SetCurrentContextInput,
  SetAiRecordDeletedInput,
  SetAnnotationDeletedInput,
  SetContentBlockDeletedInput,
  SetScreenshotDeletedInput,
  UpdateAnnotationInput,
  UpdateWorkbenchNoteBlockInput,
} from '@shared/contracts/workbench'

export const getSessionWorkbench = async(paths: LocalFirstPaths, input?: GetSessionWorkbenchInput) =>
  fetchSessionWorkbench(paths, input?.session_id)

export const getTradeDetail = async(paths: LocalFirstPaths, input?: GetTradeDetailInput) =>
  fetchTradeDetail(paths, input?.trade_id)

export const getPeriodReview = async(paths: LocalFirstPaths, input?: GetPeriodReviewInput) =>
  fetchPeriodReview(paths, input?.period_id)

export const getCurrentWorkbenchContext = async(paths: LocalFirstPaths, input?: GetCurrentContextInput): Promise<CurrentContext> =>
  fetchCurrentContext(paths, input)

export const setCurrentWorkbenchContext = async(paths: LocalFirstPaths, input: SetCurrentContextInput): Promise<CurrentContext> =>
  saveCurrentContext(paths, input)

export const listWorkbenchTargetOptions = async(paths: LocalFirstPaths, input?: ListTargetOptionsInput): Promise<CurrentTargetOptionsPayload> =>
  fetchTargetOptions(paths, input)

export const openTradeForSession = async(paths: LocalFirstPaths, input: OpenTradeInput) =>
  createTrade(paths, input)

export const addToExistingTrade = async(paths: LocalFirstPaths, input: AddToTradeInput) =>
  addTradePosition(paths, input)

export const reduceExistingTrade = async(paths: LocalFirstPaths, input: ReduceTradeInput) =>
  reduceTradePosition(paths, input)

export const closeExistingTrade = async(paths: LocalFirstPaths, input: CloseTradeInput) =>
  closeTradePosition(paths, input)

export const cancelExistingTrade = async(paths: LocalFirstPaths, input: CancelTradeInput) =>
  cancelTradePosition(paths, input)

export const updateSessionRealtimeView = async(paths: LocalFirstPaths, input: SaveSessionRealtimeViewInput) =>
  saveSessionRealtimeView(paths, input)

export const createWorkbenchNoteBlockForContext = async(paths: LocalFirstPaths, input: CreateWorkbenchNoteBlockInput) =>
  createWorkbenchNote(paths, {
    session_id: input.session_id,
    trade_id: input.trade_id ?? null,
    event_id: input.event_id ?? null,
    title: input.title,
    content_md: input.content_md,
  })

export const updateWorkbenchNoteBlockContent = async(paths: LocalFirstPaths, input: UpdateWorkbenchNoteBlockInput) =>
  updateWorkbenchNote(paths, input)

export const reorderWorkbenchNoteBlocks = async(paths: LocalFirstPaths, input: ReorderContentBlocksInput) =>
  reorderWorkbenchNotes(paths, input)

export const retargetContentBlock = async(paths: LocalFirstPaths, input: MoveContentBlockInput) =>
  moveWorkbenchContentBlock(paths, input)

export const moveScreenshotToTarget = async(paths: LocalFirstPaths, input: MoveScreenshotInput) =>
  moveWorkbenchScreenshot(paths, input)

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

export const updateWorkbenchAnnotation = async(paths: LocalFirstPaths, input: UpdateAnnotationInput) =>
  updateAnnotation(paths, {
    annotation_id: input.annotation_id,
    label: input.label,
    title: input.title,
    semantic_type: input.semantic_type ?? null,
    text: input.text ?? null,
    note_md: input.note_md,
    add_to_memory: input.add_to_memory,
  })

export const softDeleteAiRecord = async(paths: LocalFirstPaths, input: SetAiRecordDeletedInput) =>
  deleteAiRecord(paths, input.ai_run_id)

export const undeleteAiRecord = async(paths: LocalFirstPaths, input: SetAiRecordDeletedInput) =>
  restoreAiRecord(paths, input.ai_run_id)

export const recordAiAnalysis = async(
  paths: LocalFirstPaths,
  input: Parameters<typeof saveAiAnalysisArtifacts>[1],
) => saveAiAnalysisArtifacts(paths, input)

export const recordAiAnalysisFailure = async(
  paths: LocalFirstPaths,
  input: Parameters<typeof saveAiAnalysisFailure>[1],
) => saveAiAnalysisFailure(paths, input)
