import { startTransition, useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { alphaNexusApi } from '@app/bootstrap/api'
import type { DraftAnnotation } from '@app/features/annotation/annotation-types'
import type { AnnotationInspectorItem, MarketAnchorStatus, MarketAnchorView } from '@app/features/anchors'
import type { ComposerSuggestion } from '@app/features/composer/types'
import type { GroundingHitView } from '@app/features/grounding'
import type { AnnotationSuggestionView, AnchorReviewSuggestionView, SimilarCaseView } from '@app/features/suggestions'
import type { AnalysisCardRecord } from '@shared/contracts/analysis'
import type { AiRunExecutionResult, AiAnalysisAttachment } from '@shared/ai/contracts'
import type { AnnotationRecord, ContentBlockRecord, ScreenshotRecord } from '@shared/contracts/content'
import type { EventRecord } from '@shared/contracts/event'
import type { EvaluationRecord, TradeRecord } from '@shared/contracts/trade'
import type {
  AiRecordChain,
  CurrentTargetOption,
  CurrentTargetOptionsPayload,
  ReviewCaseRecord,
  SessionWorkbenchPayload,
} from '@shared/contracts/workbench'
import type {
  AiDockState,
  AiDockTab,
  AiPacketComposerState,
  AnalysisTrayState,
  EventSelectionState,
  ScreenshotStageViewMode,
  WorkbenchTab,
} from './session-workbench-types'
import { createSessionWorkbenchActions } from './hooks/useSessionWorkbenchActions'
import { createSessionWorkbenchTargetActions, loadSessionWorkbenchMoveTargetOptions } from './hooks/useSessionWorkbenchTargetActions'
import { createSessionWorkbenchTradeActions } from './hooks/useSessionWorkbenchTradeActions'
import {
  loadSessionWorkbenchAnchors,
  loadSessionWorkbenchGroundings,
} from './modules/session-workbench-anchor-grounding'
import {
  buildAiAnalysisContextFromComposer,
  buildAiDockContextChips,
  buildAiPacketBackgroundDraft,
  createAiPacketComposerState,
  rebuildAiPacketComposerState,
} from './modules/session-ai-packet'
import {
  addScreenshotsToAnalysisTray,
  addSelectionToAnalysisTray as addSelectionToAnalysisTrayState,
  createEmptyAnalysisTrayState,
  normalizeAnalysisTrayState,
  removeScreenshotFromAnalysisTray,
  resolveAnalysisTrayScreenshots,
  setCompareAnalysisTrayScreenshot,
  setPrimaryAnalysisTrayScreenshot,
} from './modules/session-analysis-tray'
import {
  clearEventSelectionState,
  createSingleEventSelectionState,
  deriveSessionWorkbenchState,
  normalizeEventSelectionState,
  selectEventInSelectionState,
  togglePinnedEventInSelectionState,
} from './modules/session-workbench-selection'
import {
  buildReviewCaseTitleSuggestion,
  buildSaveReviewCaseInput,
  restoreWorkbenchStateFromReviewCase,
} from './modules/session-review-case'
import type { ScreenshotGalleryState } from './modules/session-screenshot-gallery'
import {
  toDraftAnnotation,
} from './modules/session-workbench-mappers'
import { loadSessionWorkbenchSuggestions } from './modules/session-workbench-suggestions'

export type SessionWorkbenchController = {
  activeContentBlocks: ContentBlockRecord[]
  activeReviewCase: ReviewCaseRecord | null
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
  aiComposer: AiPacketComposerState | null
  aiDockContextChips: string[]
  aiDockDraft: string
  aiDockState: AiDockState
  aiDockTab: AiDockTab
  busy: boolean
  composerSuggestions: ComposerSuggestion[]
  currentTrade: TradeRecord | null
  deletedContentBlocks: ContentBlockRecord[]
  deletedScreenshots: ScreenshotRecord[]
  draftAnnotations: DraftAnnotation[]
  analysisTray: AnalysisTrayState
  analysisTrayCompareScreenshot: ScreenshotRecord | null
  analysisTrayPrimaryScreenshot: ScreenshotRecord | null
  analysisTrayScreenshots: ScreenshotRecord[]
  eventSelection: EventSelectionState
  groundingHits: GroundingHitView[]
  latestEvaluation: EvaluationRecord | null
  message: string | null
  moveTargetOptions: CurrentTargetOptionsPayload | null
  payload: SessionWorkbenchPayload | null
  realtimeDraft: string
  realtimeViewBlock: ContentBlockRecord | null
  reviewCases: ReviewCaseRecord[]
  screenshotGallery: ScreenshotGalleryState
  screenshotStageViewMode: ScreenshotStageViewMode
  selectedEvent: EventRecord | null
  selectedEventIds: string[]
  selectedEvents: EventRecord[]
  selectedScreenshot: ScreenshotRecord | null
  selectedScreenshotAnnotations: AnnotationRecord[]
  similarCases: SimilarCaseView[]
  addSelectionToAnalysisTray: () => void
  addScreenshotToAnalysisTray: (screenshotId: string) => void
  closeAiComposer: () => void
  clearAnalysisTray: () => void
  clearEventSelection: () => void
  handleQuickSendToAi: (screenshotId?: string | null) => Promise<void>
  handleSendAiComposer: () => Promise<void>
  handleSendAiDockFollowUp: () => Promise<void>
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
    event_id?: string
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
  handlePasteClipboardImage: () => Promise<void>
  handlePasteClipboardImageAndRunAnalysis: () => Promise<void>
  handleOpenReviewCase: (reviewCaseId: string) => Promise<void>
  handleReorderNoteBlocks: (input: {
    session_id: string
    context_type: 'session' | 'trade'
    context_id: string
    ordered_block_ids: string[]
  }) => Promise<void>
  handleRestoreAiRecord: (aiRunId: string) => Promise<void>
  handleRestoreAnnotation: (annotationId: string) => Promise<void>
  handleRestoreScreenshot: (screenshotId: string) => Promise<void>
  handleRestoreBlock: (block: ContentBlockRecord) => Promise<void>
  handleRunAnalysis: () => Promise<void>
  handleRunAnalysisForScreenshot: (screenshotId: string) => Promise<AiRunExecutionResult | null>
  handleRunAnalysisFollowUpForScreenshot: (input: {
    attachments?: AiAnalysisAttachment[]
    backgroundNoteMd: string
    screenshotId: string
  }) => Promise<AiRunExecutionResult | null>
  handleRunAnalysisAcrossProviders: () => Promise<void>
  handleSaveAnnotations: () => Promise<void>
  handleSaveReviewCase: () => Promise<void>
  handleSaveRealtimeView: () => Promise<void>
  handleSaveRealtimeViewAndRunAnalysis: () => Promise<void>
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
  openAiComposer: (input?: {
    primaryScreenshotId?: string | null
  }) => void
  refresh: (nextSessionId?: string) => Promise<void>
  removeAiComposerBackgroundScreenshot: (screenshotId: string) => void
  removeScreenshotFromAnalysisTray: (screenshotId: string) => void
  selectEvent: (event: EventRecord, options?: {
    shiftKey?: boolean
  }) => void
  selectScreenshot: (screenshotId: string) => void
  setCompareAnalysisTrayScreenshot: (screenshotId: string | null) => void
  setAiComposerBackgroundDraft: (value: string) => void
  setAiComposerBackgroundToggle: (key: keyof AiPacketComposerState['backgroundToggles'], value: boolean) => void
  setAiComposerImageRegionMode: (mode: AiPacketComposerState['imageRegionMode']) => void
  setAiComposerPrimaryScreenshot: (screenshotId: string) => void
  setAiDockDraft: (value: string) => void
  setAiDockExpanded: (expanded: boolean) => void
  setAiDockSize: (size: AiDockState['size']) => void
  setAiDockTab: (tab: AiDockTab) => void
  setPrimaryAnalysisTrayScreenshot: (screenshotId: string) => void
  setActiveTab: (tab: WorkbenchTab) => void
  setDraftAnnotations: (annotations: DraftAnnotation[]) => void
  setRealtimeDraft: (value: string) => void
  setScreenshotStageViewMode: (mode: ScreenshotStageViewMode) => void
  togglePinnedEvent: (event: EventRecord) => void
}

export const useSessionWorkbench = (sessionId?: string): SessionWorkbenchController => {
  const [payload, setPayload] = useState<SessionWorkbenchPayload | null>(null)
  const [eventSelection, setEventSelectionState] = useState<EventSelectionState | null>(null)
  const [selectedScreenshotId, setSelectedScreenshotId] = useState<string | null>(null)
  const [draftAnnotations, setDraftAnnotationsState] = useState<DraftAnnotation[]>([])
  const [apiAnchors, setApiAnchors] = useState<MarketAnchorView[]>([])
  const [apiGroundingHits, setApiGroundingHits] = useState<GroundingHitView[]>([])
  const [annotationSuggestions, setAnnotationSuggestions] = useState<AnnotationSuggestionView[]>([])
  const [anchorReviewSuggestions, setAnchorReviewSuggestions] = useState<AnchorReviewSuggestionView[]>([])
  const [similarCases, setSimilarCases] = useState<SimilarCaseView[]>([])
  const [composerSuggestions, setComposerSuggestions] = useState<ComposerSuggestion[]>([])
  const [moveTargetOptions, setMoveTargetOptions] = useState<CurrentTargetOptionsPayload | null>(null)
  const [reviewCases, setReviewCases] = useState<ReviewCaseRecord[]>([])
  const [activeReviewCaseId, setActiveReviewCaseId] = useState<string | null>(null)
  const [realtimeDraft, setRealtimeDraftState] = useState('')
  const [analysisTray, setAnalysisTrayState] = useState<AnalysisTrayState>(() => createEmptyAnalysisTrayState())
  const [aiComposer, setAiComposerState] = useState<AiPacketComposerState | null>(null)
  const [aiDockState, setAiDockState] = useState<AiDockState>({
    expanded: false,
    size: 'peek',
  })
  const [aiDockTab, setAiDockTabState] = useState<AiDockTab>('summary')
  const [aiDockDraft, setAiDockDraftState] = useState('')
  const [screenshotStageViewMode, setScreenshotStageViewModeState] = useState<ScreenshotStageViewMode>('single')
  const [activeTab, setActiveTabState] = useState<WorkbenchTab>('view')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const payloadRef = useRef<SessionWorkbenchPayload | null>(null)
  const eventSelectionRef = useRef<EventSelectionState | null>(null)
  const analysisTrayRef = useRef<AnalysisTrayState>(createEmptyAnalysisTrayState())

  const setEventSelection = (nextState: EventSelectionState) => {
    eventSelectionRef.current = nextState
    setEventSelectionState(nextState)
  }

  const setAnalysisTray = (nextState: AnalysisTrayState) => {
    analysisTrayRef.current = nextState
    setAnalysisTrayState(nextState)
  }

  useEffect(() => {
    payloadRef.current = payload
  }, [payload])

  useEffect(() => {
    eventSelectionRef.current = eventSelection
  }, [eventSelection])

  useEffect(() => {
    analysisTrayRef.current = analysisTray
  }, [analysisTray])

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
      const previousPayload = payloadRef.current
      setPayload(nextPayload)
      payloadRef.current = nextPayload
      const isNewSession = previousPayload == null || previousPayload.session.id !== nextPayload.session.id
      const nextEventSelection = normalizeEventSelectionState(
        nextPayload.events,
        isNewSession ? null : eventSelectionRef.current,
        {
          preferFirstEvent: isNewSession || eventSelectionRef.current == null,
        },
      )
      setEventSelection(nextEventSelection)
      setSelectedScreenshotId((current) =>
        current && nextPayload.screenshots.some((shot) => shot.id === current)
          ? current
          : nextPayload.events.find((event) => event.id === nextEventSelection.primaryEventId)?.screenshot_id
            ?? nextPayload.screenshots[0]?.id
            ?? null)
      setAnalysisTray(normalizeAnalysisTrayState(
        nextPayload,
        isNewSession ? createEmptyAnalysisTrayState() : analysisTrayRef.current,
      ))

      const [anchorsResult, groundingsResult, moveTargetsResult, suggestionsResult, reviewCasesResult] = await Promise.allSettled([
        loadSessionWorkbenchAnchors(nextPayload),
        loadSessionWorkbenchGroundings(nextPayload),
        loadSessionWorkbenchMoveTargetOptions(nextPayload.session.id),
        loadSessionWorkbenchSuggestions(nextPayload, {
          draftText: nextPayload.panels.my_realtime_view,
          screenshotId: nextPayload.screenshots[0]?.id ?? null,
          anchorId: nextPayload.context_memory.active_anchors[0]?.id ?? null,
        }),
        alphaNexusApi.workbench.listReviewCases({
          session_id: nextPayload.session.id,
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
      if (reviewCasesResult.status === 'fulfilled') {
        setReviewCases(reviewCasesResult.value)
        setActiveReviewCaseId((current) =>
          current && reviewCasesResult.value.some((reviewCase) => reviewCase.id === current)
            ? current
            : null)
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

  const effectiveEventSelection = eventSelection ?? clearEventSelectionState()
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
    selectedEventIds,
    selectedEvents,
    selectedScreenshot,
    selectedScreenshotAnnotations,
    similarCaseViews,
  } = deriveSessionWorkbenchState({
    payload,
    eventSelection: effectiveEventSelection,
    selectedScreenshotId,
    draftAnnotations,
    apiAnchors,
    apiGroundingHits,
    annotationSuggestions,
    anchorReviewSuggestions,
    similarCases,
    composerSuggestions,
  })
  const normalizedAnalysisTray = payload
    ? normalizeAnalysisTrayState(payload, analysisTray)
    : analysisTray
  const {
    compareScreenshot: analysisTrayCompareScreenshot,
    primaryScreenshot: analysisTrayPrimaryScreenshot,
    screenshots: analysisTrayScreenshots,
  } = resolveAnalysisTrayScreenshots(payload, normalizedAnalysisTray)
  const selectedEventIdsKey = selectedEventIds.join('|')
  const selectedEventsKey = selectedEvents.map((event) => event.id).join('|')
  const aiDockContextChips = aiComposer
    ? buildAiDockContextChips({
      composer: aiComposer,
      selectedEventIds,
    })
    : []
  const activeReviewCase = reviewCases.find((reviewCase) => reviewCase.id === activeReviewCaseId) ?? null

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
    if (!payload?.session.id) {
      setAiComposerState(null)
      setAiDockDraftState('')
      return
    }

    setAiComposerState((current) => {
      if (!current) {
        return current
      }

      return rebuildAiPacketComposerState({
        composer: current,
        currentTrade,
        payload,
        realtimeDraft,
        selectedEventIds,
        selectedEvents,
      })
    })
  }, [
    currentTrade,
    payload,
    realtimeDraft,
    selectedEventIdsKey,
    selectedEventsKey,
  ])

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
        setSelectedEventIdCompat(result.created_event_id ?? result.screenshot.event_id)
        setActiveReviewCaseId(null)
        const resolutionNote = result.resolved_target?.resolution_note
        setMessage(result.ai_error
          ? `已完成本地保存，AI 未完成：${result.ai_error}${resolutionNote ? ` ${resolutionNote}` : ''}`
          : resolutionNote ?? `已保存截图：${result.screenshot.caption ?? result.screenshot.id}`)
      })
    })
  }), [payload?.session.id])

  const setSelectedEventIdCompat: Dispatch<SetStateAction<string | null>> = (value) => {
    const nextEvents = payloadRef.current?.events ?? []
    const nextEventId = typeof value === 'function'
      ? value(eventSelectionRef.current?.primaryEventId ?? null)
      : value
    const nextSelection = nextEventId
      ? createSingleEventSelectionState(nextEvents, nextEventId)
      : clearEventSelectionState()
    setActiveReviewCaseId(null)
    setEventSelection(nextSelection)
  }

  const selectEvent = (event: EventRecord, options?: {
    shiftKey?: boolean
  }) => {
    const nextSelection = selectEventInSelectionState(
      payloadRef.current?.events ?? [],
      eventSelectionRef.current,
      event.id,
      options,
    )
    setActiveReviewCaseId(null)
    setEventSelection(nextSelection)
    if (event.screenshot_id) {
      setSelectedScreenshotId(event.screenshot_id)
    }
  }

  const togglePinnedEvent = (event: EventRecord) => {
    const nextSelection = togglePinnedEventInSelectionState(
      payloadRef.current?.events ?? [],
      eventSelectionRef.current,
      event.id,
    )
    setActiveReviewCaseId(null)
    setEventSelection(nextSelection)
    if (event.screenshot_id) {
      setSelectedScreenshotId(event.screenshot_id)
    }
  }

  const selectScreenshot = (screenshotId: string) => {
    setSelectedScreenshotId(screenshotId)
    const screenshotEvent = payloadRef.current?.events.find((event) => event.screenshot_id === screenshotId)
    if (screenshotEvent) {
      setSelectedEventIdCompat(screenshotEvent.id)
    }
  }

  const clearEventSelection = () => {
    setActiveReviewCaseId(null)
    setEventSelection(clearEventSelectionState())
  }

  const addScreenshotToAnalysisTray = (screenshotId: string) => {
    if (!payloadRef.current) {
      return
    }
    setAnalysisTray(addScreenshotsToAnalysisTray(payloadRef.current, analysisTrayRef.current, [screenshotId]))
  }

  const removeScreenshotFromAnalysisTrayAction = (screenshotId: string) => {
    if (!payloadRef.current) {
      return
    }
    setAnalysisTray(removeScreenshotFromAnalysisTray(payloadRef.current, analysisTrayRef.current, screenshotId))
  }

  const setPrimaryAnalysisTrayScreenshotAction = (screenshotId: string) => {
    if (!payloadRef.current) {
      return
    }
    setAnalysisTray(setPrimaryAnalysisTrayScreenshot(payloadRef.current, analysisTrayRef.current, screenshotId))
    selectScreenshot(screenshotId)
  }

  const setCompareAnalysisTrayScreenshotAction = (screenshotId: string | null) => {
    if (!payloadRef.current) {
      return
    }
    setAnalysisTray(setCompareAnalysisTrayScreenshot(payloadRef.current, analysisTrayRef.current, screenshotId))
  }

  const addSelectionToAnalysisTray = () => {
    if (!payloadRef.current) {
      return
    }
    setAnalysisTray(addSelectionToAnalysisTrayState(
      payloadRef.current,
      analysisTrayRef.current,
      eventSelectionRef.current ?? clearEventSelectionState(),
    ))
  }

  const clearAnalysisTray = () => {
    setAnalysisTray(createEmptyAnalysisTrayState())
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
    handlePasteClipboardImage,
    handlePasteClipboardImageAndRunAnalysis,
    handleReorderNoteBlocks,
    handleRestoreAiRecord,
    handleRestoreAnnotation,
    handleRestoreBlock,
    handleRestoreScreenshot,
    handleRunAnalysis,
    handleRunAnalysisWithContext,
    handleRunAnalysisForScreenshot,
    handleRunAnalysisFollowUpForScreenshot,
    handleRunAnalysisAcrossProviders,
    handleSaveAnnotations,
    handleSaveRealtimeView,
    handleSaveRealtimeViewAndRunAnalysis,
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
    setSelectedEventId: setSelectedEventIdCompat,
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
    setSelectedEventId: setSelectedEventIdCompat,
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

  const buildComposerState = (input?: {
    primaryScreenshotId?: string | null
  }) => {
    if (!payload) {
      return null
    }

    const primaryScreenshot = input?.primaryScreenshotId
      ? payload.screenshots.find((screenshot) => screenshot.id === input.primaryScreenshotId) ?? selectedScreenshot
      : selectedScreenshot

    const nextComposer = createAiPacketComposerState({
      analysisTray: normalizedAnalysisTray,
      currentTrade,
      payload,
      realtimeDraft,
      selectedEventIds,
      selectedEvents,
      selectedScreenshot: primaryScreenshot,
    })

    return input?.primaryScreenshotId
      ? rebuildAiPacketComposerState({
        composer: {
          ...nextComposer,
          primaryScreenshotId: input.primaryScreenshotId,
          backgroundScreenshotIds: normalizedAnalysisTray.screenshotIds.filter((screenshotId) => screenshotId !== input.primaryScreenshotId),
        },
        currentTrade,
        payload,
        realtimeDraft,
        selectedEventIds,
        selectedEvents,
      })
      : nextComposer
  }

  const uniqueOrderedComposerBackgrounds = (screenshotIds: string[]) => {
    const seen = new Set<string>()
    const ordered: string[] = []
    for (const screenshotId of screenshotIds) {
      if (!screenshotId || seen.has(screenshotId)) {
        continue
      }
      seen.add(screenshotId)
      ordered.push(screenshotId)
    }
    return ordered
  }

  const openAiComposer = (input?: {
    primaryScreenshotId?: string | null
  }) => {
    const nextComposer = buildComposerState(input)
    if (!nextComposer) {
      return
    }
    setAiComposerState({
      ...nextComposer,
      open: true,
    })
  }

  const closeAiComposer = () => {
    setAiComposerState((current) => current ? {
      ...current,
      open: false,
    } : null)
  }

  const setAiComposerBackgroundDraft = (value: string) => {
    setAiComposerState((current) => current ? {
      ...current,
      backgroundDraft: value,
      backgroundDraftDirty: true,
    } : current)
  }

  const setAiComposerBackgroundToggle = (
    key: keyof AiPacketComposerState['backgroundToggles'],
    value: boolean,
  ) => {
    if (!payload || !aiComposer) {
      return
    }

    setAiComposerState((current) => current
      ? rebuildAiPacketComposerState({
        composer: {
          ...current,
          backgroundToggles: {
            ...current.backgroundToggles,
            [key]: value,
          },
          backgroundDraft: current.backgroundDraftDirty
            ? current.backgroundDraft
            : buildAiPacketBackgroundDraft({
              currentTrade,
              payload,
              realtimeDraft,
              selectedEvents,
              toggles: {
                ...current.backgroundToggles,
                [key]: value,
              },
            }),
        },
        currentTrade,
        payload,
        realtimeDraft,
        selectedEventIds,
        selectedEvents,
      })
      : current)
  }

  const setAiComposerImageRegionMode = (mode: AiPacketComposerState['imageRegionMode']) => {
    setAiComposerState((current) => current ? {
      ...current,
      imageRegionMode: mode,
    } : current)
  }

  const setAiComposerPrimaryScreenshot = (screenshotId: string) => {
    setAiComposerState((current) => {
      const currentPayload = payload ?? payloadRef.current
      if (!current || !currentPayload) {
        return current
      }

      return rebuildAiPacketComposerState({
        composer: {
          ...current,
          primaryScreenshotId: screenshotId,
          backgroundScreenshotIds: uniqueOrderedComposerBackgrounds([
            current.primaryScreenshotId,
            ...current.backgroundScreenshotIds,
          ].filter((id): id is string => Boolean(id) && id !== screenshotId)),
        },
        currentTrade,
        payload: currentPayload,
        realtimeDraft,
        selectedEventIds,
        selectedEvents,
      })
    })
  }

  const removeAiComposerBackgroundScreenshot = (screenshotId: string) => {
    setAiComposerState((current) => {
      const currentPayload = payload ?? payloadRef.current
      if (!current || !currentPayload) {
        return current
      }

      return rebuildAiPacketComposerState({
        composer: {
          ...current,
          backgroundScreenshotIds: current.backgroundScreenshotIds.filter((id) => id !== screenshotId),
        },
        currentTrade,
        payload: currentPayload,
        realtimeDraft,
        selectedEventIds,
        selectedEvents,
      })
    })
  }

  const setAiDockExpanded = (expanded: boolean) => {
    setAiDockState((current) => ({
      ...current,
      expanded,
    }))
  }

  const setAiDockSize = (size: AiDockState['size']) => {
    setAiDockState((current) => ({
      ...current,
      size,
      expanded: true,
    }))
  }

  const handleQuickSendToAi = async(screenshotId?: string | null) => {
    const nextComposer = buildComposerState({
      primaryScreenshotId: screenshotId ?? selectedScreenshot?.id ?? normalizedAnalysisTray.primaryScreenshotId ?? null,
    })
    if (!nextComposer?.primaryScreenshotId) {
      setMessage('当前没有可发送给 AI 的主图。')
      return
    }

    setAiComposerState(nextComposer)
    setAiDockState((current) => ({
      ...current,
      expanded: true,
    }))
    setAiDockTabState('summary')
    await handleRunAnalysisWithContext({
      screenshotId: nextComposer.primaryScreenshotId,
      analysisContext: buildAiAnalysisContextFromComposer({
        composer: nextComposer,
        selectedEventIds,
      }),
      successMessagePrefix: '已快速发送：',
    })
  }

  const handleSendAiComposer = async() => {
    if (!aiComposer?.primaryScreenshotId) {
      setMessage('请先选择主图。')
      return
    }

    setAiDockState((current) => ({
      ...current,
      expanded: true,
    }))
    setAiDockTabState('packet')
    await handleRunAnalysisWithContext({
      screenshotId: aiComposer.primaryScreenshotId,
      analysisContext: buildAiAnalysisContextFromComposer({
        composer: aiComposer,
        selectedEventIds,
      }),
      successMessagePrefix: '已按编辑包发送：',
    })
    closeAiComposer()
  }

  const handleSendAiDockFollowUp = async() => {
    const question = aiDockDraft.trim()
    const activeComposer = aiComposer ?? buildComposerState()
    if (!question || !activeComposer?.primaryScreenshotId) {
      return
    }

    const analysisContext = buildAiAnalysisContextFromComposer({
      composer: activeComposer,
      selectedEventIds,
    })
    analysisContext.background_note_md = [
      activeComposer.backgroundDraft.trim(),
      `继续追问：${question}`,
    ].filter(Boolean).join('\n\n')

    setAiComposerState(activeComposer)
    setAiDockState((current) => ({
      ...current,
      expanded: true,
    }))
    await handleRunAnalysisWithContext({
      screenshotId: activeComposer.primaryScreenshotId,
      analysisContext,
      successMessagePrefix: '已发送追问：',
    })
    setAiDockDraftState('')
  }

  const handleSaveReviewCase = async() => {
    if (!payload) {
      return
    }

    if (effectiveEventSelection.mode === 'single' || selectedEvents.length < 2) {
      setMessage('请先做连续区间选择或 pinned 选择，再保存为 Case。')
      return
    }

    const suggestedTitle = buildReviewCaseTitleSuggestion({
      payload,
      selectedEvents,
      selectionMode: effectiveEventSelection.mode,
    })
    const title = window.prompt('保存为 Case：请输入标题', suggestedTitle)?.trim()
    if (!title) {
      return
    }

    try {
      setBusy(true)
      const reviewCase = await alphaNexusApi.workbench.saveReviewCase(buildSaveReviewCaseInput({
        analysisTray: normalizedAnalysisTray,
        payload,
        selectedEvents,
        selectionState: effectiveEventSelection,
        selectedScreenshotId: selectedScreenshot?.id ?? null,
        title,
      }))
      setReviewCases((current) => {
        const next = [reviewCase, ...current.filter((item) => item.id !== reviewCase.id)]
        return next.sort((left, right) => right.updated_at.localeCompare(left.updated_at))
      })
      setActiveReviewCaseId(reviewCase.id)
      setMessage(`已保存 Case：${reviewCase.title}`)
    } catch (error) {
      setMessage(error instanceof Error ? `保存 Case 失败：${error.message}` : '保存 Case 失败。')
    } finally {
      setBusy(false)
    }
  }

  const handleOpenReviewCase = async(reviewCaseId: string) => {
    try {
      setBusy(true)
      const reviewCase = reviewCases.find((item) => item.id === reviewCaseId)
        ?? await alphaNexusApi.workbench.getReviewCase({ review_case_id: reviewCaseId })
      const nextPayload = payload?.session.id === reviewCase.source_session_id
        ? payload
        : await refreshSession(reviewCase.source_session_id)
      if (!nextPayload) {
        return
      }

      const restoredState = restoreWorkbenchStateFromReviewCase({
        payload: nextPayload,
        reviewCase,
      })
      setEventSelection(restoredState.eventSelection)
      setAnalysisTray(restoredState.analysisTray)
      setSelectedScreenshotId(restoredState.selectedScreenshotId)
      setActiveReviewCaseId(reviewCase.id)
      setAiDockState((current) => ({
        ...current,
        expanded: true,
      }))
      setAiDockTabState('summary')
      setMessage(`已打开 Case：${reviewCase.title}`)
    } catch (error) {
      setMessage(error instanceof Error ? `打开 Case 失败：${error.message}` : '打开 Case 失败。')
    } finally {
      setBusy(false)
    }
  }

  return {
    activeContentBlocks,
    activeReviewCase,
    activeAnchors,
    activeTab,
    aiComposer,
    aiDockContextChips,
    aiDockDraft,
    aiDockState,
    aiDockTab,
    analysisCard,
    analysisTray: normalizedAnalysisTray,
    analysisTrayCompareScreenshot,
    analysisTrayPrimaryScreenshot,
    analysisTrayScreenshots,
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
    eventSelection: effectiveEventSelection,
    groundingHits,
    latestEvaluation,
    message,
    moveTargetOptions,
    payload,
    realtimeDraft,
    realtimeViewBlock,
    reviewCases,
    screenshotGallery,
    screenshotStageViewMode,
    selectedEvent,
    selectedEventIds,
    selectedEvents,
    selectedScreenshot,
    selectedScreenshotAnnotations,
    similarCases: similarCaseViews,
    addSelectionToAnalysisTray,
    addScreenshotToAnalysisTray,
    closeAiComposer,
    clearAnalysisTray,
    clearEventSelection,
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
    handlePasteClipboardImage,
    handlePasteClipboardImageAndRunAnalysis,
    handleOpenReviewCase,
    handleQuickSendToAi,
    handleReorderNoteBlocks,
    handleRestoreAiRecord,
    handleRestoreAnnotation,
    handleRestoreScreenshot,
    handleRestoreBlock,
    handleRunAnalysis,
    handleRunAnalysisForScreenshot,
    handleRunAnalysisFollowUpForScreenshot,
    handleRunAnalysisAcrossProviders,
    handleSaveAnnotations,
    handleSaveReviewCase,
    handleSaveRealtimeView,
    handleSaveRealtimeViewAndRunAnalysis,
    handleSendAiComposer,
    handleSendAiDockFollowUp,
    handleUpdateAnnotation,
    handleUpdateNoteBlock,
    handleSetCurrentContext: handleSetCurrentTarget,
    handleSetAnchorStatus,
    openAiComposer,
    refresh,
    removeAiComposerBackgroundScreenshot,
    removeScreenshotFromAnalysisTray: removeScreenshotFromAnalysisTrayAction,
    selectEvent,
    selectScreenshot,
    setAiComposerBackgroundDraft,
    setAiComposerBackgroundToggle,
    setAiComposerImageRegionMode,
    setAiComposerPrimaryScreenshot,
    setAiDockDraft: setAiDockDraftState,
    setAiDockExpanded,
    setAiDockSize,
    setAiDockTab: setAiDockTabState,
    setCompareAnalysisTrayScreenshot: setCompareAnalysisTrayScreenshotAction,
    setActiveTab: setActiveTabState,
    setDraftAnnotations: setDraftAnnotationsState,
    setPrimaryAnalysisTrayScreenshot: setPrimaryAnalysisTrayScreenshotAction,
    setRealtimeDraft: setRealtimeDraftState,
    setScreenshotStageViewMode: setScreenshotStageViewModeState,
    togglePinnedEvent,
  }
}
