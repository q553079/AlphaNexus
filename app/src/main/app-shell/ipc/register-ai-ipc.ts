import { ipcMain } from 'electron'
import {
  listAiProviders,
  listPromptTemplates,
  runAiAnalysis,
  runMockAiAnalysis,
  saveAiProviderConfig,
  savePromptTemplate,
} from '@main/ai/service'
import type { AppContext } from './shared'

export const registerAiIpc = ({ env, paths }: AppContext) => {
  ipcMain.handle('ai:list-providers', async() => listAiProviders(paths, env))
  ipcMain.handle('ai:save-provider-config', async(_event, input) => saveAiProviderConfig(paths, env, input))
  ipcMain.handle('ai:list-prompt-templates', async() => listPromptTemplates(paths))
  ipcMain.handle('ai:save-prompt-template', async(_event, input) => savePromptTemplate(paths, input))
  ipcMain.handle('ai:run-analysis', async(_event, input) => runAiAnalysis(paths, env, input))
  ipcMain.handle('ai:run-mock-analysis', async(_event, input) => runMockAiAnalysis(paths, input))
}
