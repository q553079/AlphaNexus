import type { AppEnvironment } from '@main/app-shell/env'
import type { LocalFirstPaths } from '@main/app-shell/paths'
import type { ProviderSecretResolution } from '@main/ai/provider-config-storage'
import type {
  AiAnalysisDraft,
  AiProviderConfig,
  MockAiRunResult,
  RunAiAnalysisInput,
  RunMockAiAnalysisInput,
} from '@shared/ai/contracts'
import type { SessionWorkbenchPayload } from '@shared/contracts/workbench'

export type AiAdapterRunInput = {
  config: AiProviderConfig
  env: AppEnvironment
  input: RunAiAnalysisInput
  paths: LocalFirstPaths
  payload: SessionWorkbenchPayload
  promptPreview: string
  providerSecret: ProviderSecretResolution
}

export type AiAdapterRunResult = {
  analysis: AiAnalysisDraft
  model: string
  raw_output: string
}

export type AiAdapter = {
  provider: AiProviderConfig['provider']
  listConfig: (paths: LocalFirstPaths, env: AppEnvironment) => AiProviderConfig
  runMock: (paths: LocalFirstPaths, input: RunMockAiAnalysisInput) => Promise<MockAiRunResult>
  runAnalysis?: (input: AiAdapterRunInput) => Promise<AiAdapterRunResult>
}
