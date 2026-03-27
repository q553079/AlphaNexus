import { ipcMain } from 'electron'
import {
  continueLauncherSession,
  createLauncherSession,
  getLauncherHome,
} from '@main/domain/session-launcher-service'
import type { AppContext } from './shared'

export const registerLauncherIpc = ({ paths }: AppContext) => {
  ipcMain.handle('launcher:get-home', async() => getLauncherHome(paths))
  ipcMain.handle('launcher:create-session', async(_event, input) => createLauncherSession(paths, input))
  ipcMain.handle('launcher:continue-session', async(_event, input) => continueLauncherSession(paths, input))
}
