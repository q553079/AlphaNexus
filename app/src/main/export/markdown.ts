import type { SessionWorkbenchPayload, TradeDetailPayload } from '@shared/contracts/workbench'

const sessionStatusLabels = {
  planned: '计划中',
  active: '进行中',
  closed: '已关闭',
} as const

const tradeStatusLabels = {
  planned: '计划中',
  open: '持仓中',
  closed: '已关闭',
  canceled: '已取消',
} as const

const tradeSideLabels = {
  long: '做多',
  short: '做空',
} as const

const eventTypeLabels = {
  observation: '观察',
  thesis: '观点',
  trade_open: '开仓',
  trade_add: '加仓',
  trade_reduce: '减仓',
  trade_close: '平仓',
  trade_cancel: '取消',
  screenshot: '截图',
  ai_summary: 'AI 摘要',
  review: '复盘',
} as const

const screenshotKindLabels = {
  chart: 'Setup 图',
  execution: 'Manage 图',
  exit: 'Exit 图',
} as const

type BuildSessionMarkdownInput = {
  payload: SessionWorkbenchPayload
  tradeDetails: TradeDetailPayload[]
}

type SessionScreenshot = SessionWorkbenchPayload['screenshots'][number]
type SessionBlock = SessionWorkbenchPayload['content_blocks'][number]
type SessionEvent = SessionWorkbenchPayload['events'][number]

const compact = (value: string | null | undefined) => value?.replace(/\s+/g, ' ').trim() ?? ''

