import type { AnalysisCardRecord, AiRunRecord } from '@shared/contracts/analysis'
import type { AnnotationRecord, ContentBlockRecord, ScreenshotRecord } from '@shared/contracts/content'
import type { EventRecord } from '@shared/contracts/event'
import type { ContractRecord, PeriodRecord, SessionRecord } from '@shared/contracts/session'
import type { EvaluationRecord, TradeRecord } from '@shared/contracts/trade'
import { WorkbenchDatasetSchema, type WorkbenchDataset } from '@shared/models/workbench-dataset'

type MockDataset = WorkbenchDataset

const now = '2026-03-25T09:30:00+08:00'
const version = 1 as const

const makeId = (prefix: string, value: string) => `${prefix}_${value}`

const buildPlaceholderAssetUrl = () => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#f5f4ed" />
          <stop offset="100%" stop-color="#e5e0d4" />
        </linearGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#bg)" />
      <path d="M120 610 C250 460, 360 520, 520 400 S860 240, 980 360 1280 500, 1450 300" fill="none" stroke="#355c5a" stroke-width="10" stroke-linecap="round" />
      <path d="M120 700 C240 640, 330 660, 470 590 S760 520, 920 460 1240 390, 1450 450" fill="none" stroke="#bc7f4a" stroke-width="7" stroke-linecap="round" />
      <rect x="1040" y="150" width="220" height="110" rx="18" fill="#ffffff" fill-opacity="0.85" />
      <text x="1080" y="205" font-family="Georgia, serif" font-size="42" fill="#20312f">NQ 5m</text>
      <text x="1080" y="240" font-family="Georgia, serif" font-size="22" fill="#5d6c69">模拟图表画布</text>
    </svg>
  `.replace(/\s+/g, ' ').trim()

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export const createMockWorkbenchDataset = (): MockDataset => {
  const contract: ContractRecord = {
    id: makeId('contract', 'nq_main'),
    schema_version: version,
    created_at: now,
    symbol: 'NQ',
    name: '纳指 E-mini 主力合约',
    venue: 'CME',
    asset_class: 'future',
    quote_currency: 'USD',
  }

  const period: PeriodRecord = {
    id: makeId('period', '2026w13'),
    schema_version: version,
    created_at: now,
    kind: 'week',
    label: '2026 W13',
    start_at: '2026-03-23T00:00:00+08:00',
    end_at: '2026-03-29T23:59:59+08:00',
  }

  const session: SessionRecord = {
    id: makeId('session', '20260325_am'),
    schema_version: version,
    created_at: now,
    contract_id: contract.id,
    period_id: period.id,
    title: '3 月 25 日早盘 Session',
    status: 'active',
    started_at: '2026-03-25T08:55:00+08:00',
    ended_at: null,
    market_bias: 'bullish',
    tags: ['开盘驱动', '回踩', '执行'],
    my_realtime_view: '开盘集合阶段消化了早段卖压。只有当价格重新站上并守住 VWAP 时我才考虑做多，没有回踩确认就不追高。',
    trade_plan_md: '- 触发条件：重新站上并守住开盘区间中位\n- 入场区间：21932 - 21945\n- 止损：跌破 21908\n- 止盈：先看 21988，余仓看 22020\n- 失效条件：跌回 VWAP 下方且 Delta 背离',
    context_focus: '带标注图表上下文的 Session 事件流。',
  }

  const trade: TradeRecord = {
    id: makeId('trade', 'nq_long_1'),
    schema_version: version,
    created_at: now,
    session_id: session.id,
    symbol: 'NQ',
    side: 'long',
    status: 'open',
    quantity: 2,
    entry_price: 21938.5,
    stop_loss: 21908,
    take_profit: 22020,
    exit_price: null,
    pnl_r: null,
    opened_at: '2026-03-25T09:42:00+08:00',
    closed_at: null,
    thesis: '下破延续失败后，价格重新回到 VWAP 上方并获得接受。',
  }

  const annotationBase = {
    schema_version: version,
    created_at: now,
    stroke_width: 2,
    text: null,
  }

  const annotations: AnnotationRecord[] = [
    {
      ...annotationBase,
      id: makeId('annotation', 'b1'),
      screenshot_id: makeId('screenshot', 'chart_1'),
      shape: 'rectangle',
      label: 'B1',
      color: '#355c5a',
      x1: 240,
      y1: 320,
      x2: 420,
      y2: 450,
    },
    {
      ...annotationBase,
      id: makeId('annotation', 'l1'),
      screenshot_id: makeId('screenshot', 'chart_1'),
      shape: 'line',
      label: 'L1',
      color: '#bc7f4a',
      x1: 420,
      y1: 415,
      x2: 920,
      y2: 360,
    },
    {
      ...annotationBase,
      id: makeId('annotation', 'a1'),
      screenshot_id: makeId('screenshot', 'chart_1'),
      shape: 'arrow',
      label: 'A1',
      color: '#9c3d30',
      x1: 910,
      y1: 360,
      x2: 1100,
      y2: 260,
    },
  ]

  const screenshot: ScreenshotRecord = {
    id: makeId('screenshot', 'chart_1'),
    schema_version: version,
    created_at: now,
    session_id: session.id,
    event_id: makeId('event', 'observation_1'),
    kind: 'chart',
    file_path: 'mock/chart-nq-opening-drive.svg',
    asset_url: buildPlaceholderAssetUrl(),
    caption: '带回收区与延伸目标的开盘驱动图表。',
    width: 1600,
    height: 900,
    annotations,
    deleted_annotations: [],
  }

  const aiRun: AiRunRecord = {
    id: makeId('airun', 'market_1'),
    schema_version: version,
    created_at: now,
    session_id: session.id,
    event_id: makeId('event', 'ai_1'),
    provider: 'deepseek',
    model: 'deepseek-reasoner',
    status: 'mocked',
    prompt_kind: 'market-analysis',
    input_summary: '分析价格重新站上 VWAP 后，开盘驱动继续延伸的概率。',
    finished_at: '2026-03-25T09:41:00+08:00',
  }

  const analysisCard: AnalysisCardRecord = {
    id: makeId('analysis', 'card_1'),
    schema_version: version,
    created_at: now,
    ai_run_id: aiRun.id,
    session_id: session.id,
    trade_id: trade.id,
    bias: 'bullish',
    confidence_pct: 71,
    reversal_probability_pct: 24,
    entry_zone: '21932 - 21945',
    stop_loss: '跌破 21908',
    take_profit: '先看 21988，延伸看 22020',
    invalidation: '重新跌回 VWAP 下方且回收失败',
    summary_short: '只要价格稳在重新收复的 VWAP 上方，并且买方继续守住 21932 一带的回踩台阶，走势更偏向延续。',
    deep_analysis_md: '重新站上 VWAP 偏积极，因为最初的下探没有形成有效扩展。最优交易仍然是等回踩确认，而不是直接追动量。如果回踩台阶下方的参与度明显衰减，延续概率会快速下降。',
    supporting_factors: ['开盘失衡向上完成修复', '买方守住回踩台阶', '延伸目标与上方流动性区域重合'],
  }

  const contentBlocks: ContentBlockRecord[] = [
    {
      id: makeId('block', 'note_1'),
      schema_version: version,
      created_at: now,
      session_id: session.id,
      event_id: makeId('event', 'observation_1'),
      block_type: 'markdown',
      title: '实时笔记',
      content_md: '价格开盘后重新站上 VWAP，并守住第一次回踩。我只想参与回测确认，不追即时延伸。',
      sort_order: 1,
      context_type: 'event',
      context_id: makeId('event', 'observation_1'),
      soft_deleted: false,
    },
    {
      id: makeId('block', 'ai_1'),
      schema_version: version,
      created_at: now,
      session_id: session.id,
      event_id: makeId('event', 'ai_1'),
      block_type: 'ai-summary',
      title: 'AI 摘要',
      content_md: analysisCard.summary_short,
      sort_order: 2,
      context_type: 'event',
      context_id: makeId('event', 'ai_1'),
      soft_deleted: false,
    },
    {
      id: makeId('block', 'plan_1'),
      schema_version: version,
      created_at: now,
      session_id: session.id,
      event_id: makeId('event', 'trade_1'),
      block_type: 'checklist',
      title: '交易执行清单',
      content_md: '- 等待回踩\n- 确认买盘响应\n- 按 2 手分批计划入场',
      sort_order: 3,
      context_type: 'trade',
      context_id: trade.id,
      soft_deleted: false,
    },
  ]

  const events: EventRecord[] = [
    {
      id: makeId('event', 'observation_1'),
      schema_version: version,
      created_at: now,
      session_id: session.id,
      trade_id: null,
      event_type: 'observation',
      title: '跌破失败后重新收复 VWAP',
      summary: '开盘卖压未能继续扩展。买方重新拿回 VWAP，并守住第一次回踩。',
      author_kind: 'user',
      occurred_at: '2026-03-25T09:18:00+08:00',
      content_block_ids: [contentBlocks[0].id],
      screenshot_id: screenshot.id,
      ai_run_id: null,
    },
    {
      id: makeId('event', 'ai_1'),
      schema_version: version,
      created_at: now,
      session_id: session.id,
      trade_id: trade.id,
      event_type: 'ai_summary',
      title: 'AI 延续性判断',
      summary: analysisCard.summary_short,
      author_kind: 'ai',
      occurred_at: '2026-03-25T09:41:00+08:00',
      content_block_ids: [contentBlocks[1].id],
      screenshot_id: screenshot.id,
      ai_run_id: aiRun.id,
    },
    {
      id: makeId('event', 'trade_1'),
      schema_version: version,
      created_at: now,
      session_id: session.id,
      trade_id: trade.id,
      event_type: 'trade_open',
      title: 'NQ 做多开仓 x2',
      summary: '在回踩复测时入场，风险放在开盘台阶下方。',
      author_kind: 'user',
      occurred_at: trade.opened_at,
      content_block_ids: [contentBlocks[2].id],
      screenshot_id: null,
      ai_run_id: null,
    },
  ]

  const evaluation: EvaluationRecord = {
    id: makeId('evaluation', 'trade_1'),
    schema_version: version,
    created_at: now,
    session_id: session.id,
    trade_id: trade.id,
    score: 84,
    note_md: '这笔 setup 的选择比较克制。主要风险在于如果回踩结构被破坏，入场会离延伸段过近。',
  }

  const dataset: WorkbenchDataset = {
    contract,
    period,
    session,
    trades: [trade],
    events,
    screenshots: [screenshot],
    deleted_screenshots: [],
    content_blocks: contentBlocks,
    ai_runs: [aiRun],
    analysis_cards: [analysisCard],
    deleted_ai_records: [],
    evaluations: [evaluation],
    panels: {
      my_realtime_view: session.my_realtime_view,
      ai_summary: analysisCard.summary_short,
      trade_plan: session.trade_plan_md,
    },
    composer_shell: {
      context_summary: '当前处于开盘驱动延续场景，优先围绕已审核的做多回踩规则补全盘中记录。',
      active_anchor_labels: [],
      active_anchors: [
        {
          id: makeId('anchor', 'opening_support'),
          title: '开盘回踩支撑区',
          semantic_type: 'support',
          status: 'active',
          origin_annotation_id: makeId('annotation', 'b1'),
          origin_annotation_label: 'B1',
          origin_screenshot_id: screenshot.id,
          timeframe_scope: '5m',
          price_low: 21932,
          price_high: 21945,
          thesis_md: '第一次回踩不破则延续结构成立。',
          invalidation_rule_md: '跌回 VWAP 下方并反抽失败。',
        },
      ],
      approved_knowledge_hits: [
        {
          card_id: makeId('knowledge_card', 'approved_vwap_reclaim'),
          title: 'VWAP reclaim continuation',
          summary: '价格重回 VWAP 上方并守住首次回踩后，优先按延续处理。',
          relevance_score: 0.82,
          card_type: 'setup',
          tags: ['vwap', 'continuation', 'opening-drive'],
          contract_scope: ['NQ'],
          timeframe_scope: ['5m'],
          fragment_excerpt: '重新站上 VWAP 后，第一次回踩不破且买盘继续响应，延续概率更高。',
          match_reasons: ['合约 NQ 命中', '5m 开盘驱动场景命中'],
        },
      ],
      suggestions: [
        {
          id: makeId('composer_suggestion', 'phrase_1'),
          type: 'phrase',
          label: '延续短句',
          text: 'B1 回踩不破，继续按 VWAP reclaim 延续看待。',
          source: 'knowledge',
          rationale: '基于已审核 setup 卡的盘中短句。',
          knowledge_card_id: makeId('knowledge_card', 'approved_vwap_reclaim'),
        },
        {
          id: makeId('composer_suggestion', 'template_1'),
          type: 'template',
          label: '观点模板',
          text: '观点：\n关键区域：\n触发条件：\n失效条件：\n执行计划：',
          source: 'rule',
          rationale: '保持 SessionWorkbench 里的结构化盘中记录格式。',
          knowledge_card_id: null,
        },
      ],
    },
    context_memory: {
      active_anchors: [
        {
          id: makeId('anchor', 'opening_support'),
          title: '开盘回踩支撑区',
          semantic_type: 'support',
          status: 'active',
          origin_annotation_id: makeId('annotation', 'b1'),
          origin_annotation_label: 'B1',
          origin_screenshot_id: screenshot.id,
          timeframe_scope: '5m',
          price_low: 21932,
          price_high: 21945,
          thesis_md: '第一次回踩不破则延续结构成立。',
          invalidation_rule_md: '跌回 VWAP 下方并反抽失败。',
        },
      ],
      latest_grounding_hits: [
        {
          id: makeId('grounding', 'vwap_reclaim'),
          knowledge_card_id: makeId('knowledge_card', 'approved_vwap_reclaim'),
          ai_run_id: aiRun.id,
          annotation_id: makeId('annotation', 'b1'),
          anchor_id: makeId('anchor', 'opening_support'),
          title: 'VWAP reclaim continuation',
          summary: '价格重回 VWAP 上方并守住首次回踩后，优先按延续处理。',
          card_type: 'setup',
          match_reason_md: 'B1 标注与已审核的 VWAP reclaim setup 命中，且当前 session 是 5m 开盘驱动场景。',
          relevance_score: 0.82,
        },
      ],
    },
    suggestion_layer: {
      annotation_suggestions: [],
      anchor_review_suggestions: [],
      similar_cases: [],
    },
    annotations,
  }

  return WorkbenchDatasetSchema.parse(dataset)
}
