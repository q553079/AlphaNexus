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
import type { EventSelectionState } from '../session-workbench-types'
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

const buildEmptyEventSelectionState = (): EventSelectionState => ({
  mode: 'single',
  primaryEventId: null,
  selectedEventIds: [],
  rangeAnchorId: null,
  pinnedEventIds: [],
})

const orderEventIdsByTimeline = (events: EventRecord[], eventIds: string[]) => {
  const uniqueIds = new Set(eventIds)
  return events
    .map((event) => event.id)
    .filter((eventId) => uniqueIds.has(eventId))
}

const getRangeEventIds = (
  events: EventRecord[],
  startEventId: string,
  endEventId: string,
) => {
  const startIndex = events.findIndex((event) => event.id === startEventId)
  const endIndex = events.findIndex((event) => event.id === endEventId)
  if (startIndex < 0 || endIndex < 0) {
    return []
  }

  const [rangeStart, rangeEnd] = startIndex <= endIndex
    ? [startIndex, endIndex]
    : [endIndex, startIndex]
  return events.slice(rangeStart, rangeEnd + 1).map((event) => event.id)
}

export const createSingleEventSelectionState = (
  events: EventRecord[],
  eventId: string | null,
): EventSelectionState => {
  if (!eventId || !events.some((event) => event.id === eventId)) {
    return buildEmptyEventSelectionState()
  }

  return {
    mode: 'single',
    primaryEventId: eventId,
    selectedEventIds: [eventId],
    rangeAnchorId: eventId,
    pinnedEventIds: [],
  }
}

export const clearEventSelectionState = () => buildEmptyEventSelectionState()

export const normalizeEventSelectionState = (
  events: EventRecord[],
  currentState: EventSelectionState | null,
  options?: {
    preferFirstEvent?: boolean
  },
): EventSelectionState => {
  const preferFirstEvent = options?.preferFirstEvent ?? false
  if (!currentState) {
    return preferFirstEvent && events[0]
      ? createSingleEventSelectionState(events, events[0].id)
      : buildEmptyEventSelectionState()
  }

  const normalizedSelectedIds = orderEventIdsByTimeline(events, currentState.selectedEventIds)
  const normalizedPinnedIds = orderEventIdsByTimeline(events, currentState.pinnedEventIds)
  const primaryEventId = currentState.primaryEventId && events.some((event) => event.id === currentState.primaryEventId)
    ? currentState.primaryEventId
    : normalizedSelectedIds.at(-1) ?? normalizedPinnedIds.at(-1) ?? null
  const rangeAnchorId = currentState.rangeAnchorId && events.some((event) => event.id === currentState.rangeAnchorId)
    ? currentState.rangeAnchorId
    : primaryEventId

  if (currentState.mode === 'pinned') {
    if (normalizedPinnedIds.length > 1) {
      return {
        mode: 'pinned',
        primaryEventId: primaryEventId && normalizedPinnedIds.includes(primaryEventId)
          ? primaryEventId
          : normalizedPinnedIds.at(-1) ?? null,
        selectedEventIds: normalizedPinnedIds,
        rangeAnchorId,
        pinnedEventIds: normalizedPinnedIds,
      }
    }

    if (normalizedPinnedIds.length === 1) {
      return createSingleEventSelectionState(events, normalizedPinnedIds[0])
    }
  }

  if (currentState.mode === 'range' && primaryEventId && rangeAnchorId) {
    const rangeEventIds = getRangeEventIds(events, rangeAnchorId, primaryEventId)
    if (rangeEventIds.length > 1) {
      return {
        mode: 'range',
        primaryEventId,
        selectedEventIds: rangeEventIds,
        rangeAnchorId,
        pinnedEventIds: [],
      }
    }
  }

  if (primaryEventId) {
    return createSingleEventSelectionState(events, primaryEventId)
  }

  return preferFirstEvent && events[0]
    ? createSingleEventSelectionState(events, events[0].id)
    : buildEmptyEventSelectionState()
}

