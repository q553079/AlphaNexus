import type { AlphaNexusApi } from '@shared/contracts/workbench'
import { requireBridgeSection } from './bridge'

export const launcherApi: AlphaNexusApi['launcher'] = requireBridgeSection('launcher')
