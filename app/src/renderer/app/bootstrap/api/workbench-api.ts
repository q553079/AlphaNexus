import type { AlphaNexusApi } from '@shared/contracts/workbench'
import { requireBridgeSection } from './bridge'

export const workbenchApi: AlphaNexusApi['workbench'] = requireBridgeSection('workbench')
