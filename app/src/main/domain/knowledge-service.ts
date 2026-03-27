import { readFile } from 'node:fs/promises'
import type { LocalFirstPaths } from '@main/app-shell/paths'
import { getDatabase } from '@main/db/connection'
import {
  findMarketAnchorBySourceAnnotation,
  getMarketAnchorById,
  insertMarketAnchor,
  insertMarketAnchorStatusHistory,
  listAnchorGroundingSignals,
  listMarketAnchors,
  updateMarketAnchor,
} from '@main/db/repositories/anchor-repository'
import {
  completeKnowledgeImportJob,
  createKnowledgeImportJob,
  createKnowledgeSource,
  failKnowledgeImportJob,
  insertDraftKnowledgeCards,
  insertKnowledgeFragments,
  insertKnowledgeGroundings,
  listApprovedKnowledgeCards,
  listDraftKnowledgeCards,
  listKnowledgeGroundingsByAiRun,
  listKnowledgeImportJobs,
  listKnowledgeSources,
  markKnowledgeImportJobProcessing,
  reviewKnowledgeCard,
} from '@main/db/repositories/knowledge-repository'
import { extractDraftCardsWithGemini } from '@main/knowledge/gemini-extractor'
import {
  buildDraftCardsFromFragments,
  splitKnowledgeContent,
  type IngestKnowledgeSourceInput,
  type KnowledgeCardRecord,
  type KnowledgeGroundingRecord,
  type KnowledgeImportJobRecord,
  type KnowledgeSourceRecord,
} from '@main/knowledge/pipeline'
import type { ActiveMarketAnchorRecord } from '@shared/contracts/knowledge'

const DEFAULT_GEMINI_MODEL = 'gemini-1.5-pro'

export type KnowledgeReviewDashboardPayload = {
  sources: KnowledgeSourceRecord[]
  import_jobs: KnowledgeImportJobRecord[]
  draft_cards: KnowledgeCardRecord[]
  approved_cards: KnowledgeCardRecord[]
}

export type ReviewKnowledgeCardInput = {
  knowledge_card_id: string
  action: 'approve' | 'edit-approve' | 'archive'
  reviewed_by?: string | null
  review_note_md?: string | null
  edit_payload?: {
    card_type?: KnowledgeCardRecord['card_type']
    title?: string
    summary?: string
    content_md?: string
    trigger_conditions_md?: string
    invalidation_md?: string
    risk_rule_md?: string
    contract_scope?: string[]
    timeframe_scope?: string[]
    tags?: string[]
  }
}

export type ApprovedKnowledgeRuntimeInput = {
  contract_scope?: string | null
  timeframe_scope?: string | null
  tags?: string[]
  annotation_semantic?: string | null
  trade_state?: string | null
  context_tags?: string[]
  limit?: number
}

export type KnowledgeRuntimeHit = {
  knowledge_card_id: string
  title: string
  summary: string
  card_type: KnowledgeCardRecord['card_type']
  contract_scope: string
  timeframe_scope: string
  tags: string[]
  relevance_score: number
  fragment_excerpt: string
  match_reasons: string[]
}

export type ApprovedKnowledgeRuntimePayload = {
  hits: KnowledgeRuntimeHit[]
}

export type ComposerSuggestion = {
  id: string
  kind: 'phrase' | 'template' | 'completion'
  label: string
  text: string
  source_kind: 'system-template' | 'rule' | 'knowledge' | 'ai' | 'history'
  source_card_id: string | null
  reason_summary: string
  rank_score: number
}

export type ActiveAnchorSummary = {
  anchor_id: string
  updated_at: string
  contract_id: string
  session_id: string | null
  trade_id: string | null
  label: string
  title: string
  semantic_type: ActiveMarketAnchorRecord['semantic_type']
  status: ActiveMarketAnchorRecord['status']
  origin_annotation_id: string | null
  origin_annotation_label: string | null
  origin_screenshot_id: string | null
  timeframe_scope: string | null
  price_low: number | null
  price_high: number | null
  thesis_md: string
  invalidation_rule_md: string
  carry_forward: boolean
  hit_count: number
  latest_grounded_at: string | null
  related_card_ids: string[]
  related_card_titles: string[]
}

export type ActiveAnchorRuntimePayload = {
  anchors: ActiveAnchorSummary[]
}

export type ComposerShellPayload = {
  approved_knowledge_hits: KnowledgeRuntimeHit[]
  suggestions: ComposerSuggestion[]
  active_anchor_labels: string[]
  context_summary?: string
}

