import assert from 'node:assert/strict'
import test from 'node:test'
import { runMockAiAnalysis } from '../../src/main/ai/service.ts'
import {
  buildMarketAnalysisPrompt,
  buildPeriodReviewPrompt,
  buildSuggestionPromptContextSection,
} from '../../src/main/ai/prompt-builders.ts'
import {
  listPromptTemplates,
  savePromptTemplate,
} from '../../src/main/ai/prompt-template-storage.ts'
import {
  readCapturePreferences,
  writeCapturePreferences,
} from '../../src/main/capture/capture-preferences-storage.ts'
import {
  readCaptureAiContextPreferences,
  writeCaptureAiContextPreferences,
} from '../../src/main/capture/capture-ai-context-preferences-storage.ts'
import { buildAiComparisonViewModel } from '../../src/renderer/app/features/session-workbench/modules/session-ai-compare.ts'
import { applySelectionFormatting } from '../../src/renderer/app/features/session-workbench/modules/session-editor-formatting.ts'
import {
  computeVirtualWindowLayout,
  computeVirtualWindowRange,
} from '../../src/renderer/app/features/session-workbench/modules/session-virtual-window.ts'
import {
  insertAiRun,
  insertAnalysisCard,
  insertContract,
  insertEvent,
  insertPeriod,
  insertScreenshot,
  insertSession,
  withTempDb,
} from './helpers.mjs'

test('P5 prompt template overrides persist locally without touching the base contract catalog', async() => {
  await withTempDb('p5-prompt-template', async({ paths }) => {
    const defaults = await listPromptTemplates(paths)
    const marketTemplate = defaults.find((template) => template.template_id === 'market-analysis')
    assert.ok(marketTemplate)
    assert.equal(marketTemplate.runtime_notes, '')

    const savedTemplates = await savePromptTemplate(paths, {
      template_id: 'market-analysis',
      runtime_notes: '优先强调风险回报约束，不要把截图噪音解释成结构确认。',
    })
    const savedMarketTemplate = savedTemplates.find((template) => template.template_id === 'market-analysis')
    const untouchedTradeTemplate = savedTemplates.find((template) => template.template_id === 'trade-review')

    assert.ok(savedMarketTemplate)
    assert.equal(savedMarketTemplate.schema_version, 1)
    assert.equal(savedMarketTemplate.runtime_notes, '优先强调风险回报约束，不要把截图噪音解释成结构确认。')
    assert.ok(untouchedTradeTemplate)
    assert.equal(untouchedTradeTemplate.runtime_notes, '')

    const reread = await listPromptTemplates(paths)
    assert.equal(
      reread.find((template) => template.template_id === 'market-analysis')?.runtime_notes,
      '优先强调风险回报约束，不要把截图噪音解释成结构确认。',
    )
  })
})

test('P5 capture preferences stay local-first and round-trip through the JSON store', async() => {
  await withTempDb('p5-capture-preferences', async({ paths }) => {
    const defaults = await readCapturePreferences(paths)
    assert.equal(defaults.schema_version, 1)
    assert.equal(defaults.display_strategy, 'cursor-display')

    const saved = await writeCapturePreferences(paths, {
      snip_accelerator: 'CommandOrControl+Shift+5',
      display_strategy: 'main-window-display',
    })

    assert.equal(saved.snip_accelerator, 'CommandOrControl+Shift+5')
    assert.equal(saved.display_strategy, 'main-window-display')

    const reread = await readCapturePreferences(paths)
    assert.deepEqual(reread, saved)
  })
})

test('P5 capture AI context defaults stay local-first and remember the last explicit analysis contract', async() => {
  await withTempDb('p5-capture-ai-context-preferences', async({ paths }) => {
    const defaults = await readCaptureAiContextPreferences(paths)
    assert.equal(defaults.schema_version, 1)
    assert.equal(defaults.analysis_contract_symbol, '')
    assert.equal(defaults.analysis_role, 'event')

    const saved = await writeCaptureAiContextPreferences(paths, {
      analysis_session_id: 'session_gc_macro',
      analysis_contract_id: null,
      analysis_contract_symbol: 'GCX-CUSTOM',
      analysis_role: 'background',
      background_layer: 'htf',
    })

    assert.equal(saved.analysis_session_id, 'session_gc_macro')
    assert.equal(saved.analysis_contract_id, null)
    assert.equal(saved.analysis_contract_symbol, 'GCX-CUSTOM')
    assert.equal(saved.analysis_role, 'background')
    assert.equal(saved.background_layer, 'htf')

    const reread = await readCaptureAiContextPreferences(paths)
    assert.deepEqual(reread, saved)
  })
})

