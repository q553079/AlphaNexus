import type { AiAdapter } from '@main/ai/adapters/base'

export const openAiAdapter: AiAdapter = {
  provider: 'openai',
  listConfig: (_paths, env) => ({
    provider: 'openai',
    label: 'OpenAI',
    enabled: true,
    configured: Boolean(env.openAiApiKey),
    model: 'gpt-5.4-mini',
    base_url: null,
    configured_via: env.openAiApiKey ? 'env' : 'none',
    secret_storage: env.openAiApiKey ? 'env' : 'none',
    supports_base_url_override: false,
    supports_local_api_key: false,
  }),
  runMock: async() => {
    throw new Error('OpenAI 的 mock 运行由聚合 AI 服务统一处理。')
  },
}
