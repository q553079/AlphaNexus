import { ipcMain } from 'electron'
import { listAiProviders, runAiAnalysis, runMockAiAnalysis, saveAiProviderConfig } from '@main/ai/service'
import type { AppContext } from './shared'

export const registerAiIpc = ({ env, paths }: AppContext) => {
  ipcMain.handle('ai:list-providers', async() => listAiProviders(paths, env))
  ipcMain.handle('ai:save-provider-config', async(_event, input) => saveAiProviderConfig(paths, env, input))
  ipcMain.handle('ai:run-analysis', async(_event, input) => runAiAnalysis(paths, env, input))
  ipcMain.handle('ai:run-mock-analysis', async(_event, input) => runMockAiAnalysis(paths, input))
}
