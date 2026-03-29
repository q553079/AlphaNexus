import type { ScreenshotRecord } from '@shared/contracts/content'
import type { PeriodReviewPayload, SessionWorkbenchPayload, TradeDetailPayload } from '@shared/contracts/workbench'

const buildAnalysisOutputLanguageRules = () => [
  'Output language requirements / 输出语言要求:',
  '- Keep all JSON keys exactly unchanged.',
  '- Keep bias as one of: bullish, bearish, range, neutral.',
  '- Write summary_short in Simplified Chinese.',
  '- Write deep_analysis_md in Simplified Chinese markdown.',
  '- Write supporting_factors as short Simplified Chinese phrases.',
  '- Write entry_zone, stop_loss, take_profit, and invalidation in concise Simplified Chinese while preserving symbols and price levels.',
  '- You may keep precise trading terms in English when they are more accurate, such as VWAP, liquidity sweep, opening drive, DOM, footprint, or CPI.',
].join('\n')

const buildReviewOutputLanguageRules = () => [
  'Output language requirements / 输出语言要求:',
  '- Keep all JSON keys exactly unchanged.',
  '- Write all JSON string values in Simplified Chinese.',
  '- Write deep_analysis_md in Simplified Chinese markdown.',
  '- Keep numbers, price levels, symbols, IDs, and dates unchanged when they are part of the supplied evidence.',
  '- Tie every list item to the supplied structured facts instead of generic trading advice.',
].join('\n')

export type PromptKnowledgeContextHit = {
  title: string
  summary: string
  card_type?: string | null
  match_reasons?: string[]
}

export type PromptActiveAnchorSummary = {
  label: string
  hit_count: number
  related_card_titles: string[]
}

export type PromptSimilarCaseSummary = {
  title: string
  summary: string
  match_reasons: string[]
}

export type PromptContextEnvelope = {
  approved_knowledge_hits?: PromptKnowledgeContextHit[]
  active_anchors?: PromptActiveAnchorSummary[]
  similar_cases?: PromptSimilarCaseSummary[]
}

export type MarketAnalysisPromptOptions = {
  mount_session_title?: string
  mount_contract_symbol?: string
  analysis_session_title?: string
  analysis_contract_symbol?: string
  primary_screenshot?: Pick<
    ScreenshotRecord,
    'id' | 'kind' | 'caption' | 'analysis_role' | 'background_layer' | 'background_label'
  > | null
  background_screenshots?: Array<Pick<
    ScreenshotRecord,
    'id' | 'kind' | 'caption' | 'background_layer' | 'background_label'
  > & {
    session_title?: string
    contract_symbol?: string
  }>
  background_note_md?: string
}

export type SuggestionPromptContextInput = {
  draftText?: string
  recentEvents?: Array<{ title: string, summary: string }>
  selectedAnnotationLabel?: string | null
}

const truncate = (value: string, maxLength: number) => {
  const compact = value.replace(/\s+/g, ' ').trim()
  if (compact.length <= maxLength) {
    return compact
  }
  return `${compact.slice(0, maxLength - 3)}...`
}

export const buildKnowledgeAndAnchorContextSection = (
  context?: PromptContextEnvelope,
  input: { maxKnowledge?: number, maxAnchors?: number } = {},
) => {
  const maxKnowledge = Math.max(1, Math.min(input.maxKnowledge ?? 6, 10))
  const maxAnchors = Math.max(1, Math.min(input.maxAnchors ?? 5, 10))
  const knowledgeHits = (context?.approved_knowledge_hits ?? []).slice(0, maxKnowledge)
  const anchors = (context?.active_anchors ?? []).slice(0, maxAnchors)

  if (knowledgeHits.length === 0 && anchors.length === 0) {
    return ''
  }

  const sections: string[] = []
  if (knowledgeHits.length > 0) {
    sections.push('Approved knowledge context (strictly curated):')
    sections.push(...knowledgeHits.map((hit, index) => {
      const reason = hit.match_reasons?.[0] ? ` | reason=${truncate(hit.match_reasons[0], 80)}` : ''
      const type = hit.card_type ? ` | type=${hit.card_type}` : ''
      return `- K${index + 1}: ${truncate(hit.title, 64)}${type} | ${truncate(hit.summary, 120)}${reason}`
    }))
  }

  if (anchors.length > 0) {
    sections.push('Active anchor context:')
    sections.push(...anchors.map((anchor, index) => {
      const related = anchor.related_card_titles.slice(0, 2).map((item) => truncate(item, 42)).join('; ')
      return `- A${index + 1}: ${truncate(anchor.label, 42)} | hits=${anchor.hit_count}${related ? ` | linked=${related}` : ''}`
    }))
  }

  return sections.join('\n')
}

