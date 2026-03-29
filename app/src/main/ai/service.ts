import type { AppEnvironment } from '@main/app-shell/env'
import type { LocalFirstPaths } from '@main/app-shell/paths'
import { getDatabase } from '@main/db/connection'
import {
  persistLocalProviderSecret,
  readPersistedProviderConfigs,
  resolveLocalProviderSecret,
  writePersistedProviderConfigs,
} from '@main/ai/provider-config-storage'
import {
  getPeriodReview,
  getSessionWorkbench,
  getTradeDetail,
  recordAiAnalysis,
  recordAiAnalysisFailure,
} from '@main/domain/workbench-service'
import {
  buildActiveAnchorRuntimeSummary,
  getApprovedKnowledgeRuntime,
  recordKnowledgeGroundingHits,
} from '@main/domain/knowledge-service'
import {
  generateAiAnnotationSuggestions,
  generateAnchorReviewSuggestions,
  generateComposerAiSuggestions,
  recallSimilarCases,
} from '@main/domain/suggestion-service'
import { buildMarketAnalysisPrompt, buildPeriodReviewPrompt, buildTradeReviewPrompt } from '@main/ai/prompt-builders'
import { listPromptTemplates as loadPromptTemplates, resolvePromptTemplate, savePromptTemplate as persistPromptTemplate } from '@main/ai/prompt-template-storage'
import { aiAdapters } from '@main/ai/registry'
import {
  AiProviderConfigSchema,
  AiRunExecutionResultSchema,
  MockAiRunResultSchema,
  PromptTemplateSchema,
  RunAiAnalysisInputSchema,
  RunMockAiAnalysisInputSchema,
  SavePromptTemplateInputSchema,
  SaveAiProviderConfigInputSchema,
  type AiAnalysisDraft,
  type AiProviderConfig,
  type PeriodReviewDraft,
  type TradeReviewDraft,
} from '@shared/ai/contracts'
import type { ScreenshotRecord } from '@shared/contracts/content'
import type { PeriodReviewPayload, SessionWorkbenchPayload, TradeDetailPayload } from '@shared/contracts/workbench'

const resolveExplicitContextTrade = (payload: SessionWorkbenchPayload) =>
  payload.current_context.trade_id
    ? payload.trades.find((trade) => trade.id === payload.current_context.trade_id) ?? null
    : null

const resolveTradeFromInput = (
  payload: SessionWorkbenchPayload,
  tradeId?: string | null,
) => tradeId
  ? payload.trades.find((trade) => trade.id === tradeId) ?? null
  : null

const resolveTradeFromScreenshot = (
  payload: SessionWorkbenchPayload,
  screenshotId?: string | null,
) => {
  if (!screenshotId) {
    return null
  }

  const screenshotEvent = payload.events.find((event) =>
    event.event_type === 'screenshot'
    && event.screenshot_id === screenshotId)

  return screenshotEvent?.trade_id
    ? payload.trades.find((trade) => trade.id === screenshotEvent.trade_id) ?? null
    : null
}

const resolveScopedTrade = (
  payload: SessionWorkbenchPayload,
  tradeId?: string | null,
  screenshotId?: string | null,
) => resolveTradeFromInput(payload, tradeId)
  ?? resolveTradeFromScreenshot(payload, screenshotId)
  ?? resolveExplicitContextTrade(payload)

const providerCapabilities: Record<AiProviderConfig['provider'], Pick<AiProviderConfig, 'supports_base_url_override' | 'supports_local_api_key'>> = {
  deepseek: {
    supports_base_url_override: true,
    supports_local_api_key: true,
  },
  openai: {
    supports_base_url_override: false,
    supports_local_api_key: false,
  },
  anthropic: {
    supports_base_url_override: false,
    supports_local_api_key: false,
  },
  'custom-http': {
    supports_base_url_override: true,
    supports_local_api_key: true,
  },
}

const resolveEnvProviderSecret = (
  env: AppEnvironment,
  provider: AiProviderConfig['provider'],
) => {
  const envKeyMap: Record<AiProviderConfig['provider'], string | undefined> = {
    deepseek: env.deepseekApiKey,
    openai: env.openAiApiKey,
    anthropic: env.anthropicApiKey,
    'custom-http': env.customAiApiKey,
  }
  const apiKey = envKeyMap[provider]?.trim()
  if (!apiKey) {
    return {
      api_key: null,
      configured_via: 'none' as const,
      secret_storage: 'none' as const,
    }
  }

  return {
    api_key: apiKey,
    configured_via: 'env' as const,
    secret_storage: 'env' as const,
  }
}

const resolveProviderSecret = async(
  paths: LocalFirstPaths,
  env: AppEnvironment,
  provider: AiProviderConfig['provider'],
) => {
  const envSecret = resolveEnvProviderSecret(env, provider)
  if (envSecret.api_key) {
    return envSecret
  }

  if (providerCapabilities[provider].supports_local_api_key) {
    return resolveLocalProviderSecret(paths, provider)
  }

  return envSecret
}

