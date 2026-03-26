import type { AlphaNexusApi } from '@shared/contracts/workbench'
import { bridgeApi } from './bridge'
import { mockApi } from './mock-runtime'

export const captureApi: AlphaNexusApi['capture'] = bridgeApi?.capture ?? mockApi.capture
