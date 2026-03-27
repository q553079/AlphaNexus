import type { SessionWorkbenchPayload, TradeDetailPayload } from '@shared/contracts/workbench'

const buildOutputLanguageRules = () => [
  'Output language requirements / 输出语言要求:',
  '- Keep all JSON keys exactly unchanged.',
  '- Keep bias as one of: bullish, bearish, range, neutral.',
  '- Write summary_short in Simplified Chinese.',
  '- Write deep_analysis_md in Simplified Chinese markdown.',
  '- Write supporting_factors as short Simplified Chinese phrases.',
  '- Write entry_zone, stop_loss, take_profit, and invalidation in concise Simplified Chinese while preserving symbols and price levels.',
  '- You may keep precise trading terms in English when they are more accurate, such as VWAP, liquidity sweep, opening drive, DOM, footprint, or CPI.',
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

export type PromptContextEnvelope = {
  approved_knowledge_hits?: PromptKnowledgeContextHit[]
  active_anchors?: PromptActiveAnchorSummary[]
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
) => `
Session: ${payload.session.title}
Contract: ${payload.contract.symbol}
Bias: ${payload.session.market_bias}

User realtime view:
${payload.panels.my_realtime_view}

Trade plan:
${payload.panels.trade_plan}

Event stream:
${payload.events.map((event) => `- ${event.occurred_at}: ${event.title} | ${event.summary}`).join('\n')}

${buildKnowledgeAndAnchorContextSection(context)}

${buildOutputLanguageRules()}
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

${buildOutputLanguageRules()}
`.trim()

export const buildPeriodReviewPrompt = (
  sessionTitles: string[],
  context?: PromptContextEnvelope,
) => `
Review the following sessions:
${sessionTitles.map((title) => `- ${title}`).join('\n')}

${buildKnowledgeAndAnchorContextSection(context)}

${buildOutputLanguageRules()}
`.trim()
