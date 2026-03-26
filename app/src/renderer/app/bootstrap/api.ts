import type {
  AlphaNexusApi,
  AiRecordChain,
  ApplySuggestionActionInput,
  AnnotationMutationResult,
  CaptureSessionContextInput,
  GetAnchorReviewSuggestionsInput,
  GetComposerSuggestionsInput,
  GetSimilarCasesInput,
  OpenSnipCaptureInput,
  PendingSnipCapture,
  ScreenshotMutationResult,
  ContentBlockMutationResult,
  PeriodReviewPayload,
  RunAnnotationSuggestionsInput,
  RunAiAnalysisInput,
  SaveSessionRealtimeViewInput,
  SessionWorkbenchPayload,
  SnipCaptureSelectionInput,
  SetAiRecordDeletedInput,
  SetAnnotationDeletedInput,
  SetContentBlockDeletedInput,
  SetScreenshotDeletedInput,
  TradeDetailPayload,
} from '@shared/contracts/workbench'
import type { AiProviderConfig, AiRunExecutionResult } from '@shared/ai/contracts'
import type { CaptureResult } from '@shared/capture/contracts'
import type { ExportSessionMarkdownInput, SessionMarkdownExport } from '@shared/export/contracts'
import type { CreateSessionInput, CreateSessionResult, LauncherHomePayload, LauncherSessionSummary } from '@shared/contracts/launcher'
import type {
  DisciplineScore,
  FeedbackItem,
  MemoryProposalPayload,
  MemoryUpdateProposal,
  PeriodEvaluationRollup,
  RankingExplanationPayload,
  RuleHit,
  SetupLeaderboardEntry,
  TradeEvaluationSummary,
  TrainingInsight,
  UserProfile,
} from '@shared/contracts/evaluation'
import type {
  ActiveMarketAnchorSummary,
  ActiveMarketAnchorsPayload,
  AdoptMarketAnchorInput,
  GetActiveMarketAnchorsInput,
  GetApprovedKnowledgeRuntimeInput,
  GetKnowledgeGroundingsInput,
  GetKnowledgeReviewDashboardInput,
  IngestKnowledgeSourceInput,
  KnowledgeCardPatch,
  KnowledgeCardRecord,
  KnowledgeFragmentRecord,
  KnowledgeGroundingHit,
  KnowledgeGroundingPayload,
  KnowledgeImportJobRecord,
  KnowledgeReviewDashboardPayload,
  KnowledgeReviewRecord,
  KnowledgeRuntimeHit,
  KnowledgeSourceRecord,
  MarketAnchorMutationResult,
  ReviewKnowledgeCardInput,
  UpdateMarketAnchorStatusInput,
} from '@shared/contracts/knowledge'
import { createMockWorkbenchDataset } from '@shared/mock-data/session-workbench'

let mockPayload: SessionWorkbenchPayload = createMockWorkbenchDataset()
let mockSessionPayloads: SessionWorkbenchPayload[] = [mockPayload]
let mockActiveSessionId = mockPayload.session.id
let mockProviders: AiProviderConfig[] = [
  {
    provider: 'deepseek',
    label: 'DeepSeek',
    enabled: true,
    configured: false,
    model: 'deepseek-reasoner',
    base_url: 'https://api.deepseek.com',
    configured_via: 'none',
    secret_storage: 'none',
    supports_base_url_override: true,
    supports_local_api_key: false,
  },
  {
    provider: 'openai',
    label: 'OpenAI',
    enabled: true,
    configured: false,
    model: 'gpt-5.4-mini',
    base_url: null,
    configured_via: 'none',
    secret_storage: 'none',
    supports_base_url_override: false,
    supports_local_api_key: false,
  },
  {
    provider: 'anthropic',
    label: 'Anthropic',
    enabled: true,
    configured: false,
    model: 'claude-sonnet-4.5',
    base_url: null,
    configured_via: 'none',
    secret_storage: 'none',
    supports_base_url_override: false,
    supports_local_api_key: false,
  },
  {
    provider: 'custom-http',
    label: 'OpenAI-compatible',
    enabled: false,
    configured: false,
    model: 'openai-compatible-model',
    base_url: null,
    configured_via: 'none',
    secret_storage: 'none',
    supports_base_url_override: true,
    supports_local_api_key: true,
  },
]
let mockCaptureContext: CaptureSessionContextInput = {
  session_id: null,
  kind: 'chart',
}
let mockPendingSnip: PendingSnipCapture | null = null
const mockCaptureSavedListeners = new Set<(result: CaptureResult) => void>()
const mockBucketLabels: Record<CreateSessionInput['bucket'], string> = {
  am: '上午',
  pm: '下午',
  night: '夜盘',
  custom: '自定义',
}
const mockKnowledgeTimestamp = '2026-03-26T10:00:00+08:00'
const mockMemoryTimestamp = '2026-03-26T10:30:00+08:00'

let mockKnowledgeSources: KnowledgeSourceRecord[] = [
  {
    id: 'knowledge_source_opening_playbook',
    schema_version: 1,
    created_at: mockKnowledgeTimestamp,
    source_type: 'course-note',
    title: '开盘驱动回踩规则',
    author: 'AlphaNexus seed',
    language: 'zh-CN',
    content_md: '重新站上 VWAP 后，如果第一次回踩不破并且主动买盘继续响应，优先按延续处理。\n\n若回踩跌回 VWAP 下方并反抽失败，则延续假设失效。',
    checksum: null,
  },
]
let mockKnowledgeImportJobs: KnowledgeImportJobRecord[] = [
  {
    id: 'knowledge_job_opening_playbook',
    schema_version: 1,
    created_at: mockKnowledgeTimestamp,
    source_id: 'knowledge_source_opening_playbook',
    provider: null,
    model: null,
    job_type: 'manual-ingest',
    status: 'completed',
    input_snapshot_json: '{}',
    output_summary: 'Seed knowledge imported locally.',
    finished_at: mockKnowledgeTimestamp,
  },
]
let mockKnowledgeFragments: KnowledgeFragmentRecord[] = [
  {
    id: 'knowledge_fragment_opening_playbook_1',
    schema_version: 1,
    created_at: mockKnowledgeTimestamp,
    source_id: 'knowledge_source_opening_playbook',
    job_id: 'knowledge_job_opening_playbook',
    sequence_no: 1,
    chapter_label: 'VWAP reclaim',
    page_from: null,
    page_to: null,
    content_md: '重新站上 VWAP 后，如果第一次回踩不破并且主动买盘继续响应，优先按延续处理。',
    tokens_estimate: 26,
  },
  {
    id: 'knowledge_fragment_opening_playbook_2',
    schema_version: 1,
    created_at: mockKnowledgeTimestamp,
    source_id: 'knowledge_source_opening_playbook',
    job_id: 'knowledge_job_opening_playbook',
    sequence_no: 2,
    chapter_label: 'Invalidation',
    page_from: null,
    page_to: null,
    content_md: '若回踩跌回 VWAP 下方并反抽失败，则延续假设失效。',
    tokens_estimate: 18,
  },
]
let mockKnowledgeCards: KnowledgeCardRecord[] = [
  {
    id: 'knowledge_card_vwap_reclaim_approved',
    schema_version: 1,
    created_at: mockKnowledgeTimestamp,
    updated_at: mockKnowledgeTimestamp,
    source_id: 'knowledge_source_opening_playbook',
    fragment_id: 'knowledge_fragment_opening_playbook_1',
    card_type: 'setup',
    title: 'VWAP reclaim continuation',
    summary: '价格重回 VWAP 上方并守住首次回踩后，优先按延续处理。',
    content_md: '等待重新站上 VWAP 后的第一次回踩确认，不追即时扩展。',
    trigger_conditions_md: '- 重回 VWAP 上方\n- 首次回踩不破\n- 买盘继续响应',
    invalidation_md: '重新跌回 VWAP 下方且反抽失败。',
    risk_rule_md: '止损放在回踩低点或 VWAP 下方结构失守处。',
    contract_scope: ['NQ'],
    timeframe_scope: ['5m'],
    tags: ['vwap', 'continuation', 'opening-drive'],
    status: 'approved',
    version: 1,
  },
  {
    id: 'knowledge_card_vwap_invalidation_draft',
    schema_version: 1,
    created_at: mockKnowledgeTimestamp,
    updated_at: mockKnowledgeTimestamp,
    source_id: 'knowledge_source_opening_playbook',
    fragment_id: 'knowledge_fragment_opening_playbook_2',
    card_type: 'invalidation-rule',
    title: 'VWAP reclaim invalidation',
    summary: '如果回踩重新跌回 VWAP 下方且反抽失败，延续前提失效。',
    content_md: '把重新跌回 VWAP 下方并反抽失败视为延续结构破坏。',
    trigger_conditions_md: '- 已出现 reclaim 尝试\n- 回踩重新跌回 VWAP 下方',
    invalidation_md: '反抽无法重新拿回 VWAP。',
    risk_rule_md: '避免在失效条件成立后继续加仓。',
    contract_scope: ['NQ'],
    timeframe_scope: ['5m'],
    tags: ['vwap', 'invalidation'],
    status: 'draft',
    version: 1,
  },
]
let mockKnowledgeReviews: KnowledgeReviewRecord[] = [
  {
    id: 'knowledge_review_seed_1',
    schema_version: 1,
    created_at: mockKnowledgeTimestamp,
    knowledge_card_id: 'knowledge_card_vwap_reclaim_approved',
    review_action: 'approve',
    review_note_md: 'Seed approved card.',
    reviewed_by: 'local-user',
  },
]

