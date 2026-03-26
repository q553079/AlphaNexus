import type { AlphaNexusApi } from '@shared/contracts/workbench'
import { bridgeApi } from './bridge'
import { mockApi } from './mock-runtime'

export const launcherApi: AlphaNexusApi['launcher'] = bridgeApi?.launcher ?? mockApi.launcher
