import type { AlphaNexusApi } from '@shared/contracts/workbench'
import { bridgeApi } from './bridge'
import { mockApi } from './mock-runtime'

export const aiApi: AlphaNexusApi['ai'] = bridgeApi?.ai ?? mockApi.ai