const mergeProviderConfigs = async(paths: LocalFirstPaths, env: AppEnvironment): Promise<AiProviderConfig[]> => {
  const saved = await readPersistedProviderConfigs(paths)
  const savedMap = new Map(saved.map((item) => [item.provider, item]))

  const configs = await Promise.all(aiAdapters.map(async(adapter) => {
    const base = adapter.listConfig(paths, env)
    const override = savedMap.get(adapter.provider)
    const secret = await resolveProviderSecret(paths, env, adapter.provider)
    const capabilities = providerCapabilities[adapter.provider]
    return AiProviderConfigSchema.parse({
      ...base,
      enabled: override?.enabled ?? base.enabled,
      model: override?.model ?? base.model,
      base_url: override?.base_url ?? base.base_url,
      configured: Boolean(secret.api_key),
      configured_via: secret.configured_via,
      secret_storage: secret.secret_storage,
      supports_base_url_override: capabilities.supports_base_url_override,
      supports_local_api_key: capabilities.supports_local_api_key,
    })
  }))

  return configs
}

export const listAiProviders = async(paths: LocalFirstPaths, env: AppEnvironment) => mergeProviderConfigs(paths, env)

export const listPromptTemplates = async(paths: LocalFirstPaths) =>
  (await loadPromptTemplates(paths)).map((template) => PromptTemplateSchema.parse(template))

export const savePromptTemplate = async(paths: LocalFirstPaths, rawInput: unknown) => {
  const input = SavePromptTemplateInputSchema.parse(rawInput)
  return (await persistPromptTemplate(paths, input)).map((template) => PromptTemplateSchema.parse(template))
}

export const saveAiProviderConfig = async(paths: LocalFirstPaths, env: AppEnvironment, rawInput: unknown) => {
  const input = SaveAiProviderConfigInputSchema.parse(rawInput)
  const existing = await mergeProviderConfigs(paths, env)
  const nextConfigs = existing.map((config) => config.provider === input.provider
    ? {
      provider: config.provider,
      enabled: input.enabled,
      model: input.model,
      base_url: input.base_url ?? config.base_url,
    }
    : {
      provider: config.provider,
      enabled: config.enabled,
      model: config.model,
      base_url: config.base_url,
    })

  await writePersistedProviderConfigs(paths, nextConfigs)
  if (input.api_key?.trim()) {
    await persistLocalProviderSecret(paths, input.provider, input.api_key.trim())
  }
  return mergeProviderConfigs(paths, env)
}

const providerActionLabels: Record<AiProviderConfig['provider'], string> = {
  deepseek: 'DeepSeek',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  'custom-http': 'OpenAI-compatible',
}

const promptKindTitle: Record<'market-analysis' | 'trade-review' | 'period-review', string> = {
  'market-analysis': '市场分析',
  'trade-review': '交易复盘',
  'period-review': '周期复盘',
}

const biasLabels: Record<AiAnalysisDraft['bias'], string> = {
  bullish: '偏多',
  bearish: '偏空',
  range: '震荡',
  neutral: '中性',
}

const isTradeReviewDraft = (
  analysis: AiAnalysisDraft | TradeReviewDraft | PeriodReviewDraft,
): analysis is TradeReviewDraft =>
  'what_went_well' in analysis

const isPeriodReviewDraft = (
  analysis: AiAnalysisDraft | TradeReviewDraft | PeriodReviewDraft,
): analysis is PeriodReviewDraft =>
  'recurring_patterns' in analysis

const summarizeInput = (value: string) => {
  const compact = value.replace(/\s+/g, ' ').trim()
  if (!compact) {
    return 'AI 分析输入为空。'
  }

  return compact.length > 180 ? `${compact.slice(0, 177)}...` : compact
}

const compactText = (value: string) => value.replace(/\s+/g, ' ').trim()

const normalizeContractSymbol = (value: string | null | undefined) => value?.trim() ?? ''

type KnownContractRef = {
  id: string
  symbol: string
}

type ResolvedAnalysisContract = {
  id: string | null
  symbol: string
  usesAnalysisSessionContract: boolean
}

const loadKnownContractById = async(
  paths: LocalFirstPaths,
  contractId?: string | null,
): Promise<KnownContractRef | null> => {
  if (!contractId?.trim()) {
    return null
  }

  const db = await getDatabase(paths)
  const row = db.prepare(`
    SELECT id, symbol
    FROM contracts
    WHERE id = ?
    LIMIT 1
  `).get(contractId.trim()) as Record<string, unknown> | undefined

  if (!row || typeof row.id !== 'string' || typeof row.symbol !== 'string') {
    return null
  }

  return {
    id: row.id,
    symbol: row.symbol.trim(),
  }
}

