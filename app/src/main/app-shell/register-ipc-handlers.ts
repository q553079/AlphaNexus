import { ipcMain } from 'electron'
import type { AppEnvironment } from '@main/app-shell/env'
import type { LocalFirstPaths } from '@main/app-shell/paths'
import {
  cancelPendingSnip,
  copyPendingSnip,
  getPendingSnip,
  importScreenshotIntoSession,
  openSnipCapture,
  savePendingSnip,
  saveScreenshotAnnotations,
  setCaptureSessionContext,
} from '@main/capture/capture-service'
import {
  listAiProviders,
  listAnchorReviewSuggestions,
  listComposerAiSuggestions,
  listSimilarCases,
  runAiAnalysis,
  runAnnotationSuggestions,
  runMockAiAnalysis,
  saveAiProviderConfig,
} from '@main/ai/service'
import { createLauncherSession, getLauncherHome } from '@main/domain/session-launcher-service'
import { applySuggestionAction } from '@main/domain/suggestion-action-service'
import {
  getPeriodReview,
  getSessionWorkbench,
  getTradeDetail,
  softDeleteAiRecord,
  softDeleteAnnotation,
  softDeleteScreenshot,
  softDeleteContentBlock,
  undeleteAiRecord,
  undeleteAnnotation,
  undeleteScreenshot,
  undeleteContentBlock,
  updateSessionRealtimeView,
} from '@main/domain/workbench-service'
import { getTradeEvaluationSummary } from '@main/evaluation/evaluation-service'
import { getTradeFeedbackBundle } from '@main/feedback/feedback-service'
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
import { approveMemoryProposal, listMemoryProposals, rejectMemoryProposal } from '@main/memory/memory-service'
import { getRankingExplanations, getUserProfileSnapshot } from '@main/profile/profile-service'
import { getPeriodReviewInsights } from '@main/review/review-service'
import { initializeStorage } from '@main/storage/database'
import { getTrainingInsightFeed } from '@main/training/training-service'
import { exportSessionMarkdown } from '@main/export/service'
import { listKnowledgeAllSources, listKnowledgeFragmentsForSource, loadKnowledgeCard } from '@main/storage/knowledge'
import {
  ActiveMarketAnchorsPayloadSchema,
  ApprovedKnowledgeRuntimePayloadSchema,
  GetActiveMarketAnchorsInputSchema,
  ComposerShellSchema,
  ComposerSuggestionPayloadSchema,
  GetKnowledgeGroundingsInputSchema,
  GetApprovedKnowledgeRuntimeInputSchema,
  GetKnowledgeReviewDashboardInputSchema,
  IngestKnowledgeSourceInputSchema,
  KnowledgeGroundingPayloadSchema,
  KnowledgeCardSchema,
  KnowledgeFragmentSchema,
  KnowledgeImportJobSchema,
  KnowledgeReviewDashboardPayloadSchema,
  KnowledgeSourceSchema,
  MarketAnchorMutationResultSchema,
  ReviewKnowledgeCardInputSchema,
  AdoptMarketAnchorInputSchema,
  UpdateMarketAnchorStatusInputSchema,
} from '@shared/contracts/knowledge'
import { AnnotationSuggestionPayloadSchema, AnchorReviewSuggestionPayloadSchema, SimilarCasePayloadSchema } from '@shared/contracts/analysis'
import {
  MemoryProposalPayloadSchema,
  RankingExplanationPayloadSchema,
  ReviewableMemoryActionInputSchema,
  TrainingInsightSchema,
  UserProfileSchema,
} from '@shared/contracts/evaluation'
import {
  AiRecordMutationResultSchema,
  AnnotationMutationResultSchema,
  ApplySuggestionActionInputSchema,
  ContentBlockMutationResultSchema,
  GetAnchorReviewSuggestionsInputSchema,
  GetComposerSuggestionsInputSchema,
  GetRankingExplanationsInputSchema,
  GetSimilarCasesInputSchema,
  GetTrainingInsightsInputSchema,
  GetUserProfileInputSchema,
  ListMemoryProposalsInputSchema,
  PeriodReviewPayloadSchema,
  RunAnnotationSuggestionsInputSchema,
  SaveSessionRealtimeViewInputSchema,
  SessionWorkbenchPayloadSchema,
  SetAiRecordDeletedInputSchema,
  SetAnnotationDeletedInputSchema,
  SetContentBlockDeletedInputSchema,
  SetScreenshotDeletedInputSchema,
  ScreenshotMutationResultSchema,
  SuggestionActionResultSchema,
  TradeDetailPayloadSchema,
} from '@shared/contracts/workbench'

