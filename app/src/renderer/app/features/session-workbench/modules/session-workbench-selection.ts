import {
  buildAnnotationKey,
  toAnnotationInspectorItems,
  type AnnotationInspectorItem,
  type MarketAnchorView,
} from '@app/features/anchors'
import type { ComposerSuggestion } from '@app/features/composer/types'
import type { GroundingHitView } from '@app/features/grounding'
import type {
  AnnotationSuggestionView,
  AnchorReviewSuggestionView,
  SimilarCaseView,
} from '@app/features/suggestions'
import type { DraftAnnotation } from '@app/features/annotation/annotation-types'
import type { AnnotationRecord, ContentBlockRecord, ScreenshotRecord } from '@shared/contracts/content'
import type { EventRecord } from '@shared/contracts/event'
import type { EvaluationRecord, TradeRecord } from '@shared/contracts/trade'
import type { AiRecordChain, SessionWorkbenchPayload } from '@shared/contracts/workbench'
import { resolveTradeForCurrentContext } from '@shared/contracts/workbench'
import type { AnalysisCardRecord } from '@shared/contracts/analysis'
import {
  toComposerGroundingHitView,
  toComposerSuggestionView,
  toDraftAnnotation,
  toGroundingHitView,
  toMarketAnchorView,
  toAnnotationSuggestionView,
  toAnchorReviewSuggestionView,
  toSimilarCaseView,
} from './session-workbench-mappers'
import { buildScreenshotGalleryState, type ScreenshotGalleryState } from './session-screenshot-gallery'

export type SessionWorkbenchDerivedState = {
  activeAnchors: MarketAnchorView[]
  activeContentBlocks: ContentBlockRecord[]
  adoptedAnnotationKeys: Set<string>
  anchors: MarketAnchorView[]
  analysisCard: AnalysisCardRecord | null
  annotationInspectorItems: AnnotationInspectorItem[]
  annotationSuggestionViews: AnnotationSuggestionView[]
  anchorReviewSuggestionViews: AnchorReviewSuggestionView[]
  composerSuggestionViews: ComposerSuggestion[]
  currentTrade: TradeRecord | null
  deletedAiRecords: AiRecordChain[]
  deletedAnnotations: AnnotationRecord[]
  deletedContentBlocks: ContentBlockRecord[]
  deletedScreenshots: ScreenshotRecord[]
  groundingHits: GroundingHitView[]
  latestEvaluation: EvaluationRecord | null
  realtimeViewBlock: ContentBlockRecord | null
  screenshotGallery: ScreenshotGalleryState
  selectedEvent: EventRecord | null
  selectedScreenshot: ScreenshotRecord | null
  selectedScreenshotAnnotations: AnnotationRecord[]
  similarCaseViews: SimilarCaseView[]
}

