import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type { AlphaNexusApi } from '@shared/contracts/workbench'
import type { ReviewableMemoryActionInput } from '@shared/contracts/evaluation'
import type { ExportSessionMarkdownInput } from '@shared/export/contracts'
import type { ContinueSessionInput, CreateSessionInput } from '@shared/contracts/launcher'
import type {
  ApplySuggestionActionInput,
  AdoptMarketAnchorInput,
  GetActiveMarketAnchorsInput,
  GetAnchorReviewSuggestionsInput,
  AddToTradeInput,
  CancelTradeInput,
  MoveContentBlockInput,
  MoveScreenshotInput,
  SetAiRecordDeletedInput,
  SetAnnotationDeletedInput,
  GetCurrentContextInput,
  CaptureSessionContextInput,
  CloseTradeInput,
  GetComposerSuggestionsInput,
  ListTargetOptionsInput,
  GetKnowledgeGroundingsInput,
  GetApprovedKnowledgeRuntimeInput,
  GetKnowledgeReviewDashboardInput,
  GetRankingExplanationsInput,
  OpenTradeInput,
  GetPeriodReviewInput,
  GetSessionWorkbenchInput,
  GetSimilarCasesInput,
  GetTrainingInsightsInput,
  GetTradeDetailInput,
  GetUserProfileInput,
  IngestKnowledgeSourceInput,
  ListMemoryProposalsInput,
  OpenSnipCaptureInput,
  ReduceTradeInput,
  ReviewKnowledgeCardInput,
  RunAnnotationSuggestionsInput,
  RunAiAnalysisInput,
  SavePendingSnipInput,
  SaveSessionRealtimeViewInput,
  SetCurrentContextInput,
  SetScreenshotDeletedInput,
  SnipCaptureSelectionInput,
  SetContentBlockDeletedInput,
  UpdateAnnotationInput,
  UpdateMarketAnchorStatusInput,
} from '@shared/contracts/workbench'
import type {
  ImportScreenshotInput,
  SavePendingSnipResult,
  SaveScreenshotAnnotationsInput,
} from '@shared/capture/contracts'
import type { RunMockAiAnalysisInput, SaveAiProviderConfigInput } from '@shared/ai/contracts'

