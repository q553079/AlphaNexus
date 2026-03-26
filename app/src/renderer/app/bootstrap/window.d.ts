import type { AlphaNexusApi } from '@shared/contracts/workbench'

declare global {
  interface Window {
    alphaNexus?: AlphaNexusApi
  }
}

export {}
