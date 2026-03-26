import type { AlphaNexusApi } from '@shared/contracts/workbench'
import { bridgeApi } from './bridge'
import { mockApi } from './mock-runtime'

export const exportApi: AlphaNexusApi['export'] = bridgeApi?.export ?? mockApi.export
