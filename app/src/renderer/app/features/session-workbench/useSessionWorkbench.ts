import { startTransition, useEffect, useState } from 'react'
import { alphaNexusApi } from '@app/bootstrap/api'
import type { DraftAnnotation } from '@app/features/annotation/annotation-types'
import type { AnnotationInspectorItem, MarketAnchorStatus, MarketAnchorView } from '@app/features/anchors'
import type { ComposerSuggestion } from '@app/features/composer/types'
import type { GroundingHitView } from '@app/features/grounding'
import type { AnnotationSuggestionView, AnchorReviewSuggestionView, SimilarCaseView } from '@app/features/suggestions'
import type { AnalysisCardRecord } from '@shared/contracts/analysis'
import type { AnnotationRecord, ContentBlockRecord, ScreenshotRecord } from '@shared/contracts/content'
import type { EventRecord } from '@shared/contracts/event'
import type { EvaluationRecord, TradeRecord } from '@shared/contracts/trade'
import type {
  AiRecordChain,
  CurrentTargetOption,
  CurrentTargetOptionsPayload,
  SessionWorkbenchPayload,
} from '@shared/contracts/workbench'
import type { WorkbenchTab } from './session-workbench-types'
import { createSessionWorkbenchActions } from './hooks/useSessionWorkbenchActions'
import { createSessionWorkbenchTargetActions, loadSessionWorkbenchMoveTargetOptions } from './hooks/useSessionWorkbenchTargetActions'
import { createSessionWorkbenchTradeActions } from './hooks/useSessionWorkbenchTradeActions'
import {
  loadSessionWorkbenchAnchors,
  loadSessionWorkbenchGroundings,
} from './modules/session-workbench-anchor-grounding'
import {
  deriveSessionWorkbenchState,
} from './modules/session-workbench-selection'
import type { ScreenshotGalleryState } from './modules/session-screenshot-gallery'
import {
  toDraftAnnotation,
} from './modules/session-workbench-mappers'
import { loadSessionWorkbenchSuggestions } from './modules/session-workbench-suggestions'

export type SessionWorkbenchController = {
  activeContentBlocks: ContentBlockRecord[]
  activeAnchors: MarketAnchorView[]
  activeTab: WorkbenchTab
  analysisCard: AnalysisCardRecord | null
  deletedAiRecords: AiRecordChain[]
  deletedAnnotations: AnnotationRecord[]
  annotationInspectorItems: AnnotationInspectorItem[]
  annotationSuggestions: AnnotationSuggestionView[]
  anchorReviewSuggestions: AnchorReviewSuggestionView[]
  anchors: MarketAnchorView[]
  adoptedAnnotationKeys: Set<string>
  busy: boolean
  composerSuggestions: ComposerSuggestion[]
  currentTrade: TradeRecord | null
  deletedContentBlocks: ContentBlockRecord[]
  deletedScreenshots: ScreenshotRecord[]
  draftAnnotations: DraftAnnotation[]
  groundingHits: GroundingHitView[]
  latestEvaluation: EvaluationRecord | null
  message: string | null
  moveTargetOptions: CurrentTargetOptionsPayload | null
  payload: SessionWorkbenchPayload | null
  realtimeDraft: string
  realtimeViewBlock: ContentBlockRecord | null
  screenshotGallery: ScreenshotGalleryState
  selectedEvent: EventRecord | null
  selectedScreenshot: ScreenshotRecord | null
  selectedScreenshotAnnotations: AnnotationRecord[]
  similarCases: SimilarCaseView[]
  handleDeleteAiRecord: (aiRunId: string) => Promise<void>
  handleDeleteAnnotation: (annotationId: string) => Promise<void>
  handleDeleteScreenshot: (screenshotId: string) => Promise<void>
  handleMoveContentBlock: (block: ContentBlockRecord, option: CurrentTargetOption) => Promise<void>
  handleMoveScreenshot: (screenshot: ScreenshotRecord, option: CurrentTargetOption) => Promise<void>
  handleOpenTrade: (input: {
    side: 'long' | 'short'
    quantity: number
    entry_price: number
    stop_loss: number
    take_profit: number
    thesis: string
  }) => Promise<void>
  handleAddToTrade: (input: {
    trade_id: string
    quantity: number
    price: number
  }) => Promise<void>
  handleCreateNoteBlock: (input?: {
    title?: string
    content_md?: string
  }) => Promise<ContentBlockRecord | null>
  handleComposerSuggestionAccept: (suggestion: ComposerSuggestion) => Promise<void>
  handleReduceTrade: (input: {
    trade_id: string
    quantity: number
    price: number
  }) => Promise<void>
  handleCloseTrade: (input: {
    trade_id: string
    exit_price: number
  }) => Promise<void>
  handleCancelTrade: (input: {
    trade_id: string
    reason_md?: string
  }) => Promise<void>
  handleAnnotationSuggestionAction: (suggestionId: string, action: 'keep' | 'merge' | 'discard') => Promise<void>
  handleDeleteBlock: (block: ContentBlockRecord) => Promise<void>
  handleAdoptAnchorFromAnnotation: (item: AnnotationInspectorItem) => void
  handleExport: () => Promise<void>
  handleImportScreenshot: () => Promise<void>
  handleOpenSnipCapture: () => Promise<void>
  handleRestoreAiRecord: (aiRunId: string) => Promise<void>
  handleRestoreAnnotation: (annotationId: string) => Promise<void>
  handleRestoreScreenshot: (screenshotId: string) => Promise<void>
  handleRestoreBlock: (block: ContentBlockRecord) => Promise<void>
  handleRunAnalysis: () => Promise<void>
  handleSaveAnnotations: () => Promise<void>
  handleSaveRealtimeView: () => Promise<void>
  handleUpdateAnnotation: (input: {
    annotation_id: string
    label: string
    title: string
    semantic_type: AnnotationRecord['semantic_type']
    text: string | null
    note_md: string
    add_to_memory: boolean
  }) => Promise<void>
  handleUpdateNoteBlock: (input: {
    block_id: string
    title: string
    content_md: string
  }) => Promise<ContentBlockRecord | null>
  handleSetCurrentContext: (option: CurrentTargetOption) => Promise<void>
  handleSetAnchorStatus: (anchorId: string, status: MarketAnchorStatus) => void
  refresh: (nextSessionId?: string) => Promise<void>
  selectEvent: (event: EventRecord) => void
  selectScreenshot: (screenshotId: string) => void
  setActiveTab: (tab: WorkbenchTab) => void
  setDraftAnnotations: (annotations: DraftAnnotation[]) => void
  setRealtimeDraft: (value: string) => void
}

