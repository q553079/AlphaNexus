import type { AnnotationInspectorItem, MarketAnchorView } from '@app/features/anchors'
import type { GroundingHitView } from '@app/features/grounding'
import type { SessionWorkbenchPayload } from '@shared/contracts/workbench'
import type { AnnotationSuggestionView, AnchorReviewSuggestionView, SimilarCaseView, SuggestionState } from './types'

const clampPct = (value: number) => Math.max(1, Math.min(99, Math.round(value)))

export const buildAnnotationSuggestions = (
  items: AnnotationInspectorItem[],
  stateById: Record<string, SuggestionState>,
): AnnotationSuggestionView[] =>
  items.slice(0, 5).map((item, index) => ({
    id: `annotation_suggestion_${item.key}`,
    source_annotation_key: item.key,
    label: `AI-${item.label}`,
    title: item.label,
    semantic_type: item.semantic_type,
    shape: item.annotation.shape,
    color: item.annotation.color,
    x1: item.annotation.x1,
    y1: item.annotation.y1,
    x2: item.annotation.x2,
    y2: item.annotation.y2,
    text: item.annotation.text ?? null,
    reason_summary: `${item.label} 的形态与当前位置适合作为 ${item.semantic_type} 观察点，建议在后续截图中持续复核。`,
    confidence_pct: clampPct(76 - index * 7),
    state: stateById[`annotation_suggestion_${item.key}`] ?? 'suggested',
  }))

const verdictFromAnchor = (anchor: MarketAnchorView, hits: GroundingHitView[]): AnchorReviewSuggestionView['verdict'] => {
  if (anchor.status === 'invalidated') {
    return 'invalidated'
  }

  const supportingHits = hits.filter((hit) =>
    (hit.anchor_id && hit.anchor_id === anchor.id) || hit.summary.includes(anchor.title))
  if (supportingHits.length >= 2) {
    return 'still_valid'
  }
  if (supportingHits.length === 1) {
    return 'weakened'
  }
  return anchor.status === 'active' ? 'weakened' : 'invalidated'
}

export const buildAnchorReviewSuggestions = (
  anchors: MarketAnchorView[],
  hits: GroundingHitView[],
): AnchorReviewSuggestionView[] =>
  anchors.slice(0, 5).map((anchor, index) => {
    const verdict = verdictFromAnchor(anchor, hits)
    const confidence = verdict === 'still_valid' ? 78 : verdict === 'weakened' ? 62 : 83
    const reason = verdict === 'still_valid'
      ? '近期 grounding 与上下文仍支持该锚点。'
      : verdict === 'weakened'
        ? '命中证据变少，建议缩小权重并等待下一次确认。'
        : '当前上下文不再支持该锚点，建议人工复核后转失效。'
    return {
      id: `anchor_review_${anchor.id}_${index + 1}`,
      anchor_id: anchor.id,
      anchor_title: anchor.title,
      verdict,
      reason_summary: reason,
      confidence_pct: confidence,
    }
  })

export const buildSimilarCases = (
  payload: SessionWorkbenchPayload,
  hits: GroundingHitView[],
): SimilarCaseView[] => {
  const contractSymbol = payload.contract.symbol
  const timeframe = payload.context_memory.active_anchors[0]?.timeframe_scope ?? 'session'
  const fromEvents = payload.events
    .slice(-4)
    .reverse()
    .map((event, index) => ({
      id: `similar_case_event_${event.id}`,
      title: `相似事件 ${index + 1}: ${event.title}`,
      summary: event.summary,
      relevance_score: Math.max(0.45, 0.82 - index * 0.11),
      contract_symbol: contractSymbol,
      timeframe_label: timeframe,
    }))
  const fromHits = hits.slice(0, 2).map((hit, index) => ({
    id: `similar_case_hit_${hit.card_id}_${index + 1}`,
    title: `历史知识命中样本: ${hit.title}`,
    summary: hit.summary,
    relevance_score: hit.relevance_score ?? Math.max(0.42, 0.74 - index * 0.08),
    contract_symbol: contractSymbol,
    timeframe_label: timeframe,
  }))

  return [...fromHits, ...fromEvents].slice(0, 5)
}
