import type { AlphaNexusApi } from '@shared/contracts/workbench'
import { bridgeApi } from './bridge'
import { mockApi } from './mock-runtime'

export const knowledgeApi: AlphaNexusApi['knowledge'] = bridgeApi?.knowledge ?? mockApi.knowledge
