import type { AlphaNexusApi } from '@shared/contracts/workbench'
import { requireBridgeSection } from './bridge'

export const appApi: AlphaNexusApi['app'] = requireBridgeSection('app')
