import type { AiAdapter, AiAdapterRunInput, AiAdapterRunResult } from '@main/ai/adapters/base'
import { AiAnalysisDraftSchema, TradeReviewDraftSchema } from '@shared/ai/contracts'

const DEFAULT_MODEL = 'openai-compatible-model'

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
  'Write all user-facing strings in Simplified Chinese.',
  'If evidence is incomplete, say so explicitly instead of omitting fields.',
].join('\n')

const TRADE_REVIEW_JSON_CONTRACT = [
  'Return a JSON object with exactly these keys:',
  '{',
  '  "summary_short": string,',
  '  "what_went_well": string[],',
  '  "mistakes": string[],',
  '  "next_improvements": string[],',
  '  "deep_analysis_md": string',
  '}',
  'Write all user-facing strings in Simplified Chinese.',
  'Do not invent or overwrite trade facts.',
  'Keep each list short, concrete, and auditable from the provided trade thread context.',
].join('\n')

type OpenAiCompatibleResponse = {
  error?: {
    message?: string
  }
  choices?: Array<{
    message?: {
      content?: string | null | Array<{
        type?: string
        text?: string
      }>
    }
  }>
}

const normalizeBaseUrl = (baseUrl: string) =>
  baseUrl
    .trim()
    .replace(/\/chat\/completions\/?$/i, '')
    .replace(/\/+$/, '')

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
      throw new Error('第三方 OpenAI-compatible provider 返回内容中不包含有效 JSON 对象。')
    }

    return JSON.parse(candidate.slice(firstBrace, lastBrace + 1)) as unknown
  }
}

const extractTextContent = (
  content: string | null | undefined | Array<{ type?: string, text?: string }>,
) => {
  if (typeof content === 'string') {
    return content.trim()
  }
  if (Array.isArray(content)) {
    return content
      .map((item) => item?.text?.trim() ?? '')
      .filter((item) => item.length > 0)
      .join('\n')
      .trim()
  }
  return ''
}

const parseStructuredOutput = (input: AiAdapterRunInput, rawOutput: string) => {
  const payload = extractJsonPayload(rawOutput)
  return input.input.prompt_kind === 'trade-review'
    ? TradeReviewDraftSchema.parse(payload)
    : AiAnalysisDraftSchema.parse(payload)
}

const buildSystemPrompt = (input: AiAdapterRunInput) =>
  [
    input.promptTemplate.base_system_prompt,
    input.promptTemplate.runtime_notes.trim(),
    'Return only one valid JSON object.',
  ].filter((section) => section.length > 0).join('\n\n')

const runCustomHttpAnalysis = async(input: AiAdapterRunInput): Promise<AiAdapterRunResult> => {
  const {
    config,
    promptPreview,
    providerSecret,
  } = input
  if (!config.base_url) {
    throw new Error('OpenAI-compatible provider 缺少 base URL，请先在设置页填写。')
  }
  if (!providerSecret.api_key) {
    throw new Error('OpenAI-compatible provider 缺少 API key，请先在设置页或环境变量中配置。')
  }

  const endpoint = `${normalizeBaseUrl(config.base_url)}/chat/completions`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${providerSecret.api_key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model || DEFAULT_MODEL,
      messages: [
        { role: 'system', content: buildSystemPrompt(input) },
        {
          role: 'user',
          content: `${promptPreview}\n\n${input.input.prompt_kind === 'trade-review' ? TRADE_REVIEW_JSON_CONTRACT : JSON_CONTRACT}`,
        },
      ],
      stream: false,
      temperature: 0.2,
    }),
  })

  const payload = await response.json() as OpenAiCompatibleResponse
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `OpenAI-compatible provider 请求失败，状态码 ${response.status}。`)
  }

  const rawOutput = extractTextContent(payload.choices?.[0]?.message?.content)
  if (!rawOutput) {
    throw new Error('OpenAI-compatible provider 返回了空的分析结果。')
  }

  const analysis = parseStructuredOutput(input, rawOutput)
  return {
    analysis,
    model: config.model || DEFAULT_MODEL,
    raw_output: rawOutput,
  }
}

export const customHttpAdapter: AiAdapter = {
  provider: 'custom-http',
  listConfig: (_paths, env) => ({
    provider: 'custom-http',
    label: 'OpenAI-compatible',
    enabled: false,
    configured: Boolean(env.customAiApiKey),
    model: DEFAULT_MODEL,
    base_url: env.customAiApiBaseUrl ?? null,
    configured_via: env.customAiApiKey ? 'env' : 'none',
    secret_storage: env.customAiApiKey ? 'env' : 'none',
    supports_base_url_override: true,
    supports_local_api_key: true,
  }),
  runMock: async() => {
    throw new Error('OpenAI-compatible provider 的 mock 运行由聚合 AI 服务统一处理。')
  },
  runAnalysis: runCustomHttpAnalysis,
}
