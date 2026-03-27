import type { AppEnvironment } from '@main/app-shell/env'
import type { LocalFirstPaths } from '@main/app-shell/paths'
import {
  persistLocalProviderSecret,
  readPersistedProviderConfigs,
  resolveLocalProviderSecret,
  writePersistedProviderConfigs,
} from '@main/ai/provider-config-storage'
import { getSessionWorkbench, getTradeDetail, recordAiAnalysis } from '@main/domain/workbench-service'
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
import { aiAdapters } from '@main/ai/registry'
import {
  AiProviderConfigSchema,
  AiRunExecutionResultSchema,
  MockAiRunResultSchema,
  RunAiAnalysisInputSchema,
  RunMockAiAnalysisInputSchema,
  SaveAiProviderConfigInputSchema,
  type AiAnalysisDraft,
  type AiProviderConfig,
  type TradeReviewDraft,
} from '@shared/ai/contracts'
import type { ScreenshotRecord } from '@shared/contracts/content'
import type { SessionWorkbenchPayload, TradeDetailPayload } from '@shared/contracts/workbench'

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
    supports_local_api_key: false,
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
  analysis: AiAnalysisDraft | TradeReviewDraft,
): analysis is TradeReviewDraft =>
  'what_went_well' in analysis

const summarizeInput = (value: string) => {
  const compact = value.replace(/\s+/g, ' ').trim()
  if (!compact) {
    return 'AI 分析输入为空。'
  }

  return compact.length > 180 ? `${compact.slice(0, 177)}...` : compact
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
    `- File: ${screenshot.file_path}`,
    `- Size: ${screenshot.width} x ${screenshot.height}`,
    'Annotations:',
    annotationLines,
  ].join('\n')
}

const buildPromptPreview = (
  payload: SessionWorkbenchPayload,
  input: {
    prompt_kind: 'market-analysis' | 'trade-review' | 'period-review'
    screenshot_id?: string | null
    trade_id?: string | null
  },
  context?: Parameters<typeof buildMarketAnalysisPrompt>[1],
  tradeDetail?: TradeDetailPayload | null,
) => {
  const basePrompt = input.prompt_kind === 'trade-review'
    ? buildTradeReviewPrompt(tradeDetail ?? (() => {
      throw new Error('trade-review 缺少 trade detail 上下文。')
    })(), context)
    : input.prompt_kind === 'period-review'
      ? buildPeriodReviewPrompt([payload.session.title], context)
      : buildMarketAnalysisPrompt(payload, context)

  if (!input.screenshot_id || input.prompt_kind === 'trade-review') {
    return basePrompt
  }

  const screenshot = payload.screenshots.find((item) => item.id === input.screenshot_id)
  if (!screenshot) {
    throw new Error(`当前 Session 中未找到截图 ${input.screenshot_id}。`)
  }

  return [basePrompt, buildScreenshotContext(screenshot)].join('\n\n')
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
  input?: { screenshot_id?: string | null, trade_id?: string | null },
) => {
  const scopeTrade = resolveScopedTrade(payload, input?.trade_id, input?.screenshot_id)
  const [runtime, activeAnchors] = await Promise.all([
    getApprovedKnowledgeRuntime(paths, {
      contract_scope: payload.contract.symbol,
      tags: payload.session.tags,
      trade_state: inferTradeState(payload, input),
      context_tags: payload.session.tags,
      limit: 6,
    }),
    buildActiveAnchorRuntimeSummary(paths, {
      contract_id: payload.contract.id,
      session_id: payload.session.id,
      trade_id: scopeTrade?.id ?? null,
      status: 'active',
      limit: 4,
    }),
  ])

  return {
    approved_knowledge_hits: runtime.hits.map((hit) => ({
      title: hit.title,
      summary: hit.summary,
      card_type: hit.card_type,
      match_reasons: [
        `contract=${payload.contract.symbol}`,
        payload.session.tags.length > 0 ? `session_tags=${payload.session.tags.join(', ')}` : 'session_tags=none',
      ],
    })),
    active_anchors: activeAnchors.anchors.map((anchor) => ({
      label: anchor.title,
      hit_count: anchor.hit_count,
      related_card_titles: anchor.related_card_titles,
    })),
    runtime_hits: runtime.hits,
    active_anchor_ids: activeAnchors.anchors.map((anchor) => anchor.anchor_id),
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

const buildAiContentMarkdown = (
  providerLabel: string,
  promptKind: 'market-analysis' | 'trade-review' | 'period-review',
  analysis: AiAnalysisDraft | TradeReviewDraft,
) => {
  if (promptKind === 'trade-review' && isTradeReviewDraft(analysis)) {
    return buildTradeReviewMarkdown(providerLabel, analysis)
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
  analysis: AiAnalysisDraft | TradeReviewDraft,
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
  const scopedTrade = resolveScopedTrade(payload, input.trade_id ?? null, input.screenshot_id ?? null)
  const tradeDetail = input.prompt_kind === 'trade-review'
    ? (scopedTrade ? await getTradeDetail(paths, { trade_id: scopedTrade.id }) : null)
    : null
  if (input.prompt_kind === 'trade-review' && !tradeDetail) {
    throw new Error('trade-review 必须绑定到一笔真实 Trade。')
  }

  const promptContext = await buildPromptContext(paths, payload, {
    screenshot_id: input.screenshot_id ?? null,
    trade_id: scopedTrade?.id ?? null,
  })
  const promptPreview = buildPromptPreview(payload, input, promptContext, tradeDetail)
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
  const adapterResult = await adapter.runAnalysis({
    config: providerConfig,
    env,
    input,
    paths,
    payload,
    promptPreview,
    providerSecret,
    attachment_screenshot_ids: input.prompt_kind === 'trade-review'
      ? resolveTradeReviewAttachments(tradeDetail!)
      : input.screenshot_id
        ? [input.screenshot_id]
        : [],
  })

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
    block_title: input.prompt_kind === 'trade-review' ? `${providerLabel} 交易复盘` : `${providerLabel} 摘要`,
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
        match_reason_md: `Prompt context injected approved knowledge card "${hit.title}" for ${payload.contract.symbol}.`,
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
  const scopedTrade = resolveScopedTrade(payload, input.trade_id ?? null, input.screenshot_id ?? null)
  const tradeDetail = input.prompt_kind === 'trade-review'
    ? (scopedTrade ? await getTradeDetail(paths, { trade_id: scopedTrade.id }) : null)
    : null
  const promptPreview = buildPromptPreview(payload, input, undefined, tradeDetail)

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