const buildKnowledgeRuntimeHit = (card: KnowledgeCardRecord): KnowledgeRuntimeHit => {
  const fragment = mockKnowledgeFragments.find((item) => item.id === card.fragment_id)

  return {
    card_id: card.id,
    title: card.title,
    summary: card.summary,
    card_type: card.card_type,
    tags: card.tags,
    contract_scope: card.contract_scope,
    timeframe_scope: card.timeframe_scope,
    relevance_score: 0.75,
    fragment_excerpt: fragment?.content_md ?? card.content_md,
    match_reasons: [
      card.contract_scope.length > 0 ? `合约命中：${card.contract_scope.join(', ')}` : '通用知识卡',
      card.timeframe_scope.length > 0 ? `周期命中：${card.timeframe_scope.join(', ')}` : '未限制周期',
    ],
  }
}

const buildRuntimeHitFromGrounding = (hit: KnowledgeGroundingHit): KnowledgeRuntimeHit => ({
  card_id: hit.knowledge_card_id,
  title: hit.title,
  summary: hit.summary,
  card_type: hit.card_type,
  relevance_score: hit.relevance_score,
  match_reasons: [hit.match_reason_md],
})

const buildMockKnowledgeDashboard = (_input?: GetKnowledgeReviewDashboardInput): KnowledgeReviewDashboardPayload => {
  const latestReviews = new Map<string, KnowledgeReviewRecord>()
  for (const review of mockKnowledgeReviews) {
    latestReviews.set(review.knowledge_card_id, review)
  }

  const reviewQueue = mockKnowledgeCards
    .filter((card) => card.status === 'draft')
    .map((card) => ({
      card,
      fragment: mockKnowledgeFragments.find((item) => item.id === card.fragment_id) ?? mockKnowledgeFragments[0],
      source: mockKnowledgeSources.find((item) => item.id === card.source_id) ?? mockKnowledgeSources[0],
      latest_review: latestReviews.get(card.id) ?? null,
    }))

  return {
    fragments: mockKnowledgeFragments,
    draft_cards: mockKnowledgeCards.filter((card) => card.status === 'draft'),
    approved_cards: mockKnowledgeCards.filter((card) => card.status === 'approved'),
    stats: {
      source_count: mockKnowledgeSources.length,
      fragment_count: mockKnowledgeFragments.length,
      draft_count: mockKnowledgeCards.filter((card) => card.status === 'draft').length,
      approved_count: mockKnowledgeCards.filter((card) => card.status === 'approved').length,
      archived_count: mockKnowledgeCards.filter((card) => card.status === 'archived').length,
    },
    sources: mockKnowledgeSources,
    import_jobs: mockKnowledgeImportJobs,
    review_queue: reviewQueue,
  }
}

const applyKnowledgeCardPatch = (card: KnowledgeCardRecord, patch?: KnowledgeCardPatch): KnowledgeCardRecord =>
  patch ? { ...card, ...patch } : card

const ingestMockKnowledgeSource = (input: IngestKnowledgeSourceInput): KnowledgeReviewDashboardPayload => {
  const timestamp = new Date().toISOString()
  const sourceId = `knowledge_source_${mockKnowledgeSources.length + 1}`
  const jobId = `knowledge_job_${mockKnowledgeImportJobs.length + 1}`
  const rawFragments = input.content
    .split(/\n\s*\n/)
    .map((fragment) => fragment.trim())
    .filter(Boolean)
  const source: KnowledgeSourceRecord = {
    id: sourceId,
    schema_version: 1,
    created_at: timestamp,
    source_type: input.source_type,
    title: input.title,
    author: input.author ?? null,
    language: null,
    content_md: input.content,
    checksum: null,
  }
  const importJob: KnowledgeImportJobRecord = {
    id: jobId,
    schema_version: 1,
    created_at: timestamp,
    source_id: sourceId,
    provider: null,
    model: null,
    job_type: 'manual-ingest',
    status: 'completed',
    input_snapshot_json: JSON.stringify({ source_type: input.source_type, title: input.title }),
    output_summary: `Imported ${rawFragments.length} fragment(s).`,
    finished_at: timestamp,
  }
  const fragments = rawFragments.map((fragment, index) => ({
    id: `knowledge_fragment_${mockKnowledgeFragments.length + index + 1}`,
    schema_version: 1 as const,
    created_at: timestamp,
    source_id: sourceId,
    job_id: jobId,
    sequence_no: index + 1,
    chapter_label: `Fragment ${index + 1}`,
    page_from: null,
    page_to: null,
    content_md: fragment,
    tokens_estimate: fragment.length,
  }))
  const draftCards = fragments.map((fragment, index) => ({
    id: `knowledge_card_${mockKnowledgeCards.length + index + 1}`,
    schema_version: 1 as const,
    created_at: timestamp,
    updated_at: timestamp,
    source_id: sourceId,
    fragment_id: fragment.id,
    card_type: 'concept' as const,
    title: `${input.title} · Fragment ${index + 1}`,
    summary: fragment.content_md.slice(0, 96),
    content_md: fragment.content_md,
    trigger_conditions_md: '',
    invalidation_md: '',
    risk_rule_md: '',
    contract_scope: [],
    timeframe_scope: [],
    tags: [input.source_type],
    status: 'draft' as const,
    version: 1,
  }))

  mockKnowledgeSources = [source, ...mockKnowledgeSources]
  mockKnowledgeImportJobs = [importJob, ...mockKnowledgeImportJobs]
  mockKnowledgeFragments = [...fragments, ...mockKnowledgeFragments]
  mockKnowledgeCards = [...draftCards, ...mockKnowledgeCards]

  return buildMockKnowledgeDashboard()
}

const reviewMockKnowledgeCard = (input: ReviewKnowledgeCardInput): KnowledgeReviewDashboardPayload => {
  const target = mockKnowledgeCards.find((card) => card.id === input.card_id)
  if (!target) {
    throw new Error(`Missing knowledge card ${input.card_id}.`)
  }

  const timestamp = new Date().toISOString()
  const nextStatus = input.action === 'archive' ? 'archived' as const : 'approved' as const
  const nextCard = {
    ...applyKnowledgeCardPatch(target, input.edit_payload),
    status: nextStatus,
    updated_at: timestamp,
  }
  const review: KnowledgeReviewRecord = {
    id: `knowledge_review_${mockKnowledgeReviews.length + 1}`,
    schema_version: 1,
    created_at: timestamp,
    knowledge_card_id: target.id,
    review_action: input.action,
    review_note_md: input.review_note_md ?? '',
    reviewed_by: input.reviewed_by,
  }

  mockKnowledgeCards = mockKnowledgeCards.map((card) => card.id === target.id ? nextCard : card)
  mockKnowledgeReviews = [review, ...mockKnowledgeReviews]

  return buildMockKnowledgeDashboard()
}

const getMockApprovedRuntime = (input?: GetApprovedKnowledgeRuntimeInput) => {
  const requestedSymbol = input?.contract_scope
  const timeframeFilter = input?.timeframe_scope ? [input.timeframe_scope] : []
  const tagFilter = input?.tags ?? []

  const hits = mockKnowledgeCards
    .filter((card) => card.status === 'approved')
    .filter((card) => {
      if (requestedSymbol && card.contract_scope.length > 0 && !card.contract_scope.includes(requestedSymbol)) {
        return false
      }
      if (timeframeFilter.length > 0 && card.timeframe_scope.length > 0 && !timeframeFilter.some((scope) => card.timeframe_scope.includes(scope))) {
        return false
      }
      if (tagFilter.length > 0 && !tagFilter.some((tag) => card.tags.includes(tag))) {
        return false
      }
      return true
    })
    .slice(0, input?.limit ?? 6)
    .map(buildKnowledgeRuntimeHit)

  return { hits }
}

const buildMockComposerShell = (payload: SessionWorkbenchPayload): SessionWorkbenchPayload['composer_shell'] => {
  const runtime = getMockApprovedRuntime({
    contract_scope: payload.contract.symbol,
    limit: 4,
  })
  const activeAnchors = payload.context_memory.active_anchors
  const groundingHits = payload.context_memory.latest_grounding_hits.map(buildRuntimeHitFromGrounding)
  const approvedKnowledgeHits = groundingHits.length > 0 ? groundingHits : runtime.hits

  return {
    context_summary: `当前 Session 绑定 ${payload.contract.symbol}，Composer 只消费 approved knowledge，并叠加 active anchor 上下文。`,
    active_anchor_labels: activeAnchors.map((anchor) => anchor.title),
    active_anchors: activeAnchors,
    approved_knowledge_hits: approvedKnowledgeHits,
    suggestions: approvedKnowledgeHits.flatMap((hit, index) => ([
      {
        id: `composer_phrase_${index + 1}`,
        type: 'phrase' as const,
        label: hit.title,
        text: `${hit.title}: ${hit.summary}`,
        source: 'knowledge' as const,
        knowledge_card_id: hit.card_id,
      },
      {
        id: `composer_template_${index + 1}`,
        type: 'template' as const,
        label: `结构化模板 ${index + 1}`,
        text: '观点：\n关键区域：\n触发条件：\n失效条件：\n执行计划：',
        source: 'rule' as const,
      },
    ])).slice(0, 6),
  }
}

