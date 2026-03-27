import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { LocalFirstPaths } from '@main/app-shell/paths'
import { getDatabase } from '@main/db/connection'
import { listAnchorGroundingSignals } from '@main/db/repositories/anchor-queries'
import { listApprovedKnowledgeCards } from '@main/db/repositories/knowledge-repository'
import {
  listRecentSessionEventsForSuggestions,
  listSessionAnnotationsForSuggestions,
  listSimilarCaseCandidates,
  loadContractSymbolById,
  loadSuggestionSessionContext,
  type SimilarCaseCandidateRow,
  type SuggestionAnnotationRow,
  type SuggestionEventRow,
} from '@main/db/repositories/suggestion-queries'
import { appendSuggestionAuditRecord } from '@main/storage/suggestions'

const AnnotationSuggestionInputSchema = z.object({
  session_id: z.string().min(1),
  screenshot_id: z.string().min(1).nullable().optional(),
  max_items: z.number().int().min(1).max(12).default(6),
})

const ComposerSuggestionInputSchema = z.object({
  session_id: z.string().min(1),
  draft_text: z.string().optional(),
  selected_anchor_id: z.string().nullable().optional(),
  selected_annotation_id: z.string().nullable().optional(),
  max_items: z.number().int().min(1).max(12).default(8),
})

const AnchorReviewSuggestionInputSchema = z.object({
  session_id: z.string().min(1).nullable().optional(),
  anchor_ids: z.array(z.string().min(1)).optional(),
  limit: z.number().int().min(1).max(24).default(12),
})

const SimilarCaseInputSchema = z.object({
  session_id: z.string().min(1).nullable().optional(),
  contract_id: z.string().min(1).nullable().optional(),
  timeframe_scope: z.string().min(1).nullable().optional(),
  semantic_tags: z.array(z.string().min(1)).optional(),
  trade_context: z.string().min(1).nullable().optional(),
  limit: z.number().int().min(1).max(12).default(6),
})

type AnnotationSemanticType =
  | 'support'
  | 'resistance'
  | 'liquidity'
  | 'fvg'
  | 'imbalance'
  | 'entry'
  | 'invalidation'
  | 'target'
  | 'path'
  | 'context'

type AnnotationSuggestionShape = 'rectangle' | 'line' | 'arrow'

type SuggestionEvidence = {
  source: 'knowledge' | 'event' | 'annotation' | 'anchor'
  ref_id: string
  excerpt: string
}

export type AnnotationSuggestion = {
  id: string
  label: string
  title: string
  semantic_type: AnnotationSemanticType
  shape: AnnotationSuggestionShape
  geometry: { x1: number, y1: number, x2: number, y2: number }
  reason_summary: string
  confidence_score: number
  evidence: SuggestionEvidence[]
}

export type AnnotationSuggestionPayload = {
  run_id: string
  audit_id: string
  generated_at: string
  suggestions: AnnotationSuggestion[]
}

export type ComposerSuggestionKind = 'phrase' | 'template' | 'completion'
export type ComposerSuggestionSourceKind = 'system-template' | 'rule' | 'knowledge' | 'ai' | 'history'

export type ComposerAiSuggestion = {
  id: string
  kind: ComposerSuggestionKind
  label: string
  text: string
  source_kind: ComposerSuggestionSourceKind
  rank_score: number
  reason_summary: string
  source_card_id: string | null
  evidence: SuggestionEvidence[]
}

export type ComposerAiSuggestionPayload = {
  run_id: string
  audit_id: string
  generated_at: string
  suggestions: ComposerAiSuggestion[]
}

export type AnchorReviewStatusSuggestion = 'still_valid' | 'weakened' | 'invalidated'

export type AnchorReviewSuggestion = {
  anchor_id: string
  suggested_status: AnchorReviewStatusSuggestion
  confidence_score: number
  reason_summary: string
  evidence: SuggestionEvidence[]
}

export type AnchorReviewSuggestionPayload = {
  run_id: string
  audit_id: string
  generated_at: string
  suggestions: AnchorReviewSuggestion[]
}

export type SimilarCaseHit = {
  id: string
  session_id: string
  trade_id: string | null
  title: string
  summary: string
  score: number
  match_reasons: string[]
  evidence: SuggestionEvidence[]
}

