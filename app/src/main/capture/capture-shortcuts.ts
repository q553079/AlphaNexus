import { globalShortcut } from 'electron'
import type { LocalFirstPaths } from '@main/app-shell/paths'
import { openSnipCapture } from '@main/capture/capture-service'

export const QUICK_SNIP_ACCELERATOR = 'CommandOrControl+Shift+4'

export const registerCaptureShortcuts = (paths: LocalFirstPaths) => {
  globalShortcut.unregister(QUICK_SNIP_ACCELERATOR)

  const registered = globalShortcut.register(QUICK_SNIP_ACCELERATOR, () => {
    void openSnipCapture(paths).catch((error) => {
      console.error('AlphaNexus snip capture shortcut failed.', error)
    })
  })

  if (!registered) {
    console.warn(`AlphaNexus failed to register shortcut ${QUICK_SNIP_ACCELERATOR}.`)
  }
}

export const unregisterCaptureShortcuts = () => {
  globalShortcut.unregister(QUICK_SNIP_ACCELERATOR)
}
