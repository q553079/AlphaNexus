import { app, BrowserWindow } from 'electron'
import { initializeStorage } from '@main/storage/database'
import { createMainWindow } from '@main/app-shell/create-main-window'
import { resolveEnvironment } from '@main/app-shell/env'
import { resolveLocalFirstPaths } from '@main/app-shell/paths'
import { registerIpcHandlers } from '@main/app-shell/register-ipc-handlers'
import { registerCaptureShortcuts, unregisterCaptureShortcuts } from '@main/capture/capture-shortcuts'

const boot = async() => {
  const env = resolveEnvironment()
  const paths = resolveLocalFirstPaths(app, env)

  registerIpcHandlers({ env, paths })
  try {
    await initializeStorage(paths)
  } catch (error) {
    console.error('AlphaNexus storage initialization failed. Falling back to limited boot mode.', error)
  }
  createMainWindow()
  registerCaptureShortcuts(paths)
}

app.whenReady().then(() => {
  void boot()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  unregisterCaptureShortcuts()
})
