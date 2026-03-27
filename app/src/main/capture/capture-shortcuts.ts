import type { LocalFirstPaths } from '@main/app-shell/paths'
import { openSnipCapture } from '@main/capture/capture-service'
import { readCapturePreferences } from '@main/capture/capture-preferences-storage'

export const DEFAULT_QUICK_SNIP_ACCELERATOR = 'CommandOrControl+Shift+4'

let registeredSnipAccelerator = DEFAULT_QUICK_SNIP_ACCELERATOR

const loadGlobalShortcut = async() => {
  const electron = await import('electron')
  if (!('globalShortcut' in electron) || !electron.globalShortcut) {
    throw new Error('Electron globalShortcut API is unavailable in the current runtime.')
  }

  return electron.globalShortcut
}

const registerAccelerator = async(paths: LocalFirstPaths, accelerator: string) => {
  const globalShortcut = await loadGlobalShortcut()
  globalShortcut.unregister(registeredSnipAccelerator)
  registeredSnipAccelerator = accelerator

  const registered = globalShortcut.register(accelerator, () => {
    void openSnipCapture(paths).catch((error) => {
      console.error('AlphaNexus snip capture shortcut failed.', error)
    })
  })

  if (!registered) {
    console.warn(`AlphaNexus failed to register shortcut ${accelerator}.`)
    registeredSnipAccelerator = DEFAULT_QUICK_SNIP_ACCELERATOR
  }
}

export const registerCaptureShortcuts = async(paths: LocalFirstPaths) => {
  const preferences = await readCapturePreferences(paths)
  await registerAccelerator(paths, preferences.snip_accelerator)
}

export const reregisterCaptureShortcuts = async(paths: LocalFirstPaths) => {
  await registerCaptureShortcuts(paths)
}

export const unregisterCaptureShortcuts = () => {
  void loadGlobalShortcut()
    .then((globalShortcut) => {
      globalShortcut.unregister(registeredSnipAccelerator)
    })
    .catch(() => {
      // Regression runs execute without the full Electron runtime.
    })
}