export type ListMarketAnchorFilters = {
  contract_id?: string | null
  session_id?: string | null
  trade_id?: string | null
  status?: ActiveMarketAnchorRecord['status'] | null
  limit?: number
}

export type AdoptMarketAnchorInput = {
  contract_id: string
  session_id: string
  trade_id?: string | null
  source_annotation_id?: string | null
  source_annotation_label?: string | null
  source_screenshot_id?: string | null
  title: string
  semantic_type?: ActiveMarketAnchorRecord['semantic_type']
  timeframe_scope?: string | null
  price_low?: number | null
  price_high?: number | null
  thesis_md: string
  invalidation_rule_md: string
  carry_forward?: boolean
}

export type UpdateMarketAnchorStatusInput = {
  anchor_id: string
  status: ActiveMarketAnchorRecord['status']
  reason_md?: string | null
  changed_by?: string | null
}

export type KnowledgeGroundingHitInput = {
  knowledge_card_id: string
  match_reason_md: string
  relevance_score: number
  annotation_id?: string | null
  anchor_id?: string | null
  screenshot_id?: string | null
}

export type RecordKnowledgeGroundingsInput = {
  ai_run_id: string
  session_id?: string | null
  trade_id?: string | null
  screenshot_id?: string | null
  annotation_id?: string | null
  anchor_id?: string | null
  hits: KnowledgeGroundingHitInput[]
}

type ExtractionMode = 'auto' | 'heuristic' | 'gemini'

const parseTags = (tagsJson: string) => {
  if (!tagsJson) {
    return []
  }
  try {
    const parsed = JSON.parse(tagsJson) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.filter((item): item is string => typeof item === 'string')
  } catch {
    return []
  }
}

const normalizeTags = (tags: string[] | undefined) =>
  (tags ?? []).map((tag) => tag.trim().toLowerCase()).filter(Boolean)

const truncate = (value: string, maxLength: number) => {
  const compact = value.replace(/\s+/g, ' ').trim()
  if (compact.length <= maxLength) {
    return compact
  }
  return `${compact.slice(0, maxLength - 3)}...`
}

const toRuntimeHit = (
  card: KnowledgeCardRecord,
  input: ApprovedKnowledgeRuntimeInput,
): KnowledgeRuntimeHit => {
  const tags = parseTags(card.tags_json)
  const matchReasons: string[] = []

  if (input.contract_scope?.trim()) {
    matchReasons.push(`contract=${input.contract_scope.trim()}`)
  }
  if (input.timeframe_scope?.trim()) {
    matchReasons.push(`timeframe=${input.timeframe_scope.trim()}`)
  }
  if (input.trade_state?.trim()) {
    matchReasons.push(`trade_state=${input.trade_state.trim()}`)
  }
  if (input.annotation_semantic?.trim()) {
    matchReasons.push(`annotation_semantic=${input.annotation_semantic.trim()}`)
  }
  if ((input.tags ?? []).length > 0) {
    matchReasons.push(`tags=${normalizeTags(input.tags).join(', ')}`)
  }
  if ((input.context_tags ?? []).length > 0) {
    matchReasons.push(`context_tags=${normalizeTags(input.context_tags).join(', ')}`)
  }
  if (matchReasons.length === 0) {
    matchReasons.push('approved knowledge runtime fallback')
  }

  const relevanceScore = Math.max(0.3, Math.min(0.95, Number((0.55 + (matchReasons.length * 0.08)).toFixed(2))))
  return {
    knowledge_card_id: card.id,
    title: card.title,
    summary: card.summary,
    card_type: card.card_type,
    contract_scope: card.contract_scope,
    timeframe_scope: card.timeframe_scope,
    tags,
    relevance_score: relevanceScore,
    fragment_excerpt: truncate(card.content_md, 180),
    match_reasons: matchReasons,
  }
}

