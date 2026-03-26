import type { AlphaNexusApi } from '@shared/contracts/workbench'
import { bridgeApi } from './bridge'
import { mockApi } from './mock-runtime'

export const appApi: AlphaNexusApi['app'] = bridgeApi?.app ?? mockApi.app
