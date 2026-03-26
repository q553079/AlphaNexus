import { startTransition, useEffect, useState } from 'react'
import { alphaNexusApi } from '@app/bootstrap/api'
import type { DraftAnnotation } from '@app/features/annotation/annotation-types'
import type { AiProviderConfig } from '@shared/ai/contracts'
import {
  buildAnnotationKey,
  toAnnotationInspectorItems,
  type AnnotationInspectorItem,
  type MarketAnchorStatus,
  type MarketAnchorView,
} from '@app/features/anchors'
import type { ComposerSuggestion } from '@app/features/composer/types'
import type { GroundingHitView } from '@app/features/grounding'
import type { AnnotationSuggestion, AnchorReviewSuggestion, AnalysisCardRecord, SimilarCase } from '@shared/contracts/analysis'
import type { AnnotationRecord, ContentBlockRecord, ScreenshotRecord } from '@shared/contracts/content'
import type { EventRecord } from '@shared/contracts/event'
import type { AnnotationSuggestionView, AnchorReviewSuggestionView, SimilarCaseView, SuggestionState } from '@app/features/suggestions'
import type {
  ActiveMarketAnchorSummary,
  AdoptMarketAnchorInput,
  GetActiveMarketAnchorsInput,
  GetKnowledgeGroundingsInput,
  KnowledgeGroundingHit,
} from '@shared/contracts/knowledge'
import type { EvaluationRecord, TradeRecord } from '@shared/contracts/trade'
import type { AiRecordChain, SessionWorkbenchPayload } from '@shared/contracts/workbench'
import type { WorkbenchTab } from './session-workbench-types'

const analysisProviderPriority: AiProviderConfig['provider'][] = ['custom-http', 'deepseek', 'openai', 'anthropic']

const pickPreferredAnalysisProvider = (providers: AiProviderConfig[]) => {
  const available = providers.filter((provider) => provider.enabled && provider.configured)
  return available.sort((left, right) =>
    analysisProviderPriority.indexOf(left.provider) - analysisProviderPriority.indexOf(right.provider))[0] ?? null
}

const toDraftAnnotation = (annotation: ScreenshotRecord['annotations'][number]): DraftAnnotation => ({
  screenshot_id: annotation.screenshot_id,
  shape: annotation.shape,
  label: annotation.label,
  color: annotation.color,
  x1: annotation.x1,
  y1: annotation.y1,
  x2: annotation.x2,
  y2: annotation.y2,
  text: annotation.text,
  stroke_width: annotation.stroke_width,
})