const loadKnownContractBySymbol = async(
  paths: LocalFirstPaths,
  contractSymbol?: string | null,
): Promise<KnownContractRef | null> => {
  const normalized = normalizeContractSymbol(contractSymbol)
  if (!normalized) {
    return null
  }

  const db = await getDatabase(paths)
  const row = db.prepare(`
    SELECT id, symbol
    FROM contracts
    WHERE lower(symbol) = lower(?)
    LIMIT 1
  `).get(normalized) as Record<string, unknown> | undefined

  if (!row || typeof row.id !== 'string' || typeof row.symbol !== 'string') {
    return null
  }

  return {
    id: row.id,
    symbol: row.symbol.trim(),
  }
}

const resolveAnalysisContract = async(
  paths: LocalFirstPaths,
  analysisPayload: SessionWorkbenchPayload,
  input: {
    analysis_context?: {
      analysis_contract_id?: string
      analysis_contract_symbol?: string
    }
  },
): Promise<ResolvedAnalysisContract> => {
  const explicitSymbol = normalizeContractSymbol(input.analysis_context?.analysis_contract_symbol)
  if (explicitSymbol) {
    const matchedContract = await loadKnownContractBySymbol(paths, explicitSymbol)
    return {
      id: matchedContract?.id ?? null,
      symbol: explicitSymbol,
      usesAnalysisSessionContract: matchedContract?.id === analysisPayload.contract.id
        || explicitSymbol.toLowerCase() === analysisPayload.contract.symbol.trim().toLowerCase(),
    }
  }

  const explicitContract = await loadKnownContractById(paths, input.analysis_context?.analysis_contract_id)
  if (explicitContract) {
    return {
      id: explicitContract.id,
      symbol: explicitContract.symbol,
      usesAnalysisSessionContract: explicitContract.id === analysisPayload.contract.id,
    }
  }

  return {
    id: analysisPayload.contract.id,
    symbol: analysisPayload.contract.symbol,
    usesAnalysisSessionContract: true,
  }
}

const buildScreenshotContext = (screenshot: ScreenshotRecord | null) => {
  if (!screenshot) {
    return 'No screenshot context was attached to this AI analysis request.'
  }

  const annotationLines = screenshot.annotations.length > 0
    ? screenshot.annotations.map((annotation) =>
      `- ${annotation.label}: ${annotation.shape} ${annotation.color} (${annotation.x1},${annotation.y1}) -> (${annotation.x2},${annotation.y2})${annotation.text ? ` | ${annotation.text}` : ''}`)
      .join('\n')
    : '- No saved annotations on this screenshot.'

  return [
    'Attached screenshot context:',
    `- Kind: ${screenshot.kind}`,
    `- Caption: ${screenshot.caption ?? 'No caption'}`,
    `- Analysis role: ${screenshot.analysis_role}`,
    `- Background layer: ${screenshot.background_layer ?? 'n/a'}`,
    `- Background label: ${screenshot.background_label ?? 'n/a'}`,
    `- File: ${screenshot.file_path}`,
    `- Size: ${screenshot.width} x ${screenshot.height}`,
    'Annotations:',
    annotationLines,
  ].join('\n')
}

const buildBackgroundScreenshotContexts = (screenshots: ScreenshotRecord[]) => {
  if (screenshots.length === 0) {
    return ''
  }

  return [
    'Selected background screenshots:',
    ...screenshots.map((screenshot, index) => [
      `- BG${index + 1}: ${screenshot.id}`,
      `  kind=${screenshot.kind}`,
      `  layer=${screenshot.background_layer ?? 'custom'}`,
      `  label=${screenshot.background_label ?? 'untitled'}`,
      `  caption=${screenshot.caption ?? 'No caption'}`,
      `  file=${screenshot.file_path}`,
    ].join(' | ')),
  ].join('\n')
}

const countInlinePacketImageAttachments = (analysisContext?: {
  attachments?: Array<{
    kind?: string
    data_url?: string
  }>
}) => (analysisContext?.attachments ?? []).filter((attachment) =>
  attachment.kind === 'image'
  && typeof attachment.data_url === 'string'
  && attachment.data_url.trim().length > 0).length

const buildPacketAuditSection = (analysisContext?: {
  attachments?: Array<{
    kind?: string
    data_url?: string
  }>
  background_note_md?: string
  background_toggles?: Record<string, boolean>
  image_region_mode?: string
  packet_preview?: {
    summary?: string
  }
}) => {
  if (!analysisContext) {
    return ''
  }

  const enabledBackgrounds = Object.entries(analysisContext.background_toggles ?? {})
    .filter(([, enabled]) => enabled)
    .map(([key]) => key)
  const lines = [
    'AI packet audit:',
    `- image_region_mode=${analysisContext.image_region_mode ?? 'full'}`,
    `- inline_image_attachments=${countInlinePacketImageAttachments(analysisContext)}`,
    `- packet_preview=${analysisContext.packet_preview?.summary ?? 'n/a'}`,
    `- enabled_background_items=${enabledBackgrounds.length > 0 ? enabledBackgrounds.join(', ') : 'none'}`,
    `- background_note_present=${analysisContext.background_note_md?.trim() ? 'yes' : 'no'}`,
  ]

  return lines.join('\n')
}

