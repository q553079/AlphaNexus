import { ipcMain } from 'electron'
import { exportSessionMarkdown } from '@main/export/service'
import type { AppContext } from './shared'

export const registerExportIpc = ({ paths }: AppContext) => {
  ipcMain.handle('export:session-markdown', async(_event, input) => exportSessionMarkdown(paths, input))
}