export type SimilarCasePayload = {
  run_id: string
  audit_id: string
  generated_at: string
  hits: SimilarCaseHit[]
}

const compact = (value: string) => value.replace(/\s+/g, ' ').trim()
const truncate = (value: string, maxLength: number) => {
  const normalized = compact(value)
  if (normalized.length <= maxLength) {
    return normalized
  }
  return `${normalized.slice(0, maxLength - 3)}...`
}

const normalizeScore = (value: number) => Math.max(0, Math.min(Number(value.toFixed(3)), 1))

const NEGATIVE_SIGNAL_TERMS = ['失效', '跌破', 'invalid', 'breakdown', 'stop out', '止损', '破位']

const tokenize = (value: string) =>
  (value.toLowerCase().match(/[a-z0-9\u4e00-\u9fff]+/g) ?? []).filter((token) => token.length >= 2)

const overlapScore = (leftTokens: string[], rightTokens: string[]) => {
  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return 0
  }
  const left = new Set(leftTokens)
  const right = new Set(rightTokens)
  let intersection = 0
  for (const token of left) {
    if (right.has(token)) {
      intersection += 1
    }
  }
  const union = new Set([...left, ...right]).size
  return union === 0 ? 0 : intersection / union
}

const semanticFromCardType = (cardType: string): AnnotationSemanticType => {
  if (cardType === 'setup') {
    return 'support'
  }
  if (cardType === 'entry-rule') {
    return 'entry'
  }
  if (cardType === 'invalidation-rule') {
    return 'invalidation'
  }
  if (cardType === 'risk-rule') {
    return 'context'
  }
  if (cardType === 'management-rule') {
    return 'path'
  }
  if (cardType === 'mistake-pattern') {
    return 'context'
  }
  if (cardType === 'checklist') {
    return 'target'
  }
  return 'context'
}

const shapeFromSemantic = (semantic: AnnotationSemanticType): AnnotationSuggestionShape => {
  if (semantic === 'path') {
    return 'arrow'
  }
  if (semantic === 'invalidation' || semantic === 'target') {
    return 'line'
  }
  return 'rectangle'
}

const geometryFromReference = (reference: SuggestionAnnotationRow | null, index: number) => {
  if (reference) {
    return {
      x1: reference.x1,
      y1: reference.y1,
      x2: reference.x2,
      y2: reference.y2,
    }
  }
  const offset = (index % 6) * 28
  return {
    x1: 220 + offset,
    y1: 180 + offset,
    x2: 420 + offset,
    y2: 290 + offset,
  }
}

const fallbackSemanticByIndex: AnnotationSemanticType[] = [
  'support',
  'entry',
  'path',
  'invalidation',
  'target',
  'context',
]

const semanticFromContext = (
  event: SuggestionEventRow | null,
  annotation: SuggestionAnnotationRow | null,
  index: number,
): AnnotationSemanticType => {
  const annotationLabel = annotation?.label.toLowerCase() ?? ''
  const eventText = `${event?.title ?? ''} ${event?.summary ?? ''}`.toLowerCase()
  if (annotationLabel.includes('support')) {
    return 'support'
  }
  if (annotationLabel.includes('entry') || eventText.includes('进场') || eventText.includes('entry')) {
    return 'entry'
  }
  if (eventText.includes('失效') || eventText.includes('stop') || eventText.includes('止损')) {
    return 'invalidation'
  }
  return fallbackSemanticByIndex[index % fallbackSemanticByIndex.length]
}

const evidenceFromContext = (
  knowledgeCard: { id: string, title: string, summary: string },
  event: SuggestionEventRow | null,
  annotation: SuggestionAnnotationRow | null,
): SuggestionEvidence[] => {
  const evidence: SuggestionEvidence[] = [
    {
      source: 'knowledge',
      ref_id: knowledgeCard.id,
      excerpt: truncate(`${knowledgeCard.title}: ${knowledgeCard.summary}`, 120),
    },
  ]
  if (event) {
    evidence.push({
      source: 'event',
      ref_id: event.id,
      excerpt: truncate(`${event.title} ${event.summary}`, 120),
    })
  }
  if (annotation) {
    evidence.push({
      source: 'annotation',
      ref_id: annotation.id,
      excerpt: truncate(`${annotation.label} ${annotation.shape}`, 60),
    })
  }
  return evidence
}