const mergeUniqueScreenshots = (...groups: ScreenshotRecord[][]) => {
  const merged = new Map<string, ScreenshotRecord>()
  for (const group of groups) {
    for (const screenshot of group) {
      if (!merged.has(screenshot.id)) {
        merged.set(screenshot.id, screenshot)
      }
    }
  }
  return Array.from(merged.values())
}

const buildPromptPreview = (
  payload: SessionWorkbenchPayload,
  input: {
    analysis_context?: {
      attachments?: Array<{
        kind?: string
        data_url?: string
      }>
      background_note_md?: string
      background_toggles?: Record<string, boolean>
      image_region_mode?: string
      packet_preview?: {
        summary?: string
      }
    }
    prompt_kind: 'market-analysis' | 'trade-review' | 'period-review'
    period_id?: string
    screenshot_id?: string | null
    trade_id?: string | null
  },
  context?: Parameters<typeof buildMarketAnalysisPrompt>[1],
  options?: {
    tradeDetail?: TradeDetailPayload | null
    periodReview?: PeriodReviewPayload | null
      marketAnalysis?: {
        analysisPayload?: SessionWorkbenchPayload
        analysisContractSymbol?: string
        primaryScreenshot?: ScreenshotRecord | null
        backgroundScreenshots?: ScreenshotRecord[]
        mountSessionTitle?: string
      mountContractSymbol?: string
      backgroundNoteMd?: string
    }
  },
) => {
  const basePrompt = input.prompt_kind === 'trade-review'
    ? buildTradeReviewPrompt(options?.tradeDetail ?? (() => {
      throw new Error('trade-review 缺少 trade detail 上下文。')
    })(), context)
    : input.prompt_kind === 'period-review'
      ? buildPeriodReviewPrompt(options?.periodReview ?? (() => {
        throw new Error('period-review 缺少 period review 上下文。')
      })(), context)
      : buildMarketAnalysisPrompt(options?.marketAnalysis?.analysisPayload ?? payload, context, {
        mount_session_title: options?.marketAnalysis?.mountSessionTitle ?? payload.session.title,
        mount_contract_symbol: options?.marketAnalysis?.mountContractSymbol ?? payload.contract.symbol,
        analysis_session_title: options?.marketAnalysis?.analysisPayload?.session.title ?? payload.session.title,
        analysis_contract_symbol: options?.marketAnalysis?.analysisContractSymbol
          ?? options?.marketAnalysis?.analysisPayload?.contract.symbol
          ?? payload.contract.symbol,
        primary_screenshot: options?.marketAnalysis?.primaryScreenshot ?? null,
        background_screenshots: (options?.marketAnalysis?.backgroundScreenshots ?? []).map((screenshot) => ({
          id: screenshot.id,
          kind: screenshot.kind,
          caption: screenshot.caption,
          background_layer: screenshot.background_layer,
          background_label: screenshot.background_label,
          session_title: options?.marketAnalysis?.analysisPayload?.session.title ?? payload.session.title,
          contract_symbol: options?.marketAnalysis?.analysisPayload?.contract.symbol ?? payload.contract.symbol,
        })),
        background_note_md: options?.marketAnalysis?.backgroundNoteMd ?? '',
      })

  if (!input.screenshot_id || input.prompt_kind !== 'market-analysis') {
    return basePrompt
  }

  const screenshot = options?.marketAnalysis?.primaryScreenshot
    ?? payload.screenshots.find((item) => item.id === input.screenshot_id)
  if (!screenshot) {
    throw new Error(`当前 Session 中未找到截图 ${input.screenshot_id}。`)
  }

  const sections = [basePrompt]
  const packetAudit = buildPacketAuditSection(input.analysis_context)
  if (packetAudit) {
    sections.push(packetAudit)
  }
  sections.push(buildScreenshotContext(screenshot))
  const backgroundContext = buildBackgroundScreenshotContexts(options?.marketAnalysis?.backgroundScreenshots ?? [])
  if (backgroundContext) {
    sections.push(backgroundContext)
  }
  return sections.join('\n\n')
}