const api: AlphaNexusApi = {
  app: {
    ping: () => ipcRenderer.invoke('app:ping'),
    getEnvironment: () => ipcRenderer.invoke('app:get-environment'),
    initializeDatabase: () => ipcRenderer.invoke('db:initialize'),
  },
  launcher: {
    getHome: () => ipcRenderer.invoke('launcher:get-home'),
    createSession: (input: CreateSessionInput) => ipcRenderer.invoke('launcher:create-session', input),
    continueSession: (input: ContinueSessionInput) => ipcRenderer.invoke('launcher:continue-session', input),
  },
  workbench: {
    getSession: (input?: GetSessionWorkbenchInput) => ipcRenderer.invoke('workbench:get-session', input),
    getTradeDetail: (input?: GetTradeDetailInput) => ipcRenderer.invoke('trade:get-detail', input),
    getPeriodReview: (input?: GetPeriodReviewInput) => ipcRenderer.invoke('review:get-period', input),
    getActiveAnchors: (input?: GetActiveMarketAnchorsInput) => ipcRenderer.invoke('workbench:get-active-anchors', input),
    adoptAnchor: (input: AdoptMarketAnchorInput) => ipcRenderer.invoke('workbench:adopt-anchor', input),
    updateAnchorStatus: (input: UpdateMarketAnchorStatusInput) => ipcRenderer.invoke('workbench:update-anchor-status', input),
    getGroundings: (input?: GetKnowledgeGroundingsInput) => ipcRenderer.invoke('workbench:get-groundings', input),
    runAnnotationSuggestions: (input: RunAnnotationSuggestionsInput) => ipcRenderer.invoke('workbench:run-annotation-suggestions', input),
    getComposerSuggestions: (input: GetComposerSuggestionsInput) => ipcRenderer.invoke('workbench:get-composer-suggestions', input),
    getAnchorReviewSuggestions: (input?: GetAnchorReviewSuggestionsInput) => ipcRenderer.invoke('workbench:get-anchor-review-suggestions', input),
    getSimilarCases: (input?: GetSimilarCasesInput) => ipcRenderer.invoke('workbench:get-similar-cases', input),
    applySuggestionAction: (input: ApplySuggestionActionInput) => ipcRenderer.invoke('workbench:apply-suggestion-action', input),
    getUserProfile: (input?: GetUserProfileInput) => ipcRenderer.invoke('workbench:get-user-profile', input),
    getTrainingInsights: (input?: GetTrainingInsightsInput) => ipcRenderer.invoke('workbench:get-training-insights', input),
    getRankingExplanations: (input?: GetRankingExplanationsInput) => ipcRenderer.invoke('workbench:get-ranking-explanations', input),
    listMemoryProposals: (input?: ListMemoryProposalsInput) => ipcRenderer.invoke('workbench:list-memory-proposals', input),
    approveMemoryProposal: (input: ReviewableMemoryActionInput) => ipcRenderer.invoke('workbench:approve-memory-proposal', input),
    rejectMemoryProposal: (input: ReviewableMemoryActionInput) => ipcRenderer.invoke('workbench:reject-memory-proposal', input),
    getCurrentContext: (input?: GetCurrentContextInput) => ipcRenderer.invoke('workbench:get-current-context', input),
    setCurrentContext: (input: SetCurrentContextInput) => ipcRenderer.invoke('workbench:set-current-context', input),
    listTargetOptions: (input?: ListTargetOptionsInput) => ipcRenderer.invoke('workbench:list-target-options', input),
    openTrade: (input: OpenTradeInput) => ipcRenderer.invoke('workbench:open-trade', input),
    addToTrade: (input: AddToTradeInput) => ipcRenderer.invoke('workbench:add-trade', input),
    reduceTrade: (input: ReduceTradeInput) => ipcRenderer.invoke('workbench:reduce-trade', input),
    closeTrade: (input: CloseTradeInput) => ipcRenderer.invoke('workbench:close-trade', input),
    cancelTrade: (input: CancelTradeInput) => ipcRenderer.invoke('workbench:cancel-trade', input),
    saveRealtimeView: (input: SaveSessionRealtimeViewInput) => ipcRenderer.invoke('workbench:save-realtime-view', input),
    createNoteBlock: (input) => ipcRenderer.invoke('workbench:create-note-block', input),
    updateNoteBlock: (input) => ipcRenderer.invoke('workbench:update-note-block', input),
    moveContentBlock: (input: MoveContentBlockInput) => ipcRenderer.invoke('workbench:move-content-block', input),
    moveScreenshot: (input: MoveScreenshotInput) => ipcRenderer.invoke('workbench:move-screenshot', input),
    deleteContentBlock: (input: SetContentBlockDeletedInput) => ipcRenderer.invoke('workbench:delete-content-block', input),
    restoreContentBlock: (input: SetContentBlockDeletedInput) => ipcRenderer.invoke('workbench:restore-content-block', input),
    deleteScreenshot: (input: SetScreenshotDeletedInput) => ipcRenderer.invoke('workbench:delete-screenshot', input),
    restoreScreenshot: (input: SetScreenshotDeletedInput) => ipcRenderer.invoke('workbench:restore-screenshot', input),
    updateAnnotation: (input: UpdateAnnotationInput) => ipcRenderer.invoke('workbench:update-annotation', input),
    deleteAnnotation: (input: SetAnnotationDeletedInput) => ipcRenderer.invoke('workbench:delete-annotation', input),
    restoreAnnotation: (input: SetAnnotationDeletedInput) => ipcRenderer.invoke('workbench:restore-annotation', input),
    deleteAiRecord: (input: SetAiRecordDeletedInput) => ipcRenderer.invoke('workbench:delete-ai-record', input),
    restoreAiRecord: (input: SetAiRecordDeletedInput) => ipcRenderer.invoke('workbench:restore-ai-record', input),
  },
  capture: {
    setSessionContext: (input: CaptureSessionContextInput) => ipcRenderer.invoke('capture:set-session-context', input),
    openSnipCapture: (input?: OpenSnipCaptureInput) => ipcRenderer.invoke('capture:open-snip', input),
    getPendingSnip: () => ipcRenderer.invoke('capture:get-pending-snip'),
    copyPendingSnip: (input: SnipCaptureSelectionInput) => ipcRenderer.invoke('capture:copy-pending-snip', input),
    savePendingSnip: (input: SavePendingSnipInput) => ipcRenderer.invoke('capture:save-pending-snip', input),
    cancelPendingSnip: () => ipcRenderer.invoke('capture:cancel-pending-snip'),
    importImage: (input: ImportScreenshotInput) => ipcRenderer.invoke('capture:import-image', input),
    saveAnnotations: (input: SaveScreenshotAnnotationsInput) => ipcRenderer.invoke('capture:save-annotations', input),
    onSaved: (listener) => {
      const wrapped = (_event: IpcRendererEvent, result: SavePendingSnipResult) => {
        listener(result)
      }

      ipcRenderer.on('capture:saved', wrapped)
      return () => {
        ipcRenderer.removeListener('capture:saved', wrapped)
      }
    },
  },
  ai: {
    listProviders: () => ipcRenderer.invoke('ai:list-providers'),
    saveProviderConfig: (input: SaveAiProviderConfigInput) => ipcRenderer.invoke('ai:save-provider-config', input),
    runAnalysis: (input: RunAiAnalysisInput) => ipcRenderer.invoke('ai:run-analysis', input),
    runMockAnalysis: (input: RunMockAiAnalysisInput) => ipcRenderer.invoke('ai:run-mock-analysis', input),
  },
  knowledge: {
    getReviewDashboard: (input?: GetKnowledgeReviewDashboardInput) => ipcRenderer.invoke('knowledge:get-review-dashboard', input),
    ingestSource: (input: IngestKnowledgeSourceInput) => ipcRenderer.invoke('knowledge:ingest-source', input),
    reviewCard: (input: ReviewKnowledgeCardInput) => ipcRenderer.invoke('knowledge:review-card', input),
    getApprovedRuntime: (input?: GetApprovedKnowledgeRuntimeInput) => ipcRenderer.invoke('knowledge:get-approved-runtime', input),
    getActiveAnchors: (input?: GetActiveMarketAnchorsInput) => ipcRenderer.invoke('knowledge:get-active-anchors', input),
    adoptAnchor: (input: AdoptMarketAnchorInput) => ipcRenderer.invoke('knowledge:adopt-anchor', input),
    updateAnchorStatus: (input: UpdateMarketAnchorStatusInput) => ipcRenderer.invoke('knowledge:update-anchor-status', input),
    getGroundings: (input?: GetKnowledgeGroundingsInput) => ipcRenderer.invoke('knowledge:get-groundings', input),
  },
  export: {
    sessionMarkdown: (input: ExportSessionMarkdownInput) => ipcRenderer.invoke('export:session-markdown', input),
  },
}

contextBridge.exposeInMainWorld('alphaNexus', api)