const buildContextOnlyEvidence = (
  event: SuggestionEventRow | null,
  annotation: SuggestionAnnotationRow | null,
): SuggestionEvidence[] => {
  const evidence: SuggestionEvidence[] = []
  if (event) {
    evidence.push({
      source: 'event',
      ref_id: event.id,
      excerpt: truncate(`${event.title} ${event.summary}`, 120),
    })
  }
  if (annotation) {
    evidence.push({
      source: 'annotation',
      ref_id: annotation.id,
      excerpt: truncate(`${annotation.label} ${annotation.text ?? annotation.shape}`, 80),
    })
  }
  return evidence
}

export const generateAiAnnotationSuggestions = async(
  paths: LocalFirstPaths,
  rawInput: unknown,
): Promise<AnnotationSuggestionPayload> => {
  const input = AnnotationSuggestionInputSchema.parse(rawInput)
  const db = await getDatabase(paths)
  const context = loadSuggestionSessionContext(db, input.session_id)
  const [events, annotations, knowledgeHits] = await Promise.all([
    listRecentSessionEventsForSuggestions(db, input.session_id, input.max_items + 2),
    listSessionAnnotationsForSuggestions(db, {
      session_id: input.session_id,
      screenshot_id: input.screenshot_id ?? null,
      limit: input.max_items * 3,
    }),
    listApprovedKnowledgeCards(db, {
      contract_scope: context.contract_symbol,
      trade_state: context.trade_state,
      context_tags: context.tags,
      limit: input.max_items * 3,
    }),
  ])

  const suggestions: AnnotationSuggestion[] = Array.from({ length: input.max_items }, (_, index) => {
    const event = events[index % Math.max(1, events.length)] ?? null
    const annotation = annotations[index % Math.max(1, annotations.length)] ?? null
    const card = knowledgeHits.length > 0
      ? knowledgeHits[index % knowledgeHits.length] ?? null
      : null
    const semantic = card
      ? semanticFromCardType(card.card_type)
      : semanticFromContext(event, annotation, index)
    const geometry = geometryFromReference(annotation, index)
    const scoreBase = 0.58 + (0.05 * Math.min(index, 4))
    const confidence = normalizeScore(
      scoreBase
      + (card ? 0.06 : 0)
      + (annotation ? 0.08 : 0)
      + (event ? 0.06 : 0),
    )

    return {
      id: `annotation_suggestion_${randomUUID()}`,
      label: `AI-${semantic.toUpperCase().slice(0, 2)}${index + 1}`,
      title: card
        ? truncate(card.title, 48)
        : truncate(annotation?.label ?? event?.title ?? `Context area ${index + 1}`, 48),
      semantic_type: semantic,
      shape: shapeFromSemantic(semantic),
      geometry,
      reason_summary: card
        ? truncate(`基于 approved knowledge "${card.title}" 与当前 session 事件上下文生成。`, 120)
        : truncate('基于当前 session 事件与现有标注生成候选层建议。', 120),
      confidence_score: confidence,
      evidence: card
        ? evidenceFromContext(
          { id: card.id, title: card.title, summary: card.summary },
          event,
          annotation,
        )
        : buildContextOnlyEvidence(event, annotation),
    }
  })

  const runId = `annotation_suggestion_run_${randomUUID()}`
  const audit = await appendSuggestionAuditRecord(paths, {
    kind: 'annotation',
    session_id: input.session_id,
    payload: {
      run_id: runId,
      input,
      context,
      suggestion_count: suggestions.length,
      suggestions,
    },
  })
  return {
    run_id: runId,
    audit_id: audit.id,
    generated_at: audit.created_at,
    suggestions,
  }
}

const buildTemplateSuggestionText = (title: string) => [
  '观点：',
  `依据：${title}`,
  '触发条件：',
  '失效条件：',
  '执行计划：',
].join('\n')

const buildSystemTemplateSuggestion = (): ComposerAiSuggestion => ({
  id: `composer_suggestion_${randomUUID()}`,
  kind: 'template',
  label: '系统模板',
  text: [
    '观点：',
    '关键区域：',
    '触发条件：',
    '失效条件：',
    '执行计划：',
  ].join('\n'),
  source_kind: 'system-template',
  rank_score: normalizeScore(0.42),
  reason_summary: '当前没有足够的上下文命中，回退到本地结构化模板。',
  source_card_id: null,
  evidence: [],
})

