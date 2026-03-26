import type { AlphaNexusApi } from '@shared/contracts/workbench'
import { aiApi } from '@app/bootstrap/api/ai-api'
import { appApi } from '@app/bootstrap/api/app-api'
import { captureApi } from '@app/bootstrap/api/capture-api'
import { exportApi } from '@app/bootstrap/api/export-api'
import { knowledgeApi } from '@app/bootstrap/api/knowledge-api'
import { launcherApi } from '@app/bootstrap/api/launcher-api'
import { workbenchApi } from '@app/bootstrap/api/workbench-api'

export const alphaNexusApi: AlphaNexusApi = {
  app: appApi,
  launcher: launcherApi,
  workbench: workbenchApi,
  capture: captureApi,
  ai: aiApi,
  knowledge: knowledgeApi,
  export: exportApi,
}
