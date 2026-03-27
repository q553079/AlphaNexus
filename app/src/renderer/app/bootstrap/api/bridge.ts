import type { AlphaNexusApi } from '@shared/contracts/workbench'

export const bridgeApi = window.alphaNexus ?? null

const createMissingBridgeSection = <T extends object>(sectionName: keyof AlphaNexusApi): T => (
  new Proxy({} as T, {
    get: () => () => {
      throw new Error(`Electron preload bridge is unavailable for ${String(sectionName)}. Mock runtime is disabled for the real-data workflow.`)
    },
  })
)

export const requireBridgeSection = <TKey extends keyof AlphaNexusApi>(sectionName: TKey): AlphaNexusApi[TKey] =>
  bridgeApi?.[sectionName] ?? createMissingBridgeSection<AlphaNexusApi[TKey]>(sectionName)