const resolveMockOutcome = (payload: SessionWorkbenchPayload) => {
  const trade = payload.trades[0]
  if (!trade) {
    return {
      trade_id: null,
      outcome_direction: 'unknown' as const,
      pnl_r: null,
      status: 'insufficient' as const,
      summary: '当前没有足够的 trade outcome。',
    }
  }
  if (trade.status !== 'closed' || trade.pnl_r === null) {
    return {
      trade_id: trade.id,
      outcome_direction: 'unknown' as const,
      pnl_r: trade.pnl_r,
      status: trade.status === 'planned' ? 'insufficient' as const : 'pending' as const,
      summary: trade.status === 'planned' ? '交易尚未进入可评估阶段。' : '交易尚未闭环，结果仍待观察。',
    }
  }
  if (trade.pnl_r > 0) {
    return {
      trade_id: trade.id,
      outcome_direction: trade.side === 'long' ? 'up' as const : 'down' as const,
      pnl_r: trade.pnl_r,
      status: 'resolved' as const,
      summary: `本笔交易已闭环，盈利 ${trade.pnl_r}R。`,
    }
  }
  if (trade.pnl_r < 0) {
    return {
      trade_id: trade.id,
      outcome_direction: trade.side === 'long' ? 'down' as const : 'up' as const,
      pnl_r: trade.pnl_r,
      status: 'resolved' as const,
      summary: `本笔交易已闭环，亏损 ${trade.pnl_r}R。`,
    }
  }
  return {
    trade_id: trade.id,
    outcome_direction: 'range' as const,
    pnl_r: trade.pnl_r,
    status: 'resolved' as const,
    summary: '本笔交易以打平收场。',
  }
}

const verdictFromBias = (
  bias: 'bullish' | 'bearish' | 'range' | 'neutral' | null,
  outcome: ReturnType<typeof resolveMockOutcome>,
) => {
  if (!bias) {
    return outcome.status === 'resolved' ? 'insufficient' as const : outcome.status
  }
  if (outcome.status !== 'resolved') {
    return outcome.status
  }
  if (bias === 'neutral') {
    return outcome.outcome_direction === 'range' ? 'correct' as const : 'partially-correct' as const
  }
  if (bias === 'range') {
    return outcome.outcome_direction === 'range' ? 'correct' as const : 'incorrect' as const
  }
  if (bias === 'bullish') {
    return outcome.outcome_direction === 'up' ? 'correct' as const : outcome.outcome_direction === 'range' ? 'partially-correct' as const : 'incorrect' as const
  }
  return outcome.outcome_direction === 'down' ? 'correct' as const : outcome.outcome_direction === 'range' ? 'partially-correct' as const : 'incorrect' as const
}

const buildMockTradeEvaluationSummary = (payload: SessionWorkbenchPayload): TradeEvaluationSummary | null => {
  const trade = payload.trades[0]
  if (!trade) {
    return null
  }

  const outcome = resolveMockOutcome(payload)
  const latestCard = payload.analysis_cards[payload.analysis_cards.length - 1] ?? null
  const ai_judgment = latestCard ? {
    source: 'ai' as const,
    bias: latestCard.bias,
    confidence_pct: latestCard.confidence_pct,
    verdict: verdictFromBias(latestCard.bias, outcome),
    reason_summary: outcome.status === 'resolved'
      ? `AI bias ${latestCard.bias} 与最终结果 ${outcome.outcome_direction} 对比。`
      : outcome.summary,
  } : null
  const human_judgment = {
    source: 'human' as const,
    bias: payload.session.market_bias,
    confidence_pct: null,
    verdict: verdictFromBias(payload.session.market_bias, outcome),
    reason_summary: outcome.status === 'resolved'
      ? `Human bias ${payload.session.market_bias} 与最终结果 ${outcome.outcome_direction} 对比。`
      : outcome.summary,
  }

  return {
    ai_judgment,
    human_judgment,
    outcome,
    plan_adherence_pct: payload.evaluations[0]?.score ?? null,
    disagreement_summary: ai_judgment && ai_judgment.bias !== human_judgment.bias
      ? `AI=${ai_judgment.bias}，Human=${human_judgment.bias}。`
      : null,
  }
}

const buildMockTradeFeedbackBundle = (payload: SessionWorkbenchPayload): {
  feedback_items: FeedbackItem[]
  discipline_score: DisciplineScore | null
  rule_hits: RuleHit[]
} => {
  const trade = payload.trades[0]
  if (!trade) {
    return {
      feedback_items: [],
      discipline_score: null,
      rule_hits: [],
    }
  }

  const evaluation = payload.evaluations[0] ?? null
  const summary = buildMockTradeEvaluationSummary(payload)
  const evidence = [
    trade.thesis || '无明确 thesis。',
    evaluation?.note_md ?? '无人工评估记录。',
  ]

  const feedback_items: FeedbackItem[] = []
  if (summary?.human_judgment?.verdict === 'incorrect') {
    feedback_items.push({
      id: `feedback_${trade.id}_setup`,
      type: 'setup-selection',
      title: '重新校验 setup 选择',
      summary: '当前 setup 与最终 outcome 偏离，下一次先等确认再入场。',
      priority: 'high',
      evidence,
    })
  }
  if ((trade.pnl_r ?? 0) < 0) {
    feedback_items.push({
      id: `feedback_${trade.id}_risk`,
      type: 'risk',
      title: '优先收紧风险边界',
      summary: '本笔结果为负，建议复核止损与失效条件是否提前写清。',
      priority: 'medium',
      evidence,
    })
  }
  if (feedback_items.length === 0) {
    feedback_items.push({
      id: `feedback_${trade.id}_execution`,
      type: 'execution',
      title: '维持当前执行节奏',
      summary: '这笔交易没有明显额外纪律告警，保持结构化记录。',
      priority: 'low',
      evidence,
    })
  }

  const dimensions = [
    {
      id: 'plan-respect',
      label: '按计划执行',
      score_pct: evaluation?.score ?? 72,
      summary: '基于 trade evaluation score 估算计划遵守度。',
      evidence,
    },
    {
      id: 'risk-boundary',
      label: '风险边界',
      score_pct: (trade.pnl_r ?? 0) < 0 ? 58 : 78,
      summary: '结合 pnl_r 与 stop / target 结构给出透明打分。',
      evidence: [
        `pnl_r=${trade.pnl_r ?? 'pending'}`,
        `stop_loss=${trade.stop_loss}`,
        `take_profit=${trade.take_profit}`,
      ],
    },
  ]

  return {
    feedback_items,
    discipline_score: {
      overall_pct: Math.round(dimensions.reduce((sum, item) => sum + item.score_pct, 0) / dimensions.length),
      summary: '纪律分基于计划遵守度与风险边界两条透明规则计算。',
      dimensions,
    },
    rule_hits: [
      {
        id: `rule_hit_${trade.id}_stop`,
        rule_id: 'respect-stop',
        label: '按计划止损',
        severity: 'warning',
        matched: trade.stop_loss > 0,
        reason: 'Trade record 存在明确 stop_loss。',
        evidence: [`stop_loss=${trade.stop_loss}`],
      },
      {
        id: `rule_hit_${trade.id}_overtrade`,
        rule_id: 'avoid-overtrade',
        label: '避免过度交易',
        severity: 'info',
        matched: payload.events.filter((event) => event.trade_id === trade.id).length <= 6,
        reason: '以当前 trade 关联事件数量作为轻量代理信号。',
        evidence: [`related_events=${payload.events.filter((event) => event.trade_id === trade.id).length}`],
      },
    ],
  }
}

const average = (values: number[]) => values.length > 0
  ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2))
  : null

