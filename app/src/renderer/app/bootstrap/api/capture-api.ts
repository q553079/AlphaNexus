import type { AlphaNexusApi } from '@shared/contracts/workbench'
import { requireBridgeSection } from './bridge'

export const captureApi: AlphaNexusApi['capture'] = requireBridgeSection('capture')
