import type { DraftAnnotation } from '@app/features/annotation/annotation-types'
import type {
  AnnotationInspectorItem,
  MarketAnchorView,
} from '@app/features/anchors'
import type { ComposerSuggestion } from '@app/features/composer/types'
import type { GroundingHitView } from '@app/features/grounding'
import type { RunAiAnalysisInput } from '@shared/ai/contracts'
import type {
  AnnotationSuggestionView,
  AnchorReviewSuggestionView,
  SimilarCaseView,
  SuggestionState,
} from '@app/features/suggestions'
import type { AiProviderConfig } from '@shared/ai/contracts'
import type { AnnotationSuggestion, AnchorReviewSuggestion, SimilarCase } from '@shared/contracts/analysis'
import type {
  ActiveMarketAnchorSummary,
  AdoptMarketAnchorInput,
  KnowledgeGroundingHit,
} from '@shared/contracts/knowledge'
import type { ScreenshotRecord } from '@shared/contracts/content'

const analysisProviderPriority: AiProviderConfig['provider'][] = ['openai', 'deepseek', 'anthropic', 'custom-http']
const imageCapableAnalysisProviderPriority: AiProviderConfig['provider'][] = ['openai', 'custom-http', 'deepseek', 'anthropic']

export const pickPreferredAnalysisProvider = (providers: AiProviderConfig[]) => {
  const available = providers.filter((provider) => provider.enabled && provider.configured)
  return available.sort((left, right) =>
    analysisProviderPriority.indexOf(left.provider) - analysisProviderPriority.indexOf(right.provider))[0] ?? null
}

export const pickPreferredAnalysisProviderForInput = (
  providers: AiProviderConfig[],
  input?: Pick<RunAiAnalysisInput, 'analysis_context'>,
) => {
  const available = providers.filter((provider) => provider.enabled && provider.configured)
  const needsInlineImages = Boolean(
    input?.analysis_context?.attachments?.some((attachment) =>
      attachment.kind === 'image' && typeof attachment.data_url === 'string' && attachment.data_url.length > 0),
  )
  const priority = needsInlineImages ? imageCapableAnalysisProviderPriority : analysisProviderPriority
  return available
    .slice()
    .sort((left, right) => priority.indexOf(left.provider) - priority.indexOf(right.provider))[0] ?? null
}

export const toDraftAnnotation = (annotation: ScreenshotRecord['annotations'][number]): DraftAnnotation => ({
  screenshot_id: annotation.screenshot_id,
  shape: annotation.shape,
  label: annotation.label,
  title: annotation.title,
  semantic_type: annotation.semantic_type,
  color: annotation.color,
  x1: annotation.x1,
  y1: annotation.y1,
  x2: annotation.x2,
  y2: annotation.y2,
  text: annotation.text,
  note_md: annotation.note_md,
  add_to_memory: annotation.add_to_memory,
  stroke_width: annotation.stroke_width,
})

export const toAnchorSemanticType = (shape: DraftAnnotation['shape']): AdoptMarketAnchorInput['semantic_type'] => {
  if (shape === 'line') {
    return 'resistance'
  }
  if (shape === 'arrow') {
    return 'path'
  }
  if (shape === 'text') {
    return 'context'
  }
  return 'support'
}

export const toMarketAnchorView = (anchor: ActiveMarketAnchorSummary): MarketAnchorView => ({
  id: anchor.id,
  title: anchor.title,
  semantic_type: anchor.semantic_type ?? 'context',
  status: anchor.status,
  source_annotation_id: anchor.origin_annotation_id ?? null,
  source_annotation_label: anchor.origin_annotation_label ?? 'manual',
  source_annotation_key: anchor.origin_annotation_id ?? `anchor:${anchor.id}`,
  created_at: undefined,
  updated_at: undefined,
})

export const toGroundingHitView = (hit: KnowledgeGroundingHit): GroundingHitView => ({
  id: hit.id,
  card_id: hit.knowledge_card_id,
  title: hit.title,
  summary: hit.summary,
  card_type: hit.card_type,
  relevance_score: hit.relevance_score,
  match_reasons: hit.match_reason_md ? [hit.match_reason_md] : [],
  ai_run_id: hit.ai_run_id,
  annotation_id: hit.annotation_id,
  anchor_id: hit.anchor_id,
})

export const toComposerGroundingHitView = (
  hit: {
    card_id: string
    title: string
    summary: string
    card_type?: string
    relevance_score?: number
    match_reasons?: string[]
  },
  index: number,
): GroundingHitView => ({
  id: `composer_hit_${index}_${hit.card_id}`,
  card_id: hit.card_id,
  title: hit.title,
  summary: hit.summary,
  card_type: hit.card_type,
  relevance_score: hit.relevance_score,
  match_reasons: hit.match_reasons ?? [],
})

const toSuggestionState = (status: AnnotationSuggestion['status']): SuggestionState =>
  status === 'pending' ? 'suggested' : status

export const toAnnotationSuggestionView = (suggestion: AnnotationSuggestion): AnnotationSuggestionView => ({
  id: suggestion.id,
  source_annotation_key: suggestion.source_annotation_id ?? undefined,
  label: suggestion.label,
  title: suggestion.title,
  semantic_type: suggestion.semantic_type ?? 'context',
  shape: suggestion.shape,
  color: suggestion.color,
  x1: suggestion.x1,
  y1: suggestion.y1,
  x2: suggestion.x2,
  y2: suggestion.y2,
  text: suggestion.text,
  reason_summary: suggestion.rationale,
  confidence_pct: suggestion.confidence_pct ?? 0,
  state: toSuggestionState(suggestion.status),
})

export const toAnchorReviewSuggestionView = (suggestion: AnchorReviewSuggestion): AnchorReviewSuggestionView => ({
  id: suggestion.id,
  anchor_id: suggestion.anchor_id,
  anchor_title: suggestion.anchor_title,
  verdict: suggestion.suggested_status,
  reason_summary: suggestion.reason_summary,
  confidence_pct: suggestion.confidence_pct ?? 0,
})

export const toSimilarCaseView = (
  suggestion: SimilarCase,
  contractSymbol: string,
  timeframeLabel: string,
): SimilarCaseView => ({
  id: suggestion.id,
  title: suggestion.title,
  summary: suggestion.summary,
  relevance_score: suggestion.score,
  contract_symbol: contractSymbol,
  timeframe_label: timeframeLabel,
})

export const toComposerSuggestionView = (
  suggestion: {
    id: string
    type: ComposerSuggestion['type']
    label: string
    text: string
    source?: ComposerSuggestion['source']
    rationale?: string
    ranking_reason?: string
    confidence_pct?: number
    knowledge_card_id?: string | null
  },
): ComposerSuggestion => ({
  id: suggestion.id,
  type: suggestion.type,
  label: suggestion.label,
  text: suggestion.text,
  source: suggestion.source,
  rationale: suggestion.rationale,
  ranking_reason: suggestion.ranking_reason,
  confidence_pct: suggestion.confidence_pct,
  knowledge_card_id: suggestion.knowledge_card_id,
})

export type AdoptAnchorCandidate = {
  item: AnnotationInspectorItem
  existingAnchor: MarketAnchorView | undefined
}