export const generateComposerAiSuggestions = async(
  paths: LocalFirstPaths,
  rawInput: unknown,
): Promise<ComposerAiSuggestionPayload> => {
  const input = ComposerSuggestionInputSchema.parse(rawInput)
  const db = await getDatabase(paths)
  const context = loadSuggestionSessionContext(db, input.session_id)
  const [events, cards] = await Promise.all([
    listRecentSessionEventsForSuggestions(db, input.session_id, 6),
    listApprovedKnowledgeCards(db, {
      contract_scope: context.contract_symbol,
      trade_state: context.trade_state,
      context_tags: context.tags,
      limit: 12,
    }),
  ])

  const suggestions: ComposerAiSuggestion[] = []
  for (const card of cards.slice(0, 4)) {
    suggestions.push({
      id: `composer_suggestion_${randomUUID()}`,
      kind: 'phrase',
      label: card.title,
      text: truncate(`${card.title}: ${card.summary}`, 180),
      source_kind: 'knowledge',
      rank_score: normalizeScore(0.78),
      reason_summary: '匹配 approved knowledge 与当前合约上下文。',
      source_card_id: card.id,
      evidence: [{
        source: 'knowledge',
        ref_id: card.id,
        excerpt: truncate(card.summary, 120),
      }],
    })
    suggestions.push({
      id: `composer_suggestion_${randomUUID()}`,
      kind: 'template',
      label: `结构化模板 · ${card.title}`,
      text: buildTemplateSuggestionText(card.title),
      source_kind: 'knowledge',
      rank_score: normalizeScore(0.71),
      reason_summary: '用于快速结构化记录当前观点与失效条件。',
      source_card_id: card.id,
      evidence: [{
        source: 'knowledge',
        ref_id: card.id,
        excerpt: truncate(card.title, 80),
      }],
    })
  }

  const event = events[0]
  if (event) {
    suggestions.push({
      id: `composer_suggestion_${randomUUID()}`,
      kind: 'phrase',
      label: '引用最近事件',
      text: truncate(`事件更新：${event.title}，${event.summary}`, 180),
      source_kind: 'history',
      rank_score: normalizeScore(0.69),
      reason_summary: '引用最近事件流，避免记录与上下文脱节。',
      source_card_id: null,
      evidence: [{
        source: 'event',
        ref_id: event.id,
        excerpt: truncate(event.summary, 120),
      }],
    })
  }

  const draftText = compact(input.draft_text ?? '')
  if (draftText.length > 0) {
    const seed = draftText.split(/[,.，。;；]/)[0] ?? draftText
    suggestions.push({
      id: `composer_suggestion_${randomUUID()}`,
      kind: 'completion',
      label: '补全当前观点',
      text: truncate(`${seed}，若确认量价继续配合，则按计划执行，不做追单。`, 180),
      source_kind: 'rule',
      rank_score: normalizeScore(0.74),
      reason_summary: '基于当前输入前缀生成补全候选。',
      source_card_id: null,
      evidence: [{
        source: 'annotation',
        ref_id: input.selected_annotation_id ?? 'draft',
        excerpt: truncate(seed, 80),
      }],
    })
  }

  const ranked = suggestions
    .sort((left, right) => right.rank_score - left.rank_score)
    .slice(0, input.max_items)
  if (ranked.length === 0) {
    ranked.push(buildSystemTemplateSuggestion())
  }

  const runId = `composer_suggestion_run_${randomUUID()}`
  const audit = await appendSuggestionAuditRecord(paths, {
    kind: 'composer',
    session_id: input.session_id,
    payload: {
      run_id: runId,
      input,
      context,
      suggestion_count: ranked.length,
      suggestions: ranked,
    },
  })
  return {
    run_id: runId,
    audit_id: audit.id,
    generated_at: audit.created_at,
    suggestions: ranked,
  }
}

const hasNegativeSignal = (events: SuggestionEventRow[]) => {
  const text = events.map((event) => `${event.title} ${event.summary}`.toLowerCase()).join(' ')
  return NEGATIVE_SIGNAL_TERMS.some((token) => text.includes(token))
}

