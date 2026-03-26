import type { AiAdapter, AiAdapterRunInput, AiAdapterRunResult } from '@main/ai/adapters/base'
import { AiAnalysisDraftSchema } from '@shared/ai/contracts'

const DEFAULT_BASE_URL = 'https://api.deepseek.com'
const DEFAULT_MODEL = 'deepseek-reasoner'

const SYSTEM_PROMPT = [
  'You are AlphaNexus, a professional trading review assistant.',
  'Assume strong domain knowledge in ICT, price action, heatmaps, DOM, footprint, and options context.',
  'Use only the supplied session context and avoid inventing chart facts that are not in the input.',
  'Reason in English if useful, but write all user-facing value strings in Simplified Chinese unless a symbol, number, or standard trading term should remain unchanged.',
  'Return only one valid JSON object.',
].join(' ')

const JSON_CONTRACT = [
  'Return a JSON object with exactly these keys:',
  '{',
  '  "bias": "bullish" | "bearish" | "range" | "neutral",',
  '  "confidence_pct": 0-100 integer,',
  '  "reversal_probability_pct": 0-100 integer,',
  '  "entry_zone": string,',
  '  "stop_loss": string,',
  '  "take_profit": string,',
  '  "invalidation": string,',
  '  "summary_short": string,',
  '  "deep_analysis_md": string,',
  '  "supporting_factors": string[]',
  '}',
  'Keep the summary short and direct, but write it in Simplified Chinese.',
  'Make the deep_analysis_md detailed but concrete, and write it in Simplified Chinese markdown.',
  'Write supporting_factors in Simplified Chinese short phrases.',
  'Keep bias exactly as bullish, bearish, range, or neutral.',
  'Keep symbols, numbers, and precise trading terms unchanged when needed.',
  'If evidence is incomplete, say so explicitly in Simplified Chinese instead of omitting fields.',
].join('\n')

type DeepSeekResponse = {
  error?: {
    message?: string
  }
  choices?: Array<{
    message?: {
      content?: string | null
    }
  }>
}

const normalizeBaseUrl = (baseUrl: string | null) => (baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '')

const extractJsonPayload = (raw: string) => {
  const trimmed = raw.trim()
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  const candidate = fenceMatch?.[1]?.trim() ?? trimmed

  try {
    return JSON.parse(candidate) as unknown
  } catch {
    const firstBrace = candidate.indexOf('{')
    const lastBrace = candidate.lastIndexOf('}')
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error('DeepSeek 返回内容中不包含有效 JSON 对象。')
    }

    return JSON.parse(candidate.slice(firstBrace, lastBrace + 1)) as unknown
  }
}

const runDeepSeekAnalysis = async({
  config,
  env,
  promptPreview,
}: AiAdapterRunInput): Promise<AiAdapterRunResult> => {
  if (!env.deepseekApiKey) {
    throw new Error('本地环境中缺少 DEEPSEEK_API_KEY。')
  }

  const response = await fetch(`${normalizeBaseUrl(config.base_url)}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.deepseekApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model || DEFAULT_MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `${promptPreview}\n\n${JSON_CONTRACT}` },
      ],
      stream: false,
    }),
  })

  const payload = await response.json() as DeepSeekResponse
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `DeepSeek 请求失败，状态码 ${response.status}。`)
  }

  const rawOutput = payload.choices?.[0]?.message?.content?.trim()
  if (!rawOutput) {
    throw new Error('DeepSeek 返回了空的分析结果。')
  }

  const analysis = AiAnalysisDraftSchema.parse(extractJsonPayload(rawOutput))

  return {
    analysis,
    model: config.model || DEFAULT_MODEL,
    raw_output: rawOutput,
  }
}

export const deepseekAdapter: AiAdapter = {
  provider: 'deepseek',
  listConfig: (_paths, env) => ({
    provider: 'deepseek',
    label: 'DeepSeek',
    enabled: true,
    configured: Boolean(env.deepseekApiKey),
    model: DEFAULT_MODEL,
    base_url: DEFAULT_BASE_URL,
    configured_via: env.deepseekApiKey ? 'env' : 'none',
    secret_storage: env.deepseekApiKey ? 'env' : 'none',
    supports_base_url_override: true,
    supports_local_api_key: false,
  }),
  runMock: async() => {
    throw new Error('DeepSeek 的 mock 运行由聚合 AI 服务统一处理。')
  },
  runAnalysis: runDeepSeekAnalysis,
}
