import { ipcMain } from 'electron'
import { initializeStorage } from '@main/storage/database'
import type { AppContext } from './shared'

export const registerCoreIpc = ({ env, paths }: AppContext) => {
  ipcMain.handle('app:ping', async() => 'alpha-nexus-ready')

  ipcMain.handle('app:get-environment', async() => ({
    hasDeepSeekKey: Boolean(env.deepseekApiKey),
    hasOpenAiKey: Boolean(env.openAiApiKey),
    hasAnthropicKey: Boolean(env.anthropicApiKey),
    hasCustomAiKey: Boolean(env.customAiApiKey),
    customAiApiBaseUrl: env.customAiApiBaseUrl ?? null,
    dataDir: paths.dataDir,
    vaultDir: paths.vaultDir,
  }))

  ipcMain.handle('db:initialize', async() => initializeStorage(paths))
}