export const generateAnchorReviewSuggestions = async(
  paths: LocalFirstPaths,
  rawInput: unknown,
): Promise<AnchorReviewSuggestionPayload> => {
  const input = AnchorReviewSuggestionInputSchema.parse(rawInput)
  const db = await getDatabase(paths)
  const [anchorSignals, events] = await Promise.all([
    listAnchorGroundingSignals(db, {
      session_id: input.session_id ?? null,
      limit: Math.max(input.limit * 20, 80),
    }),
    input.session_id ? listRecentSessionEventsForSuggestions(db, input.session_id, 8) : Promise.resolve([]),
  ])
  const negativeSignal = hasNegativeSignal(events)
  const grouped = new Map<string, typeof anchorSignals>()
  for (const row of anchorSignals) {
    if (input.anchor_ids && !input.anchor_ids.includes(row.anchor_id)) {
      continue
    }
    const list = grouped.get(row.anchor_id) ?? []
    list.push(row)
    grouped.set(row.anchor_id, list)
  }

  const now = Date.now()
  const suggestions = [...grouped.entries()].slice(0, input.limit).map(([anchorId, rows]) => {
    const latest = rows[0]
    const avgRelevance = rows.reduce((sum, row) => sum + row.relevance_score, 0) / Math.max(1, rows.length)
    const latestTs = Date.parse(latest.created_at)
    const ageHours = Number.isFinite(latestTs) ? Math.max(0, (now - latestTs) / 36e5) : 72
    let status: AnchorReviewStatusSuggestion = 'still_valid'
    if ((negativeSignal && avgRelevance < 0.62) || avgRelevance < 0.52) {
      status = 'invalidated'
    } else if (negativeSignal || avgRelevance < 0.68 || ageHours > 48) {
      status = 'weakened'
    }

    const confidence = normalizeScore(
      0.55
      + (rows.length >= 3 ? 0.12 : 0)
      + (avgRelevance >= 0.7 ? 0.16 : 0)
      - (negativeSignal ? 0.12 : 0),
    )
    const reason = status === 'still_valid'
      ? '近期 grounding 命中稳定，暂无明显失效信号。'
      : status === 'weakened'
        ? '命中强度下降或出现潜在失效信号，建议人工复核。'
        : '出现明显失效信号且相关命中弱化，建议标记 invalidated。'
    const evidence: SuggestionEvidence[] = [{
      source: 'anchor',
      ref_id: anchorId,
      excerpt: truncate(`recent_hits=${rows.length}; avg_relevance=${avgRelevance.toFixed(2)}; age_hours=${ageHours.toFixed(1)}`, 120),
    }]
    if (latest.match_reason_md) {
      evidence.push({
        source: 'knowledge',
        ref_id: latest.knowledge_card_id,
        excerpt: truncate(latest.match_reason_md, 120),
      })
    }
    if (negativeSignal && events[0]) {
      evidence.push({
        source: 'event',
        ref_id: events[0].id,
        excerpt: truncate(`${events[0].title} ${events[0].summary}`, 120),
      })
    }
    return {
      anchor_id: anchorId,
      suggested_status: status,
      confidence_score: confidence,
      reason_summary: reason,
      evidence,
    }
  })

  const runId = `anchor_review_run_${randomUUID()}`
  const audit = await appendSuggestionAuditRecord(paths, {
    kind: 'anchor-review',
    session_id: input.session_id ?? null,
    payload: {
      run_id: runId,
      input,
      suggestion_count: suggestions.length,
      suggestions,
    },
  })
  return {
    run_id: runId,
    audit_id: audit.id,
    generated_at: audit.created_at,
    suggestions,
  }
}

const buildCandidateText = (candidate: SimilarCaseCandidateRow) => [
  candidate.session_title,
  candidate.market_bias,
  candidate.tags.join(' '),
  candidate.trade_side ?? '',
  candidate.trade_status ?? '',
  candidate.thesis ?? '',
  candidate.analysis_summary ?? '',
  candidate.event_digest ?? '',
  candidate.evaluation_note ?? '',
].join(' ')

