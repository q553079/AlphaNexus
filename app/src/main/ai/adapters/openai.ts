import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { AiAdapter, AiAdapterRunInput, AiAdapterRunResult } from '@main/ai/adapters/base'
import {
  AiAnalysisDraftSchema,
  PeriodReviewDraftSchema,
  TradeReviewDraftSchema,
} from '@shared/ai/contracts'

const DEFAULT_MODEL = 'gpt-5.4-mini'
const RESPONSES_ENDPOINT = 'https://api.openai.com/v1/responses'

const ANALYSIS_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    bias: {
      type: 'string',
      enum: ['bullish', 'bearish', 'range', 'neutral'],
    },
    confidence_pct: {
      type: 'integer',
      minimum: 0,
      maximum: 100,
    },
    reversal_probability_pct: {
      type: 'integer',
      minimum: 0,
      maximum: 100,
    },
    entry_zone: {
      type: 'string',
      minLength: 1,
    },
    stop_loss: {
      type: 'string',
      minLength: 1,
    },
    take_profit: {
      type: 'string',
      minLength: 1,
    },
    invalidation: {
      type: 'string',
      minLength: 1,
    },
    summary_short: {
      type: 'string',
      minLength: 1,
    },
    deep_analysis_md: {
      type: 'string',
      minLength: 1,
    },
    supporting_factors: {
      type: 'array',
      minItems: 1,
      maxItems: 8,
      items: {
        type: 'string',
        minLength: 1,
      },
    },
  },
  required: [
    'bias',
    'confidence_pct',
    'reversal_probability_pct',
    'entry_zone',
    'stop_loss',
    'take_profit',
    'invalidation',
    'summary_short',
    'deep_analysis_md',
    'supporting_factors',
  ],
} as const

const TRADE_REVIEW_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary_short: {
      type: 'string',
      minLength: 1,
    },
    what_went_well: {
      type: 'array',
      minItems: 1,
      maxItems: 5,
      items: {
        type: 'string',
        minLength: 1,
      },
    },
    mistakes: {
      type: 'array',
      minItems: 1,
      maxItems: 5,
      items: {
        type: 'string',
        minLength: 1,
      },
    },
    next_improvements: {
      type: 'array',
      minItems: 1,
      maxItems: 5,
      items: {
        type: 'string',
        minLength: 1,
      },
    },
    deep_analysis_md: {
      type: 'string',
      minLength: 1,
    },
  },
  required: [
    'summary_short',
    'what_went_well',
    'mistakes',
    'next_improvements',
    'deep_analysis_md',
  ],
} as const

const PERIOD_REVIEW_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary_short: {
      type: 'string',
      minLength: 1,
    },
    strengths: {
      type: 'array',
      minItems: 1,
      maxItems: 6,
      items: {
        type: 'string',
        minLength: 1,
      },
    },
    mistakes: {
      type: 'array',
      minItems: 1,
      maxItems: 6,
      items: {
        type: 'string',
        minLength: 1,
      },
    },
    recurring_patterns: {
      type: 'array',
      minItems: 1,
      maxItems: 6,
      items: {
        type: 'string',
        minLength: 1,
      },
    },
    action_items: {
      type: 'array',
      minItems: 1,
      maxItems: 6,
      items: {
        type: 'string',
        minLength: 1,
      },
    },
    deep_analysis_md: {
      type: 'string',
      minLength: 1,
    },
  },
  required: [
    'summary_short',
    'strengths',
    'mistakes',
    'recurring_patterns',
    'action_items',
    'deep_analysis_md',
  ],
} as const

type OpenAiErrorPayload = {
  error?: {
    message?: string
  }
}

type OpenAiResponsePayload = OpenAiErrorPayload & {
  output_text?: string
  output?: Array<{
    type?: string
    content?: Array<{
      type?: string
      text?: string
      parsed?: unknown
      refusal?: string
    }>
  }>
}

const mimeTypeByExtension: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

const extractJsonPayload = (raw: string) => {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1]?.trim() ?? trimmed

  try {
    return JSON.parse(fenced) as unknown
  } catch {
    const firstBrace = fenced.indexOf('{')
    const lastBrace = fenced.lastIndexOf('}')
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error('OpenAI 返回内容中不包含有效 JSON 对象。')
    }

    return JSON.parse(fenced.slice(firstBrace, lastBrace + 1)) as unknown
  }
}

const parseErrorMessage = async(response: Response) => {
  try {
    const payload = await response.json() as OpenAiErrorPayload
    return payload.error?.message ?? `OpenAI 请求失败，状态码 ${response.status}。`
  } catch {
    return `OpenAI 请求失败，状态码 ${response.status}。`
  }
}

