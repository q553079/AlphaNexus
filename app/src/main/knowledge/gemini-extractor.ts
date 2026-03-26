import { z } from 'zod'
import type { KnowledgeCardType } from '@main/knowledge/pipeline'

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'
const DEFAULT_GEMINI_MODEL = 'gemini-1.5-pro'
const MAX_FRAGMENT_BATCH = 8
const MAX_CARDS_PER_FRAGMENT = 2

const GeminiCardTypeSchema = z.enum([
  'concept',
  'setup',
  'entry-rule',
  'invalidation-rule',
  'risk-rule',
  'management-rule',
  'mistake-pattern',
  'review-principle',
  'checklist',
])

const GeminiDraftCardSchema = z.object({
  fragment_sequence_no: z.coerce.number().int().positive(),
  card_type: GeminiCardTypeSchema,
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(260),
  content_md: z.string().trim().min(1),
  trigger_conditions_md: z.string().trim().optional(),
  invalidation_md: z.string().trim().optional(),
  risk_rule_md: z.string().trim().optional(),
  tags: z.array(z.string().trim().min(1)).max(12).optional(),
})

const GeminiDraftCardPayloadSchema = z.object({
  cards: z.array(GeminiDraftCardSchema).max(MAX_FRAGMENT_BATCH * MAX_CARDS_PER_FRAGMENT),
})

type FragmentSeed = {
  fragment_id: string
  sequence_no: number
  content_md: string
  contract_scope: string
  timeframe_scope: string
  base_tags: string[]
}

type GeminiExtractorInput = {
  apiKey: string
  sourceTitle: string
  model?: string
  fragments: FragmentSeed[]
}

type DraftCardInsertSeed = {
  fragment_id: string
  card_type: KnowledgeCardType
  title: string
  summary: string
  content_md: string
  trigger_conditions_md: string
  invalidation_md: string
  risk_rule_md: string
  contract_scope: string
  timeframe_scope: string
  tags_json: string
  status: 'draft'
  version: number
}

type GeminiApiResponse = {
  error?: {
    message?: string
  }
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string
      }>
    }
  }>
}

const sanitizeText = (value: string, maxLength: number) => {
  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength - 3)}...` : trimmed
}

const normalizeTags = (base: string[], extra: string[] | undefined) => {
  const values = new Set<string>()
  for (const tag of [...base, ...(extra ?? [])]) {
    const normalized = tag.trim().toLowerCase()
    if (!normalized) {
      continue
    }
    values.add(normalized)
  }
  return [...values].slice(0, 12)
}

const extractJsonPayload = (raw: string) => {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  const candidate = fenced?.[1]?.trim() ?? trimmed

  try {
    return JSON.parse(candidate) as unknown
  } catch {
    const firstBrace = candidate.indexOf('{')
    const lastBrace = candidate.lastIndexOf('}')
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error('Gemini extraction response does not contain a valid JSON object.')
    }

    return JSON.parse(candidate.slice(firstBrace, lastBrace + 1)) as unknown
  }
}

const buildPrompt = (sourceTitle: string, fragments: FragmentSeed[]) => {
  const fragmentBlock = fragments
    .map((fragment) => [
      `Fragment #${fragment.sequence_no}`,
      `contract_scope=${fragment.contract_scope}`,
      `timeframe_scope=${fragment.timeframe_scope}`,
      'content:',
      fragment.content_md,
    ].join('\n'))
    .join('\n\n---\n\n')

  return [
    'You are extracting trading knowledge cards for AlphaNexus.',
    `Source title: ${sourceTitle}`,
    'Return only one valid JSON object with this exact shape:',
    '{',
    '  "cards": [',
    '    {',
    '      "fragment_sequence_no": number,',
    '      "card_type": "concept" | "setup" | "entry-rule" | "invalidation-rule" | "risk-rule" | "management-rule" | "mistake-pattern" | "review-principle" | "checklist",',
    '      "title": string,',
    '      "summary": string,',
    '      "content_md": string,',
    '      "trigger_conditions_md": string,',
    '      "invalidation_md": string,',
    '      "risk_rule_md": string,',
    '      "tags": string[]',
    '    }',
    '  ]',
    '}',
    `Constraints: at most ${MAX_CARDS_PER_FRAGMENT} cards per fragment, concise fields, no hallucinated references.`,
    'Use Simplified Chinese for user-facing text.',
    'Fragments:',
    fragmentBlock,
  ].join('\n')
}

const callGeminiBatch = async(
  apiKey: string,
  sourceTitle: string,
  model: string,
  fragments: FragmentSeed[],
) => {
  const response = await fetch(`${GEMINI_BASE_URL}/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      generationConfig: {
        temperature: 0.1,
        topK: 32,
        topP: 0.9,
        responseMimeType: 'application/json',
      },
      contents: [{
        role: 'user',
        parts: [{ text: buildPrompt(sourceTitle, fragments) }],
      }],
    }),
  })

  const payload = await response.json() as GeminiApiResponse
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Gemini extraction request failed with HTTP ${response.status}.`)
  }

  const rawText = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('\n').trim()
  if (!rawText) {
    throw new Error('Gemini extraction returned empty content.')
  }

  return GeminiDraftCardPayloadSchema.parse(extractJsonPayload(rawText)).cards
}

export const extractDraftCardsWithGemini = async(input: GeminiExtractorInput): Promise<DraftCardInsertSeed[]> => {
  const model = input.model?.trim() || DEFAULT_GEMINI_MODEL
  const bySequence = new Map(input.fragments.map((fragment) => [fragment.sequence_no, fragment]))
  const output: DraftCardInsertSeed[] = []

  for (let index = 0; index < input.fragments.length; index += MAX_FRAGMENT_BATCH) {
    const fragmentBatch = input.fragments.slice(index, index + MAX_FRAGMENT_BATCH)
    const extracted = await callGeminiBatch(input.apiKey, input.sourceTitle, model, fragmentBatch)

    for (const item of extracted) {
      const fragment = bySequence.get(item.fragment_sequence_no)
      if (!fragment) {
        continue
      }

      const tags = normalizeTags(fragment.base_tags, item.tags)
      output.push({
        fragment_id: fragment.fragment_id,
        card_type: item.card_type,
        title: sanitizeText(item.title, 120),
        summary: sanitizeText(item.summary, 260),
        content_md: item.content_md.trim(),
        trigger_conditions_md: item.trigger_conditions_md?.trim() ?? '',
        invalidation_md: item.invalidation_md?.trim() ?? '',
        risk_rule_md: item.risk_rule_md?.trim() ?? '',
        contract_scope: fragment.contract_scope,
        timeframe_scope: fragment.timeframe_scope,
        tags_json: JSON.stringify(tags),
        status: 'draft',
        version: 1,
      })
    }
  }

  return output
}