const resolveMarketAnalysisAttachmentScreenshotIds = (input: {
  analysis_context?: {
    attachments?: Array<{
      kind?: string
      data_url?: string
    }>
  }
  prompt_kind: 'market-analysis' | 'trade-review' | 'period-review'
}, primaryScreenshot: ScreenshotRecord | null, backgroundScreenshots: ScreenshotRecord[]) => {
  if (input.prompt_kind !== 'market-analysis') {
    return []
  }

  if (countInlinePacketImageAttachments(input.analysis_context) > 0) {
    return []
  }

  return [...new Set([
    ...(primaryScreenshot ? [primaryScreenshot.id] : []),
    ...backgroundScreenshots.map((screenshot) => screenshot.id),
  ])]
}

const inferTradeState = (
  payload: SessionWorkbenchPayload,
  input?: { screenshot_id?: string | null, trade_id?: string | null },
) => {
  const scopedTrade = resolveScopedTrade(payload, input?.trade_id, input?.screenshot_id)
  if (!scopedTrade) {
    return 'pre_entry'
  }
  if (scopedTrade.status === 'closed' || scopedTrade.status === 'canceled') {
    return 'post_trade'
  }
  return 'manage'
}

const buildPromptContext = async(
  paths: LocalFirstPaths,
  payload: SessionWorkbenchPayload,
  input?: {
    screenshot_id?: string | null
    trade_id?: string | null
    analysis_contract_id?: string | null
    analysis_contract_symbol?: string | null
    uses_analysis_session_contract?: boolean
  },
) => {
  const scopeTrade = resolveScopedTrade(payload, input?.trade_id, input?.screenshot_id)
  const tradeContext = compactText(scopeTrade?.thesis ?? payload.panels.my_realtime_view ?? payload.session.context_focus ?? '')
  const analysisContractSymbol = normalizeContractSymbol(input?.analysis_contract_symbol) || payload.contract.symbol
  const analysisContractId = input?.analysis_contract_id ?? null
  const useSessionScopedRuntime = input?.uses_analysis_session_contract ?? (analysisContractId === payload.contract.id)
  const [runtime, activeAnchors, similarCases] = await Promise.all([
    getApprovedKnowledgeRuntime(paths, {
      contract_scope: analysisContractSymbol,
      tags: payload.session.tags,
      trade_state: inferTradeState(payload, input),
      context_tags: payload.session.tags,
      limit: 6,
    }),
    analysisContractId
      ? buildActiveAnchorRuntimeSummary(paths, {
        contract_id: analysisContractId,
        session_id: useSessionScopedRuntime ? payload.session.id : null,
        trade_id: useSessionScopedRuntime ? scopeTrade?.id ?? null : null,
        status: 'active',
        limit: 4,
      })
      : Promise.resolve({ anchors: [] }),
    analysisContractId
      ? recallSimilarCases(paths, {
        session_id: useSessionScopedRuntime ? payload.session.id : undefined,
        contract_id: analysisContractId,
        timeframe_scope: payload.period.kind,
        semantic_tags: payload.session.tags,
        trade_context: tradeContext.length > 0 ? tradeContext : '待补充',
        limit: 3,
      })
      : Promise.resolve({ hits: [] }),
  ])

  return {
    approved_knowledge_hits: runtime.hits.map((hit) => ({
      title: hit.title,
      summary: hit.summary,
      card_type: hit.card_type,
      match_reasons: [
        `contract=${analysisContractSymbol}`,
        payload.session.tags.length > 0 ? `session_tags=${payload.session.tags.join(', ')}` : 'session_tags=none',
      ],
    })),
    active_anchors: activeAnchors.anchors.map((anchor) => ({
      label: anchor.title,
      hit_count: anchor.hit_count,
      related_card_titles: anchor.related_card_titles,
    })),
    similar_cases: similarCases.hits.map((hit) => ({
      title: hit.title,
      summary: hit.summary,
      match_reasons: hit.match_reasons,
    })),
    runtime_hits: runtime.hits,
    active_anchor_ids: activeAnchors.anchors.map((anchor) => anchor.anchor_id),
    similar_case_hits: similarCases.hits,
  }
}

const buildTradeReviewMarkdown = (
  providerLabel: string,
  analysis: TradeReviewDraft,
) => [
  `# ${providerLabel} ${promptKindTitle['trade-review']}`,
  '',
  '## 摘要',
  '',
  analysis.summary_short,
  '',
  '## 做得好的地方',
  '',
  ...analysis.what_went_well.map((item) => `- ${item}`),
  '',
  '## 出错点',
  '',
  ...analysis.mistakes.map((item) => `- ${item}`),
  '',
  '## 下次改进',
  '',
  ...analysis.next_improvements.map((item) => `- ${item}`),
  '',
  '## 深度分析',
  '',
  analysis.deep_analysis_md,
].join('\n')

