import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

const loadWorkspaceFile = async(relativePath) => {
  const workspaceRoot = path.resolve(import.meta.dirname, '..', '..')
  return readFile(path.join(workspaceRoot, relativePath), 'utf8')
}

test('preload/main contract regression keeps workbench, capture, AI template, and knowledge IPCs aligned', async() => {
  const [sharedContracts, contentContracts, periodContracts, aiContracts, captureContracts, preloadBridge, workbenchIpc, launcherIpc, knowledgeIpc, aiIpc, captureIpc] = await Promise.all([
    loadWorkspaceFile('src/shared/contracts/workbench.ts'),
    loadWorkspaceFile('src/shared/contracts/content.ts'),
    loadWorkspaceFile('src/shared/contracts/period-review.ts'),
    loadWorkspaceFile('src/shared/ai/contracts.ts'),
    loadWorkspaceFile('src/shared/capture/contracts.ts'),
    loadWorkspaceFile('src/preload/index.ts'),
    loadWorkspaceFile('src/main/app-shell/ipc/register-workbench-ipc.ts'),
    loadWorkspaceFile('src/main/app-shell/ipc/register-launcher-ipc.ts'),
    loadWorkspaceFile('src/main/app-shell/ipc/register-knowledge-ipc.ts'),
    loadWorkspaceFile('src/main/app-shell/ipc/register-ai-ipc.ts'),
    loadWorkspaceFile('src/main/app-shell/ipc/register-capture-ipc.ts'),
  ])

  assert.match(sharedContracts, /createNoteBlock:\s*\(input: CreateWorkbenchNoteBlockInput\)/)
  assert.match(sharedContracts, /event_id: EntityIdSchema\.nullable\(\)\.optional\(\)/)
  assert.match(sharedContracts, /updateNoteBlock:\s*\(input: UpdateWorkbenchNoteBlockInput\)/)
  assert.match(sharedContracts, /reorderContentBlocks:\s*\(input: ReorderContentBlocksInput\)/)
  assert.match(sharedContracts, /moveScreenshot:\s*\(input: MoveScreenshotInput\)/)
  assert.match(sharedContracts, /updateAnnotation:\s*\(input: UpdateAnnotationInput\)/)
  assert.match(sharedContracts, /cancelTrade:\s*\(input: CancelTradeInput\)/)
  assert.match(sharedContracts, /period_rollup:\s*PeriodRollupSchema/)
  assert.match(sharedContracts, /trade_metrics:\s*z\.array\(PeriodTradeMetricSchema\)/)
  assert.match(sharedContracts, /latest_period_ai_review:\s*PeriodReviewAiRecordSchema\.nullable\(\)/)
  assert.match(sharedContracts, /ai_quality_summary:\s*PeriodAiQualitySummarySchema/)
  assert.match(sharedContracts, /continueSession:\s*\(input: z\.infer<typeof ContinueSessionInputSchema>\)/)
  assert.match(sharedContracts, /reviewCard:\s*\(input: ReviewKnowledgeCardInput\)/)
  assert.match(periodContracts, /PeriodRollupSchema = z\.object\(/)
  assert.match(periodContracts, /PeriodTradeMetricSchema = z\.object\(/)
  assert.match(periodContracts, /PeriodAiQualitySummarySchema = z\.object\(/)
  assert.match(aiContracts, /PromptTemplateSchema = z\.object\(/)
  assert.match(aiContracts, /PeriodReviewDraftSchema = z\.object\(/)
  assert.match(aiContracts, /AiAnalysisAttachmentSchema = z\.object\(/)
  assert.match(aiContracts, /AiAnalysisContextInputSchema = z\.object\(/)
  assert.match(aiContracts, /SavePromptTemplateInputSchema = z\.object\(/)
  assert.match(aiContracts, /period_id: EntityIdSchema\.optional\(\)/)
  assert.match(aiContracts, /analysis_context: AiAnalysisContextInputSchema\.optional\(\)/)
  assert.match(aiContracts, /attachments: z\.array\(AiAnalysisAttachmentSchema\)\.max\(6\)\.default\(\[\]\)/)
  assert.match(captureContracts, /CapturePreferencesSchema = z\.object\(/)
  assert.match(captureContracts, /PasteClipboardImageInputSchema = z\.object\(/)
  assert.match(captureContracts, /CaptureScreenshotBackgroundInputSchema = z\.object\(/)
  assert.match(captureContracts, /screenshot_background: CaptureScreenshotBackgroundInputSchema\.optional\(\)/)
  assert.match(captureContracts, /analysis_context: AiAnalysisContextInputSchema\.optional\(\)/)
  assert.match(contentContracts, /analysis_role: ScreenshotAnalysisRoleSchema\.default\('event'\)/)
  assert.match(contentContracts, /background_layer: ScreenshotBackgroundLayerSchema\.nullable\(\)\.default\(null\)/)
  assert.match(contentContracts, /'brush'/)
  assert.match(contentContracts, /'fib_retracement'/)

  assert.match(preloadBridge, /continueSession:\s*\(input: ContinueSessionInput\)\s*=> ipcRenderer\.invoke\('launcher:continue-session', input\)/)
  assert.match(preloadBridge, /createNoteBlock:\s*\(input\)\s*=> ipcRenderer\.invoke\('workbench:create-note-block', input\)/)
  assert.match(preloadBridge, /updateNoteBlock:\s*\(input\)\s*=> ipcRenderer\.invoke\('workbench:update-note-block', input\)/)
  assert.match(preloadBridge, /reorderContentBlocks:\s*\(input: ReorderContentBlocksInput\)\s*=> ipcRenderer\.invoke\('workbench:reorder-content-blocks', input\)/)
  assert.match(preloadBridge, /moveScreenshot:\s*\(input: MoveScreenshotInput\)\s*=> ipcRenderer\.invoke\('workbench:move-screenshot', input\)/)
  assert.match(preloadBridge, /updateAnnotation:\s*\(input: UpdateAnnotationInput\)\s*=> ipcRenderer\.invoke\('workbench:update-annotation', input\)/)
  assert.match(preloadBridge, /cancelTrade:\s*\(input: CancelTradeInput\)\s*=> ipcRenderer\.invoke\('workbench:cancel-trade', input\)/)
  assert.match(preloadBridge, /reviewCard:\s*\(input: ReviewKnowledgeCardInput\)\s*=> ipcRenderer\.invoke\('knowledge:review-card', input\)/)
  assert.match(preloadBridge, /listPromptTemplates:\s*\(\)\s*=> ipcRenderer\.invoke\('ai:list-prompt-templates'\)/)
  assert.match(preloadBridge, /savePromptTemplate:\s*\(input: SavePromptTemplateInput\)\s*=> ipcRenderer\.invoke\('ai:save-prompt-template', input\)/)
  assert.match(preloadBridge, /listDisplays:\s*\(\)\s*=> ipcRenderer\.invoke\('capture:list-displays'\)/)
  assert.match(preloadBridge, /getPreferences:\s*\(\)\s*=> ipcRenderer\.invoke\('capture:get-preferences'\)/)
  assert.match(preloadBridge, /savePreferences:\s*\(input: SaveCapturePreferencesInput\)\s*=> ipcRenderer\.invoke\('capture:save-preferences', input\)/)
  assert.match(preloadBridge, /pasteClipboardImage:\s*\(input: PasteClipboardImageInput\)\s*=> ipcRenderer\.invoke\('capture:paste-clipboard-image', input\)/)

  assert.match(launcherIpc, /ipcMain\.handle\('launcher:continue-session'/)
  assert.match(workbenchIpc, /ipcMain\.handle\('workbench:create-note-block'/)
  assert.match(workbenchIpc, /ipcMain\.handle\('workbench:update-note-block'/)
  assert.match(workbenchIpc, /ipcMain\.handle\('workbench:reorder-content-blocks'/)
  assert.match(workbenchIpc, /ipcMain\.handle\('workbench:move-screenshot'/)
  assert.match(workbenchIpc, /ipcMain\.handle\('workbench:update-annotation'/)
  assert.match(workbenchIpc, /ipcMain\.handle\('workbench:cancel-trade'/)
  assert.match(knowledgeIpc, /ipcMain\.handle\('knowledge:review-card'/)
  assert.match(aiIpc, /ipcMain\.handle\('ai:list-prompt-templates'/)
  assert.match(aiIpc, /ipcMain\.handle\('ai:save-prompt-template'/)
  assert.match(captureIpc, /ipcMain\.handle\('capture:list-displays'/)
  assert.match(captureIpc, /ipcMain\.handle\('capture:get-preferences'/)
  assert.match(captureIpc, /ipcMain\.handle\('capture:save-preferences'/)
  assert.match(captureIpc, /ipcMain\.handle\('capture:paste-clipboard-image'/)
})