const buildMockPeriodEvaluationRollup = (): PeriodEvaluationRollup => {
  const tradeSummaries = mockSessionPayloads
    .map((payload) => buildMockTradeEvaluationSummary(payload))
    .filter((item): item is NonNullable<typeof item> => item !== null)

  const calibration_buckets: PeriodEvaluationRollup['calibration_buckets'] = [
    { id: 'bucket_0_40', label: '0-40', confidence_min: 0, confidence_max: 40, sample_count: 0, resolved_count: 0, hit_rate_pct: null, avg_confidence_pct: 20, calibration_gap_pct: null, status: 'sparse' },
    { id: 'bucket_41_60', label: '41-60', confidence_min: 41, confidence_max: 60, sample_count: 0, resolved_count: 0, hit_rate_pct: null, avg_confidence_pct: 50, calibration_gap_pct: null, status: 'sparse' },
    { id: 'bucket_61_75', label: '61-75', confidence_min: 61, confidence_max: 75, sample_count: 0, resolved_count: 0, hit_rate_pct: null, avg_confidence_pct: 68, calibration_gap_pct: null, status: 'sparse' },
    { id: 'bucket_76_90', label: '76-90', confidence_min: 76, confidence_max: 90, sample_count: 0, resolved_count: 0, hit_rate_pct: null, avg_confidence_pct: 83, calibration_gap_pct: null, status: 'sparse' },
    { id: 'bucket_91_100', label: '91-100', confidence_min: 91, confidence_max: 100, sample_count: 0, resolved_count: 0, hit_rate_pct: null, avg_confidence_pct: 96, calibration_gap_pct: null, status: 'sparse' },
  ]

  for (const summary of tradeSummaries) {
    const confidence = summary.ai_judgment?.confidence_pct
    if (confidence === null || confidence === undefined) {
      continue
    }
    const bucket = calibration_buckets.find((item) => confidence >= item.confidence_min && confidence <= item.confidence_max)
    if (!bucket) {
      continue
    }
    bucket.sample_count += 1
    bucket.avg_confidence_pct = Math.round(((bucket.avg_confidence_pct * (bucket.sample_count - 1)) + confidence) / bucket.sample_count)
    if (summary.outcome.status === 'resolved') {
      bucket.resolved_count += 1
      const hit = summary.ai_judgment?.verdict === 'correct' ? 100 : summary.ai_judgment?.verdict === 'partially-correct' ? 50 : 0
      bucket.hit_rate_pct = bucket.hit_rate_pct === null
        ? hit
        : Math.round(((bucket.hit_rate_pct * (bucket.resolved_count - 1)) + hit) / bucket.resolved_count)
      bucket.calibration_gap_pct = bucket.hit_rate_pct === null ? null : bucket.avg_confidence_pct - bucket.hit_rate_pct
      bucket.status = 'ok'
    } else {
      bucket.status = 'pending'
    }
  }

  const aiScores = tradeSummaries
    .flatMap((summary) => {
      const score = summary.ai_judgment?.verdict === 'correct'
        ? 1
        : summary.ai_judgment?.verdict === 'partially-correct'
          ? 0.5
          : summary.ai_judgment?.verdict === 'incorrect'
            ? 0
            : null
      return score === null ? [] : [score]
    })
  const humanScores = tradeSummaries
    .flatMap((summary) => {
      const score = summary.human_judgment?.verdict === 'correct'
        ? 1
        : summary.human_judgment?.verdict === 'partially-correct'
          ? 0.5
          : summary.human_judgment?.verdict === 'incorrect'
            ? 0
            : null
      return score === null ? [] : [score]
    })
  const planScores = mockSessionPayloads
    .flatMap((payload) => payload.evaluations)
    .map((evaluation) => evaluation.score / 100)

  const aiAverage = aiScores.length > 0 ? Math.round((aiScores.reduce((sum, value) => sum + value, 0) / aiScores.length) * 100) : null
  const humanAverage = humanScores.length > 0 ? Math.round((humanScores.reduce((sum, value) => sum + value, 0) / humanScores.length) * 100) : null
  const planAverage = planScores.length > 0 ? Math.round((planScores.reduce((sum, value) => sum + value, 0) / planScores.length) * 100) : null

  const ai_vs_human: PeriodEvaluationRollup['ai_vs_human'] = [
    {
      id: 'direction_hit',
      label: '方向判断命中率',
      ai_value_pct: aiAverage,
      human_value_pct: humanAverage,
      delta_pct: aiAverage !== null && humanAverage !== null ? aiAverage - humanAverage : null,
      sample_count: tradeSummaries.length,
    },
    {
      id: 'plan_adherence',
      label: '计划遵守度',
      ai_value_pct: aiAverage,
      human_value_pct: planAverage,
      delta_pct: aiAverage !== null && planAverage !== null ? aiAverage - planAverage : null,
      sample_count: planScores.length,
    },
  ]

  const error_patterns: PeriodEvaluationRollup['error_patterns'] = mockSessionPayloads
    .flatMap((payload) => payload.evaluations)
    .filter((evaluation) => evaluation.note_md.toLowerCase().includes('风险') || evaluation.note_md.includes('回踩'))
    .slice(0, 3)
    .map((evaluation, index) => ({
      id: `error_pattern_${index + 1}`,
      label: index === 0 ? '回踩确认不足' : '风险边界需要更清晰',
      count: 1,
      summary: evaluation.note_md,
    }))

  const effectiveMap = new Map<string, { title: string, hit_count: number, total: number }>()
  for (const hit of mockSessionPayloads.flatMap((payload) => payload.context_memory.latest_grounding_hits)) {
    const current = effectiveMap.get(hit.knowledge_card_id) ?? {
      title: hit.title,
      hit_count: 0,
      total: 0,
    }
    current.hit_count += 1
    current.total += Math.round(hit.relevance_score * 100)
    effectiveMap.set(hit.knowledge_card_id, current)
  }
  const effective_knowledge: PeriodEvaluationRollup['effective_knowledge'] = [...effectiveMap.entries()].map(([card_id, item]) => ({
    card_id,
    title: item.title,
    hit_count: item.hit_count,
    quality_score_pct: Math.round(item.total / item.hit_count),
  }))

  return {
    calibration_buckets,
    ai_vs_human,
    error_patterns,
    effective_knowledge,
    pending_count: tradeSummaries.filter((summary) => summary.outcome.status !== 'resolved').length,
    evaluated_count: tradeSummaries.filter((summary) => summary.outcome.status === 'resolved').length,
  }
}

const buildMockSetupLeaderboard = (): SetupLeaderboardEntry[] => {
  const periodRollup = buildMockPeriodEvaluationRollup()
  const setupMap = new Map<string, Array<{ pnl_r: number | null, score: number | null }>>()
  for (const payload of mockSessionPayloads) {
    const setup = payload.session.tags[0] ?? 'untagged'
    const trade = payload.trades[0] ?? null
    const evaluation = payload.evaluations[0] ?? null
    const list = setupMap.get(setup) ?? []
    list.push({
      pnl_r: trade?.pnl_r ?? null,
      score: evaluation?.score ?? null,
    })
    setupMap.set(setup, list)
  }

  return [...setupMap.entries()]
    .map(([label, items]) => {
      const pnlValues = items.map((item) => item.pnl_r).filter((item): item is number => item !== null)
      return {
        id: `setup_${label}`,
        label,
        sample_count: items.length,
        win_rate_pct: pnlValues.length > 0
          ? Math.round((pnlValues.filter((item) => item > 0).length / pnlValues.length) * 100)
          : null,
        avg_r: average(pnlValues),
        discipline_avg_pct: average(items.map((item) => item.score).filter((item): item is number => item !== null)),
        ai_alignment_pct: periodRollup.ai_vs_human[0]?.ai_value_pct ?? null,
      }
    })
    .sort((left, right) => right.sample_count - left.sample_count)
}

const buildMockPeriodFeedbackItems = (): FeedbackItem[] => {
  const rollup = buildMockPeriodEvaluationRollup()
  const items: FeedbackItem[] = rollup.error_patterns.slice(0, 3).map((pattern, index) => ({
    id: `period_feedback_${index + 1}`,
    type: 'discipline',
    title: pattern.label,
    summary: pattern.summary,
    priority: index === 0 ? 'high' : 'medium',
    evidence: [pattern.label, `count=${pattern.count}`],
  }))
  return items.length > 0 ? items : [{
    id: 'period_feedback_default',
    type: 'execution',
    title: '保持轻量复盘节奏',
    summary: '当前周期没有突出的纪律错误模式，继续沿用结构化复盘。',
    priority: 'low',
    evidence: [mockPayload.period.label],
  }]
}

const buildMockRuleRollup = () => {
  const tradeBundles = mockSessionPayloads
    .map((payload) => buildMockTradeFeedbackBundle(payload))
    .flatMap((bundle) => bundle.rule_hits)
  const grouped = new Map<string, RuleHit[]>()
  for (const hit of tradeBundles) {
    const list = grouped.get(hit.rule_id) ?? []
    list.push(hit)
    grouped.set(hit.rule_id, list)
  }

  return [...grouped.entries()].map(([ruleId, hits]) => {
    const first = hits[0]
    const matchCount = hits.filter((hit) => hit.matched).length
    const totalCount = hits.length
    const matchRate = totalCount > 0 ? Math.round((matchCount / totalCount) * 100) : null
    return {
      id: `rule_rollup_${ruleId}`,
      rule_id: ruleId,
      label: first.label,
      severity: first.severity,
      match_count: matchCount,
      total_count: totalCount,
      match_rate_pct: matchRate,
      summary: matchRate === null
        ? '当前没有足够样本。'
        : matchRate >= 70
          ? '当前周期对这条规则执行相对稳定。'
          : matchRate >= 50
            ? '这条规则执行有波动，建议继续观察。'
            : '这条规则执行偏弱，建议优先复核。',
      evidence: [
        `matched=${matchCount}/${totalCount}`,
        ...hits.flatMap((hit) => hit.evidence).slice(0, 3),
      ],
    }
  }).sort((left, right) => (left.match_rate_pct ?? -1) - (right.match_rate_pct ?? -1))
}

const buildMockUserProfile = (): UserProfile => {
  const rollup = buildMockPeriodEvaluationRollup()
  const leaderboard = buildMockSetupLeaderboard()
  const strongest = leaderboard[0]
  const weakest = rollup.error_patterns[0]

  return {
    strengths: strongest ? [{
      id: 'profile_strength_setup',
      label: `强项 setup: ${strongest.label}`,
      count: strongest.sample_count,
      summary: `样本 ${strongest.sample_count}，avg R ${strongest.avg_r ?? 'pending'}。`,
    }] : [],
    weaknesses: weakest ? [weakest] : [],
    execution_style: [{
      id: 'profile_execution_style',
      label: '执行风格',
      count: rollup.evaluated_count,
      summary: rollup.ai_vs_human[0]?.human_value_pct !== null
        ? `人工方向命中率 ${rollup.ai_vs_human[0]?.human_value_pct}% ，当前偏结构化执行。`
        : '样本仍少，执行风格先按中性处理。',
    }],
    ai_collaboration: [{
      id: 'profile_ai_collab',
      label: 'AI 协同倾向',
      count: rollup.ai_vs_human[0]?.sample_count ?? 0,
      summary: rollup.ai_vs_human[0]?.ai_value_pct !== null
        ? `AI 方向命中率 ${rollup.ai_vs_human[0]?.ai_value_pct}%，当前建议继续保留 AI 作为辅助层。`
        : 'AI 协同样本不足。',
    }],
  }
}

const buildMockTrainingInsights = (): TrainingInsight[] => {
  const feedbackItems = buildMockPeriodFeedbackItems()
  const insights: TrainingInsight[] = feedbackItems.slice(0, 3).map((item, index) => ({
    id: `training_insight_${index + 1}`,
    title: item.title,
    summary: item.summary,
    priority: item.priority,
    evidence: item.evidence,
  }))
  const rollup = buildMockPeriodEvaluationRollup()
  if (rollup.calibration_buckets.some((bucket) => bucket.calibration_gap_pct !== null && Math.abs(bucket.calibration_gap_pct) > 15)) {
    insights.unshift({
      id: 'training_calibration',
      title: '校准 AI 置信度',
      summary: '部分 confidence bucket 与真实命中率偏差较大，下一轮优先校准高置信度输出。',
      priority: 'high',
      evidence: rollup.calibration_buckets
        .filter((bucket) => bucket.calibration_gap_pct !== null)
        .map((bucket) => `${bucket.label}: gap=${bucket.calibration_gap_pct}`),
    })
  }
  return insights.slice(0, 5)
}

