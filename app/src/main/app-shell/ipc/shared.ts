import type { AppEnvironment } from '@main/app-shell/env'
import type { LocalFirstPaths } from '@main/app-shell/paths'
import { listAnchorReviewSuggestions, listComposerAiSuggestions, listSimilarCases, runAnnotationSuggestions } from '@main/ai/service'
import { getSessionWorkbench } from '@main/domain/workbench-service'
import {
  adoptMarketAnchor,
  buildActiveAnchorRuntimeSummary,
  getApprovedKnowledgeRuntime,
  getComposerShellData,
  getKnowledgeReviewDashboard,
  ingestKnowledgeSource,
  listKnowledgeGroundingsForAiRun,
  reviewKnowledgeDraftCard,
  updatePersistedMarketAnchorStatus,
} from '@main/domain/knowledge-service'
import { listKnowledgeAllSources, listKnowledgeFragmentsForSource, loadKnowledgeCard } from '@main/storage/knowledge'
import {
  ActiveMarketAnchorsPayloadSchema,
  ApprovedKnowledgeRuntimePayloadSchema,
  ComposerShellSchema,
  ComposerSuggestionPayloadSchema,
  KnowledgeGroundingPayloadSchema,
  KnowledgeReviewDashboardPayloadSchema,
  KnowledgeSourceSchema,
  KnowledgeFragmentSchema,
  KnowledgeCardSchema,
  KnowledgeImportJobSchema,
  MarketAnchorMutationResultSchema,
} from '@shared/contracts/knowledge'
import { AnnotationSuggestionPayloadSchema, AnchorReviewSuggestionPayloadSchema, SimilarCasePayloadSchema } from '@shared/contracts/analysis'
import type { AnnotationSuggestionPayload } from '@shared/contracts/analysis'
import type { IngestKnowledgeSourceInput, ReviewKnowledgeCardInput } from '@shared/contracts/knowledge'

export type AppContext = {
  env: AppEnvironment
  paths: LocalFirstPaths
}

export const emptyComposerShell = () => ComposerShellSchema.parse({
  active_anchor_labels: [],
  active_anchors: [],
  approved_knowledge_hits: [],
  suggestions: [],
  context_summary: '当前没有可用的 approved knowledge。',
})

export const emptyActiveAnchorsPayload = () => ActiveMarketAnchorsPayloadSchema.parse({
  anchors: [],
})

export const emptyKnowledgeGroundingPayload = () => KnowledgeGroundingPayloadSchema.parse({
  hits: [],
})

export const emptyAnnotationSuggestionPayload = () => AnnotationSuggestionPayloadSchema.parse({
  suggestions: [],
})

export const describeError = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

export const logWorkbenchSessionContextFailure = (
  moduleName: 'anchors' | 'groundings' | 'composer',
  sessionId: string,
  error: unknown,
) => {
  console.error(
    `[AlphaNexus][workbench:get-session][${moduleName}] session_id=${sessionId} failed: ${describeError(error)}`,
    error,
  )
}

const splitScope = (value: string | null | undefined) =>
  (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item !== '*')

