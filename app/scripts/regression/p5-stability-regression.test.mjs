import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildMarketAnalysisPrompt,
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
import { buildAiComparisonViewModel } from '../../src/renderer/app/features/session-workbench/modules/session-ai-compare.ts'
import { applySelectionFormatting } from '../../src/renderer/app/features/session-workbench/modules/session-editor-formatting.ts'
import {
  computeVirtualWindowLayout,
  computeVirtualWindowRange,
} from '../../src/renderer/app/features/session-workbench/modules/session-virtual-window.ts'
import {
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