const toAnchorSemanticType = (shape: DraftAnnotation['shape']): AdoptMarketAnchorInput['semantic_type'] => {
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

const toMarketAnchorView = (anchor: ActiveMarketAnchorSummary): MarketAnchorView => ({
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

const toGroundingHitView = (hit: KnowledgeGroundingHit): GroundingHitView => ({
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

const toComposerGroundingHitView = (
  hit: SessionWorkbenchPayload['composer_shell']['approved_knowledge_hits'][number],
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

const toAnnotationSuggestionView = (suggestion: AnnotationSuggestion): AnnotationSuggestionView => ({
  id: suggestion.id,
  source_annotation_key: suggestion.source_annotation_id ?? undefined,
  label: suggestion.label,
  semantic_type: suggestion.semantic_type ?? 'context',
  reason_summary: suggestion.rationale,
  confidence_pct: suggestion.confidence_pct ?? 0,
  state: toSuggestionState(suggestion.status),
})

const toAnchorReviewSuggestionView = (suggestion: AnchorReviewSuggestion): AnchorReviewSuggestionView => ({
  id: suggestion.id,
  anchor_id: suggestion.anchor_id,
  anchor_title: suggestion.anchor_title,
  verdict: suggestion.suggested_status,
  reason_summary: suggestion.reason_summary,
  confidence_pct: suggestion.confidence_pct ?? 0,
})

const toSimilarCaseView = (
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

const toComposerSuggestionView = (
  suggestion: SessionWorkbenchPayload['composer_shell']['suggestions'][number],
): ComposerSuggestion => ({
  id: suggestion.id,
  type: suggestion.type,
  label: suggestion.label,
  text: suggestion.text,
  source: suggestion.source,
  rationale: suggestion.rationale,
  ranking_reasons: suggestion.ranking_reason ? [suggestion.ranking_reason] : [],
})

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
  payload: SessionWorkbenchPayload | null
  realtimeDraft: string
  realtimeViewBlock: ContentBlockRecord | null
  selectedEvent: EventRecord | null
  selectedScreenshot: ScreenshotRecord | null
  selectedScreenshotAnnotations: AnnotationRecord[]
  similarCases: SimilarCaseView[]
  handleDeleteAiRecord: (aiRunId: string) => Promise<void>
  handleDeleteAnnotation: (annotationId: string) => Promise<void>
  handleDeleteScreenshot: (screenshotId: string) => Promise<void>
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
  handleSetAnchorStatus: (anchorId: string, status: MarketAnchorStatus) => void
  refresh: (nextSessionId?: string) => Promise<void>
  selectEvent: (event: EventRecord) => void
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
  const [realtimeDraft, setRealtimeDraftState] = useState('')
  const [activeTab, setActiveTabState] = useState<WorkbenchTab>('view')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const loadAnchors = async(sessionPayload: SessionWorkbenchPayload) => {
    const input: NonNullable<GetActiveMarketAnchorsInput> = {
      contract_id: sessionPayload.contract.id,
      session_id: sessionPayload.session.id,
      limit: 12,
    }
    const currentTradeId = sessionPayload.trades[0]?.id
    if (currentTradeId) {
      input.trade_id = currentTradeId
    }

    const result = await alphaNexusApi.workbench.getActiveAnchors(input)
    setApiAnchors(result.anchors.map(toMarketAnchorView))
  }

  const loadGroundings = async(sessionPayload: SessionWorkbenchPayload, aiRunId?: string | null) => {
    const input: NonNullable<GetKnowledgeGroundingsInput> = {
      session_id: sessionPayload.session.id,
      limit: 12,
    }
    if (aiRunId) {
      input.ai_run_id = aiRunId
    }

    const result = await alphaNexusApi.workbench.getGroundings(input)
    setApiGroundingHits(result.hits.map(toGroundingHitView))
  }

  const loadSuggestionLayer = async(sessionPayload: SessionWorkbenchPayload, options?: {
    draftText?: string
    screenshotId?: string | null
    anchorId?: string | null
  }) => {
    const timeframeLabel = sessionPayload.context_memory.active_anchors[0]?.timeframe_scope ?? 'session'
    const [annotationResult, anchorReviewResult, similarCaseResult, composerResult] = await Promise.all([
      options?.screenshotId
        ? alphaNexusApi.workbench.runAnnotationSuggestions({
          session_id: sessionPayload.session.id,
          screenshot_id: options.screenshotId,
          limit: 6,
        })
        : Promise.resolve({ suggestions: [] }),
      alphaNexusApi.workbench.getAnchorReviewSuggestions({
        session_id: sessionPayload.session.id,
        limit: 6,
      }),
      alphaNexusApi.workbench.getSimilarCases({
        session_id: sessionPayload.session.id,
        contract_id: sessionPayload.contract.id,
        timeframe_scope: timeframeLabel,
        semantic_tags: sessionPayload.session.tags,
        trade_context: options?.draftText || sessionPayload.panels.my_realtime_view,
        limit: 5,
      }),
      alphaNexusApi.workbench.getComposerSuggestions({
        session_id: sessionPayload.session.id,
        draft_text: options?.draftText,
        anchor_id: options?.anchorId ?? null,
        limit: 6,
      }),
    ])

    setAnnotationSuggestions(annotationResult.suggestions.map(toAnnotationSuggestionView))
    setAnchorReviewSuggestions(anchorReviewResult.suggestions.map(toAnchorReviewSuggestionView))
    setSimilarCases(similarCaseResult.cases.map((item) => toSimilarCaseView(item, sessionPayload.contract.symbol, timeframeLabel)))
    setComposerSuggestions(composerResult.suggestions.map(toComposerSuggestionView))
  }

  const refresh = async(nextSessionId?: string) => {
    try {
      const nextPayload = await alphaNexusApi.workbench.getSession(nextSessionId ? { session_id: nextSessionId } : undefined)
      setPayload(nextPayload)
      setSelectedEventId((current) =>
        current && nextPayload.events.some((event) => event.id === current)
          ? current
          : nextPayload.events[0]?.id ?? null)
      setSelectedScreenshotId((current) =>
        current && nextPayload.screenshots.some((shot) => shot.id === current)
          ? current
          : nextPayload.screenshots[0]?.id ?? null)
      await Promise.allSettled([
        loadAnchors(nextPayload),
        loadGroundings(nextPayload),
        loadSuggestionLayer(nextPayload, {
          draftText: nextPayload.panels.my_realtime_view,
          screenshotId: nextPayload.screenshots[0]?.id ?? null,
          anchorId: nextPayload.context_memory.active_anchors[0]?.id ?? null,
        }),
      ])
    } catch (error) {
      setMessage(error instanceof Error ? `加载失败：${error.message}` : '加载 Session 工作台失败。')
    }
  }

  useEffect(() => {
    startTransition(() => {
      void refresh(sessionId)
    })
  }, [sessionId])

  const selectedScreenshot = payload?.screenshots.find((shot) => shot.id === selectedScreenshotId) ?? payload?.screenshots[0] ?? null
  const selectedScreenshotAnnotations = selectedScreenshot?.annotations ?? []
  const deletedAnnotations = selectedScreenshot?.deleted_annotations ?? []
  const deletedScreenshots = payload?.deleted_screenshots ?? []
  const deletedAiRecords = payload?.deleted_ai_records ?? []

  useEffect(() => {
    setDraftAnnotationsState(selectedScreenshot?.annotations.map(toDraftAnnotation) ?? [])
  }, [selectedScreenshot])

  useEffect(() => {
    setRealtimeDraftState(payload?.panels.my_realtime_view ?? '')
  }, [payload?.session.id, payload?.panels.my_realtime_view])

  useEffect(() => {
    setApiAnchors([])
    setApiGroundingHits([])
    setAnnotationSuggestions([])
    setAnchorReviewSuggestions([])
    setSimilarCases([])
    setComposerSuggestions([])
  }, [payload?.session.id])

  useEffect(() => {
    if (!payload?.session.id) {
      return
    }

    const timer = window.setTimeout(() => {
      void loadSuggestionLayer(payload, {
        draftText: realtimeDraft,
        screenshotId: selectedScreenshot?.id ?? null,
        anchorId: payload.context_memory.active_anchors[0]?.id ?? apiAnchors[0]?.id ?? null,
      })
    }, 220)

    return () => {
      window.clearTimeout(timer)
    }
  }, [payload?.session.id, selectedScreenshot?.id, realtimeDraft, apiAnchors])

  useEffect(() => {
    if (!payload?.session.id) {
      return
    }

    void alphaNexusApi.capture.setSessionContext({
      session_id: payload.session.id,
      kind: 'chart',
    })
  }, [payload?.session.id])

  useEffect(() => alphaNexusApi.capture.onSaved((result) => {
    if (!payload || result.screenshot.session_id !== payload.session.id) {
      return
    }

    startTransition(() => {
      void refresh(payload.session.id).then(() => {
        setSelectedScreenshotId(result.screenshot.id)
        setSelectedEventId(result.created_event_id ?? result.screenshot.event_id)
        setMessage(`已保存截图：${result.screenshot.caption ?? result.screenshot.id}`)
      })
    })
  }), [payload?.session.id])

  const selectedEvent = payload?.events.find((event) => event.id === selectedEventId) ?? payload?.events[0] ?? null
  const analysisCard = payload?.analysis_cards[payload.analysis_cards.length - 1] ?? null
  const currentTrade = payload?.trades[0] ?? null
  const latestEvaluation = payload?.evaluations[0] ?? null
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
  const realtimeViewBlock = [...(payload?.content_blocks ?? [])]
    .reverse()
    .find((block) => block.context_type === 'session' && block.context_id === payload?.session.id && block.title === 'Realtime view')
    ?? null
  const activeContentBlocks = (payload?.content_blocks ?? []).filter((block) => !block.soft_deleted)
  const deletedContentBlocks = (payload?.content_blocks ?? []).filter((block) => block.soft_deleted && block.block_type !== 'ai-summary')

  const selectEvent = (event: EventRecord) => {
    setSelectedEventId(event.id)
    if (event.screenshot_id) {
      setSelectedScreenshotId(event.screenshot_id)
    }
  }

  const handleImportScreenshot = async() => {
    if (!payload) {
      return
    }

    try {
      setBusy(true)
      const result = await alphaNexusApi.capture.importImage({ session_id: payload.session.id, kind: 'chart' })
      await refresh(payload.session.id)
      setSelectedScreenshotId(result.screenshot.id)
      setMessage(`已导入截图：${result.screenshot.caption ?? result.screenshot.id}`)
    } catch (error) {
      setMessage(error instanceof Error ? `导入失败：${error.message}` : '导入截图失败。')
    } finally {
      setBusy(false)
    }
  }

  const handleOpenSnipCapture = async() => {
    if (!payload) {
      return
    }

    try {
      setBusy(true)
      await alphaNexusApi.capture.openSnipCapture({
        session_id: payload.session.id,
        kind: 'chart',
      })
      setMessage('截图浮层已打开。拖拽选区后可复制，或按 Enter 送入当前笔记流程。')
    } catch (error) {
      setMessage(error instanceof Error ? `打开失败：${error.message}` : '打开截图浮层失败。')
    } finally {
      setBusy(false)
    }
  }

  const handleSaveAnnotations = async() => {
    if (!selectedScreenshot || !payload) {
      return
    }

    try {
      setBusy(true)
      await alphaNexusApi.capture.saveAnnotations({
        screenshot_id: selectedScreenshot.id,
        annotations: draftAnnotations,
      })
      await refresh(payload.session.id)
      setMessage(`已保存 ${draftAnnotations.length} 个标注到当前上下文。`)
    } catch (error) {
      setMessage(error instanceof Error ? `保存失败：${error.message}` : '保存标注失败。')
    } finally {
      setBusy(false)
    }
  }

  const handleRunAnalysis = async() => {
    if (!payload) {
      return
    }

    try {
      setBusy(true)
      const providers = await alphaNexusApi.ai.listProviders()
      const preferredProvider = pickPreferredAnalysisProvider(providers)
      if (!preferredProvider) {
        throw new Error('当前没有已启用且已配置完成的 AI provider。请先到设置页启用并配置一个 provider。')
      }
      const result = await alphaNexusApi.ai.runAnalysis({
        session_id: payload.session.id,
        screenshot_id: selectedScreenshot?.id ?? null,
        provider: preferredProvider.provider,
        prompt_kind: 'market-analysis',
      })
      await refresh(payload.session.id)
      await loadGroundings(payload, result.ai_run.id)
      setSelectedEventId(result.event.id)
      if (result.event.screenshot_id) {
        setSelectedScreenshotId(result.event.screenshot_id)
      }
      setActiveTabState('ai')
      setMessage(`${preferredProvider.label} 分析已完成：${result.analysis_card.summary_short}`)
    } catch (error) {
      setMessage(error instanceof Error ? `运行失败：${error.message}` : '运行 AI 分析失败。')
    } finally {
      setBusy(false)
    }
  }

  const handleExport = async() => {
    if (!payload) {
      return
    }

    try {
      const result = await alphaNexusApi.export.sessionMarkdown({ session_id: payload.session.id })
      setMessage(`Markdown 已导出到 ${result.file_path}`)
    } catch (error) {
      setMessage(error instanceof Error ? `导出失败：${error.message}` : '导出 Markdown 失败。')
    }
  }

  const handleSaveRealtimeView = async() => {
    if (!payload) {
      return
    }

    try {
      setBusy(true)
      await alphaNexusApi.workbench.saveRealtimeView({
        session_id: payload.session.id,
        content_md: realtimeDraft,
      })
      await refresh(payload.session.id)
      setActiveTabState('view')
      setMessage('已将我的看法保存到本地 Session 上下文。')
    } catch (error) {
      setMessage(error instanceof Error ? `保存失败：${error.message}` : '保存我的看法失败。')
    } finally {
      setBusy(false)
    }
  }

  const handleAnnotationSuggestionAction = async(
    suggestionId: string,
    action: 'keep' | 'merge' | 'discard',
  ) => {
    if (!payload) {
      return
    }

    try {
      setBusy(true)
      const result = await alphaNexusApi.workbench.applySuggestionAction({
        suggestion_id: suggestionId,
        suggestion_kind: 'annotation',
        action,
      })
      if (result.screenshot_id) {
        setSelectedScreenshotId(result.screenshot_id)
      }
      await refresh(payload.session.id)
      setMessage(
        result.applied_effect === 'merged-annotation'
          ? 'AI annotation suggestion 已合并到现有正式标注。'
          : result.applied_effect === 'created-annotation'
            ? 'AI annotation suggestion 已转成正式标注。'
            : 'AI annotation suggestion 已丢弃并记录审计。',
      )
    } catch (error) {
      setMessage(error instanceof Error ? `处理失败：${error.message}` : '处理 annotation suggestion 失败。')
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteScreenshot = async(screenshotId: string) => {
    if (!payload) {
      return
    }

    try {
      setBusy(true)
      const result = await alphaNexusApi.workbench.deleteScreenshot({ screenshot_id: screenshotId })
      await refresh(payload.session.id)
      setSelectedScreenshotId((current) => current === screenshotId ? null : current)
      if (selectedEvent?.screenshot_id === screenshotId) {
        setSelectedEventId(null)
      }
      setMessage(`已删除截图：${result.screenshot.caption ?? result.screenshot.id}。`)
    } catch (error) {
      setMessage(error instanceof Error ? `删除失败：${error.message}` : '删除截图失败。')
    } finally {
      setBusy(false)
    }
  }

  const handleRestoreScreenshot = async(screenshotId: string) => {
    if (!payload) {
      return
    }

    try {
      setBusy(true)
      const result = await alphaNexusApi.workbench.restoreScreenshot({ screenshot_id: screenshotId })
      await refresh(payload.session.id)
      setSelectedScreenshotId(result.screenshot.id)
      if (result.screenshot.event_id) {
        setSelectedEventId(result.screenshot.event_id)
      }
      setMessage(`已恢复截图：${result.screenshot.caption ?? result.screenshot.id}。`)
    } catch (error) {
      setMessage(error instanceof Error ? `恢复失败：${error.message}` : '恢复截图失败。')
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteAnnotation = async(annotationId: string) => {
    if (!payload || !selectedScreenshot) {
      return
    }

    try {
      setBusy(true)
      const result = await alphaNexusApi.workbench.deleteAnnotation({ annotation_id: annotationId })
      await refresh(payload.session.id)
      setSelectedScreenshotId(selectedScreenshot.id)
      setMessage(`已删除标注：${result.annotation.label}。`)
    } catch (error) {
      setMessage(error instanceof Error ? `删除失败：${error.message}` : '删除标注失败。')
    } finally {
      setBusy(false)
    }
  }

  const handleRestoreAnnotation = async(annotationId: string) => {
    if (!payload || !selectedScreenshot) {
      return
    }

    try {
      setBusy(true)
      const result = await alphaNexusApi.workbench.restoreAnnotation({ annotation_id: annotationId })
      await refresh(payload.session.id)
      setSelectedScreenshotId(selectedScreenshot.id)
      setMessage(`已恢复标注：${result.annotation.label}。`)
    } catch (error) {
      setMessage(error instanceof Error ? `恢复失败：${error.message}` : '恢复标注失败。')
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteAiRecord = async(aiRunId: string) => {
    if (!payload) {
      return
    }

    try {
      setBusy(true)
      const result = await alphaNexusApi.workbench.deleteAiRecord({ ai_run_id: aiRunId })
      await refresh(payload.session.id)
      if (selectedEvent?.ai_run_id === aiRunId) {
        setSelectedEventId(null)
      }
      setActiveTabState('view')
      setMessage(`已删除 AI 记录：${result.ai_record.analysis_card?.summary_short ?? result.ai_record.ai_run.id}。`)
    } catch (error) {
      setMessage(error instanceof Error ? `删除失败：${error.message}` : '删除 AI 记录失败。')
    } finally {
      setBusy(false)
    }
  }

  const handleRestoreAiRecord = async(aiRunId: string) => {
    if (!payload) {
      return
    }

    try {
      setBusy(true)
      const result = await alphaNexusApi.workbench.restoreAiRecord({ ai_run_id: aiRunId })
      await refresh(payload.session.id)
      if (result.ai_record.event) {
        setSelectedEventId(result.ai_record.event.id)
        if (result.ai_record.event.screenshot_id) {
          setSelectedScreenshotId(result.ai_record.event.screenshot_id)
        }
      }
      setActiveTabState('ai')
      setMessage(`已恢复 AI 记录：${result.ai_record.analysis_card?.summary_short ?? result.ai_record.ai_run.id}。`)
    } catch (error) {
      setMessage(error instanceof Error ? `恢复失败：${error.message}` : '恢复 AI 记录失败。')
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteBlock = async(block: ContentBlockRecord) => {
    if (!payload) {
      return
    }

    try {
      setBusy(true)
      if (block.block_type === 'ai-summary') {
        const aiRunId = payload.events.find((event) => event.id === block.event_id)?.ai_run_id
        if (!aiRunId) {
          throw new Error('当前 AI 内容块没有关联 ai_run_id。')
        }
        await alphaNexusApi.workbench.deleteAiRecord({ ai_run_id: aiRunId })
        await refresh(payload.session.id)
        setMessage(`已删除 AI 记录“${block.title}”。`)
        return
      }
      await alphaNexusApi.workbench.deleteContentBlock({ block_id: block.id })
      await refresh(payload.session.id)
      setMessage(`已删除内容块“${block.title}”。`)
    } catch (error) {
      setMessage(error instanceof Error ? `删除失败：${error.message}` : `删除“${block.title}”失败。`)
    } finally {
      setBusy(false)
    }
  }

  const handleRestoreBlock = async(block: ContentBlockRecord) => {
    if (!payload) {
      return
    }

    try {
      setBusy(true)
      if (block.block_type === 'ai-summary') {
        const aiRunId = payload.deleted_ai_records.find((record) => record.content_block?.id === block.id)?.ai_run.id
        if (!aiRunId) {
          throw new Error('当前 AI 内容块没有可恢复的 ai_run_id。')
        }
        await alphaNexusApi.workbench.restoreAiRecord({ ai_run_id: aiRunId })
        await refresh(payload.session.id)
        setMessage(`已恢复 AI 记录“${block.title}”。`)
        return
      }
      await alphaNexusApi.workbench.restoreContentBlock({ block_id: block.id })
      await refresh(payload.session.id)
      setMessage(`已恢复内容块“${block.title}”。`)
    } catch (error) {
      setMessage(error instanceof Error ? `恢复失败：${error.message}` : `恢复“${block.title}”失败。`)
    } finally {
      setBusy(false)
    }
  }

  const handleAdoptAnchorFromAnnotation = (item: AnnotationInspectorItem) => {
    if (!payload) {
      return
    }

    void (async() => {
      try {
        setBusy(true)
        const sourceAnnotation = selectedScreenshot?.annotations.find((annotation) =>
          buildAnnotationKey(toDraftAnnotation(annotation)) === item.key)
        const existing = anchors.find((anchor) => anchor.source_annotation_key === item.key || anchor.source_annotation_id === sourceAnnotation?.id)
        await alphaNexusApi.workbench.adoptAnchor({
          contract_id: payload.contract.id,
          session_id: payload.session.id,
          trade_id: currentTrade?.id ?? null,
          source_annotation_id: sourceAnnotation?.id ?? null,
          source_annotation_label: item.label,
          source_screenshot_id: selectedScreenshot?.id ?? null,
          title: `${item.label} Anchor`,
          semantic_type: toAnchorSemanticType(item.annotation.shape),
          carry_forward: true,
          thesis_md: '',
          invalidation_rule_md: '',
        })
        await refresh(payload.session.id)
        setMessage(existing ? `已重新激活 ${item.label} 对应的 Anchor。` : `已将 ${item.label} 采纳为 Anchor。`)
      } catch (error) {
        setMessage(error instanceof Error ? `采纳失败：${error.message}` : '采纳 Anchor 失败。')
      } finally {
        setBusy(false)
      }
    })()
  }

  const handleSetAnchorStatus = (anchorId: string, status: MarketAnchorStatus) => {
    if (!payload) {
      return
    }

    void (async() => {
      try {
        setBusy(true)
        await alphaNexusApi.workbench.updateAnchorStatus({
          anchor_id: anchorId,
          status,
        })
        await refresh(payload.session.id)
        const target = anchors.find((anchor) => anchor.id === anchorId)
        if (target) {
          setMessage(`Anchor ${target.title} 已更新为 ${status}。`)
        }
      } catch (error) {
        setMessage(error instanceof Error ? `更新失败：${error.message}` : '更新 Anchor 状态失败。')
      } finally {
        setBusy(false)
      }
    })()
  }

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
    adoptedAnnotationKeys: adoptedKeys,
    busy,
    composerSuggestions: composerSuggestionViews,
    currentTrade,
    deletedContentBlocks,
    deletedScreenshots,
    draftAnnotations,
    groundingHits,
    latestEvaluation,
    message,
    payload,
    realtimeDraft,
    realtimeViewBlock,
    selectedEvent,
    selectedScreenshot,
    selectedScreenshotAnnotations,
    similarCases: similarCaseViews,
    handleDeleteAiRecord,
    handleDeleteAnnotation,
    handleDeleteScreenshot,
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
    handleSetAnchorStatus,
    refresh,
    selectEvent,
    setActiveTab: setActiveTabState,
    setDraftAnnotations: setDraftAnnotationsState,
    setRealtimeDraft: setRealtimeDraftState,
  }
}