const buildMockRankingExplanations = (): RankingExplanationPayload => ({
  explanations: [
    {
      id: 'ranking_composer',
      target_id: 'composer-default',
      target_kind: 'composer',
      reason_summary: 'Composer suggestions 优先按当前上下文相关度、approved knowledge 命中和风险控制价值排序。',
      factors: ['当前 session tags', 'approved knowledge 命中', '风险控制优先'],
    },
    {
      id: 'ranking_feedback',
      target_id: buildMockTrainingInsights()[0]?.id ?? 'feedback-default',
      target_kind: 'feedback',
      reason_summary: '反馈建议优先展示高优先级、证据最集中的条目。',
      factors: buildMockTrainingInsights()[0]?.evidence.slice(0, 3) ?? ['evaluation summary'],
    },
    {
      id: 'ranking_rule_warning',
      target_id: 'rule-warning-default',
      target_kind: 'rule-warning',
      reason_summary: '规则告警优先展示与当前 trade 风险边界最相关的命中。',
      factors: ['纪律分偏低', '风险边界命中', '近期错误模式'],
    },
  ],
})

let mockMemoryProposals: MemoryUpdateProposal[] = [
  {
    id: 'memory_proposal_mistake_pattern',
    proposal_type: 'mistake-pattern',
    title: '强化常见错误模式记忆',
    summary: '近期回踩确认不足反复出现，建议把该模式回灌为长期提醒。',
    evidence: ['回踩确认不足', '训练建议优先级高'],
    status: 'pending',
    created_at: mockMemoryTimestamp,
    reviewed_at: null,
  },
  {
    id: 'memory_proposal_rule_adjust',
    proposal_type: 'rule-adjust',
    title: '调整风险边界规则优先级',
    summary: '纪律反馈持续指向风险边界表达不够清晰，建议调整规则提醒顺序。',
    evidence: ['risk boundary', 'discipline feedback'],
    status: 'pending',
    created_at: mockMemoryTimestamp,
    reviewed_at: null,
  },
]

const listMockMemoryProposals = (status?: MemoryUpdateProposal['status']): MemoryProposalPayload => ({
  proposals: mockMemoryProposals
    .filter((proposal) => !status || proposal.status === status)
    .sort((left, right) => right.created_at.localeCompare(left.created_at)),
})

const reviewMockMemoryProposal = (
  proposalId: string,
  status: MemoryUpdateProposal['status'],
): MemoryProposalPayload => {
  mockMemoryProposals = mockMemoryProposals.map((proposal) => proposal.id === proposalId
    ? {
      ...proposal,
      status,
      reviewed_at: new Date().toISOString(),
    }
    : proposal)
  return listMockMemoryProposals()
}

const hydrateMockPayload = (payload: SessionWorkbenchPayload): SessionWorkbenchPayload => ({
  ...payload,
  composer_shell: buildMockComposerShell(payload),
})

const syncMockSessionPayload = (payload: SessionWorkbenchPayload) => {
  const nextPayload = hydrateMockPayload(payload)
  const nextSessions = mockSessionPayloads.some((item) => item.session.id === nextPayload.session.id)
    ? mockSessionPayloads.map((item) => item.session.id === nextPayload.session.id ? nextPayload : item)
    : [nextPayload, ...mockSessionPayloads]

  mockSessionPayloads = nextSessions
  if (mockActiveSessionId === nextPayload.session.id || mockPayload.session.id === nextPayload.session.id) {
    mockPayload = nextPayload
  }

  return nextPayload
}

const getMockPayload = (sessionId?: string) => {
  const target = sessionId
    ? mockSessionPayloads.find((payload) => payload.session.id === sessionId) ?? mockPayload
    : mockSessionPayloads.find((payload) => payload.session.id === mockActiveSessionId)
      ?? mockSessionPayloads[0]
      ?? mockPayload

  return hydrateMockPayload(target)
}

const updateMockSessionPayload = (
  sessionId: string,
  updater: (payload: SessionWorkbenchPayload) => SessionWorkbenchPayload,
) => syncMockSessionPayload(updater(getMockPayload(sessionId)))

const findMockSessionByScreenshotId = (screenshotId: string) =>
  mockSessionPayloads.find((payload) =>
    payload.screenshots.some((screenshot) => screenshot.id === screenshotId)
    || payload.deleted_screenshots.some((screenshot) => screenshot.id === screenshotId))

const findMockSessionByAnnotationId = (annotationId: string) =>
  mockSessionPayloads.find((payload) =>
    [...payload.screenshots, ...payload.deleted_screenshots].some((screenshot) =>
      screenshot.annotations.some((annotation) => annotation.id === annotationId)
      || screenshot.deleted_annotations.some((annotation) => annotation.id === annotationId)))

const findMockSessionByAiRunId = (aiRunId: string) =>
  mockSessionPayloads.find((payload) =>
    payload.ai_runs.some((run) => run.id === aiRunId)
    || payload.deleted_ai_records.some((record) => record.ai_run.id === aiRunId))

const mutateMockScreenshotDeleteState = (
  input: SetScreenshotDeletedInput,
  deleted: boolean,
): ScreenshotMutationResult => {
  const targetPayload = findMockSessionByScreenshotId(input.screenshot_id)
  if (!targetPayload) {
    throw new Error(`Missing mock screenshot ${input.screenshot_id}.`)
  }

  const timestamp = new Date().toISOString()
  let resultScreenshot: ScreenshotMutationResult['screenshot'] | null = null

  updateMockSessionPayload(targetPayload.session.id, (payload) => {
    const source = deleted ? payload.screenshots : payload.deleted_screenshots
    const target = source.find((screenshot) => screenshot.id === input.screenshot_id)
    if (!target) {
      throw new Error(`Missing mock screenshot ${input.screenshot_id}.`)
    }

    const nextScreenshot = {
      ...target,
      deleted_at: deleted ? timestamp : null,
    }
    resultScreenshot = nextScreenshot

    return {
      ...payload,
      screenshots: deleted
        ? payload.screenshots.filter((screenshot) => screenshot.id !== target.id)
        : [...payload.screenshots, nextScreenshot],
      deleted_screenshots: deleted
        ? [...payload.deleted_screenshots, nextScreenshot]
        : payload.deleted_screenshots.filter((screenshot) => screenshot.id !== target.id),
    }
  })

  if (!resultScreenshot) {
    throw new Error(`Missing mock screenshot ${input.screenshot_id}.`)
  }

  return { screenshot: resultScreenshot }
}

const mutateMockAnnotationDeleteState = (
  input: SetAnnotationDeletedInput,
  deleted: boolean,
): AnnotationMutationResult => {
  const targetPayload = findMockSessionByAnnotationId(input.annotation_id)
  if (!targetPayload) {
    throw new Error(`Missing mock annotation ${input.annotation_id}.`)
  }

  const timestamp = new Date().toISOString()
  let resultAnnotation: AnnotationMutationResult['annotation'] | null = null

  updateMockSessionPayload(targetPayload.session.id, (payload) => {
    const updateScreenshot = (screenshot: SessionWorkbenchPayload['screenshots'][number]) => {
      const activeAnnotation = screenshot.annotations.find((annotation) => annotation.id === input.annotation_id)
      const deletedAnnotation = screenshot.deleted_annotations.find((annotation) => annotation.id === input.annotation_id)
      const target = deleted ? activeAnnotation : deletedAnnotation
      if (!target) {
        return screenshot
      }

      const nextAnnotation = {
        ...target,
        deleted_at: deleted ? timestamp : null,
      }
      resultAnnotation = nextAnnotation

      return {
        ...screenshot,
        annotations: deleted
          ? screenshot.annotations.filter((annotation) => annotation.id !== input.annotation_id)
          : [...screenshot.annotations, nextAnnotation],
        deleted_annotations: deleted
          ? [...screenshot.deleted_annotations, nextAnnotation]
          : screenshot.deleted_annotations.filter((annotation) => annotation.id !== input.annotation_id),
      }
    }

    return {
      ...payload,
      screenshots: payload.screenshots.map(updateScreenshot),
      deleted_screenshots: payload.deleted_screenshots.map(updateScreenshot),
    }
  })

  if (!resultAnnotation) {
    throw new Error(`Missing mock annotation ${input.annotation_id}.`)
  }

  return { annotation: resultAnnotation }
}