const toComposerSuggestions = (hits: KnowledgeRuntimeHit[]): ComposerSuggestion[] => {
  const suggestions: ComposerSuggestion[] = []

  for (const hit of hits.slice(0, 4)) {
    suggestions.push({
      id: `composer_phrase_${hit.knowledge_card_id}`,
      kind: 'phrase',
      label: hit.title,
      text: `${hit.title}: ${hit.summary}`,
      source_kind: 'knowledge',
      source_card_id: hit.knowledge_card_id,
      reason_summary: hit.match_reasons[0] ?? '命中 approved knowledge。',
      rank_score: hit.relevance_score,
    })
    suggestions.push({
      id: `composer_template_${hit.knowledge_card_id}`,
      kind: 'template',
      label: `结构化模板 · ${hit.title}`,
      text: `观点：\n依据：${hit.title}\n触发条件：\n失效条件：`,
      source_kind: 'knowledge',
      source_card_id: hit.knowledge_card_id,
      reason_summary: `基于 approved knowledge "${hit.title}" 生成结构化模板。`,
      rank_score: Math.max(0.45, hit.relevance_score - 0.05),
    })
  }

  if (suggestions.length === 0) {
    suggestions.push({
      id: 'composer_template_system_default',
      kind: 'template',
      label: '系统模板',
      text: '观点：\n关键区域：\n触发条件：\n失效条件：\n执行计划：',
      source_kind: 'system-template',
      source_card_id: null,
      reason_summary: '当前没有命中的 approved knowledge，回退到本地结构化模板。',
      rank_score: 0.42,
    })
  }

  return suggestions.slice(0, 8)
}

const buildComposerContextSummary = (
  hits: KnowledgeRuntimeHit[],
  activeAnchorCount: number,
) => {
  if (hits.length === 0) {
    return activeAnchorCount > 0
      ? `当前没有命中的 approved knowledge，保留 ${activeAnchorCount} 个 active anchor 供手动参考。`
      : '当前没有命中的 approved knowledge，Composer 仅提供本地结构化模板。'
  }

  return activeAnchorCount > 0
    ? `当前命中 ${hits.length} 条 approved knowledge，并携带 ${activeAnchorCount} 个 active anchor 上下文。`
    : `当前命中 ${hits.length} 条 approved knowledge。`
}

const normalizeAnchorFilters = (input: ListMarketAnchorFilters = {}): ListMarketAnchorFilters => ({
  contract_id: input.contract_id ?? null,
  session_id: input.session_id ?? null,
  trade_id: input.trade_id ?? null,
  status: input.status ?? 'active',
  limit: Math.max(1, Math.min(input.limit ?? 12, 24)),
})

const buildAnchorSummary = (
  anchor: ActiveMarketAnchorRecord,
  groundingSignals: ReturnType<typeof listAnchorGroundingSignals>,
): ActiveAnchorSummary => {
  const relatedCardIds = [...new Set(groundingSignals.map((item) => item.knowledge_card_id))]
  const relatedCardTitles = [...new Set(
    groundingSignals
      .map((item) => item.knowledge_card_title?.trim())
      .filter((item): item is string => Boolean(item)),
  )]

  return {
    anchor_id: anchor.id,
    updated_at: anchor.updated_at ?? anchor.created_at,
    contract_id: anchor.contract_id,
    session_id: anchor.session_id,
    trade_id: anchor.trade_id,
    label: anchor.title,
    title: anchor.title,
    semantic_type: anchor.semantic_type,
    status: anchor.status,
    origin_annotation_id: anchor.origin_annotation_id,
    origin_annotation_label: anchor.origin_annotation_label ?? null,
    origin_screenshot_id: anchor.origin_screenshot_id,
    timeframe_scope: anchor.timeframe_scope,
    price_low: anchor.price_low,
    price_high: anchor.price_high,
    thesis_md: anchor.thesis_md,
    invalidation_rule_md: anchor.invalidation_rule_md,
    carry_forward: anchor.carry_forward,
    hit_count: groundingSignals.length,
    latest_grounded_at: groundingSignals[0]?.created_at ?? null,
    related_card_ids: relatedCardIds,
    related_card_titles: relatedCardTitles,
  }
}

const resolveExtractionMode = (requestedMode: ExtractionMode | undefined): ExtractionMode => {
  if (requestedMode) {
    return requestedMode
  }

  const envMode = process.env.ALPHA_NEXUS_KNOWLEDGE_EXTRACT_MODE?.trim().toLowerCase()
  if (envMode === 'gemini' || envMode === 'heuristic' || envMode === 'auto') {
    return envMode
  }

  return 'auto'
}

const resolveContentMarkdown = async(input: IngestKnowledgeSourceInput) => {
  if (input.file_path?.trim()) {
    return readFile(input.file_path.trim(), 'utf8')
  }
  return input.content_md
}