const resolveScreenshotDataUrls = async(input: AiAdapterRunInput) => {
  const screenshotIds = input.attachment_screenshot_ids && input.attachment_screenshot_ids.length > 0
    ? input.attachment_screenshot_ids
    : input.input.screenshot_id
      ? [input.input.screenshot_id]
      : []

  if (screenshotIds.length === 0) {
    return []
  }

  const urls = await Promise.all(screenshotIds.map(async(screenshotId) => {
    const screenshot = input.payload.screenshots.find((item) => item.id === screenshotId)
    if (!screenshot) {
      throw new Error(`当前 Session 中未找到截图 ${screenshotId}。`)
    }

    const rawPath = path.join(input.paths.vaultDir, screenshot.raw_file_path)
    const mimeType = mimeTypeByExtension[path.extname(rawPath).toLowerCase()] ?? 'image/png'
    const imageBuffer = await readFile(rawPath)
    return `data:${mimeType};base64,${imageBuffer.toString('base64')}`
  }))

  return urls
}

const resolveInlineAttachmentImageDataUrls = (input: AiAdapterRunInput) =>
  (input.input.analysis_context?.attachments ?? [])
    .filter((attachment) =>
      attachment.kind === 'image'
      && typeof attachment.data_url === 'string'
      && attachment.data_url.trim().length > 0)
    .map((attachment) => attachment.data_url!.trim())

const extractOutputText = (payload: OpenAiResponsePayload) => {
  if (typeof payload.output_text === 'string' && payload.output_text.trim().length > 0) {
    return payload.output_text.trim()
  }

  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.text === 'string' && content.text.trim().length > 0) {
        return content.text.trim()
      }
      if (content.parsed != null) {
        return JSON.stringify(content.parsed)
      }
      if (typeof content.refusal === 'string' && content.refusal.trim().length > 0) {
        throw new Error(`OpenAI 拒绝返回结构化分析：${content.refusal.trim()}`)
      }
    }
  }

  throw new Error('OpenAI 返回了空的分析结果。')
}

const parseStructuredOutput = (input: AiAdapterRunInput, rawOutput: string) => {
  const payload = extractJsonPayload(rawOutput)
  if (input.input.prompt_kind === 'trade-review') {
    return TradeReviewDraftSchema.parse(payload)
  }
  if (input.input.prompt_kind === 'period-review') {
    return PeriodReviewDraftSchema.parse(payload)
  }
  return AiAnalysisDraftSchema.parse(payload)
}

const buildSystemPrompt = (input: AiAdapterRunInput) =>
  [
    input.promptTemplate.base_system_prompt,
    input.promptTemplate.runtime_notes.trim(),
  ].filter((section) => section.length > 0).join('\n\n')

const runOpenAiAnalysis = async(input: AiAdapterRunInput): Promise<AiAdapterRunResult> => {
  if (!input.providerSecret.api_key) {
    throw new Error('本地环境中缺少 OPENAI_API_KEY。')
  }

  const screenshotDataUrls = await resolveScreenshotDataUrls(input)
  const inlineAttachmentDataUrls = resolveInlineAttachmentImageDataUrls(input)
  const allImageDataUrls = [...screenshotDataUrls, ...inlineAttachmentDataUrls]
  const response = await fetch(RESPONSES_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.providerSecret.api_key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: input.config.model || DEFAULT_MODEL,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: buildSystemPrompt(input),
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: input.promptPreview,
            },
            ...allImageDataUrls.map((imageUrl) => ({
              type: 'input_image',
              image_url: imageUrl,
            })),
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: input.input.prompt_kind === 'trade-review'
            ? 'alpha_nexus_trade_review'
            : input.input.prompt_kind === 'period-review'
              ? 'alpha_nexus_period_review'
              : 'alpha_nexus_market_analysis',
          strict: true,
          schema: input.input.prompt_kind === 'trade-review'
            ? TRADE_REVIEW_JSON_SCHEMA
            : input.input.prompt_kind === 'period-review'
              ? PERIOD_REVIEW_JSON_SCHEMA
              : ANALYSIS_JSON_SCHEMA,
        },
      },
    }),
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }

  const payload = await response.json() as OpenAiResponsePayload
  const rawOutput = extractOutputText(payload)
  const analysis = parseStructuredOutput(input, rawOutput)

  return {
    analysis,
    model: input.config.model || DEFAULT_MODEL,
    raw_output: rawOutput,
  }
}

export const openAiAdapter: AiAdapter = {
  provider: 'openai',
  listConfig: (_paths, env) => ({
    provider: 'openai',
    label: 'OpenAI',
    enabled: true,
    configured: Boolean(env.openAiApiKey),
    model: DEFAULT_MODEL,
    base_url: null,
    configured_via: env.openAiApiKey ? 'env' : 'none',
    secret_storage: env.openAiApiKey ? 'env' : 'none',
    supports_base_url_override: false,
    supports_local_api_key: false,
  }),
  runMock: async() => {
    throw new Error('OpenAI 的 mock 运行由聚合 AI 服务统一处理。')
  },
  runAnalysis: runOpenAiAnalysis,
}