const mutateMockAiRecordDeleteState = (
  input: SetAiRecordDeletedInput,
  deleted: boolean,
): { ai_record: AiRecordChain } => {
  const targetPayload = findMockSessionByAiRunId(input.ai_run_id)
  if (!targetPayload) {
    throw new Error(`Missing mock ai run ${input.ai_run_id}.`)
  }

  let resultRecord: AiRecordChain | null = null

  updateMockSessionPayload(targetPayload.session.id, (payload) => {
    if (deleted) {
      const aiRun = payload.ai_runs.find((run) => run.id === input.ai_run_id)
      if (!aiRun) {
        throw new Error(`Missing mock ai run ${input.ai_run_id}.`)
      }
      const analysisCard = payload.analysis_cards.find((card) => card.ai_run_id === input.ai_run_id) ?? null
      const event = payload.events.find((item) => item.ai_run_id === input.ai_run_id) ?? null
      const contentBlock = payload.content_blocks.find((block) => block.event_id === event?.id) ?? null
      resultRecord = {
        ai_run: { ...aiRun, deleted_at: new Date().toISOString() },
        analysis_card: analysisCard ? { ...analysisCard, deleted_at: new Date().toISOString() } : null,
        event: event ? { ...event, deleted_at: new Date().toISOString() } : null,
        content_block: contentBlock
          ? { ...contentBlock, soft_deleted: true, deleted_at: new Date().toISOString() }
          : null,
      }

      return {
        ...payload,
        ai_runs: payload.ai_runs.filter((run) => run.id !== input.ai_run_id),
        analysis_cards: payload.analysis_cards.filter((card) => card.ai_run_id !== input.ai_run_id),
        events: payload.events.filter((eventItem) => eventItem.ai_run_id !== input.ai_run_id),
        content_blocks: payload.content_blocks.filter((block) => block.event_id !== event?.id),
        deleted_ai_records: [resultRecord, ...payload.deleted_ai_records.filter((record) => record.ai_run.id !== input.ai_run_id)],
      }
    }

    const record = payload.deleted_ai_records.find((item) => item.ai_run.id === input.ai_run_id)
    if (!record) {
      throw new Error(`Missing mock deleted ai run ${input.ai_run_id}.`)
    }
    resultRecord = {
      ai_run: { ...record.ai_run, deleted_at: null },
      analysis_card: record.analysis_card ? { ...record.analysis_card, deleted_at: null } : null,
      event: record.event ? { ...record.event, deleted_at: null } : null,
      content_block: record.content_block
        ? { ...record.content_block, soft_deleted: false, deleted_at: null }
        : null,
    }

    return {
      ...payload,
      ai_runs: [...payload.ai_runs, resultRecord.ai_run],
      analysis_cards: resultRecord.analysis_card ? [...payload.analysis_cards, resultRecord.analysis_card] : payload.analysis_cards,
      events: resultRecord.event ? [...payload.events, resultRecord.event] : payload.events,
      content_blocks: resultRecord.content_block ? [...payload.content_blocks, resultRecord.content_block] : payload.content_blocks,
      deleted_ai_records: payload.deleted_ai_records.filter((item) => item.ai_run.id !== input.ai_run_id),
    }
  })

  if (!resultRecord) {
    throw new Error(`Missing mock ai run ${input.ai_run_id}.`)
  }

  return { ai_record: resultRecord }
}

const listMockAnchors = () => mockSessionPayloads.flatMap((payload) => payload.context_memory.active_anchors)

const getMockActiveAnchors = (input?: GetActiveMarketAnchorsInput): ActiveMarketAnchorsPayload => ({
  anchors: mockSessionPayloads
    .filter((payload) => !input?.session_id || payload.session.id === input.session_id)
    .filter((payload) => !input?.contract_id || payload.contract.id === input.contract_id)
    .flatMap((payload) => payload.context_memory.active_anchors)
    .filter((anchor) => !input?.status || anchor.status === input.status)
    .slice(0, input?.limit ?? 12),
})

const getMockGroundings = (input?: GetKnowledgeGroundingsInput): KnowledgeGroundingPayload => ({
  hits: mockSessionPayloads
    .filter((payload) => !input?.session_id || payload.session.id === input.session_id)
    .flatMap((payload) => payload.context_memory.latest_grounding_hits)
    .filter((hit) => !input?.ai_run_id || hit.ai_run_id === input.ai_run_id)
    .filter((hit) => !input?.anchor_id || hit.anchor_id === input.anchor_id)
    .slice(0, input?.limit ?? 12),
})

const adoptMockAnchor = (input: AdoptMarketAnchorInput): MarketAnchorMutationResult => {
  const existing = getMockPayload(input.session_id).context_memory.active_anchors.find((anchor) =>
    (input.source_annotation_id && anchor.origin_annotation_id === input.source_annotation_id)
    || anchor.title === input.title)

  if (existing) {
    const updated = updateMockSessionPayload(input.session_id, (payload) => ({
      ...payload,
      context_memory: {
        ...payload.context_memory,
        active_anchors: payload.context_memory.active_anchors.map((anchor) => anchor.id === existing.id
          ? {
            ...anchor,
            title: input.title,
            semantic_type: input.semantic_type ?? anchor.semantic_type,
            status: 'active',
            origin_annotation_id: input.source_annotation_id ?? anchor.origin_annotation_id,
            origin_annotation_label: input.source_annotation_label ?? anchor.origin_annotation_label,
            origin_screenshot_id: input.source_screenshot_id ?? anchor.origin_screenshot_id,
            timeframe_scope: input.timeframe_scope ?? anchor.timeframe_scope,
            price_low: input.price_low ?? anchor.price_low,
            price_high: input.price_high ?? anchor.price_high,
            thesis_md: input.thesis_md || anchor.thesis_md,
            invalidation_rule_md: input.invalidation_rule_md || anchor.invalidation_rule_md,
          }
          : anchor),
      },
    }))
    const anchor = updated.context_memory.active_anchors.find((item) => item.id === existing.id) ?? existing
    return { anchor }
  }

  const anchor: ActiveMarketAnchorSummary = {
    id: `anchor_mock_${listMockAnchors().length + 1}`,
    title: input.title,
    semantic_type: input.semantic_type ?? null,
    status: 'active',
    origin_annotation_id: input.source_annotation_id ?? null,
    origin_annotation_label: input.source_annotation_label ?? null,
    origin_screenshot_id: input.source_screenshot_id ?? null,
    timeframe_scope: input.timeframe_scope ?? null,
    price_low: input.price_low ?? null,
    price_high: input.price_high ?? null,
    thesis_md: input.thesis_md || '',
    invalidation_rule_md: input.invalidation_rule_md || '',
  }

  updateMockSessionPayload(input.session_id, (payload) => ({
    ...payload,
    context_memory: {
      ...payload.context_memory,
      active_anchors: [anchor, ...payload.context_memory.active_anchors],
    },
  }))

  return { anchor }
}

const updateMockAnchorStatus = (input: UpdateMarketAnchorStatusInput): MarketAnchorMutationResult => {
  const targetPayload = mockSessionPayloads.find((payload) =>
    payload.context_memory.active_anchors.some((anchor) => anchor.id === input.anchor_id))
  if (!targetPayload) {
    throw new Error(`Missing mock anchor ${input.anchor_id}.`)
  }

  const updated = updateMockSessionPayload(targetPayload.session.id, (payload) => ({
    ...payload,
    context_memory: {
      ...payload.context_memory,
      active_anchors: payload.context_memory.active_anchors.map((anchor) => anchor.id === input.anchor_id
        ? {
          ...anchor,
          status: input.status,
          thesis_md: input.reason_md ? `${anchor.thesis_md}\n\n状态说明：${input.reason_md}`.trim() : anchor.thesis_md,
        }
        : anchor),
    },
  }))
  const anchor = updated.context_memory.active_anchors.find((item) => item.id === input.anchor_id)
  if (!anchor) {
    throw new Error(`Missing mock anchor ${input.anchor_id}.`)
  }
  return { anchor }
}

const setActiveMockPayload = (payload: SessionWorkbenchPayload) => {
  mockActiveSessionId = payload.session.id
  mockPayload = syncMockSessionPayload(payload)
}

const uniqueContracts = () => {
  const contracts = new Map<string, SessionWorkbenchPayload['contract']>()
  for (const payload of mockSessionPayloads) {
    contracts.set(payload.contract.id, payload.contract)
  }

  return [...contracts.values()].sort((left, right) => left.symbol.localeCompare(right.symbol))
}

const buildLauncherSummary = (payload: SessionWorkbenchPayload): LauncherSessionSummary => ({
  id: payload.session.id,
  title: payload.session.title,
  status: payload.session.status,
  started_at: payload.session.started_at,
  contract_symbol: payload.contract.symbol,
  event_count: payload.events.length,
  trade_count: payload.trades.length,
})

const buildLauncherHome = (): LauncherHomePayload => {
  const recentSessions = [...mockSessionPayloads]
    .sort((left, right) => {
      if (left.session.status !== right.session.status) {
        return left.session.status === 'active' ? -1 : 1
      }

      return right.session.started_at.localeCompare(left.session.started_at)
    })
    .map(buildLauncherSummary)

  const activeSession = buildLauncherSummary(getMockPayload())

  return {
    contracts: uniqueContracts(),
    active_session: activeSession,
    recent_sessions: recentSessions,
  }
}

const createMockSessionPayload = (input: CreateSessionInput): CreateSessionResult => {
  const basePayload = getMockPayload()
  const contract = uniqueContracts().find((item) => item.id === input.contract_id) ?? basePayload.contract
  const timestamp = new Date().toISOString()
  const nextIndex = mockSessionPayloads.length + 1
  const sessionId = `session_mock_${nextIndex}`
  const session = {
    ...basePayload.session,
    id: sessionId,
    contract_id: contract.id,
    title: input.title?.trim() || `${contract.symbol} ${mockBucketLabels[input.bucket]} Session`,
    status: 'active' as const,
    started_at: timestamp,
    created_at: timestamp,
    ended_at: null,
    market_bias: input.market_bias,
    tags: input.tags,
    my_realtime_view: '',
    trade_plan_md: input.trade_plan_md,
    context_focus: input.context_focus,
  }
  const payload: SessionWorkbenchPayload = {
    ...basePayload,
    contract,
    session,
    trades: [],
    events: [],
    screenshots: [],
    deleted_screenshots: [],
    content_blocks: [],
    ai_runs: [],
    analysis_cards: [],
    deleted_ai_records: [],
    evaluations: [],
    panels: {
      my_realtime_view: '',
      ai_summary: '还没有 AI 摘要。',
      trade_plan: input.trade_plan_md,
    },
    composer_shell: basePayload.composer_shell,
    context_memory: {
      active_anchors: [],
      latest_grounding_hits: [],
    },
    suggestion_layer: {
      annotation_suggestions: [],
      anchor_review_suggestions: [],
      similar_cases: [],
    },
  }

  setActiveMockPayload(payload)
  return { session }
}

