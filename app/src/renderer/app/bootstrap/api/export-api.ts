import type { AlphaNexusApi } from '@shared/contracts/workbench'
import { requireBridgeSection } from './bridge'

export const exportApi: AlphaNexusApi['export'] = requireBridgeSection('export')