export const buildSimilarCaseContextSection = (
  context?: PromptContextEnvelope,
  input: { maxCases?: number } = {},
) => {
  const maxCases = Math.max(1, Math.min(input.maxCases ?? 3, 6))
  const cases = (context?.similar_cases ?? []).slice(0, maxCases)
  if (cases.length === 0) {
    return ''
  }

  return [
    'Similar historical cases (local recall only):',
    ...cases.map((item, index) =>
      `- S${index + 1}: ${truncate(item.title, 64)} | ${truncate(item.summary, 120)}${item.match_reasons[0] ? ` | reason=${truncate(item.match_reasons[0], 72)}` : ''}`),
  ].join('\n')
}

export const buildSuggestionPromptContextSection = (
  context?: PromptContextEnvelope,
  input: SuggestionPromptContextInput = {},
) => {
  const sections: string[] = []
  const contextSection = buildKnowledgeAndAnchorContextSection(context, {
    maxKnowledge: 4,
    maxAnchors: 3,
  })
  if (contextSection) {
    sections.push(contextSection)
  }
  const similarCaseSection = buildSimilarCaseContextSection(context, { maxCases: 3 })
  if (similarCaseSection) {
    sections.push(similarCaseSection)
  }

  const recentEvents = (input.recentEvents ?? []).slice(0, 4)
  if (recentEvents.length > 0) {
    sections.push('Recent event cues:')
    sections.push(...recentEvents.map((event, index) =>
      `- E${index + 1}: ${truncate(event.title, 48)} | ${truncate(event.summary, 96)}`))
  }

  if (input.selectedAnnotationLabel) {
    sections.push(`Selected annotation: ${truncate(input.selectedAnnotationLabel, 42)}`)
  }

  if (input.draftText) {
    sections.push(`Current draft text: ${truncate(input.draftText, 180)}`)
  }

  return sections.join('\n')
}

export const buildMarketAnalysisPrompt = (
  payload: SessionWorkbenchPayload,
  context?: PromptContextEnvelope,
  options: MarketAnalysisPromptOptions = {},
) => `
Mount target session: ${options.mount_session_title ?? payload.session.title}
Mount target contract: ${options.mount_contract_symbol ?? payload.contract.symbol}
Analysis session: ${options.analysis_session_title ?? payload.session.title}
Analysis contract: ${options.analysis_contract_symbol ?? payload.contract.symbol}
Bias: ${payload.session.market_bias}

Primary screenshot:
${options.primary_screenshot
    ? [
      `- id=${options.primary_screenshot.id}`,
      `- kind=${options.primary_screenshot.kind}`,
      `- caption=${options.primary_screenshot.caption ?? 'No caption'}`,
      `- role=${options.primary_screenshot.analysis_role}`,
      options.primary_screenshot.analysis_role === 'background'
        ? `- background=${options.primary_screenshot.background_layer ?? 'custom'} / ${options.primary_screenshot.background_label ?? 'untitled'}`
        : '- background=none',
    ].join('\n')
    : '- No explicit primary screenshot metadata was supplied.'}

Background context:
${options.background_screenshots && options.background_screenshots.length > 0
    ? options.background_screenshots.map((item, index) =>
      `- BG${index + 1}: id=${item.id} | layer=${item.background_layer ?? 'custom'} | label=${item.background_label ?? 'untitled'} | session=${item.session_title ?? payload.session.title} | contract=${item.contract_symbol ?? payload.contract.symbol} | kind=${item.kind} | caption=${item.caption ?? 'No caption'}`).join('\n')
    : '- No explicit background screenshot was selected for this run.'}

Background note:
${options.background_note_md?.trim() || 'No extra background note.'}

User realtime view:
${payload.panels.my_realtime_view}

Trade plan:
${payload.panels.trade_plan}

Event stream:
${payload.events.map((event) => `- ${event.occurred_at}: ${event.title} | ${event.summary}`).join('\n')}

${buildKnowledgeAndAnchorContextSection(context)}
${buildSimilarCaseContextSection(context)}

${buildAnalysisOutputLanguageRules()}
`.trim()