const buildTradeDetail = (tradeId?: string): TradeDetailPayload => {
  const targetPayload = tradeId
    ? mockSessionPayloads.find((payload) => payload.trades.some((trade) => trade.id === tradeId)) ?? getMockPayload()
    : mockSessionPayloads.find((payload) => payload.trades.length > 0) ?? getMockPayload()
  const trade = tradeId
    ? targetPayload.trades.find((item) => item.id === tradeId) ?? targetPayload.trades[0]
    : targetPayload.trades[0]
  const feedbackBundle = buildMockTradeFeedbackBundle(targetPayload)

  return {
    session: targetPayload.session,
    trade,
    related_events: targetPayload.events.filter((event) => event.trade_id === trade.id),
    analysis_cards: targetPayload.analysis_cards,
    evaluation: targetPayload.evaluations[0] ?? null,
    evaluation_summary: buildMockTradeEvaluationSummary(targetPayload),
    feedback_items: feedbackBundle.feedback_items,
    discipline_score: feedbackBundle.discipline_score,
    rule_hits: feedbackBundle.rule_hits,
  }
}

const buildPeriodReview = (periodId?: string): PeriodReviewPayload => {
  const targetPayload = periodId
    ? mockSessionPayloads.find((payload) => payload.period.id === periodId) ?? mockPayload
    : mockPayload
  const scopedPayloads = mockSessionPayloads.filter((payload) => payload.period.id === targetPayload.period.id)

  return {
    period: targetPayload.period,
    contract: targetPayload.contract,
    sessions: scopedPayloads.map((payload) => payload.session),
    highlight_cards: targetPayload.analysis_cards,
    evaluations: scopedPayloads.flatMap((payload) => payload.evaluations),
    evaluation_rollup: buildMockPeriodEvaluationRollup(),
    feedback_items: buildMockPeriodFeedbackItems(),
    rule_rollup: buildMockRuleRollup(),
    setup_leaderboard: buildMockSetupLeaderboard(),
    profile_snapshot: buildMockUserProfile(),
    training_insights: buildMockTrainingInsights(),
  }
}

const renderMockMarkdown = (input: ExportSessionMarkdownInput): SessionMarkdownExport => ({
  file_path: `mock/${input.session_id}.md`,
  markdown: [
    `# ${getMockPayload(input.session_id).session.title}`,
    '',
    '## 我的实时看法',
    '',
    getMockPayload(input.session_id).panels.my_realtime_view,
  ].join('\n'),
})

const refreshPanels = () => {
  const realtimeBlock = [...mockPayload.content_blocks]
    .reverse()
    .find((block) => block.context_type === 'session' && block.context_id === mockPayload.session.id && block.title === 'Realtime view' && !block.soft_deleted)
  const latestAnalysisCard = mockPayload.analysis_cards[mockPayload.analysis_cards.length - 1]

  mockPayload = {
    ...mockPayload,
    panels: {
      ...mockPayload.panels,
      ai_summary: latestAnalysisCard?.summary_short ?? mockPayload.panels.ai_summary,
      my_realtime_view: realtimeBlock?.content_md ?? mockPayload.session.my_realtime_view,
    },
  }
  syncMockSessionPayload(mockPayload)
}

const mutateMockRealtimeView = (input: SaveSessionRealtimeViewInput): ContentBlockMutationResult => {
  const existingBlock = mockPayload.content_blocks.find((block) =>
    block.context_type === 'session' && block.context_id === input.session_id && block.title === 'Realtime view')

  if (existingBlock) {
    const nextBlock = {
      ...existingBlock,
      content_md: input.content_md,
      soft_deleted: false,
      deleted_at: null,
      updated_at: new Date().toISOString(),
    }

    mockPayload = {
      ...mockPayload,
      session: {
        ...mockPayload.session,
        my_realtime_view: input.content_md,
      },
      content_blocks: mockPayload.content_blocks.map((block) => block.id === nextBlock.id ? nextBlock : block),
    }
    refreshPanels()
    return { block: nextBlock }
  }

  const timestamp = new Date().toISOString()
  const newBlock = {
    id: `block_mock_${mockPayload.content_blocks.length + 1}`,
    schema_version: 1 as const,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
    session_id: input.session_id,
    event_id: null,
    block_type: 'markdown' as const,
    title: 'Realtime view',
    content_md: input.content_md,
    sort_order: mockPayload.content_blocks.length + 1,
    context_type: 'session' as const,
    context_id: input.session_id,
    soft_deleted: false,
  }

  mockPayload = {
    ...mockPayload,
    session: {
      ...mockPayload.session,
      my_realtime_view: input.content_md,
    },
    content_blocks: [...mockPayload.content_blocks, newBlock],
  }
  refreshPanels()
  return { block: newBlock }
}

const mutateMockDeleteState = (input: SetContentBlockDeletedInput, deleted: boolean): ContentBlockMutationResult => {
  const target = mockPayload.content_blocks.find((block) => block.id === input.block_id)
  if (!target) {
    throw new Error(`Missing mock content block ${input.block_id}.`)
  }

  const nextBlock = {
    ...target,
    soft_deleted: deleted,
    deleted_at: deleted ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }

  mockPayload = {
    ...mockPayload,
    session: target.title === 'Realtime view'
      ? {
        ...mockPayload.session,
        my_realtime_view: deleted ? '' : target.content_md,
      }
      : mockPayload.session,
    content_blocks: mockPayload.content_blocks.map((block) => block.id === input.block_id ? nextBlock : block),
  }
  refreshPanels()
  return { block: nextBlock }
}

const mutateMockAiAnalysis = (input: RunAiAnalysisInput): AiRunExecutionResult => {
  const timestamp = new Date().toISOString()
  const nextIndex = mockPayload.analysis_cards.length + 1
  const latestCard = mockPayload.analysis_cards[mockPayload.analysis_cards.length - 1]
  const providerLabel = mockProviders.find((provider) => provider.provider === input.provider)?.label ?? input.provider
  const aiRunId = `airun_mock_${nextIndex}`
  const eventId = `event_mock_ai_${nextIndex}`
  const blockId = `block_mock_ai_${nextIndex}`
  const analysisCard = {
    ...latestCard,
    id: `analysis_mock_${nextIndex}`,
    created_at: timestamp,
    ai_run_id: aiRunId,
    summary_short: `${providerLabel} 模拟分析：${latestCard.summary_short}`,
    deep_analysis_md: [
      latestCard.deep_analysis_md,
      '',
      `模拟 Prompt 类型：${input.prompt_kind}`,
      `模拟截图上下文：${input.screenshot_id ?? '无'}`,
    ].join('\n'),
    context_layer: {
      active_anchor_ids: mockPayload.context_memory.active_anchors
        .filter((anchor) => anchor.status === 'active')
        .map((anchor) => anchor.id),
      grounded_knowledge_card_ids: getMockApprovedRuntime({
        contract_scope: mockPayload.contract.symbol,
        limit: 3,
      }).hits.map((hit) => hit.card_id),
    },
  }
  const contentBlock = {
    id: blockId,
    schema_version: 1 as const,
    created_at: timestamp,
    deleted_at: null,
    session_id: mockPayload.session.id,
    event_id: eventId,
    block_type: 'ai-summary' as const,
    title: `${providerLabel} 摘要`,
    content_md: [
      `# ${providerLabel} 模拟分析`,
      '',
      analysisCard.summary_short,
      '',
      analysisCard.deep_analysis_md,
    ].join('\n'),
    sort_order: mockPayload.content_blocks.length + 1,
    context_type: 'event' as const,
    context_id: eventId,
    soft_deleted: false,
  }
  const event = {
    id: eventId,
    schema_version: 1 as const,
    created_at: timestamp,
    deleted_at: null,
    session_id: mockPayload.session.id,
    trade_id: mockPayload.trades[0]?.id ?? null,
    event_type: 'ai_summary' as const,
    title: `${providerLabel} 模拟市场分析`,
    summary: analysisCard.summary_short,
    author_kind: 'ai' as const,
    occurred_at: timestamp,
    content_block_ids: [blockId],
    screenshot_id: input.screenshot_id ?? mockPayload.screenshots[0]?.id ?? null,
    ai_run_id: aiRunId,
  }
  const aiRun = {
    id: aiRunId,
    schema_version: 1 as const,
    created_at: timestamp,
    deleted_at: null,
    session_id: mockPayload.session.id,
    event_id: eventId,
    provider: input.provider,
    model: mockProviders.find((provider) => provider.provider === input.provider)?.model ?? 'mock-model',
    status: 'completed' as const,
    prompt_kind: input.prompt_kind,
    input_summary: `模拟 ${input.prompt_kind} 输入`,
    finished_at: timestamp,
  }
  const groundingHits = getMockApprovedRuntime({
    contract_scope: mockPayload.contract.symbol,
    limit: 3,
  }).hits.map((hit, index) => ({
    id: `grounding_mock_${mockPayload.context_memory.latest_grounding_hits.length + index + 1}`,
    knowledge_card_id: hit.card_id,
    ai_run_id: aiRunId,
    annotation_id: mockPayload.screenshots[0]?.annotations[0]?.id ?? null,
    anchor_id: mockPayload.context_memory.active_anchors[0]?.id ?? null,
    title: hit.title,
    summary: hit.summary,
    card_type: hit.card_type,
    match_reason_md: hit.match_reasons?.[0] ?? 'Approved knowledge matched current runtime context.',
    relevance_score: hit.relevance_score ?? 0.75,
  }))

  mockPayload = {
    ...mockPayload,
    ai_runs: [...mockPayload.ai_runs, aiRun],
    analysis_cards: [...mockPayload.analysis_cards, analysisCard],
    content_blocks: [...mockPayload.content_blocks, contentBlock],
    events: [...mockPayload.events, event],
    context_memory: {
      ...mockPayload.context_memory,
      latest_grounding_hits: groundingHits,
    },
  }
  refreshPanels()

  return {
    ai_run: aiRun,
    analysis_card: analysisCard,
    event,
    content_block: contentBlock,
    prompt_preview: `模拟 ${input.prompt_kind} 提示词预览。`,
  }
}

