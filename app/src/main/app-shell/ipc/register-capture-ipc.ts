import { ipcMain } from 'electron'
import {
  cancelPendingSnip,
  copyPendingSnip,
  getCapturePreferences,
  getPendingSnip,
  importScreenshotIntoSession,
  listCaptureDisplays,
  openSnipCapture,
  pasteClipboardImage,
  savePendingSnip,
  saveCapturePreferences,
  saveScreenshotAnnotations,
  setCaptureSessionContext,
} from '@main/capture/capture-service'
import type { AppContext } from './shared'

export const registerCaptureIpc = ({ env, paths }: AppContext) => {
  ipcMain.handle('capture:set-session-context', async(_event, input) => setCaptureSessionContext(input))
  ipcMain.handle('capture:open-snip', async(_event, input) => openSnipCapture(paths, input))
  ipcMain.handle('capture:list-displays', async() => listCaptureDisplays())
  ipcMain.handle('capture:get-preferences', async() => getCapturePreferences(paths))
  ipcMain.handle('capture:save-preferences', async(_event, input) => saveCapturePreferences(paths, input))
  ipcMain.handle('capture:get-pending-snip', async() => getPendingSnip())
  ipcMain.handle('capture:copy-pending-snip', async(_event, input) => copyPendingSnip(input))
  ipcMain.handle('capture:save-pending-snip', async(_event, input) => savePendingSnip(paths, env, input))
  ipcMain.handle('capture:cancel-pending-snip', async() => cancelPendingSnip())
  ipcMain.handle('capture:paste-clipboard-image', async(_event, input) => pasteClipboardImage(paths, input))
  ipcMain.handle('capture:import-image', async(_event, input) => importScreenshotIntoSession(paths, input))
  ipcMain.handle('capture:save-annotations', async(_event, input) => saveScreenshotAnnotations(paths, input))
}