const sanitizeSummary = (message: string) => {
  const compact = message.replace(/\s+/g, ' ').trim()
  return compact.length > 220 ? `${compact.slice(0, 217)}...` : compact
}

export const ingestKnowledgeSource = async(paths: LocalFirstPaths, input: IngestKnowledgeSourceInput) => {
  const db = await getDatabase(paths)
  const contentMd = (await resolveContentMarkdown(input)).trim()
  const fragments = splitKnowledgeContent(contentMd)
  const extractionMode = resolveExtractionMode(input.extraction_mode)
  const geminiApiKey = process.env.GEMINI_API_KEY?.trim() ?? ''
  const geminiModel = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL

  if (fragments.length === 0) {
    throw new Error('知识源内容为空，无法导入。')
  }

  const shouldUseGemini = extractionMode === 'gemini' || (extractionMode === 'auto' && geminiApiKey.length > 0)
  if (extractionMode === 'gemini' && geminiApiKey.length === 0) {
    throw new Error('GEMINI_API_KEY 缺失，无法执行 Gemini 知识抽取。')
  }

  const source = createKnowledgeSource(db, {
    source_type: input.source_type,
    title: input.title.trim(),
    author: input.author ?? null,
    language: input.language ?? 'zh-CN',
    content_md: contentMd,
  })

  const job = createKnowledgeImportJob(db, {
    source_id: source.id,
    input_snapshot_json: JSON.stringify({
      ...input,
      content_md: undefined,
      content_length: contentMd.length,
      extraction_mode: extractionMode,
    }),
    provider: shouldUseGemini ? 'gemini' : 'local',
    model: shouldUseGemini ? geminiModel : 'deterministic-v1',
    job_type: shouldUseGemini ? 'gemini-extract' : (input.file_path ? 'document-import' : 'manual-ingest'),
    status: 'pending',
  })

  markKnowledgeImportJobProcessing(db, {
    job_id: job.id,
    output_summary: shouldUseGemini ? 'Gemini extraction started.' : 'Heuristic extraction started.',
  })

  const fragmentRows = insertKnowledgeFragments(db, fragments.map((content, index) => ({
    source_id: source.id,
    job_id: job.id,
    sequence_no: index + 1,
    content_md: content,
  })))

  const fragmentSeeds = fragmentRows.map((fragment) => ({
    fragment_id: fragment.id,
    sequence_no: fragment.sequence_no,
    content_md: fragment.content_md,
    contract_scope: input.contract_scope?.trim() || '*',
    timeframe_scope: input.timeframe_scope?.trim() || '*',
    base_tags: normalizeTags(input.tags),
  }))

  try {
    const extractedCards = shouldUseGemini
      ? await extractDraftCardsWithGemini({
        apiKey: geminiApiKey,
        sourceTitle: source.title,
        model: geminiModel,
        fragments: fragmentSeeds,
      })
      : buildDraftCardsFromFragments(fragmentSeeds)

    if (extractedCards.length === 0) {
      throw new Error('知识抽取完成但未生成任何 draft cards。')
    }

    const cardRows = insertDraftKnowledgeCards(db, extractedCards.map((card) => ({
      source_id: source.id,
      fragment_id: card.fragment_id,
      card_type: card.card_type,
      title: card.title,
      summary: card.summary,
      content_md: card.content_md,
      trigger_conditions_md: card.trigger_conditions_md,
      invalidation_md: card.invalidation_md,
      risk_rule_md: card.risk_rule_md,
      contract_scope: card.contract_scope,
      timeframe_scope: card.timeframe_scope,
      tags_json: card.tags_json,
      status: 'draft',
      version: card.version,
    })))

    completeKnowledgeImportJob(db, {
      job_id: job.id,
      output_summary: `${shouldUseGemini ? 'Gemini' : 'Heuristic'} extraction created ${fragmentRows.length} fragments and ${cardRows.length} draft cards.`,
    })

    return {
      source,
      import_job_id: job.id,
      fragments: fragmentRows,
      draft_cards: cardRows,
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown extraction failure'
    failKnowledgeImportJob(db, {
      job_id: job.id,
      output_summary: sanitizeSummary(detail),
    })
    throw new Error(`知识抽取失败（provider=${shouldUseGemini ? 'gemini' : 'heuristic'}）: ${detail}`)
  }
}

export const listKnowledgeDraftCardsForReview = async(paths: LocalFirstPaths, limit?: number) => {
  const db = await getDatabase(paths)
  return listDraftKnowledgeCards(db, limit)
}

export const reviewKnowledgeDraftCard = async(paths: LocalFirstPaths, input: ReviewKnowledgeCardInput) => {
  const db = await getDatabase(paths)
  return db.transaction(() => reviewKnowledgeCard(db, {
    knowledge_card_id: input.knowledge_card_id,
    action: input.action,
    reviewed_by: input.reviewed_by ?? 'local-user',
    review_note_md: input.review_note_md ?? '',
    edit_payload: input.edit_payload,
  }))()
}

export const getKnowledgeReviewDashboard = async(paths: LocalFirstPaths): Promise<KnowledgeReviewDashboardPayload> => {
  const db = await getDatabase(paths)
  const sources = listKnowledgeSources(db)
  const importJobs = listKnowledgeImportJobs(db)
  const draftCards = listDraftKnowledgeCards(db, 200)
  const approvedCards = listApprovedKnowledgeCards(db, { limit: 200 })

  return {
    sources,
    import_jobs: importJobs,
    draft_cards: draftCards,
    approved_cards: approvedCards,
  }
}

export const getApprovedKnowledgeRuntime = async(
  paths: LocalFirstPaths,
  input: ApprovedKnowledgeRuntimeInput = {},
): Promise<ApprovedKnowledgeRuntimePayload> => {
  const db = await getDatabase(paths)
  const cards = listApprovedKnowledgeCards(db, input)
  return {
    hits: cards.map((card) => toRuntimeHit(card, input)),
  }
}

export const getMarketAnchor = async(paths: LocalFirstPaths, anchorId: string) => {
  const db = await getDatabase(paths)
  return getMarketAnchorById(db, anchorId)
}

export const listPersistedMarketAnchors = async(
  paths: LocalFirstPaths,
  input: ListMarketAnchorFilters = {},
) => {
  const db = await getDatabase(paths)
  return listMarketAnchors(db, normalizeAnchorFilters(input))
}

export const adoptMarketAnchor = async(
  paths: LocalFirstPaths,
  input: AdoptMarketAnchorInput,
) => {
  const db = await getDatabase(paths)
  return db.transaction(() => {
    const existing = input.source_annotation_id
      ? findMarketAnchorBySourceAnnotation(db, {
        contract_id: input.contract_id,
        session_id: input.session_id,
        trade_id: input.trade_id ?? null,
        source_annotation_id: input.source_annotation_id,
      })
      : null

    if (existing) {
      const nextStatus: ActiveMarketAnchorRecord['status'] = 'active'
      updateMarketAnchor(db, {
        ...existing,
        contract_id: input.contract_id,
        session_id: input.session_id,
        trade_id: input.trade_id ?? null,
        origin_annotation_id: input.source_annotation_id ?? existing.origin_annotation_id,
        origin_annotation_label: input.source_annotation_label ?? existing.origin_annotation_label ?? null,
        origin_screenshot_id: input.source_screenshot_id ?? existing.origin_screenshot_id,
        title: input.title,
        semantic_type: input.semantic_type ?? existing.semantic_type,
        timeframe_scope: input.timeframe_scope ?? existing.timeframe_scope,
        price_low: input.price_low ?? existing.price_low,
        price_high: input.price_high ?? existing.price_high,
        thesis_md: input.thesis_md,
        invalidation_rule_md: input.invalidation_rule_md,
        status: nextStatus,
        carry_forward: input.carry_forward ?? existing.carry_forward,
      })
      if (existing.status !== nextStatus) {
        insertMarketAnchorStatusHistory(db, {
          anchor_id: existing.id,
          previous_status: existing.status,
          next_status: nextStatus,
          reason_md: 'Anchor re-adopted from annotation.',
          changed_by: 'local-user',
        })
      }
      return getMarketAnchorById(db, existing.id)
    }

    const created = insertMarketAnchor(db, {
      contract_id: input.contract_id,
      session_id: input.session_id,
      trade_id: input.trade_id ?? null,
      source_annotation_id: input.source_annotation_id ?? null,
      source_annotation_label: input.source_annotation_label ?? null,
      source_screenshot_id: input.source_screenshot_id ?? null,
      title: input.title,
      semantic_type: input.semantic_type ?? null,
      timeframe_scope: input.timeframe_scope ?? null,
      price_low: input.price_low ?? null,
      price_high: input.price_high ?? null,
      thesis_md: input.thesis_md,
      invalidation_rule_md: input.invalidation_rule_md,
      status: 'active',
      carry_forward: input.carry_forward ?? true,
    })
    insertMarketAnchorStatusHistory(db, {
      anchor_id: created.id,
      previous_status: null,
      next_status: created.status,
      reason_md: 'Anchor adopted into persistent storage.',
      changed_by: 'local-user',
    })
    return created
  })()
}

export const updatePersistedMarketAnchorStatus = async(
  paths: LocalFirstPaths,
  input: UpdateMarketAnchorStatusInput,
) => {
  const db = await getDatabase(paths)
  return db.transaction(() => {
    const current = getMarketAnchorById(db, input.anchor_id)
    updateMarketAnchor(db, {
      ...current,
      status: input.status,
    })
    if (current.status !== input.status || (input.reason_md ?? '').trim().length > 0) {
      insertMarketAnchorStatusHistory(db, {
        anchor_id: current.id,
        previous_status: current.status,
        next_status: input.status,
        reason_md: input.reason_md ?? '',
        changed_by: input.changed_by ?? 'local-user',
      })
    }
    return getMarketAnchorById(db, current.id)
  })()
}

export const recordKnowledgeGroundingHits = async(
  paths: LocalFirstPaths,
  input: RecordKnowledgeGroundingsInput,
): Promise<KnowledgeGroundingRecord[]> => {
  const db = await getDatabase(paths)
  return db.transaction(() => insertKnowledgeGroundings(db, input.hits.map((hit) => ({
    knowledge_card_id: hit.knowledge_card_id,
    session_id: input.session_id ?? null,
    trade_id: input.trade_id ?? null,
    screenshot_id: hit.screenshot_id ?? input.screenshot_id ?? null,
    annotation_id: hit.annotation_id ?? input.annotation_id ?? null,
    anchor_id: hit.anchor_id ?? input.anchor_id ?? null,
    ai_run_id: input.ai_run_id,
    match_reason_md: hit.match_reason_md,
    relevance_score: hit.relevance_score,
  }))))()
}

export const listKnowledgeGroundingsForAiRun = async(paths: LocalFirstPaths, aiRunId: string) => {
  const db = await getDatabase(paths)
  return listKnowledgeGroundingsByAiRun(db, aiRunId)
}

export const buildActiveAnchorRuntimeSummary = async(
  paths: LocalFirstPaths,
  input: ListMarketAnchorFilters = {},
): Promise<ActiveAnchorRuntimePayload> => {
  const db = await getDatabase(paths)
  const filters = normalizeAnchorFilters(input)
  const anchors = listMarketAnchors(db, filters)
  if (anchors.length === 0) {
    return { anchors: [] }
  }

  const groundingSignals = listAnchorGroundingSignals(db, {
    session_id: filters.session_id ?? null,
    trade_id: filters.trade_id ?? null,
    anchor_ids: anchors.map((anchor) => anchor.id),
    limit: Math.max(40, anchors.length * 40),
  })
  const grouped = new Map<string, typeof groundingSignals>()
  for (const row of groundingSignals) {
    const list = grouped.get(row.anchor_id) ?? []
    list.push(row)
    grouped.set(row.anchor_id, list)
  }

  const summaries = anchors.map((anchor) => buildAnchorSummary(anchor, grouped.get(anchor.id) ?? []))
  summaries.sort((left, right) => {
    const leftStamp = left.latest_grounded_at ?? left.updated_at
    const rightStamp = right.latest_grounded_at ?? right.updated_at
    return rightStamp.localeCompare(leftStamp)
  })
  return {
    anchors: summaries.slice(0, filters.limit ?? 12),
  }
}

export const getComposerShellData = async(
  paths: LocalFirstPaths,
  input: ApprovedKnowledgeRuntimeInput = {},
  anchorFilters: ListMarketAnchorFilters = {},
): Promise<ComposerShellPayload> => {
  const [runtime, anchorSummary] = await Promise.all([
    getApprovedKnowledgeRuntime(paths, { ...input, limit: input.limit ?? 8 }),
    buildActiveAnchorRuntimeSummary(paths, { ...anchorFilters, limit: anchorFilters.limit ?? 4 }),
  ])

  return {
    approved_knowledge_hits: runtime.hits,
    suggestions: toComposerSuggestions(runtime.hits),
    active_anchor_labels: anchorSummary.anchors.map((anchor) => anchor.title),
    context_summary: buildComposerContextSummary(runtime.hits, anchorSummary.anchors.length),
  }
}