const emitMockCaptureSaved = (result: CaptureResult) => {
  for (const listener of mockCaptureSavedListeners) {
    listener(result)
  }
}

const createMockSnipCapture = (sessionId: string): CaptureResult => {
  const timestamp = new Date().toISOString()
  const nextIndex = mockPayload.screenshots.length + 1
  const eventId = `event_mock_screenshot_${nextIndex}`
  const screenshotId = `screenshot_mock_${nextIndex}`
  const baseScreenshot = mockPayload.screenshots[0]
  const screenshot = {
    ...baseScreenshot,
    id: screenshotId,
    event_id: eventId,
    session_id: sessionId,
    caption: `模拟截图 ${nextIndex}`,
    file_path: `mock/snips/mock-snip-${nextIndex}.png`,
    created_at: timestamp,
  }
  const event = {
    id: eventId,
    schema_version: 1 as const,
    created_at: timestamp,
    deleted_at: null,
    session_id: sessionId,
    trade_id: null,
    event_type: 'screenshot' as const,
    title: `截图 ${nextIndex}`,
    summary: '截图已挂到当前 Session 上下文。',
    author_kind: 'user' as const,
    occurred_at: timestamp,
    content_block_ids: [],
    screenshot_id: screenshotId,
    ai_run_id: null,
  }

  mockPayload = {
    ...mockPayload,
    screenshots: [...mockPayload.screenshots, screenshot],
    events: [...mockPayload.events, event],
  }
  syncMockSessionPayload(mockPayload)

  return {
    screenshot,
    created_event_id: eventId,
  }
}

const ensureMockPendingSnip = () => {
  if (!mockPendingSnip) {
    throw new Error('当前没有待处理的模拟截图任务。')
  }

  return mockPendingSnip
}

const openMockSnipCapture = (input?: OpenSnipCaptureInput) => {
  const sessionId = input?.session_id ?? mockCaptureContext.session_id ?? mockPayload.session.id
  mockPendingSnip = {
    session_id: sessionId,
    kind: input?.kind ?? mockCaptureContext.kind ?? 'chart',
    display_label: '模拟屏幕',
    source_width: 1600,
    source_height: 900,
    source_data_url: mockPayload.screenshots[0]?.asset_url ?? '',
  }
}

const mockApi: AlphaNexusApi = {
  app: {
    ping: async() => 'alpha-nexus-mock',
    getEnvironment: async() => ({
      hasDeepSeekKey: false,
      hasOpenAiKey: false,
      hasAnthropicKey: false,
      hasCustomAiKey: false,
      customAiApiBaseUrl: null,
      dataDir: 'mock/data',
      vaultDir: 'mock/vault',
    }),
    initializeDatabase: async() => ({ ok: true }),
  },
  launcher: {
    getHome: async() => buildLauncherHome(),
    createSession: async(input) => createMockSessionPayload(input),
  },
  workbench: {
    getSession: async(input) => {
      const payload = getMockPayload(input?.session_id)
      return hydrateMockPayload(payload)
    },
    getTradeDetail: async(input) => buildTradeDetail(input?.trade_id),
    getPeriodReview: async(input) => buildPeriodReview(input?.period_id),
    getActiveAnchors: async(input) => getMockActiveAnchors(input),
    adoptAnchor: async(input) => adoptMockAnchor(input),
    updateAnchorStatus: async(input) => updateMockAnchorStatus(input),
    getGroundings: async(input) => getMockGroundings(input),
    runAnnotationSuggestions: async(_input: RunAnnotationSuggestionsInput) => ({
      suggestions: [],
    }),
    getComposerSuggestions: async(input: GetComposerSuggestionsInput) => ({
      suggestions: buildMockComposerShell(getMockPayload(input.session_id)).suggestions,
    }),
    getAnchorReviewSuggestions: async(_input?: GetAnchorReviewSuggestionsInput) => ({
      suggestions: [],
    }),
    getSimilarCases: async(_input?: GetSimilarCasesInput) => ({
      cases: [],
    }),
    applySuggestionAction: async(input: ApplySuggestionActionInput) => ({
      ok: true as const,
      suggestion_id: input.suggestion_id,
      suggestion_kind: input.suggestion_kind,
      action: input.action,
      status: input.action === 'discard' ? 'discarded' as const : input.action === 'merge' ? 'merged' as const : 'kept' as const,
      applied_effect: input.action === 'discard' ? 'audit-only' as const : input.action === 'merge' ? 'merged-annotation' as const : 'created-annotation' as const,
      audit_id: `suggestion_audit_mock_${Date.now()}`,
      screenshot_id: mockPayload.screenshots[0]?.id ?? null,
      annotation_id: input.action === 'discard' ? null : `annotation_mock_applied_${Date.now()}`,
      target_annotation_id: input.target_annotation_id ?? null,
    }),
    getUserProfile: async() => buildMockUserProfile(),
    getTrainingInsights: async() => buildMockTrainingInsights(),
    getRankingExplanations: async() => buildMockRankingExplanations(),
    listMemoryProposals: async(input) => listMockMemoryProposals(input?.status),
    approveMemoryProposal: async(input) => reviewMockMemoryProposal(input.proposal_id, 'approved'),
    rejectMemoryProposal: async(input) => reviewMockMemoryProposal(input.proposal_id, 'rejected'),
    saveRealtimeView: async(input) => mutateMockRealtimeView(input),
    deleteContentBlock: async(input) => mutateMockDeleteState(input, true),
    restoreContentBlock: async(input) => mutateMockDeleteState(input, false),
    deleteScreenshot: async(input) => mutateMockScreenshotDeleteState(input, true),
    restoreScreenshot: async(input) => mutateMockScreenshotDeleteState(input, false),
    deleteAnnotation: async(input) => mutateMockAnnotationDeleteState(input, true),
    restoreAnnotation: async(input) => mutateMockAnnotationDeleteState(input, false),
    deleteAiRecord: async(input) => mutateMockAiRecordDeleteState(input, true),
    restoreAiRecord: async(input) => mutateMockAiRecordDeleteState(input, false),
  },
  capture: {
    setSessionContext: async(input) => {
      mockCaptureContext = {
        session_id: input.session_id ?? null,
        kind: input.kind,
      }
      return { ok: true as const }
    },
    openSnipCapture: async(input) => {
      openMockSnipCapture(input)
      return { ok: true as const }
    },
    getPendingSnip: async() => mockPendingSnip,
    copyPendingSnip: async(_input: SnipCaptureSelectionInput) => {
      ensureMockPendingSnip()
      return { ok: true as const }
    },
    savePendingSnip: async(_input: SnipCaptureSelectionInput) => {
      const pending = ensureMockPendingSnip()
      const result = createMockSnipCapture(pending.session_id)
      mockPendingSnip = null
      emitMockCaptureSaved(result)
      return result
    },
    cancelPendingSnip: async() => {
      mockPendingSnip = null
      return { ok: true as const }
    },
    importImage: async() => ({
      screenshot: mockPayload.screenshots[0],
      created_event_id: mockPayload.events[0].id,
    }),
    saveAnnotations: async(input) => {
      const screenshot = mockPayload.screenshots.find((item) => item.id === input.screenshot_id) ?? mockPayload.screenshots[0]
      const nextScreenshot = {
        ...screenshot,
        annotations: input.annotations.map((annotation, index) => ({
          ...annotation,
          id: `annotation_mock_${index + 1}`,
          schema_version: 1 as const,
          created_at: new Date().toISOString(),
          deleted_at: null,
        })),
      }

      mockPayload = {
        ...mockPayload,
        screenshots: mockPayload.screenshots.map((item) => item.id === nextScreenshot.id ? nextScreenshot : item),
      }
      syncMockSessionPayload(mockPayload)

      return {
        screenshot: nextScreenshot,
        created_event_id: nextScreenshot.event_id,
      }
    },
    onSaved: (listener) => {
      mockCaptureSavedListeners.add(listener)
      return () => {
        mockCaptureSavedListeners.delete(listener)
      }
    },
  },
  ai: {
    listProviders: async() => mockProviders,
    saveProviderConfig: async(input) => {
      mockProviders = mockProviders.map((provider) => provider.provider === input.provider
        ? {
          ...provider,
          enabled: input.enabled,
          model: input.model,
          base_url: input.base_url ?? null,
          configured: provider.configured || Boolean(input.api_key?.trim()),
          configured_via: provider.provider === 'custom-http' && input.api_key?.trim() ? 'local' : provider.configured_via,
          secret_storage: provider.provider === 'custom-http' && input.api_key?.trim() ? 'safe-storage' : provider.secret_storage,
        }
        : provider)

      return mockProviders
    },
    runAnalysis: async(input) => mutateMockAiAnalysis(input),
    runMockAnalysis: async() => ({
      analysis_card: mockPayload.analysis_cards[mockPayload.analysis_cards.length - 1],
      prompt_preview: '模拟分析提示词预览。',
    }),
  },
  knowledge: {
    getReviewDashboard: async(input) => buildMockKnowledgeDashboard(input),
    ingestSource: async(input) => ingestMockKnowledgeSource(input),
    reviewCard: async(input) => reviewMockKnowledgeCard(input),
    getApprovedRuntime: async(input) => getMockApprovedRuntime(input),
    getActiveAnchors: async(input) => getMockActiveAnchors(input),
    adoptAnchor: async(input) => adoptMockAnchor(input),
    updateAnchorStatus: async(input) => updateMockAnchorStatus(input),
    getGroundings: async(input) => getMockGroundings(input),
  },
  export: {
    sessionMarkdown: async(input) => renderMockMarkdown(input),
  },
}

const realApi = window.alphaNexus

export const alphaNexusApi: AlphaNexusApi = realApi ?? mockApi
