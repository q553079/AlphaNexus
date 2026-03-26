import type { AiProviderConfig, SaveAiProviderConfigInput } from '@shared/ai/contracts'

export type ProviderPresentation = {
  id: string
  name: string
  description: string
  endpoint_label: string
  config: AiProviderConfig
  api_key_input: string
}

const providerDescriptions: Record<AiProviderConfig['provider'], { name: string, description: string, endpointLabel: string }> = {
  deepseek: {
    name: 'DeepSeek',
    description: '适合当前 AlphaNexus 的 Session 分析场景，适用于需要明确 bias、目标位、止损、失效条件和更深推理的工作流。',
    endpointLabel: '由 DeepSeek 官方端点管理',
  },
  openai: {
    name: 'OpenAI',
    description: '适合结构化市场分析，以及后续接入真实凭据后的多模态图表复盘。',
    endpointLabel: '由 OpenAI 官方端点管理',
  },
  anthropic: {
    name: 'Anthropic',
    description: '适合更长文本的 thesis 复查和交易后反思，摘要风格更克制。',
    endpointLabel: '由 Anthropic 官方端点管理',
  },
  'custom-http': {
    name: 'OpenAI-compatible',
    description: '这个槽位用于接入支持 OpenAI 协议的第三方网关或推理服务，页面可直接配置本地 URL、模型和 API key。',
    endpointLabel: '第三方基础 URL',
  },
}

export const sortProviders = (providers: ProviderPresentation[]) =>
  providers.slice().sort((left, right) => left.name.localeCompare(right.name))

export const presentProvider = (config: AiProviderConfig): ProviderPresentation => {
  const metadata = providerDescriptions[config.provider]

  return {
    id: config.provider,
    name: metadata.name,
    description: metadata.description,
    endpoint_label: metadata.endpointLabel,
    config,
    api_key_input: '',
  }
}

export const toSaveInput = (provider: ProviderPresentation): SaveAiProviderConfigInput => ({
  provider: provider.config.provider,
  enabled: provider.config.enabled,
  model: provider.config.model,
  base_url: provider.config.base_url,
  api_key: provider.api_key_input.trim().length > 0 ? provider.api_key_input.trim() : undefined,
})
