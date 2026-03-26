import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type { AlphaNexusApi } from '@shared/contracts/workbench'
import type { ReviewableMemoryActionInput } from '@shared/contracts/evaluation'
import type { ExportSessionMarkdownInput } from '@shared/export/contracts'
import type { CreateSessionInput } from '@shared/contracts/launcher'
import type {
  ApplySuggestionActionInput,
  AdoptMarketAnchorInput,
  GetActiveMarketAnchorsInput,
  GetAnchorReviewSuggestionsInput,
  SetAiRecordDeletedInput,
  SetAnnotationDeletedInput,
  CaptureSessionContextInput,
  GetComposerSuggestionsInput,
  GetKnowledgeGroundingsInput,
  GetApprovedKnowledgeRuntimeInput,
  GetKnowledgeReviewDashboardInput,
  GetRankingExplanationsInput,
  GetPeriodReviewInput,
  GetSessionWorkbenchInput,
  GetSimilarCasesInput,
  GetTrainingInsightsInput,
  GetTradeDetailInput,
  GetUserProfileInput,
  IngestKnowledgeSourceInput,
  ListMemoryProposalsInput,
  OpenSnipCaptureInput,
  ReviewKnowledgeCardInput,
  RunAnnotationSuggestionsInput,
  RunAiAnalysisInput,
  SaveSessionRealtimeViewInput,
  SetScreenshotDeletedInput,
  SnipCaptureSelectionInput,
  SetContentBlockDeletedInput,
  UpdateMarketAnchorStatusInput,
} from '@shared/contracts/workbench'
import type { CaptureResult, ImportScreenshotInput, SaveScreenshotAnnotationsInput } from '@shared/capture/contracts'
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
    saveRealtimeView: (input: SaveSessionRealtimeViewInput) => ipcRenderer.invoke('workbench:save-realtime-view', input),
    deleteContentBlock: (input: SetContentBlockDeletedInput) => ipcRenderer.invoke('workbench:delete-content-block', input),
    restoreContentBlock: (input: SetContentBlockDeletedInput) => ipcRenderer.invoke('workbench:restore-content-block', input),
    deleteScreenshot: (input: SetScreenshotDeletedInput) => ipcRenderer.invoke('workbench:delete-screenshot', input),
    restoreScreenshot: (input: SetScreenshotDeletedInput) => ipcRenderer.invoke('workbench:restore-screenshot', input),
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
    savePendingSnip: (input: SnipCaptureSelectionInput) => ipcRenderer.invoke('capture:save-pending-snip', input),
    cancelPendingSnip: () => ipcRenderer.invoke('capture:cancel-pending-snip'),
    importImage: (input: ImportScreenshotInput) => ipcRenderer.invoke('capture:import-image', input),
    saveAnnotations: (input: SaveScreenshotAnnotationsInput) => ipcRenderer.invoke('capture:save-annotations', input),
    onSaved: (listener) => {
      const wrapped = (_event: IpcRendererEvent, result: CaptureResult) => {
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