const parseTags = (value: string | null | undefined) => {
  if (!value) {
    return []
  }

  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

const toKnowledgeSourceRecord = (source: {
  id: string
  schema_version: number
  created_at: string
  deleted_at: string | null
  source_type: string
  title: string
  author: string | null
  language: string
  content_md: string
  checksum: string | null
}) => KnowledgeSourceSchema.parse({
  ...source,
  language: source.language ?? null,
  deleted_at: source.deleted_at ?? null,
})

const toKnowledgeFragmentRecord = (fragment: {
  id: string
  schema_version: number
  created_at: string
  deleted_at: string | null
  source_id: string
  job_id: string
  sequence_no: number
  chapter_label: string | null
  page_from: number | null
  page_to: number | null
  content_md: string
  tokens_estimate: number
}) => KnowledgeFragmentSchema.parse({
  ...fragment,
  deleted_at: fragment.deleted_at ?? null,
})

const toKnowledgeCardRecord = (card: {
  id: string
  schema_version: number
  created_at: string
  updated_at: string
  deleted_at: string | null
  source_id: string
  fragment_id: string
  card_type: string
  title: string
  summary: string
  content_md: string
  trigger_conditions_md: string
  invalidation_md: string
  risk_rule_md: string
  contract_scope: string
  timeframe_scope: string
  tags_json: string
  status: string
  version: number
}) => KnowledgeCardSchema.parse({
  ...card,
  contract_scope: splitScope(card.contract_scope),
  timeframe_scope: splitScope(card.timeframe_scope),
  tags: parseTags(card.tags_json),
  deleted_at: card.deleted_at ?? null,
})

const toKnowledgeImportJobRecord = (job: {
  id: string
  schema_version: number
  created_at: string
  deleted_at: string | null
  source_id: string
  provider: string
  model: string
  job_type: string
  status: string
  input_snapshot_json: string
  output_summary: string
  finished_at: string | null
}) => KnowledgeImportJobSchema.parse({
  ...job,
  provider: job.provider || null,
  model: job.model || null,
  status: job.status === 'pending' ? 'queued' : job.status,
  deleted_at: job.deleted_at ?? null,
})

export const toPublicDashboard = async(paths: LocalFirstPaths, input?: { source_id?: string }) => {
  const [dashboard, sources] = await Promise.all([
    getKnowledgeReviewDashboard(paths),
    listKnowledgeAllSources(paths),
  ])
  const selectedSources = input?.source_id
    ? sources.filter((source) => source.id === input.source_id)
    : sources
  const fragmentGroups = await Promise.all(selectedSources.map((source) => listKnowledgeFragmentsForSource(paths, source.id)))
  const fragments = fragmentGroups.flat()

  return KnowledgeReviewDashboardPayloadSchema.parse({
    sources: selectedSources.map(toKnowledgeSourceRecord),
    fragments: fragments.map(toKnowledgeFragmentRecord),
    draft_cards: dashboard.draft_cards.map(toKnowledgeCardRecord),
    approved_cards: dashboard.approved_cards.map(toKnowledgeCardRecord),
    stats: {
      source_count: sources.length,
      fragment_count: fragments.length,
      draft_count: dashboard.draft_cards.length,
      approved_count: dashboard.approved_cards.length,
      archived_count: 0,
    },
    import_jobs: dashboard.import_jobs.map(toKnowledgeImportJobRecord),
  })
}

export const toPublicRuntimePayload = (payload: Awaited<ReturnType<typeof getApprovedKnowledgeRuntime>>) =>
  ApprovedKnowledgeRuntimePayloadSchema.parse({
    hits: payload.hits.map((hit) => ({
      card_id: hit.knowledge_card_id,
      title: hit.title,
      summary: hit.summary,
      card_type: hit.card_type,
      tags: hit.tags,
      contract_scope: splitScope(hit.contract_scope),
      timeframe_scope: splitScope(hit.timeframe_scope),
      relevance_score: 0.75,
    })),
  })

export const toPublicActiveAnchorsPayload = (payload: Awaited<ReturnType<typeof buildActiveAnchorRuntimeSummary>>) =>
  ActiveMarketAnchorsPayloadSchema.parse({
    anchors: payload.anchors.map((anchor) => ({
      id: anchor.anchor_id,
      title: anchor.title,
      semantic_type: anchor.semantic_type ?? null,
      status: anchor.status,
      origin_annotation_id: anchor.origin_annotation_id ?? null,
      origin_annotation_label: anchor.origin_annotation_label ?? null,
      origin_screenshot_id: anchor.origin_screenshot_id ?? null,
      timeframe_scope: anchor.timeframe_scope ?? null,
      price_low: anchor.price_low ?? null,
      price_high: anchor.price_high ?? null,
      thesis_md: anchor.thesis_md,
      invalidation_rule_md: anchor.invalidation_rule_md,
    })),
  })

export const toMarketAnchorMutationResult = (
  anchor: Awaited<ReturnType<typeof adoptMarketAnchor> | ReturnType<typeof updatePersistedMarketAnchorStatus>>,
) => MarketAnchorMutationResultSchema.parse({
  anchor: {
    id: anchor.id,
    title: anchor.title,
    semantic_type: anchor.semantic_type ?? null,
    status: anchor.status,
    origin_annotation_id: anchor.origin_annotation_id ?? null,
    origin_annotation_label: anchor.origin_annotation_label ?? null,
    origin_screenshot_id: anchor.origin_screenshot_id ?? null,
    timeframe_scope: anchor.timeframe_scope ?? null,
    price_low: anchor.price_low ?? null,
    price_high: anchor.price_high ?? null,
    thesis_md: anchor.thesis_md,
    invalidation_rule_md: anchor.invalidation_rule_md,
  },
})

export const toPublicKnowledgeGroundingPayload = async(
  paths: LocalFirstPaths,
  groundings: Awaited<ReturnType<typeof listKnowledgeGroundingsForAiRun>>,
) => {
  const hits = await Promise.all(groundings.map(async(grounding) => {
    const card = await loadKnowledgeCard(paths, grounding.knowledge_card_id)
    return {
      id: grounding.id,
      knowledge_card_id: grounding.knowledge_card_id,
      ai_run_id: grounding.ai_run_id,
      annotation_id: grounding.annotation_id,
      anchor_id: grounding.anchor_id,
      title: card.title,
      summary: card.summary,
      card_type: card.card_type,
      match_reason_md: grounding.match_reason_md,
      relevance_score: grounding.relevance_score,
    }
  }))

  return KnowledgeGroundingPayloadSchema.parse({ hits })
}

export const toPublicComposerShell = (
  payload: Awaited<ReturnType<typeof getComposerShellData>>,
  activeAnchors = emptyActiveAnchorsPayload().anchors,
) =>
  ComposerShellSchema.parse({
    active_anchor_labels: payload.active_anchor_labels,
    active_anchors: activeAnchors,
    approved_knowledge_hits: payload.approved_knowledge_hits.map((hit) => ({
      card_id: hit.knowledge_card_id,
      title: hit.title,
      summary: hit.summary,
      card_type: hit.card_type,
      tags: hit.tags,
      contract_scope: splitScope(hit.contract_scope),
      timeframe_scope: splitScope(hit.timeframe_scope),
      relevance_score: 0.75,
    })),
    suggestions: payload.suggestions.map((suggestion, index) => ({
      id: `composer_suggestion_${index + 1}_${suggestion.source_card_id ?? 'local'}`,
      type: suggestion.kind,
      label: suggestion.kind === 'template' ? '结构化模板' : '候选短句',
      text: suggestion.text,
    })),
    context_summary: 'Composer 仅消费 approved knowledge 的运行时命中结果。',
  })

const suggestionColorBySemantic = (semanticType?: string | null) => {
  if (semanticType === 'support') {
    return '#355c5a'
  }
  if (semanticType === 'resistance' || semanticType === 'invalidation') {
    return '#9c3d30'
  }
  if (semanticType === 'path') {
    return '#bc7f4a'
  }
  return '#54706d'
}

export const toPublicAnnotationSuggestionsPayload = (
  payload: Awaited<ReturnType<typeof runAnnotationSuggestions>>,
  screenshotId: string,
): AnnotationSuggestionPayload => AnnotationSuggestionPayloadSchema.parse({
  suggestions: payload.suggestions.map((suggestion) => ({
    id: suggestion.id,
    ai_run_id: null,
    screenshot_id: screenshotId,
    label: suggestion.label,
    semantic_type: suggestion.semantic_type,
    shape: suggestion.shape === 'rectangle' ? 'rectangle' : suggestion.shape,
    color: suggestionColorBySemantic(suggestion.semantic_type),
    x1: suggestion.geometry.x1,
    y1: suggestion.geometry.y1,
    x2: suggestion.geometry.x2,
    y2: suggestion.geometry.y2,
    text: suggestion.title,
    stroke_width: 2,
    rationale: suggestion.reason_summary,
    confidence_pct: Math.round(suggestion.confidence_score * 100),
    status: 'pending',
  })),
})

export const toPublicComposerAiSuggestionsPayload = (payload: Awaited<ReturnType<typeof listComposerAiSuggestions>>) =>
  ComposerSuggestionPayloadSchema.parse({
    suggestions: payload.suggestions.map((suggestion) => ({
      id: suggestion.id,
      type: suggestion.kind,
      label: suggestion.kind === 'template' ? '结构化模板' : suggestion.kind === 'completion' ? '补全建议' : '候选短句',
      text: suggestion.text,
      source: suggestion.source_card_id ? 'knowledge' : 'rule',
      rationale: suggestion.reason_summary,
      confidence_pct: Math.round(suggestion.rank_score * 100),
      ranking_reason: suggestion.reason_summary,
      knowledge_card_id: suggestion.source_card_id,
    })),
  })

export const toPublicAnchorReviewSuggestionsPayload = (payload: Awaited<ReturnType<typeof listAnchorReviewSuggestions>>) =>
  AnchorReviewSuggestionPayloadSchema.parse({
    suggestions: payload.suggestions.map((suggestion, index) => ({
      id: `anchor_review_${suggestion.anchor_id}_${index + 1}`,
      ai_run_id: null,
      anchor_id: suggestion.anchor_id,
      anchor_title: suggestion.anchor_id,
      current_status: 'active',
      suggested_status: suggestion.suggested_status,
      reason_summary: suggestion.reason_summary,
      evidence: suggestion.evidence.map((item) => item.excerpt),
      confidence_pct: Math.round(suggestion.confidence_score * 100),
    })),
  })

export const toPublicSimilarCasePayload = (payload: Awaited<ReturnType<typeof listSimilarCases>>) =>
  SimilarCasePayloadSchema.parse({
    cases: payload.hits.map((hit) => ({
      id: hit.id,
      session_id: hit.session_id,
      trade_id: hit.trade_id,
      event_id: null,
      title: hit.title,
      summary: hit.summary,
      match_reason: hit.match_reasons.join(' / '),
      score: hit.score,
      tags: hit.match_reasons,
    })),
  })

export const resolveKnowledgeGroundings = async(paths: LocalFirstPaths, input?: {
  session_id?: string
  ai_run_id?: string
  anchor_id?: string
  limit?: number
}) => {
  let aiRunId = input?.ai_run_id

  if (!aiRunId && input?.session_id) {
    const workbench = await getSessionWorkbench(paths, { session_id: input.session_id })
    aiRunId = workbench.ai_runs[workbench.ai_runs.length - 1]?.id
  }

  if (!aiRunId) {
    return emptyKnowledgeGroundingPayload()
  }

  const groundings = await listKnowledgeGroundingsForAiRun(paths, aiRunId)
  return toPublicKnowledgeGroundingPayload(
    paths,
    groundings
      .filter((grounding) => !input?.anchor_id || grounding.anchor_id === input.anchor_id)
      .slice(0, input?.limit ?? 12),
  )
}

export const ingestReviewedKnowledgeSource = async(paths: LocalFirstPaths, input: IngestKnowledgeSourceInput) => {
  await ingestKnowledgeSource(paths, {
    source_type: input.source_type,
    title: input.title,
    content_md: input.content,
    author: input.author ?? null,
    language: 'zh-CN',
    contract_scope: input.contract_scope ?? null,
    timeframe_scope: input.timeframe_scope ?? null,
    tags: input.tags ?? [],
    file_path: input.file_path ?? null,
    extraction_mode: input.import_mode === 'gemini' ? 'gemini' : 'auto',
  })
}

export const reviewKnowledgeCard = async(paths: LocalFirstPaths, input: ReviewKnowledgeCardInput) => {
  await reviewKnowledgeDraftCard(paths, {
    knowledge_card_id: input.card_id,
    action: input.action === 'archive' ? 'archive' : 'approve',
    reviewed_by: input.reviewed_by,
    review_note_md: input.review_note_md ?? '',
  })
}