export const buildTradeReviewPrompt = (
  detail: TradeDetailPayload,
  context?: PromptContextEnvelope,
) => `
Trade review for ${detail.trade.symbol} in ${detail.session.title}

Trade facts:
- Side: ${detail.trade.side}
- Status: ${detail.trade.status}
- Quantity: ${detail.trade.quantity}
- Entry: ${detail.trade.entry_price}
- Stop: ${detail.trade.stop_loss}
- Target: ${detail.trade.take_profit}
- Exit: ${detail.trade.exit_price ?? 'pending'}
- PnL R: ${detail.trade.pnl_r ?? 'pending'}

Setup evidence:
${detail.setup_screenshots.length > 0
    ? detail.setup_screenshots.map((shot, index) => `- Setup ${index + 1}: ${truncate(shot.caption ?? shot.id, 72)} | kind=${shot.kind}`).join('\n')
    : '- No setup screenshot is currently attached.'}

Exit evidence:
${detail.exit_screenshots.length > 0
    ? detail.exit_screenshots.map((shot, index) => `- Exit ${index + 1}: ${truncate(shot.caption ?? shot.id, 72)} | kind=${shot.kind}`).join('\n')
    : '- No exit screenshot is currently attached.'}

Original plan:
- Trade thesis: ${truncate(detail.trade.thesis || 'pending', 240)}
- Session trade plan: ${truncate(detail.session.trade_plan_md || 'pending', 240)}
${detail.original_plan_blocks.slice(0, 3).map((block, index) => `- User block ${index + 1}: ${truncate(block.title, 48)} | ${truncate(block.content_md, 220)}`).join('\n') || '- No extra user plan block.'}

Intraday AI context:
${detail.ai_groups.market_analysis.length > 0
    ? detail.ai_groups.market_analysis.slice(-2).map((record, index) =>
      `- AI ${index + 1}: ${truncate(record.analysis_card?.summary_short ?? record.ai_run.input_summary, 220)}`).join('\n')
    : '- No intraday AI record was linked to this trade.'}

Execution trail:
${detail.execution_events.length > 0
    ? detail.execution_events.map((event) => `- ${event.event_type}: ${truncate(event.summary || event.title, 220)}`).join('\n')
    : '- No execution event was recorded.'}

Result snapshot:
${detail.trade.status === 'closed'
    ? `- Trade is closed with exit ${detail.trade.exit_price ?? 'pending'} and pnl ${detail.trade.pnl_r ?? 'pending'}R.`
    : detail.trade.status === 'canceled'
      ? '- Trade was canceled and should be reviewed as an invalidated thread, not a normal exit.'
      : '- Trade is not closed yet. Focus on execution quality and what must improve before full closure.'}

${buildKnowledgeAndAnchorContextSection(context)}
${buildSimilarCaseContextSection(context)}

${buildReviewOutputLanguageRules()}
`.trim()

