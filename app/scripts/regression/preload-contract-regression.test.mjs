import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

const loadWorkspaceFile = async(relativePath) => {
  const workspaceRoot = path.resolve(import.meta.dirname, '..', '..')
  return readFile(path.join(workspaceRoot, relativePath), 'utf8')
}

test('preload/main contract regression keeps session, trade cancel, note, screenshot move, annotation update, and knowledge review IPCs aligned', async() => {
  const [sharedContracts, preloadBridge, workbenchIpc, launcherIpc, knowledgeIpc] = await Promise.all([
    loadWorkspaceFile('src/shared/contracts/workbench.ts'),
    loadWorkspaceFile('src/preload/index.ts'),
    loadWorkspaceFile('src/main/app-shell/ipc/register-workbench-ipc.ts'),
    loadWorkspaceFile('src/main/app-shell/ipc/register-launcher-ipc.ts'),
    loadWorkspaceFile('src/main/app-shell/ipc/register-knowledge-ipc.ts'),
  ])

  assert.match(sharedContracts, /createNoteBlock:\s*\(input: CreateWorkbenchNoteBlockInput\)/)
  assert.match(sharedContracts, /updateNoteBlock:\s*\(input: UpdateWorkbenchNoteBlockInput\)/)
  assert.match(sharedContracts, /moveScreenshot:\s*\(input: MoveScreenshotInput\)/)
  assert.match(sharedContracts, /updateAnnotation:\s*\(input: UpdateAnnotationInput\)/)
  assert.match(sharedContracts, /cancelTrade:\s*\(input: CancelTradeInput\)/)
  assert.match(sharedContracts, /continueSession:\s*\(input: z\.infer<typeof ContinueSessionInputSchema>\)/)
  assert.match(sharedContracts, /reviewCard:\s*\(input: ReviewKnowledgeCardInput\)/)

  assert.match(preloadBridge, /continueSession:\s*\(input: ContinueSessionInput\)\s*=> ipcRenderer\.invoke\('launcher:continue-session', input\)/)
  assert.match(preloadBridge, /createNoteBlock:\s*\(input\)\s*=> ipcRenderer\.invoke\('workbench:create-note-block', input\)/)
  assert.match(preloadBridge, /updateNoteBlock:\s*\(input\)\s*=> ipcRenderer\.invoke\('workbench:update-note-block', input\)/)
  assert.match(preloadBridge, /moveScreenshot:\s*\(input: MoveScreenshotInput\)\s*=> ipcRenderer\.invoke\('workbench:move-screenshot', input\)/)
  assert.match(preloadBridge, /updateAnnotation:\s*\(input: UpdateAnnotationInput\)\s*=> ipcRenderer\.invoke\('workbench:update-annotation', input\)/)
  assert.match(preloadBridge, /cancelTrade:\s*\(input: CancelTradeInput\)\s*=> ipcRenderer\.invoke\('workbench:cancel-trade', input\)/)
  assert.match(preloadBridge, /reviewCard:\s*\(input: ReviewKnowledgeCardInput\)\s*=> ipcRenderer\.invoke\('knowledge:review-card', input\)/)

  assert.match(launcherIpc, /ipcMain\.handle\('launcher:continue-session'/)
  assert.match(workbenchIpc, /ipcMain\.handle\('workbench:create-note-block'/)
  assert.match(workbenchIpc, /ipcMain\.handle\('workbench:update-note-block'/)
  assert.match(workbenchIpc, /ipcMain\.handle\('workbench:move-screenshot'/)
  assert.match(workbenchIpc, /ipcMain\.handle\('workbench:update-annotation'/)
  assert.match(workbenchIpc, /ipcMain\.handle\('workbench:cancel-trade'/)
  assert.match(knowledgeIpc, /ipcMain\.handle\('knowledge:review-card'/)
})