test('P5 virtual timeline windowing only keeps the current slice mounted and editor formatting stays deterministic', () => {
  const items = Array.from({ length: 60 }, (_, index) => ({ id: `event-${index + 1}` }))
  const layout = computeVirtualWindowLayout(items, {
    'event-1': 220,
    'event-2': 190,
    'event-3': 210,
  }, 172)

  const range = computeVirtualWindowRange(items, {}, layout, {
    estimatedHeight: 172,
    overscan: 2,
    scrollTop: 172 * 22,
    viewportHeight: 172 * 3,
  })

  assert.equal(layout.offsets[0], 0)
  assert.ok(layout.totalHeight > 172 * 50)
  assert.ok(range.startIndex > 0)
  assert.ok(range.endIndex < items.length - 1)
  assert.ok(range.endIndex - range.startIndex < 12)

  const bold = applySelectionFormatting('alpha beta', 0, 5, 'bold')
  assert.deepEqual(bold, {
    nextSelectionStart: 2,
    nextSelectionEnd: 9,
    nextValue: '**alpha** beta',
  })

  const quote = applySelectionFormatting('line1\nline2', 0, 'line1\nline2'.length, 'quote')
  assert.equal(quote.nextValue, '> line1\n> line2')

  const bullet = applySelectionFormatting('', 0, 0, 'bullet')
  assert.equal(bullet.nextValue, '- 文本')
})

