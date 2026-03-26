import { ipcMain } from 'electron'
import { createLauncherSession, getLauncherHome } from '@main/domain/session-launcher-service'
import type { AppContext } from './shared'

export const registerLauncherIpc = ({ paths }: AppContext) => {
  ipcMain.handle('launcher:get-home', async() => getLauncherHome(paths))
  ipcMain.handle('launcher:create-session', async(_event, input) => createLauncherSession(paths, input))
}
