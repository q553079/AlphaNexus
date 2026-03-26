import type { AppContext } from '@main/app-shell/ipc/shared'
import { registerAiIpc } from '@main/app-shell/ipc/register-ai-ipc'
import { registerCaptureIpc } from '@main/app-shell/ipc/register-capture-ipc'
import { registerCoreIpc } from '@main/app-shell/ipc/register-core-ipc'
import { registerExportIpc } from '@main/app-shell/ipc/register-export-ipc'
import { registerKnowledgeIpc } from '@main/app-shell/ipc/register-knowledge-ipc'
import { registerLauncherIpc } from '@main/app-shell/ipc/register-launcher-ipc'
import { registerWorkbenchIpc } from '@main/app-shell/ipc/register-workbench-ipc'

export const registerIpcHandlers = (context: AppContext) => {
  registerCoreIpc(context)
  registerLauncherIpc(context)
  registerWorkbenchIpc(context)
  registerCaptureIpc(context)
  registerAiIpc(context)
  registerKnowledgeIpc(context)
  registerExportIpc(context)
}
