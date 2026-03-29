import assert from 'node:assert/strict'
import test from 'node:test'
import { recordAiAnalysisFailure } from '../../src/main/domain/workbench-service.ts'
import { getLatestPeriodReviewAiRecord, getPeriodAiQualitySummary } from '../../src/main/period/period-ai-quality-service.ts'
import { buildPeriodRollupBundle } from '../../src/main/period/period-rollup-service.ts'
import {
  insertAiRun,
  insertAnalysisCard,
  insertContract,
  insertEvaluation,
  insertPeriod,
  insertSession,
  insertTrade,
  withTempDb,
} from './helpers.mjs'

test('period domain rebuilds rollups, trade metrics, and AI quality from local records', async() => {
  await withTempDb('period-domain', async({ paths, db, nextIso }) => {
    insertPeriod(db, nextIso, {
      id: 'period_domain',
      label: '2026-W13',
    })
    insertContract(db, nextIso, {
      id: 'contract_domain',
      symbol: 'NQ',
    })
    insertSession(db, nextIso, {
      id: 'session_domain_a',
      contract_id: 'contract_domain',
      period_id: 'period_domain',
      title: 'Opening drive reclaim',
      started_at: '2026-03-26T01:00:00.000Z',
      market_bias: 'bullish',
      tags: ['opening-drive', 'context:news-driven'],
    })
    insertSession(db, nextIso, {
      id: 'session_domain_b',
      contract_id: 'contract_domain',
      period_id: 'period_domain',
      title: 'Failed chase',
      started_at: '2026-03-26T03:00:00.000Z',
      market_bias: 'bearish',
      tags: ['reversal'],
    })

    insertTrade(db, nextIso, {
      id: 'trade_domain_best',
      session_id: 'session_domain_a',
      symbol: 'NQ',
      side: 'long',
      status: 'closed',
      entry_price: 100,
      stop_loss: 97,
      take_profit: 108,
      opened_at: '2026-03-26T01:05:00.000Z',
      closed_at: '2026-03-26T01:32:00.000Z',
      pnl_r: 2,
      thesis: 'Opening drive reclaim after confirmation and VWAP hold.',
    })
    insertTrade(db, nextIso, {
      id: 'trade_domain_worst',
      session_id: 'session_domain_b',
      symbol: 'NQ',
      side: 'short',
      status: 'closed',
      entry_price: 106,
      stop_loss: 109,
      take_profit: 101,
      opened_at: '2026-03-26T03:04:00.000Z',
      closed_at: '2026-03-26T03:21:00.000Z',
      pnl_r: -1.5,
      thesis: 'Chase move without confirmation, then fear-based early exit.',
    })

    insertEvaluation(db, nextIso, {
      id: 'evaluation_domain_best',
      session_id: 'session_domain_a',
      trade_id: 'trade_domain_best',
      score: 88,
      note_md: '确认后入场，止损执行稳定，趋势延续配合良好。',
    })
    insertEvaluation(db, nextIso, {
      id: 'evaluation_domain_worst',
      session_id: 'session_domain_b',
      trade_id: 'trade_domain_worst',
      score: 42,
      note_md: '确认不足就追单，提前离场且很焦虑。',
    })

    insertAiRun(db, nextIso, {
      id: 'airun_domain_market',
      session_id: 'session_domain_a',
      trade_id: 'trade_domain_best',
      prompt_kind: 'market-analysis',
      structured_response_json: JSON.stringify({
        bias: 'bullish',
        confidence_pct: 78,
        reversal_probability_pct: 24,
        entry_zone: '100-101',
        stop_loss: '97',
        take_profit: '108',
        invalidation: 'lose reclaim',
        summary_short: 'Opening drive reclaim can continue.',
        deep_analysis_md: 'Bullish continuation structure remains intact.',
        supporting_factors: ['VWAP reclaim', 'trend continuation'],
      }),
    })
    insertAnalysisCard(db, nextIso, {
      id: 'analysis_domain_market',
      ai_run_id: 'airun_domain_market',
      session_id: 'session_domain_a',
      trade_id: 'trade_domain_best',
      bias: 'bullish',
      confidence_pct: 78,
      summary_short: 'Opening drive reclaim can continue.',
      supporting_factors: ['VWAP reclaim', 'trend continuation'],
    })

    insertAiRun(db, nextIso, {
      id: 'airun_domain_period',
      session_id: 'session_domain_a',
      prompt_kind: 'period-review',
      prompt_preview: 'Structured period facts:\n- Period key: week:2026-W13\n- Period scope marker: [period_key=week:2026-W13]',
      structured_response_json: JSON.stringify({
        summary_short: '本周期最稳定的是确认后再做的 opening drive reclaim。',
        strengths: ['确认后入场的样本表现更稳'],
        mistakes: ['追单且无确认的样本拖累表现'],
        recurring_patterns: ['确认充分时，AI 与人工更一致'],
        action_items: ['先写确认条件，再决定是否开仓'],
        deep_analysis_md: 'Period review regression output.',
      }),
    })
    insertAnalysisCard(db, nextIso, {
      id: 'analysis_domain_period',
      ai_run_id: 'airun_domain_period',
      session_id: 'session_domain_a',
      trade_id: null,
      bias: 'neutral',
      confidence_pct: 0,
      summary_short: '本周期最稳定的是确认后再做的 opening drive reclaim。',
    })

    await recordAiAnalysisFailure(paths, {
      session_id: 'session_domain_b',
      provider: 'openai',
      model: 'gpt-5.4-mini',
      prompt_kind: 'market-analysis',
      input_summary: 'failure regression',
      prompt_preview: 'failure regression prompt',
      failure_reason: 'structured parse failed',
    })

    const bundle = await buildPeriodRollupBundle(paths, {
      period_id: 'period_domain',
      latest_period_review: await getLatestPeriodReviewAiRecord(paths, 'period_domain'),
    })

    assert.equal(bundle.rollup.period.id, 'period_domain')
    assert.equal(bundle.rollup.stats.trade_count, 2)
    assert.equal(bundle.rollup.stats.resolved_trade_count, 2)
    assert.equal(bundle.rollup.stats.total_pnl_r, 0.5)
    assert.equal(bundle.rollup.stats.win_rate_pct, 50)
    assert.equal(bundle.rollup.best_trade_ids[0], 'trade_domain_best')
    assert.equal(bundle.rollup.worst_trade_ids[0], 'trade_domain_worst')
    assert.equal(bundle.trade_metrics[0]?.holding_minutes, 27)
    assert.ok(bundle.trade_metrics.some((metric) => metric.tags.some((tag) => tag.category === 'setup' && tag.source === 'user')))
    assert.ok(bundle.trade_metrics.some((metric) => metric.tags.some((tag) => tag.category === 'mistake' && tag.source === 'system')))
    assert.ok(bundle.trade_metrics.some((metric) => metric.tags.some((tag) => tag.category === 'context' && tag.source === 'ai')))
    assert.ok(bundle.rollup.tag_summary.some((tag) => tag.category === 'mistake'))

    const latestPeriodAiReview = await getLatestPeriodReviewAiRecord(paths, 'period_domain')
    assert.equal(latestPeriodAiReview?.ai_run.prompt_kind, 'period-review')
    assert.deepEqual(latestPeriodAiReview?.structured?.action_items, ['先写确认条件，再决定是否开仓'])

    const quality = await getPeriodAiQualitySummary(paths, 'period_domain')
    assert.equal(quality.total_runs, 3)
    assert.equal(quality.structured_success_count, 2)
    assert.equal(quality.structured_failure_count, 1)
    assert.equal(quality.success_rate_pct, 67)
      assert.ok(quality.providers.some((provider) => provider.provider === 'openai' && provider.structured_failure_count === 1))
      assert.ok(quality.recent_failures.some((failure) => failure.reason.includes('structured parse failed')))
  })
})
