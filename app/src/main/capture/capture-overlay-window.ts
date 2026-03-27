import { BrowserWindow, screen } from 'electron'
import type { Rectangle } from 'electron'
import { join } from 'node:path'

let captureOverlayWindow: BrowserWindow | null = null

const rendererUrl = process.env.ELECTRON_RENDERER_URL
const preloadPath = join(__dirname, '../preload/index.mjs')
const indexHtmlPath = join(__dirname, '../renderer/index.html')

export const openCaptureOverlayWindow = (bounds?: Rectangle) => {
  if (captureOverlayWindow) {
    if (bounds) {
      captureOverlayWindow.setBounds(bounds, false)
    }
    captureOverlayWindow.webContents.reloadIgnoringCache()
    captureOverlayWindow.show()
    captureOverlayWindow.focus()
    return captureOverlayWindow
  }

  const primaryDisplay = screen.getPrimaryDisplay()
  const targetBounds = bounds ?? primaryDisplay.bounds

  captureOverlayWindow = new BrowserWindow({
    x: targetBounds.x,
    y: targetBounds.y,
    width: targetBounds.width,
    height: targetBounds.height,
    frame: false,
    transparent: false,
    backgroundColor: '#101513',
    show: false,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    title: 'AlphaNexus Capture',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  captureOverlayWindow.setAlwaysOnTop(true, 'screen-saver')
  captureOverlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  captureOverlayWindow.setMenuBarVisibility(false)

  captureOverlayWindow.once('ready-to-show', () => {
    captureOverlayWindow?.show()
    captureOverlayWindow?.focus()
  })

  if (rendererUrl) {
    void captureOverlayWindow.loadURL(`${rendererUrl}#/capture-overlay`)
  } else {
    void captureOverlayWindow.loadFile(indexHtmlPath, { hash: '/capture-overlay' })
  }

  captureOverlayWindow.on('closed', () => {
    captureOverlayWindow = null
  })

  return captureOverlayWindow
}

export const closeCaptureOverlayWindow = () => {
  captureOverlayWindow?.close()
}

export const getCaptureOverlayWindow = () => captureOverlayWindow
