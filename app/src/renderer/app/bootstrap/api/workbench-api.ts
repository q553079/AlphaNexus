import type { AlphaNexusApi } from '@shared/contracts/workbench'
import { bridgeApi } from './bridge'
import { mockApi } from './mock-runtime'

export const workbenchApi: AlphaNexusApi['workbench'] = bridgeApi?.workbench ?? mockApi.workbench