export const buildPeriodReviewPrompt = (
  payload: PeriodReviewPayload,
  context?: PromptContextEnvelope,
) => `
Period review for ${payload.contract.symbol} ${payload.period_rollup.period.label}

Structured period facts:
- Period key: ${payload.period_rollup.period_key}
- Period scope marker: [period_key=${payload.period_rollup.period_key}]
- Range: ${payload.period_rollup.period.start_at} -> ${payload.period_rollup.period.end_at}
- Sessions: ${payload.sessions.length}
- Trades: ${payload.period_rollup.stats.trade_count}
- Resolved trades: ${payload.period_rollup.stats.resolved_trade_count}
- Pending trades: ${payload.period_rollup.stats.pending_trade_count}
- Canceled trades: ${payload.period_rollup.stats.canceled_trade_count}
- Net pnl_r: ${payload.period_rollup.stats.total_pnl_r}
- Avg pnl_r: ${payload.period_rollup.stats.avg_pnl_r ?? 'pending'}
- Win rate: ${payload.period_rollup.stats.win_rate_pct ?? 'pending'}%
- Avg holding minutes: ${payload.period_rollup.stats.avg_holding_minutes ?? 'pending'}
- Plan adherence avg: ${payload.period_rollup.stats.plan_adherence_avg_pct ?? 'pending'}%
- AI alignment avg: ${payload.period_rollup.stats.ai_alignment_avg_pct ?? 'pending'}%

Setup leaderboard:
${payload.setup_leaderboard.length > 0
    ? payload.setup_leaderboard.slice(0, 4).map((entry, index) =>
      `- Setup ${index + 1}: ${entry.label} | sample=${entry.sample_count} | win_rate=${entry.win_rate_pct ?? 'pending'}% | avg_r=${entry.avg_r ?? 'pending'} | plan=${entry.discipline_avg_pct ?? 'pending'}% | ai_align=${entry.ai_alignment_pct ?? 'pending'}%`).join('\n')
    : '- No setup leaderboard is available for this period.'}

Mistake tags:
${payload.period_rollup.tag_summary.filter((tag) => tag.category === 'mistake').slice(0, 5).map((tag, index) =>
    `- M${index + 1}: ${tag.label} | source=${tag.source} | count=${tag.count}`).join('\n') || '- No mistake tags were aggregated.'}

Best trade samples:
${payload.trade_metrics
    .filter((metric) => payload.period_rollup.best_trade_ids.includes(metric.trade_id))
    .slice(0, 3)
    .map((metric, index) =>
      `- Best ${index + 1}: trade=${metric.trade_id} | session=${metric.session_title} | result=${metric.result_label} | pnl_r=${metric.pnl_r ?? 'pending'} | plan=${metric.plan_adherence_score ?? 'pending'}% | thesis=${metric.thesis_excerpt}`)
    .join('\n') || '- No best-trade sample is available.'}

Worst trade samples:
${payload.trade_metrics
    .filter((metric) => payload.period_rollup.worst_trade_ids.includes(metric.trade_id))
    .slice(0, 3)
    .map((metric, index) =>
      `- Worst ${index + 1}: trade=${metric.trade_id} | session=${metric.session_title} | result=${metric.result_label} | pnl_r=${metric.pnl_r ?? 'pending'} | plan=${metric.plan_adherence_score ?? 'pending'}% | thesis=${metric.thesis_excerpt}`)
    .join('\n') || '- No worst-trade sample is available.'}

Actionable feedback already derived from local evidence:
${payload.feedback_items.slice(0, 4).map((item) => `- ${item.title}: ${truncate(item.summary, 140)}`).join('\n') || '- No local feedback item is available.'}

Existing period notes:
${payload.content_blocks.slice(0, 3).map((block, index) => `- Note ${index + 1}: ${truncate(block.title, 48)} | ${truncate(block.content_md, 180)}`).join('\n') || '- No period note block is attached.'}

${buildKnowledgeAndAnchorContextSection(context)}
${buildSimilarCaseContextSection(context)}

${buildReviewOutputLanguageRules()}
`.trim()