test('P5 similar-case prompt context and multi-provider compare view stay explainable', () => {
  const promptSection = buildSuggestionPromptContextSection({
    approved_knowledge_hits: [
      {
        title: 'VWAP reclaim continuation',
        summary: '第一次回踩不破，优先按延续处理。',
        card_type: 'setup',
        match_reasons: ['contract=NQ'],
      },
    ],
    active_anchors: [
      {
        label: 'Opening drive low',
        hit_count: 2,
        related_card_titles: ['VWAP reclaim continuation'],
      },
    ],
    similar_cases: [
      {
        title: '2026-03-19 opening drive reclaim',
        summary: '第一次回踩不破后走出二次扩展。',
        match_reasons: ['same timeframe'],
      },
    ],
  }, {
    draftText: '等待第一次回踩确认',
    selectedAnnotationLabel: 'VWAP reclaim',
    recentEvents: [{ title: 'Observation', summary: '开盘后重新站上 VWAP' }],
  })

  assert.match(promptSection, /Similar historical cases/)
  assert.match(promptSection, /2026-03-19 opening drive reclaim/)
  assert.match(promptSection, /Opening drive low/)
  assert.match(promptSection, /等待第一次回踩确认/)

  const marketPrompt = buildMarketAnalysisPrompt({
    session: {
      title: 'NQ AM Session',
      market_bias: 'bullish',
      tags: ['opening-drive'],
    },
    contract: { symbol: 'NQ' },
    panels: {
      my_realtime_view: '等待第一次回踩确认',
      trade_plan: '回踩不破才考虑开仓',
    },
    events: [{ occurred_at: '2026-03-26T01:00:00.000Z', title: 'Observation', summary: '重新站上 VWAP' }],
  }, {
    similar_cases: [
      {
        title: '2026-03-19 opening drive reclaim',
        summary: '第一次回踩不破后走出二次扩展。',
        match_reasons: ['same timeframe'],
      },
    ],
  })
  assert.match(marketPrompt, /2026-03-19 opening drive reclaim/)

  const periodPrompt = buildPeriodReviewPrompt({
    contract: { symbol: 'NQ' },
    sessions: [{ id: 'session-a', title: 'Opening drive reclaim' }],
    content_blocks: [{ title: 'My note', content_md: '等待确认后只做 opening drive reclaim。' }],
    feedback_items: [{ title: '先等确认', summary: '先等确认再入场。' }],
    setup_leaderboard: [{ label: 'opening-drive', sample_count: 3, win_rate_pct: 67, avg_r: 1.2, discipline_avg_pct: 80, ai_alignment_pct: 70 }],
    trade_metrics: [
      { trade_id: 'trade-best', session_title: 'Opening drive reclaim', result_label: 'win', pnl_r: 2, plan_adherence_score: 88, thesis_excerpt: '确认后入场' },
      { trade_id: 'trade-worst', session_title: 'Failed chase', result_label: 'loss', pnl_r: -1, plan_adherence_score: 42, thesis_excerpt: '追单失败' },
    ],
    period_rollup: {
      period: { label: '2026-W13', start_at: '2026-03-23T00:00:00.000Z', end_at: '2026-03-29T23:59:59.000Z' },
      period_key: 'week:2026-W13',
      stats: {
        trade_count: 2,
        resolved_trade_count: 2,
        pending_trade_count: 0,
        canceled_trade_count: 0,
        total_pnl_r: 1,
        avg_pnl_r: 0.5,
        win_rate_pct: 50,
        avg_holding_minutes: 26,
        plan_adherence_avg_pct: 65,
        ai_alignment_avg_pct: 70,
      },
      tag_summary: [{ label: '追单', category: 'mistake', source: 'system', count: 1 }],
      best_trade_ids: ['trade-best'],
      worst_trade_ids: ['trade-worst'],
    },
  }, {
    approved_knowledge_hits: [{ title: 'Opening drive reclaim', summary: '确认后再入场。' }],
  })
  assert.match(periodPrompt, /Structured period facts/)
  assert.match(periodPrompt, /week:2026-W13/)
  assert.match(periodPrompt, /\[period_key=week:2026-W13\]/)
  assert.match(periodPrompt, /Best 1: trade=trade-best/)
  assert.match(periodPrompt, /Mistake tags/)

  const compareView = buildAiComparisonViewModel({
    ai_runs: [
      {
        id: 'ai-openai-old',
        provider: 'openai',
        prompt_kind: 'market-analysis',
        created_at: '2026-03-26T01:05:00.000Z',
      },
      {
        id: 'ai-openai-new',
        provider: 'openai',
        prompt_kind: 'market-analysis',
        created_at: '2026-03-26T01:10:00.000Z',
      },
      {
        id: 'ai-deepseek-new',
        provider: 'deepseek',
        prompt_kind: 'market-analysis',
        created_at: '2026-03-26T01:11:00.000Z',
      },
    ],
    analysis_cards: [
      {
        ai_run_id: 'ai-openai-old',
        bias: 'bearish',
        confidence_pct: 42,
        entry_zone: '跌破开盘区间',
        supporting_factors: ['旧结论'],
      },
      {
        ai_run_id: 'ai-openai-new',
        bias: 'bullish',
        confidence_pct: 61,
        entry_zone: '回踩 VWAP',
        supporting_factors: ['VWAP reclaim', '买盘响应'],
      },
      {
        ai_run_id: 'ai-deepseek-new',
        bias: 'bullish',
        confidence_pct: 84,
        entry_zone: '回踩 VWAP',
        supporting_factors: ['VWAP reclaim', '买盘响应', 'opening drive continuation'],
      },
    ],
    events: [
      { id: 'event-openai-old', ai_run_id: 'ai-openai-old', screenshot_id: 'shot-1', trade_id: 'trade-1' },
      { id: 'event-openai-new', ai_run_id: 'ai-openai-new', screenshot_id: 'shot-1', trade_id: 'trade-1' },
      { id: 'event-deepseek-new', ai_run_id: 'ai-deepseek-new', screenshot_id: 'shot-1', trade_id: 'trade-1' },
    ],
  }, {
    screenshot_id: 'shot-1',
    trade_id: 'trade-1',
  })

  assert.equal(compareView.records.length, 2)
  assert.deepEqual(compareView.records.map((record) => record.ai_run.id), ['ai-deepseek-new', 'ai-openai-new'])
  assert.ok(compareView.consensus_points.some((item) => item.includes('共同偏向：bullish')))
  assert.ok(compareView.consensus_points.some((item) => item.includes('共同入场区：回踩 VWAP')))
  assert.ok(compareView.consensus_points.some((item) => item.includes('共同支撑：VWAP reclaim')))
  assert.ok(compareView.divergence_points.some((item) => item.includes('置信度跨度 23%')))
})