const buildPeriodReviewMarkdown = (
  providerLabel: string,
  analysis: PeriodReviewDraft,
) => [
  `# ${providerLabel} ${promptKindTitle['period-review']}`,
  '',
  '## 摘要',
  '',
  analysis.summary_short,
  '',
  '## 优势模式',
  '',
  ...analysis.strengths.map((item) => `- ${item}`),
  '',
  '## 错误模式',
  '',
  ...analysis.mistakes.map((item) => `- ${item}`),
  '',
  '## 重复模式',
  '',
  ...analysis.recurring_patterns.map((item) => `- ${item}`),
  '',
  '## 行动项',
  '',
  ...analysis.action_items.map((item) => `- ${item}`),
  '',
  '## 深度分析',
  '',
  analysis.deep_analysis_md,
].join('\n')

const buildAiContentMarkdown = (
  providerLabel: string,
  promptKind: 'market-analysis' | 'trade-review' | 'period-review',
  analysis: AiAnalysisDraft | TradeReviewDraft | PeriodReviewDraft,
) => {
  if (promptKind === 'trade-review' && isTradeReviewDraft(analysis)) {
    return buildTradeReviewMarkdown(providerLabel, analysis)
  }
  if (promptKind === 'period-review' && isPeriodReviewDraft(analysis)) {
    return buildPeriodReviewMarkdown(providerLabel, analysis)
  }

  const marketAnalysis = analysis as AiAnalysisDraft
  return [
    `# ${providerLabel} ${promptKindTitle[promptKind]}`,
    '',
    '## 摘要',
    '',
    marketAnalysis.summary_short,
    '',
    '## 直接结论',
    '',
    `- 偏向：${biasLabels[marketAnalysis.bias]}`,
    `- 置信度：${marketAnalysis.confidence_pct}%`,
    `- 反转概率：${marketAnalysis.reversal_probability_pct}%`,
    `- 入场区间：${marketAnalysis.entry_zone}`,
    `- 止损：${marketAnalysis.stop_loss}`,
    `- 止盈：${marketAnalysis.take_profit}`,
    `- 失效条件：${marketAnalysis.invalidation}`,
    '',
    '## 支撑因素',
    '',
    ...marketAnalysis.supporting_factors.map((factor) => `- ${factor}`),
    '',
    '## 深度分析',
    '',
    marketAnalysis.deep_analysis_md,
  ].join('\n')
}

const mapStructuredOutputToPersistedAnalysis = (
  promptKind: 'market-analysis' | 'trade-review' | 'period-review',
  analysis: AiAnalysisDraft | TradeReviewDraft | PeriodReviewDraft,
) => {
  if (promptKind === 'trade-review' && isTradeReviewDraft(analysis)) {
    return {
      bias: 'neutral' as const,
      confidence_pct: 0,
      reversal_probability_pct: 0,
      entry_zone: 'trade-review',
      stop_loss: 'trade-review',
      take_profit: 'trade-review',
      invalidation: 'trade-review',
      summary_short: analysis.summary_short,
      deep_analysis_md: analysis.deep_analysis_md,
      supporting_factors: analysis.what_went_well.slice(0, 4),
    }
  }
  if (promptKind === 'period-review' && isPeriodReviewDraft(analysis)) {
    return {
      bias: 'neutral' as const,
      confidence_pct: 0,
      reversal_probability_pct: 0,
      entry_zone: 'period-review',
      stop_loss: 'period-review',
      take_profit: 'period-review',
      invalidation: 'period-review',
      summary_short: analysis.summary_short,
      deep_analysis_md: analysis.deep_analysis_md,
      supporting_factors: analysis.strengths.slice(0, 4),
    }
  }

  return analysis as AiAnalysisDraft
}

const resolveTradeReviewAttachments = (detail: TradeDetailPayload) => {
  const ordered = [
    detail.setup_screenshot?.id ?? null,
    detail.exit_screenshot?.id ?? null,
  ].filter((value): value is string => Boolean(value))

  return [...new Set(ordered)]
}