const shiftHeadings = (value: string, depth: number) => value
  .split(/\r?\n/)
  .map((line) => {
    const match = line.match(/^(#{1,6})(\s.*)$/)
    if (!match) {
      return line
    }

    return `${'#'.repeat(Math.min(6, match[1].length + depth))}${match[2]}`
  })
  .join('\n')

const renderMarkdownBody = (value: string | null | undefined, fallback = '待补充') => {
  const trimmed = value?.trim()
  if (!trimmed) {
    return fallback
  }

  return shiftHeadings(trimmed, 5)
}

const renderTradeReference = (tradeId: string | null, tradeIndexById: Map<string, number>) => {
  if (!tradeId) {
    return 'Session'
  }

  return `Trade #${tradeIndexById.get(tradeId) ?? '?'}`
}

const renderEventSpine = (events: SessionEvent[], tradeIndexById: Map<string, number>) => {
  if (events.length === 0) {
    return ['当前 Session 还没有事件。']
  }

  return events.map((event) => [
    `- ${event.occurred_at} · ${eventTypeLabels[event.event_type] ?? event.event_type} · ${renderTradeReference(event.trade_id, tradeIndexById)} · ${event.title}`,
    `  ${compact(event.summary) || '当前事件没有额外摘要。'}`,
  ].join('\n'))
}

const renderScreenshotSection = (
  title: string,
  screenshots: SessionScreenshot[],
  fallback: string,
) => {
  const lines = [`#### ${title}`, '']
  if (screenshots.length === 0) {
    lines.push(fallback, '')
    return lines
  }

  screenshots.forEach((screenshot, index) => {
    const imageUrl = screenshot.annotated_asset_url ?? screenshot.raw_asset_url ?? screenshot.asset_url
    lines.push(`##### ${title} ${index + 1}`)
    lines.push('')
    lines.push(`![${screenshot.caption ?? screenshot.id}](${imageUrl})`)
    lines.push('')
    lines.push(`_${screenshotKindLabels[screenshot.kind]} · ${screenshot.caption ?? screenshot.id}_`)
    lines.push(`_Audit: raw=${screenshot.raw_file_path}; annotated=${screenshot.annotated_file_path ?? 'none'}; annotations=${screenshot.annotations_json_path ?? 'none'}_`)
    lines.push('')
  })

  return lines
}

const renderContentBlocks = (
  title: string,
  blocks: SessionBlock[],
  fallback: string,
) => {
  const lines = [`#### ${title}`, '']
  if (blocks.length === 0) {
    lines.push(fallback, '')
    return lines
  }

  blocks.forEach((block) => {
    lines.push(`##### ${block.title}`)
    lines.push('')
    lines.push(renderMarkdownBody(block.content_md))
    lines.push('')
  })

  return lines
}

const renderAiCards = (
  cards: TradeDetailPayload['linked_ai_cards'],
  title = 'AI 摘要',
  fallback = '当前还没有关联 AI 记录。',
) => {
  const lines = [`#### ${title}`, '']
  if (cards.length === 0) {
    lines.push(fallback, '')
    return lines
  }

  cards.forEach((card, index) => {
    lines.push(`##### AI Card ${index + 1}`)
    lines.push('')
    lines.push(`- 摘要：${compact(card.summary_short) || '待补充'}`)
    lines.push(`- 偏向：${card.bias}`)
    lines.push(`- 置信度：${card.confidence_pct ?? '待补充'}%`)
    lines.push(`- 入场区：${card.entry_zone || '待补充'}`)
    lines.push(`- 止损：${card.stop_loss || '待补充'}`)
    lines.push(`- 目标：${card.take_profit || '待补充'}`)
    lines.push('')

    if (compact(card.deep_analysis_md)) {
      lines.push(shiftHeadings(card.deep_analysis_md.trim(), 5))
      lines.push('')
    }
  })

  return lines
}

const renderExecutionEvents = (events: TradeDetailPayload['execution_events']) => {
  const lines = ['#### 实际执行', '']
  if (events.length === 0) {
    lines.push('当前 trade thread 还没有执行事件。', '')
    return lines
  }

  events.forEach((event) => {
    lines.push(`- ${event.occurred_at} · ${eventTypeLabels[event.event_type] ?? event.event_type} · ${compact(event.summary) || event.title}`)
  })
  lines.push('')
  return lines
}

const renderReviewSection = (detail: TradeDetailPayload) => {
  const lines = ['#### Review Draft / Exit Review', '']
  const primaryReview = detail.review_draft_block ?? detail.review_blocks[detail.review_blocks.length - 1] ?? null

  if (!primaryReview) {
    lines.push('当前 trade thread 还没有 review draft。', '')
  } else {
    lines.push(renderMarkdownBody(primaryReview.content_md))
    lines.push('')
  }

  if (detail.review_sections.result_assessment.length > 0) {
    lines.push('#### 结果评估')
    lines.push('')
    detail.review_sections.result_assessment.forEach((item) => {
      lines.push(`- ${item.title}：${item.summary}`)
    })
    lines.push('')
  }

  if (detail.review_sections.next_improvements.length > 0) {
    lines.push('#### 下次改进')
    lines.push('')
    detail.review_sections.next_improvements.forEach((item) => {
      lines.push(`- ${item.title}：${item.summary}`)
    })
    lines.push('')
  }

  return lines
}

const renderTradeReviewAiSection = (detail: TradeDetailPayload) => {
  const lines = ['#### 交易级 AI 复盘', '']
  if (detail.ai_groups.trade_review.length === 0) {
    lines.push('当前还没有交易级 AI 复盘记录。', '')
    return lines
  }

  detail.ai_groups.trade_review.forEach((record, index) => {
    lines.push(`##### Trade Review AI ${index + 1}`)
    lines.push('')
    lines.push(`- 摘要：${compact(record.analysis_card?.summary_short ?? record.trade_review_structured?.summary_short) || '待补充'}`)
    if (record.trade_review_structured) {
      lines.push('- 做得好的地方：')
      record.trade_review_structured.what_went_well.forEach((item) => {
        lines.push(`  - ${item}`)
      })
      lines.push('- 出错点：')
      record.trade_review_structured.mistakes.forEach((item) => {
        lines.push(`  - ${item}`)
      })
      lines.push('- 下次改进：')
      record.trade_review_structured.next_improvements.forEach((item) => {
        lines.push(`  - ${item}`)
      })
      lines.push('')
    }
    lines.push(renderMarkdownBody(record.content_block?.content_md ?? record.analysis_card?.deep_analysis_md ?? '待补充'))
    lines.push('')
  })

  return lines
}

const renderTradeThread = (detail: TradeDetailPayload, tradeIndex: number) => {
  const trade = detail.trade
  const lines = [
    `### Trade #${tradeIndex} · ${trade.symbol} ${tradeSideLabels[trade.side]} · ${tradeStatusLabels[trade.status]}`,
    '',
    `- 数量：${trade.quantity}`,
    `- Entry：${trade.entry_price}`,
    `- Stop：${trade.stop_loss}`,
    `- Target：${trade.take_profit}`,
    `- Opened：${trade.opened_at}`,
    `- Closed：${trade.closed_at ?? '未平仓'}`,
    `- Exit：${trade.exit_price ?? '未记录'}`,
    `- PnL：${trade.pnl_r ?? '待补充'}R`,
    '',
    '#### Thesis',
    '',
    trade.thesis.trim() || '待补充',
    '',
  ]

  lines.push(...renderScreenshotSection('Setup 图', detail.setup_screenshots, '当前没有 setup 图。'))
  lines.push(...renderScreenshotSection('Manage 图', detail.manage_screenshots, '当前没有 manage 图。'))
  lines.push(...renderScreenshotSection('Exit 图', detail.exit_screenshots, '当前没有 exit 图。'))
  lines.push(...renderContentBlocks('原始观点', detail.original_plan_blocks, '当前没有额外的原始观点记录。'))
  lines.push(...renderAiCards(detail.linked_ai_cards, 'AI 摘要', '当前 trade thread 还没有关联 AI 记录。'))
  lines.push(...renderTradeReviewAiSection(detail))
  lines.push(...renderExecutionEvents(detail.execution_events))
  lines.push(...renderReviewSection(detail))

  return lines
}

export const buildSessionMarkdown = ({ payload, tradeDetails }: BuildSessionMarkdownInput) => {
  const tradeIndexById = new Map(payload.trades.map((trade, index) => [trade.id, index + 1]))
  const usedTradeBlockIds = new Set(tradeDetails.flatMap((detail) => detail.content_blocks.map((block) => block.id)))
  const usedTradeScreenshotIds = new Set(tradeDetails.flatMap((detail) => detail.screenshots.map((screenshot) => screenshot.id)))
  const sessionOnlyBlocks = payload.content_blocks
    .filter((block) => !block.soft_deleted)
    .filter((block) => !usedTradeBlockIds.has(block.id))
    .filter((block) => block.block_type !== 'ai-summary')
    .filter((block) => !(block.context_type === 'session' && block.context_id === payload.session.id && block.title === 'Realtime view'))
  const sessionOnlyScreenshots = payload.screenshots.filter((screenshot) => !usedTradeScreenshotIds.has(screenshot.id))
  const sessionOnlyAiCards = payload.analysis_cards.filter((card) => card.trade_id == null)

  const lines = [
    `# ${payload.session.title}`,
    '',
    `- 合约：${payload.contract.symbol} (${payload.contract.name})`,
    `- 周期：${payload.period.label}`,
    `- Session 状态：${sessionStatusLabels[payload.session.status]}`,
    `- Current Context：${renderTradeReference(payload.current_context.trade_id, tradeIndexById)} · ${payload.current_context.source_view} · capture=${payload.current_context.capture_kind}`,
  ]

  if (compact(payload.session.context_focus)) {
    lines.push(`- Context Focus：${compact(payload.session.context_focus)}`)
  }

  lines.push(
    '',
    '## Session Context',
    '',
    '### 我的实时看法',
    '',
    renderMarkdownBody(payload.panels.my_realtime_view, '当前还没有 realtime view 记录。'),
    '',
    '### 交易计划',
    '',
    renderMarkdownBody(payload.panels.trade_plan, '当前还没有 trade plan。'),
    '',
    '### Session AI 摘要',
    '',
    renderMarkdownBody(payload.panels.ai_summary, '当前还没有 session 级 AI 摘要。'),
    '',
    '## Event Spine',
    '',
    ...renderEventSpine(payload.events, tradeIndexById),
    '',
    '## Trade Threads',
    '',
  )

  if (tradeDetails.length === 0) {
    lines.push('当前 Session 还没有 trade thread。', '')
  } else {
    tradeDetails.forEach((detail, index) => {
      lines.push(...renderTradeThread(detail, index + 1))
    })
  }

  lines.push('## Session-Level Records', '')
  lines.push(...renderContentBlocks('Session 原始记录', sessionOnlyBlocks, '当前没有 session 级内容块。'))
  lines.push(...renderAiCards(sessionOnlyAiCards, 'Session 级 AI 记录', '当前没有 session 级 AI 记录。'))
  lines.push(...renderScreenshotSection('Session 级截图', sessionOnlyScreenshots, '当前没有 session 级截图。'))

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()
}
