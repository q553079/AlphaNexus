export type KnowledgeSourceType = 'book' | 'article' | 'course-note' | 'user-note' | 'review-derived'
export type KnowledgeCardType =
  | 'concept'
  | 'setup'
  | 'entry-rule'
  | 'invalidation-rule'
  | 'risk-rule'
  | 'management-rule'
  | 'mistake-pattern'
  | 'review-principle'
  | 'checklist'
export type KnowledgeCardStatus = 'draft' | 'approved' | 'archived'

export type IngestKnowledgeSourceInput = {
  source_type: KnowledgeSourceType
  title: string
  content_md: string
  author?: string | null
  language?: string | null
  contract_scope?: string | null
  timeframe_scope?: string | null
  tags?: string[]
  file_path?: string | null
  extraction_mode?: 'auto' | 'heuristic' | 'gemini'
}

export type KnowledgeSourceRecord = {
  id: string
  schema_version: number
  created_at: string
  source_type: KnowledgeSourceType
  title: string
  author: string | null
  language: string
  content_md: string
  checksum: string | null
  deleted_at: string | null
}

export type KnowledgeImportJobRecord = {
  id: string
  schema_version: number
  created_at: string
  source_id: string
  provider: string
  model: string
  job_type: string
  status: 'pending' | 'completed' | 'failed'
  input_snapshot_json: string
  output_summary: string
  finished_at: string | null
  deleted_at: string | null
}

export type KnowledgeFragmentRecord = {
  id: string
  schema_version: number
  created_at: string
  source_id: string
  job_id: string
  sequence_no: number
  chapter_label: string | null
  page_from: number | null
  page_to: number | null
  content_md: string
  tokens_estimate: number
  deleted_at: string | null
}

export type KnowledgeCardRecord = {
  id: string
  schema_version: number
  created_at: string
  updated_at: string
  source_id: string
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
  status: KnowledgeCardStatus
  version: number
  deleted_at: string | null
}

export type KnowledgeGroundingRecord = {
  id: string
  schema_version: number
  created_at: string
  knowledge_card_id: string
  session_id: string | null
  trade_id: string | null
  screenshot_id: string | null
  annotation_id: string | null
  anchor_id: string | null
  ai_run_id: string | null
  match_reason_md: string
  relevance_score: number
}

type DraftCardSeed = {
  fragment_id: string
  content_md: string
  sequence_no: number
  contract_scope: string
  timeframe_scope: string
  base_tags: string[]
}

export const splitKnowledgeContent = (content: string): string[] => {
  const normalized = content.replace(/\r\n/g, '\n').trim()
  if (!normalized) {
    return []
  }

  const paragraphs = normalized
    .split(/\n{2,}/g)
    .map((part) => part.trim())
    .filter(Boolean)

  const chunks: string[] = []
  let buffer = ''

  for (const paragraph of paragraphs) {
    if (!buffer) {
      buffer = paragraph
      continue
    }

    if (buffer.length + paragraph.length + 2 <= 900) {
      buffer = `${buffer}\n\n${paragraph}`
      continue
    }

    chunks.push(buffer)
    buffer = paragraph
  }

  if (buffer) {
    chunks.push(buffer)
  }

  return chunks
}

const toSummary = (content: string, max = 140) => {
  const compact = content.replace(/\s+/g, ' ').trim()
  if (compact.length <= max) {
    return compact
  }

  return `${compact.slice(0, max - 3)}...`
}

const toTitle = (sequenceNo: number, content: string) => {
  const firstLine = content.split('\n')[0]?.trim() ?? ''
  if (firstLine.length === 0) {
    return `Knowledge Draft ${sequenceNo}`
  }

  const condensed = firstLine.replace(/^[-#*\d.\s]+/, '').trim()
  if (!condensed) {
    return `Knowledge Draft ${sequenceNo}`
  }

  return condensed.length > 72 ? `${condensed.slice(0, 69)}...` : condensed
}

const inferCardType = (content: string): KnowledgeCardType => {
  const lower = content.toLowerCase()
  if (lower.includes('stop') || lower.includes('risk') || lower.includes('止损') || lower.includes('风控')) {
    return 'risk-rule'
  }

  if (lower.includes('invalid') || lower.includes('失效')) {
    return 'invalidation-rule'
  }

  if (lower.includes('entry') || lower.includes('入场') || lower.includes('trigger') || lower.includes('触发')) {
    return 'entry-rule'
  }

  if (lower.includes('setup')) {
    return 'setup'
  }

  return 'concept'
}

const inferTags = (content: string, baseTags: string[]) => {
  const merged = new Set(baseTags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))
  const lower = content.toLowerCase()

  if (lower.includes('vwap')) {
    merged.add('vwap')
  }
  if (lower.includes('liquidity') || lower.includes('流动性')) {
    merged.add('liquidity')
  }
  if (lower.includes('breakout') || lower.includes('突破')) {
    merged.add('breakout')
  }
  if (lower.includes('retest') || lower.includes('回踩')) {
    merged.add('retest')
  }
  if (lower.includes('risk') || lower.includes('风控')) {
    merged.add('risk')
  }

  return [...merged]
}

export const buildDraftCardsFromFragments = (seeds: DraftCardSeed[]) =>
  seeds.map((seed) => {
    const cardType = inferCardType(seed.content_md)
    const tags = inferTags(seed.content_md, seed.base_tags)
    const summary = toSummary(seed.content_md)

    return {
      fragment_id: seed.fragment_id,
      card_type: cardType,
      title: toTitle(seed.sequence_no, seed.content_md),
      summary,
      content_md: seed.content_md,
      trigger_conditions_md: cardType === 'entry-rule' || cardType === 'setup' ? `- ${summary}` : '',
      invalidation_md: cardType === 'invalidation-rule' ? summary : '',
      risk_rule_md: cardType === 'risk-rule' ? summary : '',
      contract_scope: seed.contract_scope,
      timeframe_scope: seed.timeframe_scope,
      tags_json: JSON.stringify(tags),
      status: 'draft' as const,
      version: 1,
    }
  })
