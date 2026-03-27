import type { AlphaNexusApi } from '@shared/contracts/workbench'
import { requireBridgeSection } from './bridge'

export const knowledgeApi: AlphaNexusApi['knowledge'] = requireBridgeSection('knowledge')