export const selectEventInSelectionState = (
  events: EventRecord[],
  currentState: EventSelectionState | null,
  eventId: string,
  options?: {
    shiftKey?: boolean
  },
): EventSelectionState => {
  if (!options?.shiftKey) {
    return createSingleEventSelectionState(events, eventId)
  }

  const normalizedState = normalizeEventSelectionState(events, currentState, {
    preferFirstEvent: false,
  })
  const rangeAnchorId = normalizedState.rangeAnchorId ?? normalizedState.primaryEventId ?? eventId
  const rangeEventIds = getRangeEventIds(events, rangeAnchorId, eventId)

  if (rangeEventIds.length <= 1) {
    return createSingleEventSelectionState(events, eventId)
  }

  return {
    mode: 'range',
    primaryEventId: eventId,
    selectedEventIds: rangeEventIds,
    rangeAnchorId,
    pinnedEventIds: [],
  }
}

export const togglePinnedEventInSelectionState = (
  events: EventRecord[],
  currentState: EventSelectionState | null,
  eventId: string,
): EventSelectionState => {
  const normalizedState = normalizeEventSelectionState(events, currentState, {
    preferFirstEvent: false,
  })
  const nextPinnedIds = new Set(
    normalizedState.mode === 'pinned'
      ? normalizedState.pinnedEventIds
      : normalizedState.primaryEventId
        ? [normalizedState.primaryEventId]
        : [],
  )

  if (nextPinnedIds.has(eventId)) {
    nextPinnedIds.delete(eventId)
  } else {
    nextPinnedIds.add(eventId)
  }

  const orderedPinnedIds = orderEventIdsByTimeline(events, [...nextPinnedIds])
  if (orderedPinnedIds.length <= 1) {
    return createSingleEventSelectionState(events, orderedPinnedIds[0] ?? eventId)
  }

  return {
    mode: 'pinned',
    primaryEventId: orderedPinnedIds.includes(eventId)
      ? eventId
      : orderedPinnedIds.at(-1) ?? null,
    selectedEventIds: orderedPinnedIds,
    rangeAnchorId: eventId,
    pinnedEventIds: orderedPinnedIds,
  }
}

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
  selectedEventIds: string[]
  selectedEvents: EventRecord[]
  selectedScreenshot: ScreenshotRecord | null
  selectedScreenshotAnnotations: AnnotationRecord[]
  similarCaseViews: SimilarCaseView[]
}

export const deriveSessionWorkbenchState = (input: {
  payload: SessionWorkbenchPayload | null
  eventSelection: EventSelectionState
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
    eventSelection,
    selectedScreenshotId,
    draftAnnotations,
    apiAnchors,
    apiGroundingHits,
    annotationSuggestions,
    anchorReviewSuggestions,
    similarCases,
    composerSuggestions,
  } = input

  const normalizedSelectedEventIds = payload ? orderEventIdsByTimeline(payload.events, eventSelection.selectedEventIds) : []
  const selectedEvents = payload
    ? normalizedSelectedEventIds
      .map((eventId) => payload.events.find((event) => event.id === eventId) ?? null)
      .filter((event): event is EventRecord => event != null)
    : []
  const selectedEvent = eventSelection.primaryEventId
    ? payload?.events.find((event) => event.id === eventSelection.primaryEventId) ?? null
    : null
  const fallbackScreenshotId = selectedScreenshotId
    ?? selectedEvent?.screenshot_id
    ?? selectedEvents.find((event) => event.screenshot_id)?.screenshot_id
    ?? null
  const selectedScreenshot = payload?.screenshots.find((shot) => shot.id === fallbackScreenshotId) ?? payload?.screenshots[0] ?? null
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
    selectedEventIds: normalizedSelectedEventIds,
    selectedEvents,
    selectedScreenshot,
    selectedScreenshotAnnotations,
    similarCaseViews,
  }
}