const scoreSimilarCandidate = (
  candidate: SimilarCaseCandidateRow,
  queryTokens: string[],
  contractSymbol: string | null,
  tradeContext: string | null,
) => {
  const candidateTokens = tokenize(buildCandidateText(candidate))
  const textSimilarity = overlapScore(queryTokens, candidateTokens)
  const contextTokens = tradeContext ? tokenize(tradeContext) : []
  const tradeTokens = tokenize(`${candidate.trade_side ?? ''} ${candidate.trade_status ?? ''} ${candidate.thesis ?? ''}`)
  const contextSimilarity = overlapScore(contextTokens, tradeTokens)
  const contractBonus = contractSymbol && candidate.contract_symbol === contractSymbol ? 0.35 : 0
  const evalBonus = candidate.evaluation_score ? Math.max(0, Math.min(candidate.evaluation_score / 100, 0.1)) : 0
  const total = normalizeScore(contractBonus + (0.35 * textSimilarity) + (0.2 * contextSimilarity) + evalBonus)

  const reasons: string[] = []
  if (contractBonus > 0) {
    reasons.push(`合约匹配 ${candidate.contract_symbol}`)
  }
  if (textSimilarity > 0) {
    reasons.push(`语义标签重合 ${(textSimilarity * 100).toFixed(0)}%`)
  }
  if (contextSimilarity > 0.05) {
    reasons.push(`交易上下文重合 ${(contextSimilarity * 100).toFixed(0)}%`)
  }
  if (candidate.evaluation_score) {
    reasons.push(`历史评估分 ${candidate.evaluation_score.toFixed(0)}`)
  }

  return { score: total, reasons }
}

const resolveSimilarCasesContractSymbol = (
  db: Awaited<ReturnType<typeof getDatabase>>,
  input: z.infer<typeof SimilarCaseInputSchema>,
  sessionContext: ReturnType<typeof loadSuggestionSessionContext> | null,
) => {
  if (input.contract_id && sessionContext && sessionContext.contract_id !== input.contract_id) {
    throw new Error(`similar cases contract mismatch: session=${sessionContext.contract_id}, input=${input.contract_id}`)
  }

  if (input.contract_id) {
    return loadContractSymbolById(db, input.contract_id)
  }

  return sessionContext?.contract_symbol ?? null
}

export const recallSimilarCases = async(
  paths: LocalFirstPaths,
  rawInput: unknown,
): Promise<SimilarCasePayload> => {
  const input = SimilarCaseInputSchema.parse(rawInput)
  const db = await getDatabase(paths)
  const sessionContext = input.session_id ? loadSuggestionSessionContext(db, input.session_id) : null
  const contractSymbol = resolveSimilarCasesContractSymbol(db, input, sessionContext)
  const baseTags = input.semantic_tags ?? sessionContext?.tags ?? []
  const queryText = [
    ...(baseTags ?? []),
    input.trade_context ?? '',
    input.timeframe_scope ?? '',
  ].join(' ')
  const queryTokens = tokenize(queryText)
  const candidates = listSimilarCaseCandidates(db, {
    contract_symbol: contractSymbol,
    limit: 120,
  })

  const scored = candidates
    .filter((candidate) => !input.session_id || candidate.session_id !== input.session_id)
    .map((candidate) => ({ candidate, ...scoreSimilarCandidate(candidate, queryTokens, contractSymbol, input.trade_context ?? null) }))
    .filter((row) => row.score > 0.08)
    .sort((left, right) => right.score - left.score)
    .slice(0, input.limit)

  const hits: SimilarCaseHit[] = scored.map(({ candidate, score, reasons }) => ({
    id: `similar_case_${candidate.trade_id ?? candidate.session_id}`,
    session_id: candidate.session_id,
    trade_id: candidate.trade_id,
    title: truncate(candidate.session_title, 80),
    summary: truncate(
      candidate.analysis_summary
        ?? candidate.thesis
        ?? candidate.event_digest
        ?? '无可用摘要，建议查看该 session 的事件流。',
      180,
    ),
    score,
    match_reasons: reasons.length > 0 ? reasons : ['基础结构化条件命中'],
    evidence: [{
      source: 'event',
      ref_id: candidate.session_id,
      excerpt: truncate(candidate.event_digest ?? candidate.analysis_summary ?? candidate.session_title, 120),
    }],
  }))

  const runId = `similar_case_run_${randomUUID()}`
  const audit = await appendSuggestionAuditRecord(paths, {
    kind: 'similar-case',
    session_id: input.session_id ?? null,
    payload: {
      run_id: runId,
      input,
      hit_count: hits.length,
      hits,
    },
  })
  return {
    run_id: runId,
    audit_id: audit.id,
    generated_at: audit.created_at,
    hits,
  }
}