export const runAiAnalysis = async(paths: LocalFirstPaths, env: AppEnvironment, rawInput: unknown) => {
  const input = RunAiAnalysisInputSchema.parse(rawInput)
  const payload = await getSessionWorkbench(paths, { session_id: input.session_id })
  const analysisSessionId = input.analysis_context?.analysis_session_id ?? input.session_id
  const analysisPayload = analysisSessionId === input.session_id
    ? payload
    : await getSessionWorkbench(paths, { session_id: analysisSessionId })
  const analysisContract = await resolveAnalysisContract(paths, analysisPayload, input)
  const scopedTrade = resolveScopedTrade(payload, input.trade_id ?? null, input.screenshot_id ?? null)
  const primaryScreenshot = input.screenshot_id
    ? payload.screenshots.find((item) => item.id === input.screenshot_id) ?? null
    : null
  const backgroundScreenshots = (input.analysis_context?.background_screenshot_ids ?? []).map((screenshotId) => {
    const screenshot = analysisPayload.screenshots.find((item) => item.id === screenshotId)
    if (!screenshot) {
      throw new Error(`分析 Session 中未找到背景截图 ${screenshotId}。`)
    }
    return screenshot
  })
  const tradeDetail = input.prompt_kind === 'trade-review'
    ? (scopedTrade ? await getTradeDetail(paths, { trade_id: scopedTrade.id }) : null)
    : null
  const periodReview = input.prompt_kind === 'period-review'
    ? await getPeriodReview(paths, { period_id: input.period_id ?? payload.session.period_id })
    : null
  if (input.prompt_kind === 'trade-review' && !tradeDetail) {
    throw new Error('trade-review 必须绑定到一笔真实 Trade。')
  }

  const marketAnalysisAttachmentScreenshotIds = resolveMarketAnalysisAttachmentScreenshotIds({
    analysis_context: input.analysis_context,
    prompt_kind: input.prompt_kind,
  }, primaryScreenshot, backgroundScreenshots)

  const promptContext = await buildPromptContext(paths, analysisPayload, {
    screenshot_id: analysisPayload.session.id === payload.session.id
      ? input.screenshot_id ?? null
      : null,
    trade_id: analysisPayload.session.id === payload.session.id
      ? scopedTrade?.id ?? null
      : null,
    analysis_contract_id: analysisContract.id,
    analysis_contract_symbol: analysisContract.symbol,
    uses_analysis_session_contract: analysisContract.usesAnalysisSessionContract,
  })
  const promptPreview = buildPromptPreview(payload, input, promptContext, {
    tradeDetail,
    periodReview,
    marketAnalysis: {
      analysisPayload,
      analysisContractSymbol: analysisContract.symbol,
      primaryScreenshot,
      backgroundScreenshots,
      mountSessionTitle: payload.session.title,
      mountContractSymbol: payload.contract.symbol,
      backgroundNoteMd: input.analysis_context?.background_note_md?.trim() ?? '',
    },
  })
  const promptTemplate = await resolvePromptTemplate(paths, input.prompt_kind)
  const providerConfigs = await mergeProviderConfigs(paths, env)
  const providerConfig = providerConfigs.find((config) => config.provider === input.provider)

  if (!providerConfig) {
    throw new Error(`AI Provider ${input.provider} 当前不可用。`)
  }

  if (!providerConfig.enabled) {
    throw new Error(`${providerActionLabels[input.provider]} 在本地设置中已被禁用。`)
  }

  if (!providerConfig.configured) {
    throw new Error(`${providerActionLabels[input.provider]} 尚未在本地环境中完成配置。`)
  }

  const adapter = aiAdapters.find((item) => item.provider === input.provider)
  if (!adapter?.runAnalysis) {
    throw new Error(`${providerActionLabels[input.provider]} 的真实分析能力尚未实现。`)
  }

  const providerSecret = await resolveProviderSecret(paths, env, input.provider)
  let adapterResult
  try {
    adapterResult = await adapter.runAnalysis({
      config: providerConfig,
      env,
      input,
      paths,
      payload: {
        ...analysisPayload,
        screenshots: mergeUniqueScreenshots(
          analysisPayload.screenshots,
          primaryScreenshot ? [primaryScreenshot] : [],
          backgroundScreenshots,
        ),
      },
      promptPreview,
      promptTemplate,
      providerSecret,
      attachment_screenshot_ids: input.prompt_kind === 'trade-review'
        ? resolveTradeReviewAttachments(tradeDetail!)
        : marketAnalysisAttachmentScreenshotIds,
    })
  } catch (error) {
    try {
      await recordAiAnalysisFailure(paths, {
        session_id: input.session_id,
        provider: input.provider,
        model: providerConfig.model,
        prompt_kind: input.prompt_kind,
        input_summary: summarizeInput(promptPreview),
        prompt_preview: promptPreview,
        failure_reason: error instanceof Error ? error.message : '未知 AI 运行错误。',
      })
    } catch {
      // Keep the original provider error visible even if failure recording also fails.
    }
    throw error
  }

  const providerLabel = providerConfig.label
  const persistedAnalysis = mapStructuredOutputToPersistedAnalysis(input.prompt_kind, adapterResult.analysis)
  const persisted = await recordAiAnalysis(paths, {
    session_id: input.session_id,
    provider: input.provider,
    model: adapterResult.model,
    prompt_kind: input.prompt_kind,
    input_summary: summarizeInput(promptPreview),
    prompt_preview: promptPreview,
    raw_response_text: adapterResult.raw_output,
    structured_response_json: JSON.stringify(adapterResult.analysis),
    screenshot_id: input.screenshot_id ?? null,
    trade_id: scopedTrade?.id ?? null,
    event_title: `${providerLabel} ${promptKindTitle[input.prompt_kind]}`,
    block_title: input.prompt_kind === 'trade-review'
      ? `${providerLabel} 交易复盘`
      : input.prompt_kind === 'period-review'
        ? `${providerLabel} 周期复盘`
        : `${providerLabel} 摘要`,
    summary_short: adapterResult.analysis.summary_short,
    content_md: buildAiContentMarkdown(providerLabel, input.prompt_kind, adapterResult.analysis),
    analysis: persistedAnalysis,
  })

  if (promptContext.runtime_hits.length > 0) {
    await recordKnowledgeGroundingHits(paths, {
      ai_run_id: persisted.ai_run.id,
      session_id: input.session_id,
      trade_id: scopedTrade?.id ?? null,
      screenshot_id: input.screenshot_id ?? null,
      hits: promptContext.runtime_hits.slice(0, 4).map((hit) => ({
        knowledge_card_id: hit.knowledge_card_id,
        match_reason_md: `Prompt context injected approved knowledge card "${hit.title}" for ${analysisContract.symbol}.`,
        relevance_score: 0.75,
      })),
    })
  }

  return AiRunExecutionResultSchema.parse({
    ...persisted,
    analysis_card: {
      ...persisted.analysis_card,
      context_layer: {
        active_anchor_ids: promptContext.active_anchor_ids,
        grounded_knowledge_card_ids: promptContext.runtime_hits.map((hit) => hit.knowledge_card_id),
      },
    },
    prompt_preview: promptPreview,
  })
}