type AppContext = {
  env: AppEnvironment
  paths: LocalFirstPaths
}

const emptyComposerShell = () => ComposerShellSchema.parse({
  active_anchor_labels: [],
  active_anchors: [],
  approved_knowledge_hits: [],
  suggestions: [],
  context_summary: '当前没有可用的 approved knowledge。',
})

const emptyActiveAnchorsPayload = () => ActiveMarketAnchorsPayloadSchema.parse({
  anchors: [],
})

const emptyKnowledgeGroundingPayload = () => KnowledgeGroundingPayloadSchema.parse({
  hits: [],
})

const emptyAnnotationSuggestionPayload = () => AnnotationSuggestionPayloadSchema.parse({
  suggestions: [],
})

const describeError = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

const logWorkbenchSessionContextFailure = (
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

const toPublicDashboard = async(paths: LocalFirstPaths, input?: { source_id?: string }) => {
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

const toPublicRuntimePayload = (payload: Awaited<ReturnType<typeof getApprovedKnowledgeRuntime>>) =>
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

const toPublicActiveAnchorsPayload = (payload: Awaited<ReturnType<typeof buildActiveAnchorRuntimeSummary>>) =>
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

const toPublicKnowledgeGroundingPayload = async(
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

const toPublicComposerShell = (
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

const toPublicAnnotationSuggestionsPayload = (
  payload: Awaited<ReturnType<typeof runAnnotationSuggestions>>,
  screenshotId: string,
) => AnnotationSuggestionPayloadSchema.parse({
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

const toPublicComposerAiSuggestionsPayload = (payload: Awaited<ReturnType<typeof listComposerAiSuggestions>>) =>
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

const toPublicAnchorReviewSuggestionsPayload = (payload: Awaited<ReturnType<typeof listAnchorReviewSuggestions>>) =>
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

const toPublicSimilarCasePayload = (payload: Awaited<ReturnType<typeof listSimilarCases>>) =>
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

const resolveKnowledgeGroundings = async(paths: LocalFirstPaths, input?: {
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

export const registerIpcHandlers = ({ env, paths }: AppContext) => {
  ipcMain.handle('app:ping', async() => 'alpha-nexus-ready')

  ipcMain.handle('app:get-environment', async() => ({
    hasDeepSeekKey: Boolean(env.deepseekApiKey),
    hasOpenAiKey: Boolean(env.openAiApiKey),
    hasAnthropicKey: Boolean(env.anthropicApiKey),
    hasCustomAiKey: Boolean(env.customAiApiKey),
    customAiApiBaseUrl: env.customAiApiBaseUrl ?? null,
    dataDir: paths.dataDir,
    vaultDir: paths.vaultDir,
  }))

  ipcMain.handle('db:initialize', async() => initializeStorage(paths))
  ipcMain.handle('launcher:get-home', async() => getLauncherHome(paths))
  ipcMain.handle('launcher:create-session', async(_event, input) => createLauncherSession(paths, input))
  ipcMain.handle('workbench:get-session', async(_event, input) => {
    const workbench = await getSessionWorkbench(paths, input)
    let composerShell = emptyComposerShell()
    let activeAnchors = emptyActiveAnchorsPayload()
    let groundings = emptyKnowledgeGroundingPayload()
    const currentTrade = workbench.trades.find((trade) => trade.status === 'open') ?? workbench.trades[0] ?? null

    const anchorFilters = {
      contract_id: workbench.contract.id,
      session_id: workbench.session.id,
      trade_id: currentTrade?.id ?? null,
      status: 'active' as const,
      limit: 6,
    }
    const composerAnchorFilters = {
      ...anchorFilters,
      limit: 4,
    }
    const [anchorResult, groundingResult, composerResult] = await Promise.allSettled([
      buildActiveAnchorRuntimeSummary(paths, anchorFilters),
      resolveKnowledgeGroundings(paths, {
        session_id: workbench.session.id,
        limit: 6,
      }),
      getComposerShellData(paths, {
        contract_scope: workbench.contract.symbol,
        limit: 4,
      }, composerAnchorFilters),
    ])

    if (anchorResult.status === 'fulfilled') {
      activeAnchors = toPublicActiveAnchorsPayload(anchorResult.value)
    } else {
      logWorkbenchSessionContextFailure('anchors', workbench.session.id, anchorResult.reason)
    }

    if (groundingResult.status === 'fulfilled') {
      groundings = groundingResult.value
    } else {
      logWorkbenchSessionContextFailure('groundings', workbench.session.id, groundingResult.reason)
    }

    if (composerResult.status === 'fulfilled') {
      composerShell = toPublicComposerShell(composerResult.value, activeAnchors.anchors)
    } else {
      logWorkbenchSessionContextFailure('composer', workbench.session.id, composerResult.reason)
    }

    return SessionWorkbenchPayloadSchema.parse({
      ...workbench,
      composer_shell: composerShell,
      context_memory: {
        active_anchors: activeAnchors.anchors,
        latest_grounding_hits: groundings.hits,
      },
      suggestion_layer: {
        annotation_suggestions: [],
        anchor_review_suggestions: [],
        similar_cases: [],
      },
    })
  })
  ipcMain.handle('trade:get-detail', async(_event, input) => {
    const detail = await getTradeDetail(paths, input)
    const [evaluationSummary, feedbackBundle] = await Promise.all([
      getTradeEvaluationSummary(paths, detail.trade.id),
      getTradeFeedbackBundle(paths, detail.trade.id),
    ])

    return TradeDetailPayloadSchema.parse({
      ...detail,
      evaluation_summary: evaluationSummary,
      feedback_items: feedbackBundle.feedback_items,
      discipline_score: feedbackBundle.discipline_score,
      rule_hits: feedbackBundle.rule_hits,
    })
  })
  ipcMain.handle('review:get-period', async(_event, input) => {
    const detail = await getPeriodReview(paths, input)
    const insights = await getPeriodReviewInsights(paths, detail.period.id)

    return PeriodReviewPayloadSchema.parse({
      ...detail,
      evaluation_rollup: insights.evaluation_rollup,
      feedback_items: insights.feedback_items,
      rule_rollup: insights.rule_rollup,
      setup_leaderboard: insights.setup_leaderboard,
      profile_snapshot: insights.profile_snapshot,
      training_insights: insights.training_insights,
    })
  })
  ipcMain.handle('workbench:get-active-anchors', async(_event, input) => {
    const parsed = GetActiveMarketAnchorsInputSchema.parse(input)
    return toPublicActiveAnchorsPayload(await buildActiveAnchorRuntimeSummary(paths, {
      contract_id: parsed?.contract_id ?? null,
      session_id: parsed?.session_id ?? null,
      trade_id: parsed?.trade_id ?? null,
      status: parsed?.status ?? 'active',
      limit: parsed?.limit ?? 12,
    }))
  })
  ipcMain.handle('workbench:adopt-anchor', async(_event, input) => {
    const parsed = AdoptMarketAnchorInputSchema.parse(input)
    const anchor = await adoptMarketAnchor(paths, parsed)
    return MarketAnchorMutationResultSchema.parse({
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
  })
  ipcMain.handle('workbench:update-anchor-status', async(_event, input) => {
    const parsed = UpdateMarketAnchorStatusInputSchema.parse(input)
    const anchor = await updatePersistedMarketAnchorStatus(paths, parsed)
    return MarketAnchorMutationResultSchema.parse({
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
  })
  ipcMain.handle('workbench:get-groundings', async(_event, input) => {
    const parsed = GetKnowledgeGroundingsInputSchema.parse(input)
    return resolveKnowledgeGroundings(paths, {
      session_id: parsed?.session_id,
      ai_run_id: parsed?.ai_run_id,
      anchor_id: parsed?.anchor_id,
      limit: parsed?.limit,
    })
  })
  ipcMain.handle('workbench:run-annotation-suggestions', async(_event, input) => {
    const parsed = RunAnnotationSuggestionsInputSchema.parse(input)
    const workbench = await getSessionWorkbench(paths, { session_id: parsed.session_id })
    const screenshotId = parsed.screenshot_id ?? workbench.screenshots[0]?.id
    if (!screenshotId) {
      return emptyAnnotationSuggestionPayload()
    }
    const payload = await runAnnotationSuggestions(paths, {
      session_id: parsed.session_id,
      screenshot_id: screenshotId,
      max_items: parsed.limit,
    })
    return toPublicAnnotationSuggestionsPayload(payload, screenshotId)
  })
  ipcMain.handle('workbench:get-composer-suggestions', async(_event, input) => {
    const parsed = GetComposerSuggestionsInputSchema.parse(input)
    return toPublicComposerAiSuggestionsPayload(await listComposerAiSuggestions(paths, {
      session_id: parsed.session_id,
      draft_text: parsed.draft_text,
      selected_anchor_id: parsed.anchor_id ?? null,
      selected_annotation_id: parsed.annotation_id ?? null,
      max_items: parsed.limit,
    }))
  })
  ipcMain.handle('workbench:get-anchor-review-suggestions', async(_event, input) => {
    const parsed = GetAnchorReviewSuggestionsInputSchema.parse(input)
    return toPublicAnchorReviewSuggestionsPayload(await listAnchorReviewSuggestions(paths, {
      session_id: parsed?.session_id ?? null,
      limit: parsed?.limit ?? 6,
    }))
  })
  ipcMain.handle('workbench:get-similar-cases', async(_event, input) => {
    const parsed = GetSimilarCasesInputSchema.parse(input)
    return toPublicSimilarCasePayload(await listSimilarCases(paths, {
      session_id: parsed?.session_id ?? null,
      contract_id: parsed?.contract_id ?? null,
      timeframe_scope: parsed?.timeframe_scope ?? null,
      semantic_tags: parsed?.semantic_tags,
      trade_context: parsed?.trade_context ?? null,
      limit: parsed?.limit ?? 6,
    }))
  })
  ipcMain.handle('workbench:apply-suggestion-action', async(_event, input) => {
    return SuggestionActionResultSchema.parse(await applySuggestionAction(paths, ApplySuggestionActionInputSchema.parse(input)))
  })
  ipcMain.handle('workbench:get-user-profile', async(_event, input) => {
    const parsed = GetUserProfileInputSchema.parse(input)
    return UserProfileSchema.parse(await getUserProfileSnapshot(paths, parsed?.period_id))
  })
  ipcMain.handle('workbench:get-training-insights', async(_event, input) => {
    const parsed = GetTrainingInsightsInputSchema.parse(input)
    return (await getTrainingInsightFeed(paths, parsed?.period_id)).map((item) => TrainingInsightSchema.parse(item))
  })
  ipcMain.handle('workbench:get-ranking-explanations', async(_event, input) => {
    const parsed = GetRankingExplanationsInputSchema.parse(input)
    return RankingExplanationPayloadSchema.parse(await getRankingExplanations(paths, parsed?.session_id))
  })
  ipcMain.handle('workbench:list-memory-proposals', async(_event, input) => {
    const parsed = ListMemoryProposalsInputSchema.parse(input)
    return MemoryProposalPayloadSchema.parse(await listMemoryProposals(paths, parsed?.status))
  })
  ipcMain.handle('workbench:approve-memory-proposal', async(_event, input) => {
    const parsed = ReviewableMemoryActionInputSchema.parse(input)
    return MemoryProposalPayloadSchema.parse(await approveMemoryProposal(paths, parsed.proposal_id))
  })
  ipcMain.handle('workbench:reject-memory-proposal', async(_event, input) => {
    const parsed = ReviewableMemoryActionInputSchema.parse(input)
    return MemoryProposalPayloadSchema.parse(await rejectMemoryProposal(paths, parsed.proposal_id))
  })
  ipcMain.handle('workbench:save-realtime-view', async(_event, input) => {
    const result = await updateSessionRealtimeView(paths, SaveSessionRealtimeViewInputSchema.parse(input))
    return ContentBlockMutationResultSchema.parse({ block: result })
  })
  ipcMain.handle('workbench:delete-content-block', async(_event, input) => {
    const result = await softDeleteContentBlock(paths, SetContentBlockDeletedInputSchema.parse(input))
    return ContentBlockMutationResultSchema.parse({ block: result })
  })
  ipcMain.handle('workbench:restore-content-block', async(_event, input) => {
    const result = await undeleteContentBlock(paths, SetContentBlockDeletedInputSchema.parse(input))
    return ContentBlockMutationResultSchema.parse({ block: result })
  })
  ipcMain.handle('workbench:delete-screenshot', async(_event, input) => {
    const result = await softDeleteScreenshot(paths, SetScreenshotDeletedInputSchema.parse(input))
    return ScreenshotMutationResultSchema.parse({ screenshot: result })
  })
  ipcMain.handle('workbench:restore-screenshot', async(_event, input) => {
    const result = await undeleteScreenshot(paths, SetScreenshotDeletedInputSchema.parse(input))
    return ScreenshotMutationResultSchema.parse({ screenshot: result })
  })
  ipcMain.handle('workbench:delete-annotation', async(_event, input) => {
    const result = await softDeleteAnnotation(paths, SetAnnotationDeletedInputSchema.parse(input))
    return AnnotationMutationResultSchema.parse({ annotation: result })
  })
  ipcMain.handle('workbench:restore-annotation', async(_event, input) => {
    const result = await undeleteAnnotation(paths, SetAnnotationDeletedInputSchema.parse(input))
    return AnnotationMutationResultSchema.parse({ annotation: result })
  })
  ipcMain.handle('workbench:delete-ai-record', async(_event, input) => {
    const result = await softDeleteAiRecord(paths, SetAiRecordDeletedInputSchema.parse(input))
    return AiRecordMutationResultSchema.parse({ ai_record: result })
  })
  ipcMain.handle('workbench:restore-ai-record', async(_event, input) => {
    const result = await undeleteAiRecord(paths, SetAiRecordDeletedInputSchema.parse(input))
    return AiRecordMutationResultSchema.parse({ ai_record: result })
  })
  ipcMain.handle('capture:set-session-context', async(_event, input) => setCaptureSessionContext(input))
  ipcMain.handle('capture:open-snip', async(_event, input) => openSnipCapture(paths, input))
  ipcMain.handle('capture:get-pending-snip', async() => getPendingSnip())
  ipcMain.handle('capture:copy-pending-snip', async(_event, input) => copyPendingSnip(input))
  ipcMain.handle('capture:save-pending-snip', async(_event, input) => savePendingSnip(paths, input))
  ipcMain.handle('capture:cancel-pending-snip', async() => cancelPendingSnip())
  ipcMain.handle('capture:import-image', async(_event, input) => importScreenshotIntoSession(paths, input))
  ipcMain.handle('capture:save-annotations', async(_event, input) => saveScreenshotAnnotations(paths, input))
  ipcMain.handle('ai:list-providers', async() => listAiProviders(paths, env))
  ipcMain.handle('ai:save-provider-config', async(_event, input) => saveAiProviderConfig(paths, env, input))
  ipcMain.handle('ai:run-analysis', async(_event, input) => runAiAnalysis(paths, env, input))
  ipcMain.handle('ai:run-mock-analysis', async(_event, input) => runMockAiAnalysis(paths, input))
  ipcMain.handle('knowledge:get-review-dashboard', async(_event, input) => {
    const parsed = GetKnowledgeReviewDashboardInputSchema.parse(input)
    return toPublicDashboard(paths, parsed ?? undefined)
  })
  ipcMain.handle('knowledge:ingest-source', async(_event, input) => {
    const parsed = IngestKnowledgeSourceInputSchema.parse(input)
    await ingestKnowledgeSource(paths, {
      source_type: parsed.source_type,
      title: parsed.title,
      content_md: parsed.content,
      author: parsed.author ?? null,
      language: 'zh-CN',
      contract_scope: parsed.contract_scope ?? null,
      timeframe_scope: parsed.timeframe_scope ?? null,
      tags: parsed.tags,
      file_path: parsed.file_path ?? null,
      extraction_mode: parsed.import_mode === 'gemini' ? 'gemini' : 'auto',
    })
    return toPublicDashboard(paths)
  })
  ipcMain.handle('knowledge:review-card', async(_event, input) => {
    const parsed = ReviewKnowledgeCardInputSchema.parse(input)
    await reviewKnowledgeDraftCard(paths, {
      knowledge_card_id: parsed.card_id,
      action: parsed.action === 'archive' ? 'archive' : 'approve',
      reviewed_by: parsed.reviewed_by,
      review_note_md: parsed.review_note_md ?? '',
    })
    return toPublicDashboard(paths)
  })
  ipcMain.handle('knowledge:get-approved-runtime', async(_event, input) => {
    const parsed = GetApprovedKnowledgeRuntimeInputSchema.parse(input)
    const runtime = await getApprovedKnowledgeRuntime(paths, parsed ? {
      contract_scope: parsed.contract_scope ?? null,
      timeframe_scope: parsed.timeframe_scope ?? null,
      tags: parsed.tags,
      annotation_semantic: parsed.annotation_semantic ?? null,
      trade_state: parsed.trade_state ?? null,
      context_tags: parsed.context_tags,
      limit: parsed.limit,
    } : undefined)
    return toPublicRuntimePayload(runtime)
  })
  ipcMain.handle('knowledge:get-active-anchors', async(_event, input) => {
    const parsed = GetActiveMarketAnchorsInputSchema.parse(input)
    return toPublicActiveAnchorsPayload(await buildActiveAnchorRuntimeSummary(paths, {
      contract_id: parsed?.contract_id ?? null,
      session_id: parsed?.session_id ?? null,
      trade_id: parsed?.trade_id ?? null,
      status: parsed?.status ?? 'active',
      limit: parsed?.limit ?? 12,
    }))
  })
  ipcMain.handle('knowledge:adopt-anchor', async(_event, input) => {
    const parsed = AdoptMarketAnchorInputSchema.parse(input)
    const anchor = await adoptMarketAnchor(paths, parsed)
    return MarketAnchorMutationResultSchema.parse({
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
  })
  ipcMain.handle('knowledge:update-anchor-status', async(_event, input) => {
    const parsed = UpdateMarketAnchorStatusInputSchema.parse(input)
    const anchor = await updatePersistedMarketAnchorStatus(paths, parsed)
    return MarketAnchorMutationResultSchema.parse({
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
  })
  ipcMain.handle('knowledge:get-groundings', async(_event, input) => {
    const parsed = GetKnowledgeGroundingsInputSchema.parse(input)
    return resolveKnowledgeGroundings(paths, {
      session_id: parsed?.session_id,
      ai_run_id: parsed?.ai_run_id,
      anchor_id: parsed?.anchor_id,
      limit: parsed?.limit,
    })
  })
  ipcMain.handle('export:session-markdown', async(_event, input) => exportSessionMarkdown(paths, input))
}