export const deriveSessionWorkbenchState = (input: {
  payload: SessionWorkbenchPayload | null
  selectedEventId: string | null
  selectedScreenshotId: string | null
  draftAnnotations: DraftAnnotation[]
  apiAnchors: MarketAnchorView[]
  apiGroundingHits: GroundingHitView[]
  annotationSuggestions: AnnotationSuggestionView[]
  anchorReviewSuggestions: AnchorReviewSuggestionView[]
  similarCases: SimilarCaseView[]
  composerSuggestions: ComposerSuggestion[]
}): SessionWorkbenchDerivedState => {
  const {
    payload,
    selectedEventId,
    selectedScreenshotId,
    draftAnnotations,
    apiAnchors,
    apiGroundingHits,
    annotationSuggestions,
    anchorReviewSuggestions,
    similarCases,
    composerSuggestions,
  } = input

  const selectedScreenshot = payload?.screenshots.find((shot) => shot.id === selectedScreenshotId) ?? payload?.screenshots[0] ?? null
  const selectedEvent = payload?.events.find((event) => event.id === selectedEventId) ?? payload?.events[0] ?? null
  const selectedScreenshotAnnotations = selectedScreenshot?.annotations ?? []
  const deletedAnnotations = selectedScreenshot?.deleted_annotations ?? []
  const deletedScreenshots = payload?.deleted_screenshots ?? []
  const deletedAiRecords = payload?.deleted_ai_records ?? []
  const explicitTradeId = payload?.current_context.trade_id ?? null
  const aiRunsById = new Map((payload?.ai_runs ?? []).map((run) => [run.id, run]))
  const analysisCard = payload
    ? payload.analysis_cards
      .filter((card) =>
        card.trade_id === explicitTradeId
        && aiRunsById.get(card.ai_run_id)?.prompt_kind !== 'trade-review')
      .at(-1) ?? null
    : null
  const currentTrade = payload ? resolveTradeForCurrentContext(payload.trades, explicitTradeId) : null
  const latestEvaluation = currentTrade
    ? payload?.evaluations.find((evaluation) => evaluation.trade_id === currentTrade.id) ?? null
    : payload?.evaluations[0] ?? null
  const payloadAnchors = payload?.context_memory.active_anchors.map(toMarketAnchorView) ?? []
  const anchors = apiAnchors.length > 0 ? apiAnchors : payloadAnchors
  const activeAnchors = anchors.filter((anchor) => anchor.status === 'active')
  const annotationInspectorItems = toAnnotationInspectorItems(draftAnnotations)
  const selectedAnnotationKeyById = new Map(
    (selectedScreenshot?.annotations ?? []).map((annotation) => [annotation.id, buildAnnotationKey(toDraftAnnotation(annotation))] as const),
  )
  const adoptedKeys = new Set<string>()
  for (const anchor of anchors) {
    adoptedKeys.add(anchor.source_annotation_key)
    if (anchor.source_annotation_id) {
      const mappedKey = selectedAnnotationKeyById.get(anchor.source_annotation_id)
      if (mappedKey) {
        adoptedKeys.add(mappedKey)
      }
    }
  }

  const payloadGroundingHits = payload?.context_memory.latest_grounding_hits.map(toGroundingHitView) ?? []
  const composerFallbackHits = (payload?.composer_shell.approved_knowledge_hits ?? []).map(toComposerGroundingHitView)
  const groundingHits = payloadGroundingHits.length > 0
    ? payloadGroundingHits
    : apiGroundingHits.length > 0
      ? apiGroundingHits
      : composerFallbackHits
  const composerSuggestionViews = composerSuggestions.length > 0
    ? composerSuggestions
    : (payload?.composer_shell.suggestions ?? []).map(toComposerSuggestionView)
  const annotationSuggestionViews = annotationSuggestions.length > 0
    ? annotationSuggestions
    : (payload?.suggestion_layer.annotation_suggestions ?? []).map(toAnnotationSuggestionView)
  const anchorReviewSuggestionViews = anchorReviewSuggestions.length > 0
    ? anchorReviewSuggestions
    : (payload?.suggestion_layer.anchor_review_suggestions ?? []).map(toAnchorReviewSuggestionView)
  const similarCaseViews = similarCases.length > 0
    ? similarCases
    : (payload?.suggestion_layer.similar_cases ?? []).map((item) =>
      toSimilarCaseView(
        item,
        payload?.contract.symbol ?? 'local',
        payload?.context_memory.active_anchors[0]?.timeframe_scope ?? 'session',
      ))
  const realtimeContextType = explicitTradeId ? 'trade' : 'session'
  const realtimeContextId = explicitTradeId ?? payload?.session.id ?? null
  const realtimeViewBlock = [...(payload?.content_blocks ?? [])]
    .reverse()
    .find((block) => block.context_type === realtimeContextType && block.context_id === realtimeContextId && block.title === 'Realtime view')
    ?? null
  const activeContentBlocks = (payload?.content_blocks ?? []).filter((block) => !block.soft_deleted)
  const deletedContentBlocks = (payload?.content_blocks ?? []).filter((block) => block.soft_deleted && block.block_type !== 'ai-summary')
  const screenshotGallery = buildScreenshotGalleryState({
    current_trade_id: currentTrade?.id ?? null,
    payload,
    selected_screenshot_id: selectedScreenshot?.id ?? null,
  })

  return {
    activeAnchors,
    activeContentBlocks,
    adoptedAnnotationKeys: adoptedKeys,
    anchors,
    analysisCard,
    annotationInspectorItems,
    annotationSuggestionViews,
    anchorReviewSuggestionViews,
    composerSuggestionViews,
    currentTrade,
    deletedAiRecords,
    deletedAnnotations,
    deletedContentBlocks,
    deletedScreenshots,
    groundingHits,
    latestEvaluation,
    realtimeViewBlock,
    screenshotGallery,
    selectedEvent,
    selectedScreenshot,
    selectedScreenshotAnnotations,
    similarCaseViews,
  }
}