export const runMockAiAnalysis = async(paths: LocalFirstPaths, rawInput: unknown) => {
  const input = RunMockAiAnalysisInputSchema.parse(rawInput)
  const payload = await getSessionWorkbench(paths, { session_id: input.session_id })
  const analysisSessionId = input.analysis_context?.analysis_session_id ?? input.session_id
  const analysisPayload = analysisSessionId === input.session_id
    ? payload
    : await getSessionWorkbench(paths, { session_id: analysisSessionId })
  const analysisContract = await resolveAnalysisContract(paths, analysisPayload, input)
  const scopedTrade = resolveScopedTrade(payload, input.trade_id ?? null, input.screenshot_id ?? null)
  const primaryScreenshot = input.screenshot_id
    ? payload.screenshots.find((item) => item.id === input.screenshot_id) ?? null
    : null
  const backgroundScreenshots = (input.analysis_context?.background_screenshot_ids ?? []).map((screenshotId) => {
    const screenshot = analysisPayload.screenshots.find((item) => item.id === screenshotId)
    if (!screenshot) {
      throw new Error(`分析 Session 中未找到背景截图 ${screenshotId}。`)
    }
    return screenshot
  })
  const tradeDetail = input.prompt_kind === 'trade-review'
    ? (scopedTrade ? await getTradeDetail(paths, { trade_id: scopedTrade.id }) : null)
    : null
  const periodReview = input.prompt_kind === 'period-review'
    ? await getPeriodReview(paths, { period_id: input.period_id ?? payload.session.period_id })
    : null
  const promptContext = input.prompt_kind === 'market-analysis'
    ? await buildPromptContext(paths, analysisPayload, {
      screenshot_id: analysisPayload.session.id === payload.session.id
        ? input.screenshot_id ?? null
        : null,
      trade_id: analysisPayload.session.id === payload.session.id
        ? scopedTrade?.id ?? null
        : null,
      analysis_contract_id: analysisContract.id,
      analysis_contract_symbol: analysisContract.symbol,
      uses_analysis_session_contract: analysisContract.usesAnalysisSessionContract,
    })
    : undefined
  const promptPreview = buildPromptPreview(payload, input, promptContext, {
    tradeDetail,
    periodReview,
    marketAnalysis: {
      analysisPayload,
      analysisContractSymbol: analysisContract.symbol,
      primaryScreenshot,
      backgroundScreenshots,
      mountSessionTitle: payload.session.title,
      mountContractSymbol: payload.contract.symbol,
      backgroundNoteMd: input.analysis_context?.background_note_md?.trim() ?? '',
    },
  })

  return MockAiRunResultSchema.parse({
    analysis_card: payload.analysis_cards[payload.analysis_cards.length - 1],
    prompt_preview: promptPreview,
  })
}

export const runAnnotationSuggestions = async(paths: LocalFirstPaths, rawInput: unknown) =>
  generateAiAnnotationSuggestions(paths, rawInput)

export const listComposerAiSuggestions = async(paths: LocalFirstPaths, rawInput: unknown) =>
  generateComposerAiSuggestions(paths, rawInput)

export const listAnchorReviewSuggestions = async(paths: LocalFirstPaths, rawInput: unknown) =>
  generateAnchorReviewSuggestions(paths, rawInput)

export const listSimilarCases = async(paths: LocalFirstPaths, rawInput: unknown) =>
  recallSimilarCases(paths, rawInput)
