import type { AiAdapter } from '@main/ai/adapters/base'

export const anthropicAdapter: AiAdapter = {
  provider: 'anthropic',
  listConfig: (_paths, env) => ({
    provider: 'anthropic',
    label: 'Anthropic',
    enabled: true,
    configured: Boolean(env.anthropicApiKey),
    model: 'claude-sonnet-4.5',
    base_url: null,
    configured_via: env.anthropicApiKey ? 'env' : 'none',
    secret_storage: env.anthropicApiKey ? 'env' : 'none',
    supports_base_url_override: false,
    supports_local_api_key: false,
  }),
  runMock: async() => {
    throw new Error('Anthropic 的 mock 运行由聚合 AI 服务统一处理。')
  },
}
