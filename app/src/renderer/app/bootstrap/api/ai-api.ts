import type { AlphaNexusApi } from '@shared/contracts/workbench'
import { requireBridgeSection } from './bridge'

export const aiApi: AlphaNexusApi['ai'] = requireBridgeSection('ai')
