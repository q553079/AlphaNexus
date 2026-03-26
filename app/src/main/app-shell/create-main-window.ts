import { BrowserWindow, shell } from 'electron'
import { join } from 'node:path'

let mainWindow: BrowserWindow | null = null

const rendererUrl = process.env.ELECTRON_RENDERER_URL
const preloadPath = join(__dirname, '../preload/index.mjs')
const indexHtmlPath = join(__dirname, '../renderer/index.html')

export const createMainWindow = () => {
  if (mainWindow) {
    mainWindow.focus()
    return mainWindow
  }

  mainWindow = new BrowserWindow({
    width: 1560,
    height: 980,
    minWidth: 1280,
    minHeight: 820,
    title: 'AlphaNexus',
    backgroundColor: '#f5f6f1',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (rendererUrl) {
    void mainWindow.loadURL(rendererUrl)
  } else {
    void mainWindow.loadFile(indexHtmlPath)
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  return mainWindow
}

export const getMainWindow = () => mainWindow