export const useSessionWorkbench = (sessionId?: string): SessionWorkbenchController => {
  const [payload, setPayload] = useState<SessionWorkbenchPayload | null>(null)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [selectedScreenshotId, setSelectedScreenshotId] = useState<string | null>(null)
  const [draftAnnotations, setDraftAnnotationsState] = useState<DraftAnnotation[]>([])
  const [apiAnchors, setApiAnchors] = useState<MarketAnchorView[]>([])
  const [apiGroundingHits, setApiGroundingHits] = useState<GroundingHitView[]>([])
  const [annotationSuggestions, setAnnotationSuggestions] = useState<AnnotationSuggestionView[]>([])
  const [anchorReviewSuggestions, setAnchorReviewSuggestions] = useState<AnchorReviewSuggestionView[]>([])
  const [similarCases, setSimilarCases] = useState<SimilarCaseView[]>([])
  const [composerSuggestions, setComposerSuggestions] = useState<ComposerSuggestion[]>([])
  const [moveTargetOptions, setMoveTargetOptions] = useState<CurrentTargetOptionsPayload | null>(null)
  const [realtimeDraft, setRealtimeDraftState] = useState('')
  const [activeTab, setActiveTabState] = useState<WorkbenchTab>('view')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const reloadGroundings = async(sessionPayload: SessionWorkbenchPayload, aiRunId?: string | null) => {
    const nextGroundings = await loadSessionWorkbenchGroundings(sessionPayload, aiRunId)
    setApiGroundingHits(nextGroundings)
  }

  const refreshSession = async(nextSessionId?: string): Promise<SessionWorkbenchPayload | null> => {
    try {
      const requestedSessionId = nextSessionId ?? sessionId
      const shouldContinueSession = requestedSessionId != null
        && (payload == null || payload.session.id !== requestedSessionId)
      if (shouldContinueSession) {
        await alphaNexusApi.launcher.continueSession({ session_id: requestedSessionId })
      }

      const nextPayload = await alphaNexusApi.workbench.getSession(requestedSessionId ? { session_id: requestedSessionId } : undefined)
      setPayload(nextPayload)
      setSelectedEventId((current) =>
        current && nextPayload.events.some((event) => event.id === current)
          ? current
          : nextPayload.events[0]?.id ?? null)
      setSelectedScreenshotId((current) =>
        current && nextPayload.screenshots.some((shot) => shot.id === current)
          ? current
          : nextPayload.screenshots[0]?.id ?? null)

      const [anchorsResult, groundingsResult, moveTargetsResult, suggestionsResult] = await Promise.allSettled([
        loadSessionWorkbenchAnchors(nextPayload),
        loadSessionWorkbenchGroundings(nextPayload),
        loadSessionWorkbenchMoveTargetOptions(nextPayload.session.id),
        loadSessionWorkbenchSuggestions(nextPayload, {
          draftText: nextPayload.panels.my_realtime_view,
          screenshotId: nextPayload.screenshots[0]?.id ?? null,
          anchorId: nextPayload.context_memory.active_anchors[0]?.id ?? null,
        }),
      ])

      if (anchorsResult.status === 'fulfilled') {
        setApiAnchors(anchorsResult.value)
      }
      if (groundingsResult.status === 'fulfilled') {
        setApiGroundingHits(groundingsResult.value)
      }
      if (moveTargetsResult.status === 'fulfilled') {
        setMoveTargetOptions(moveTargetsResult.value)
      }
      if (suggestionsResult.status === 'fulfilled') {
        setAnnotationSuggestions(suggestionsResult.value.annotationSuggestions)
        setAnchorReviewSuggestions(suggestionsResult.value.anchorReviewSuggestions)
        setSimilarCases(suggestionsResult.value.similarCases)
        setComposerSuggestions(suggestionsResult.value.composerSuggestions)
      }

      return nextPayload
    } catch (error) {
      setMessage(error instanceof Error ? `加载失败：${error.message}` : '加载 Session 工作台失败。')
      return null
    }
  }

  const refresh = async(nextSessionId?: string) => {
    await refreshSession(nextSessionId)
  }

  const {
    activeAnchors,
    activeContentBlocks,
    adoptedAnnotationKeys,
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
  } = deriveSessionWorkbenchState({
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
  })

  useEffect(() => {
    startTransition(() => {
      void refreshSession(sessionId)
    })
  }, [sessionId])

  useEffect(() => {
    setDraftAnnotationsState(selectedScreenshot?.annotations.map(toDraftAnnotation) ?? [])
  }, [selectedScreenshot])

  useEffect(() => {
    setRealtimeDraftState(payload?.panels.my_realtime_view ?? '')
  }, [payload?.session.id, payload?.panels.my_realtime_view])

  useEffect(() => {
    setMoveTargetOptions(null)
    setApiAnchors([])
    setApiGroundingHits([])
    setAnnotationSuggestions([])
    setAnchorReviewSuggestions([])
    setSimilarCases([])
    setComposerSuggestions([])
  }, [payload?.session.id, payload?.current_context.trade_id])

  useEffect(() => {
    if (!payload?.session.id) {
      return
    }

    const timer = window.setTimeout(() => {
      void loadSessionWorkbenchSuggestions(payload, {
        draftText: realtimeDraft,
        screenshotId: selectedScreenshot?.id ?? null,
        anchorId: payload.context_memory.active_anchors[0]?.id ?? apiAnchors[0]?.id ?? null,
      }).then((nextSuggestions) => {
        setAnnotationSuggestions(nextSuggestions.annotationSuggestions)
        setAnchorReviewSuggestions(nextSuggestions.anchorReviewSuggestions)
        setSimilarCases(nextSuggestions.similarCases)
        setComposerSuggestions(nextSuggestions.composerSuggestions)
      }).catch(() => {})
    }, 220)

    return () => {
      window.clearTimeout(timer)
    }
  }, [payload?.session.id, payload?.current_context.trade_id, selectedScreenshot?.id, realtimeDraft, apiAnchors])

  useEffect(() => {
    if (!payload?.session.id) {
      return
    }

    void alphaNexusApi.capture.setSessionContext({
      session_id: payload.current_context.session_id,
      contract_id: payload.current_context.contract_id,
      period_id: payload.current_context.period_id,
      trade_id: payload.current_context.trade_id,
      source_view: payload.current_context.source_view,
      kind: payload.current_context.capture_kind,
    })
  }, [
    payload?.current_context.capture_kind,
    payload?.current_context.contract_id,
    payload?.current_context.period_id,
    payload?.current_context.session_id,
    payload?.current_context.source_view,
    payload?.current_context.trade_id,
  ])

  useEffect(() => alphaNexusApi.capture.onSaved((result) => {
    if (!payload || result.screenshot.session_id !== payload.session.id) {
      return
    }

    startTransition(() => {
      void refreshSession(payload.session.id).then(() => {
        setSelectedScreenshotId(result.screenshot.id)
        setSelectedEventId(result.created_event_id ?? result.screenshot.event_id)
        const resolutionNote = result.resolved_target?.resolution_note
        setMessage(result.ai_error
          ? `已完成本地保存，AI 未完成：${result.ai_error}${resolutionNote ? ` ${resolutionNote}` : ''}`
          : resolutionNote ?? `已保存截图：${result.screenshot.caption ?? result.screenshot.id}`)
      })
    })
  }), [payload?.session.id])

  const selectEvent = (event: EventRecord) => {
    setSelectedEventId(event.id)
    if (event.screenshot_id) {
      setSelectedScreenshotId(event.screenshot_id)
    }
  }

  const selectScreenshot = (screenshotId: string) => {
    setSelectedScreenshotId(screenshotId)
    const screenshotEvent = payload?.events.find((event) => event.screenshot_id === screenshotId)
    if (screenshotEvent) {
      setSelectedEventId(screenshotEvent.id)
    }
  }

  const {
    handleAdoptAnchorFromAnnotation,
    handleAnnotationSuggestionAction,
    handleDeleteAiRecord,
    handleDeleteAnnotation,
    handleDeleteBlock,
    handleDeleteScreenshot,
    handleExport,
    handleCreateNoteBlock,
    handleComposerSuggestionAccept,
    handleImportScreenshot,
    handleOpenSnipCapture,
    handleRestoreAiRecord,
    handleRestoreAnnotation,
    handleRestoreBlock,
    handleRestoreScreenshot,
    handleRunAnalysis,
    handleSaveAnnotations,
    handleSaveRealtimeView,
    handleUpdateAnnotation,
    handleSetAnchorStatus,
    handleUpdateNoteBlock,
  } = createSessionWorkbenchActions({
    anchors,
    draftAnnotations,
    payload,
    realtimeDraft,
    refreshSession,
    reloadGroundings,
    selectedEvent,
    selectedScreenshot,
    setActiveTab: setActiveTabState,
    setBusy,
    setMessage,
    setSelectedEventId,
    setSelectedScreenshotId,
  })

  const {
    handleAddToTrade,
    handleCancelTrade,
    handleCloseTrade,
    handleOpenTrade,
    handleReduceTrade,
  } = createSessionWorkbenchTradeActions({
    payload,
    refreshSession,
    setBusy,
    setMessage,
    setSelectedEventId,
  })

  const {
    handleMoveContentBlock,
    handleMoveScreenshot,
    handleSetCurrentTarget,
  } = createSessionWorkbenchTargetActions({
    payload,
    refreshSession,
    setBusy,
    setMessage,
  })

  return {
    activeContentBlocks,
    activeAnchors,
    activeTab,
    analysisCard,
    deletedAiRecords,
    deletedAnnotations,
    annotationInspectorItems,
    annotationSuggestions: annotationSuggestionViews,
    anchorReviewSuggestions: anchorReviewSuggestionViews,
    anchors,
    adoptedAnnotationKeys,
    busy,
    composerSuggestions: composerSuggestionViews,
    currentTrade,
    deletedContentBlocks,
    deletedScreenshots,
    draftAnnotations,
    groundingHits,
    latestEvaluation,
    message,
    moveTargetOptions,
    payload,
    realtimeDraft,
    realtimeViewBlock,
    screenshotGallery,
    selectedEvent,
    selectedScreenshot,
    selectedScreenshotAnnotations,
    similarCases: similarCaseViews,
    handleDeleteAiRecord,
    handleDeleteAnnotation,
    handleDeleteScreenshot,
    handleMoveContentBlock,
    handleMoveScreenshot,
    handleOpenTrade,
    handleAddToTrade,
    handleCreateNoteBlock,
    handleComposerSuggestionAccept,
    handleReduceTrade,
    handleCloseTrade,
    handleCancelTrade,
    handleAnnotationSuggestionAction,
    handleDeleteBlock,
    handleAdoptAnchorFromAnnotation,
    handleExport,
    handleImportScreenshot,
    handleOpenSnipCapture,
    handleRestoreAiRecord,
    handleRestoreAnnotation,
    handleRestoreScreenshot,
    handleRestoreBlock,
    handleRunAnalysis,
    handleSaveAnnotations,
    handleSaveRealtimeView,
    handleUpdateAnnotation,
    handleUpdateNoteBlock,
    handleSetCurrentContext: handleSetCurrentTarget,
    handleSetAnchorStatus,
    refresh,
    selectEvent,
    selectScreenshot,
    setActiveTab: setActiveTabState,
    setDraftAnnotations: setDraftAnnotationsState,
    setRealtimeDraft: setRealtimeDraftState,
  }
}