test('P5 market-analysis prompt preview keeps save target and explicit analysis contract separate', async() => {
  await withTempDb('p5-ai-analysis-context', async({ paths, db, nextIso }) => {
    insertPeriod(db, nextIso, { id: 'period_p5_ai_context_nq' })
    insertPeriod(db, nextIso, { id: 'period_p5_ai_context_gc', label: 'GC week' })
    insertContract(db, nextIso, { id: 'contract_p5_ai_context_nq', symbol: 'NQ' })
    insertContract(db, nextIso, { id: 'contract_p5_ai_context_gc', symbol: 'GC' })
    insertSession(db, nextIso, {
      id: 'session_p5_ai_context_nq',
      contract_id: 'contract_p5_ai_context_nq',
      period_id: 'period_p5_ai_context_nq',
      title: 'NQ execution session',
      tags: ['execution'],
    })
    insertSession(db, nextIso, {
      id: 'session_p5_ai_context_gc',
      contract_id: 'contract_p5_ai_context_gc',
      period_id: 'period_p5_ai_context_gc',
      title: 'GC macro session',
      tags: ['macro'],
    })
    insertSession(db, nextIso, {
      id: 'session_p5_ai_context_gc_history',
      contract_id: 'contract_p5_ai_context_gc',
      period_id: 'period_p5_ai_context_gc',
      title: 'GC macro history',
      tags: ['macro'],
    })
    insertAiRun(db, nextIso, {
      id: 'airun_p5_ai_context_seed',
      session_id: 'session_p5_ai_context_nq',
      prompt_kind: 'market-analysis',
      prompt_preview: 'seed prompt',
    })
    insertAnalysisCard(db, nextIso, {
      id: 'analysis_p5_ai_context_seed',
      ai_run_id: 'airun_p5_ai_context_seed',
      session_id: 'session_p5_ai_context_nq',
      trade_id: null,
      bias: 'bullish',
      confidence_pct: 62,
      summary_short: 'seed summary',
      supporting_factors: ['seed'],
    })
    insertEvent(db, nextIso, {
      id: 'event_p5_ai_context_primary',
      session_id: 'session_p5_ai_context_nq',
      event_type: 'screenshot',
      title: 'NQ execution shot',
      summary: 'execution shot',
      screenshot_id: 'screenshot_p5_ai_context_primary',
    })
    insertScreenshot(db, nextIso, {
      id: 'screenshot_p5_ai_context_primary',
      session_id: 'session_p5_ai_context_nq',
      event_id: 'event_p5_ai_context_primary',
      caption: 'NQ execution frame',
    })
    insertEvent(db, nextIso, {
      id: 'event_p5_ai_context_background',
      session_id: 'session_p5_ai_context_gc',
      event_type: 'screenshot',
      title: 'GC macro background',
      summary: 'macro background',
      screenshot_id: 'screenshot_p5_ai_context_background',
    })
    insertScreenshot(db, nextIso, {
      id: 'screenshot_p5_ai_context_background',
      session_id: 'session_p5_ai_context_gc',
      event_id: 'event_p5_ai_context_background',
      caption: 'GC daily structure',
      analysis_role: 'background',
      analysis_session_id: 'session_p5_ai_context_gc',
      background_layer: 'macro',
      background_label: 'GC 日线大背景',
      background_note_md: '优先看更长周期上升结构。',
    })

    const result = await runMockAiAnalysis(paths, {
      session_id: 'session_p5_ai_context_nq',
      screenshot_id: 'screenshot_p5_ai_context_primary',
      provider: 'deepseek',
      prompt_kind: 'market-analysis',
      analysis_context: {
        analysis_session_id: 'session_p5_ai_context_gc',
        analysis_contract_symbol: 'GCX-CUSTOM',
        background_screenshot_ids: ['screenshot_p5_ai_context_background'],
        background_note_md: '先用 GC 日线结构做宏观背景。',
      },
    })

    assert.match(result.prompt_preview, /Mount target contract: NQ/)
    assert.match(result.prompt_preview, /Analysis contract: GCX-CUSTOM/)
    assert.match(result.prompt_preview, /GC macro session/)
    assert.match(result.prompt_preview, /BG1: id=screenshot_p5_ai_context_background/)
    assert.match(result.prompt_preview, /GC 日线大背景/)
    assert.match(result.prompt_preview, /先用 GC 日线结构做宏观背景/)
    assert.doesNotMatch(result.prompt_preview, /Similar historical cases/)
  })
})
