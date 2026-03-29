import assert from 'node:assert/strict'
import test from 'node:test'
import { runMockAiAnalysis } from '../../src/main/ai/service.ts'
import { recordAiAnalysisFailure } from '../../src/main/domain/workbench-service.ts'
import { getPeriodReview } from '../../src/main/domain/workbench-service.ts'
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

const insertKnowledgeFixture = (db, nextIso, input) => {
  db.prepare(`
    INSERT INTO knowledge_sources (
      id, schema_version, created_at, source_type, title, author, language, content_md, checksum, deleted_at
    ) VALUES (?, 1, ?, 'note', ?, 'regression', 'zh-CN', ?, NULL, NULL)
  `).run(input.source_id, nextIso(), input.title, input.content_md)

  db.prepare(`
    INSERT INTO knowledge_import_jobs (
      id, schema_version, created_at, source_id, provider, model, job_type, status,
      input_snapshot_json, output_summary, finished_at, deleted_at
    ) VALUES (?, 1, ?, ?, 'manual', 'manual', 'manual-ingest', 'completed', '{}', 'fixture import', ?, NULL)
  `).run(input.job_id, nextIso(), input.source_id, nextIso())

  db.prepare(`
    INSERT INTO knowledge_fragments (
      id, schema_version, created_at, source_id, job_id, sequence_no, chapter_label,
      page_from, page_to, content_md, tokens_estimate, deleted_at
    ) VALUES (?, 1, ?, ?, ?, 1, 'fixture', NULL, NULL, ?, 12, NULL)
  `).run(input.fragment_id, nextIso(), input.source_id, input.job_id, input.content_md)

  db.prepare(`
    INSERT INTO knowledge_cards (
      id, schema_version, created_at, updated_at, source_id, fragment_id, card_type, title,
      summary, content_md, trigger_conditions_md, invalidation_md, risk_rule_md,
      contract_scope, timeframe_scope, tags_json, status, version, deleted_at
    ) VALUES (?, 1, ?, ?, ?, ?, 'setup', ?, ?, ?, ?, ?, ?, 'NQ', '5m', '[]', 'approved', 1, NULL)
  `).run(
    input.card_id,
    nextIso(),
    nextIso(),
    input.source_id,
    input.fragment_id,
    input.title,
    input.summary,
    input.content_md,
    '等待确认后入场',
    '失去关键位置视为失效',
    '风险边界先写清',
  )

  db.prepare(`
    INSERT INTO knowledge_groundings (
      id, schema_version, created_at, knowledge_card_id, session_id, trade_id, screenshot_id,
      annotation_id, anchor_id, ai_run_id, match_reason_md, relevance_score
    ) VALUES (?, 1, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?)
  `).run(
    input.grounding_id,
    nextIso(),
    input.card_id,
    input.session_id,
    input.trade_id,
    input.ai_run_id,
    'period review regression grounding',
    input.relevance_score ?? 0.84,
  )
}

test('AlphaNexus period review regression guards', async(t) => {
  await t.test('period review returns real aggregate sections from local records', async() => {
    await withTempDb('period-review-real', async({ paths, db, nextIso }) => {
      insertPeriod(db, nextIso, { id: 'period_review_real', label: '2026-W13' })
      insertContract(db, nextIso, { id: 'contract_review_real', symbol: 'NQ' })

      insertSession(db, nextIso, {
        id: 'session_review_one',
        contract_id: 'contract_review_real',
        period_id: 'period_review_real',
        title: 'Opening drive A',
        started_at: '2026-03-26T01:00:00.000Z',
        market_bias: 'bullish',
        tags: ['opening-drive'],
      })
      insertSession(db, nextIso, {
        id: 'session_review_two',
        contract_id: 'contract_review_real',
        period_id: 'period_review_real',
        title: 'Opening drive B',
        started_at: '2026-03-26T03:00:00.000Z',
        market_bias: 'bearish',
        tags: ['opening-drive'],
      })

      insertTrade(db, nextIso, {
        id: 'trade_review_primary',
        session_id: 'session_review_one',
        symbol: 'NQ',
        side: 'long',
        status: 'closed',
        quantity: 2,
        entry_price: 100,
        stop_loss: 96,
        take_profit: 108,
        opened_at: '2026-03-26T01:10:00.000Z',
        closed_at: '2026-03-26T01:35:00.000Z',
        exit_price: 108,
        pnl_r: 2,
        thesis: '等待确认后继续做 opening drive reclaim。',
      })
      insertTrade(db, nextIso, {
        id: 'trade_review_secondary',
        session_id: 'session_review_two',
        symbol: 'NQ',
        side: 'short',
        status: 'closed',
        quantity: 1,
        entry_price: 106,
        stop_loss: 109,
        take_profit: 100,
        opened_at: '2026-03-26T03:05:00.000Z',
        closed_at: '2026-03-26T03:28:00.000Z',
        exit_price: 108,
        pnl_r: -1,
        thesis: '追空失败，确认不足时不该先手。',
      })

      insertEvaluation(db, nextIso, {
        id: 'evaluation_review_primary',
        session_id: 'session_review_one',
        trade_id: 'trade_review_primary',
        score: 88,
        note_md: '止损执行稳定，确认后再入场，过程符合计划。',
      })
      insertEvaluation(db, nextIso, {
        id: 'evaluation_review_secondary',
        session_id: 'session_review_two',
        trade_id: 'trade_review_secondary',
        score: 54,
        note_md: '追单后又提前离场，止损与确认都做得不够。',
      })

      insertAiRun(db, nextIso, {
        id: 'airun_review_primary',
        session_id: 'session_review_one',
        structured_response_json: JSON.stringify({
          bias: 'bullish',
          confidence_pct: 72,
          reversal_probability_pct: 24,
          entry_zone: '100-101',
          stop_loss: '99',
          take_profit: '104',
          invalidation: 'lose reclaim',
          summary_short: 'Primary trade analysis',
          deep_analysis_md: 'Primary trade analysis markdown.',
          supporting_factors: ['opening drive', 'reclaim'],
        }),
      })
      insertAiRun(db, nextIso, {
        id: 'airun_review_secondary',
        session_id: 'session_review_two',
        structured_response_json: JSON.stringify({
          bias: 'bullish',
          confidence_pct: 86,
          reversal_probability_pct: 30,
          entry_zone: '105-106',
          stop_loss: '109',
          take_profit: '100',
          invalidation: 'reclaim failure',
          summary_short: 'Secondary trade analysis',
          deep_analysis_md: 'Secondary trade analysis markdown.',
          supporting_factors: ['reversal risk', 'late chase'],
        }),
      })
      insertAiRun(db, nextIso, {
        id: 'airun_review_session',
        session_id: 'session_review_two',
        structured_response_json: JSON.stringify({
          bias: 'range',
          confidence_pct: 97,
          reversal_probability_pct: 18,
          entry_zone: 'session-level',
          stop_loss: 'n/a',
          take_profit: 'n/a',
          invalidation: 'session context shift',
          summary_short: 'Session-level analysis',
          deep_analysis_md: 'Session-level analysis markdown.',
          supporting_factors: ['session context'],
        }),
      })
      insertAiRun(db, nextIso, {
        id: 'airun_review_period',
        session_id: 'session_review_one',
        prompt_kind: 'period-review',
        prompt_preview: 'Structured period facts:\n- Period key: week:2026-W13\n- Period scope marker: [period_key=week:2026-W13]',
        structured_response_json: JSON.stringify({
          summary_short: '本周期 opening drive reclaim 比追空更稳定。',
          strengths: ['确认后入场样本更稳'],
          mistakes: ['追单与确认不足反复出现'],
          recurring_patterns: ['AI 与人工在强 setup 上更一致'],
          action_items: ['先收紧确认条件，再决定是否放行交易'],
          deep_analysis_md: 'Period review regression markdown.',
        }),
      })

      insertAnalysisCard(db, nextIso, {
        id: 'analysis_trade_primary',
        ai_run_id: 'airun_review_primary',
        session_id: 'session_review_one',
        trade_id: 'trade_review_primary',
        bias: 'bullish',
        confidence_pct: 72,
        summary_short: 'Primary trade analysis',
      })
      insertAnalysisCard(db, nextIso, {
        id: 'analysis_trade_secondary',
        ai_run_id: 'airun_review_secondary',
        session_id: 'session_review_two',
        trade_id: 'trade_review_secondary',
        bias: 'bullish',
        confidence_pct: 86,
        summary_short: 'Secondary trade analysis',
      })
      insertAnalysisCard(db, nextIso, {
        id: 'analysis_session_noise',
        ai_run_id: 'airun_review_session',
        session_id: 'session_review_two',
        trade_id: null,
        bias: 'range',
        confidence_pct: 97,
        summary_short: 'Session-level analysis',
      })
      insertAnalysisCard(db, nextIso, {
        id: 'analysis_period_review',
        ai_run_id: 'airun_review_period',
        session_id: 'session_review_one',
        trade_id: null,
        bias: 'neutral',
        confidence_pct: 0,
        summary_short: '本周期 opening drive reclaim 比追空更稳定。',
      })
      await recordAiAnalysisFailure(paths, {
        session_id: 'session_review_two',
        provider: 'openai',
        model: 'gpt-5.4-mini',
        prompt_kind: 'market-analysis',
        input_summary: 'period review failure regression',
        prompt_preview: 'period review failure regression prompt',
        failure_reason: 'provider timeout',
      })

      insertKnowledgeFixture(db, nextIso, {
        source_id: 'knowledge_source_review',
        job_id: 'knowledge_job_review',
        fragment_id: 'knowledge_fragment_review',
        card_id: 'knowledge_card_review',
        grounding_id: 'knowledge_grounding_review',
        session_id: 'session_review_one',
        trade_id: 'trade_review_primary',
        ai_run_id: 'airun_review_primary',
        title: 'Opening drive reclaim',
        summary: 'Only take the setup after reclaim confirmation.',
        content_md: 'Confirmation-based reclaim setup.',
      })

      const review = await getPeriodReview(paths, { period_id: 'period_review_real' })

      assert.equal(review.period.id, 'period_review_real')
      assert.equal(review.contract.id, 'contract_review_real')
      assert.equal(review.sessions.length, 2)
      assert.equal(review.period_rollup.period.id, 'period_review_real')
      assert.equal(review.period_rollup.stats.trade_count, 2)
      assert.equal(review.period_rollup.stats.resolved_trade_count, 2)
      assert.equal(review.period_rollup.stats.total_pnl_r, 1)
      assert.deepEqual(
        review.highlight_cards.map((card) => card.id),
        ['analysis_trade_secondary', 'analysis_trade_primary', 'analysis_session_noise'],
      )
      assert.equal(review.trade_metrics.length, 2)
      assert.ok(review.trade_metrics.some((metric) => metric.tags.some((tag) => tag.category === 'setup')))
      assert.equal(review.latest_period_ai_review?.ai_run.id, 'airun_review_period')
      assert.deepEqual(review.latest_period_ai_review?.structured?.action_items, ['先收紧确认条件，再决定是否放行交易'])
      assert.equal(review.ai_quality_summary.total_runs, 5)
      assert.equal(review.ai_quality_summary.structured_failure_count, 1)
      assert.ok(review.ai_quality_summary.recent_failures.some((failure) => failure.reason.includes('provider timeout')))
      assert.equal(review.evaluations.length, 2)
      assert.equal(review.evaluation_rollup.evaluated_count, 2)
      assert.equal(review.evaluation_rollup.pending_count, 0)
      assert.ok(review.evaluation_rollup.ai_vs_human.some((metric) => (metric.sample_count ?? 0) > 0))
      assert.ok(review.evaluation_rollup.error_patterns.length > 0)
      assert.ok(review.evaluation_rollup.effective_knowledge.some((item) => item.card_id === 'knowledge_card_review'))
      assert.ok(review.feedback_items.length > 0)
      assert.ok(review.rule_rollup.length > 0)
      assert.equal(review.setup_leaderboard[0]?.label, 'opening-drive')
      assert.equal(review.setup_leaderboard[0]?.sample_count, 2)
      assert.equal(review.profile_snapshot !== null, true)
      assert.ok((review.profile_snapshot?.execution_style[0]?.count ?? 0) > 0)
      assert.ok(review.training_insights.length > 0)
    })
  })

  await t.test('empty periods stay query-safe and do not fabricate review data', async() => {
    await withTempDb('period-review-empty', async({ paths, db, nextIso }) => {
      insertPeriod(db, nextIso, {
        id: 'period_review_filled',
        label: '2026-W12',
        start_at: '2026-03-16T00:00:00.000Z',
        end_at: '2026-03-22T23:59:59.000Z',
      })
      insertPeriod(db, nextIso, {
        id: 'period_review_empty',
        label: '2026-W14',
        start_at: '2026-03-30T00:00:00.000Z',
        end_at: '2026-04-05T23:59:59.000Z',
      })
      insertContract(db, nextIso, { id: 'contract_review_empty', symbol: 'NQ' })

      insertSession(db, nextIso, {
        id: 'session_review_filled',
        contract_id: 'contract_review_empty',
        period_id: 'period_review_filled',
        title: 'filled session',
      })
      insertTrade(db, nextIso, {
        id: 'trade_review_filled',
        session_id: 'session_review_filled',
        symbol: 'NQ',
        side: 'long',
        status: 'closed',
        pnl_r: 1,
        thesis: 'other period noise',
      })

      const emptyReview = await getPeriodReview(paths, { period_id: 'period_review_empty' })

      assert.equal(emptyReview.period.id, 'period_review_empty')
      assert.equal(emptyReview.contract.id, 'contract_review_empty')
      assert.equal(emptyReview.period_rollup.period.id, 'period_review_empty')
      assert.equal(emptyReview.period_rollup.stats.trade_count, 0)
      assert.deepEqual(emptyReview.sessions, [])
      assert.deepEqual(emptyReview.trade_metrics, [])
      assert.deepEqual(emptyReview.highlight_cards, [])
      assert.equal(emptyReview.latest_period_ai_review, null)
      assert.equal(emptyReview.ai_quality_summary.total_runs, 0)
      assert.deepEqual(emptyReview.evaluations, [])
      assert.equal(emptyReview.evaluation_rollup.evaluated_count, 0)
      assert.equal(emptyReview.evaluation_rollup.pending_count, 0)
      assert.deepEqual(emptyReview.feedback_items, [])
      assert.deepEqual(emptyReview.rule_rollup, [])
      assert.deepEqual(emptyReview.setup_leaderboard, [])
      assert.deepEqual(emptyReview.training_insights, [])
      assert.equal(emptyReview.profile_snapshot?.execution_style[0]?.count ?? 0, 0)
      assert.equal(emptyReview.profile_snapshot?.ai_collaboration[0]?.count ?? 0, 0)
    })
  })

  await t.test('period review backfills day and month rows while keeping sessions anchored to week context', async() => {
    await withTempDb('period-review-backfill', async({ paths, db, nextIso }) => {
      insertPeriod(db, nextIso, {
        id: 'period_week_only',
        kind: 'week',
        label: '2026-W13',
        start_at: '2026-03-23T00:00:00.000Z',
        end_at: '2026-03-29T23:59:59.000Z',
      })
      insertContract(db, nextIso, { id: 'contract_backfill', symbol: 'NQ' })
      insertSession(db, nextIso, {
        id: 'session_backfill',
        contract_id: 'contract_backfill',
        period_id: 'period_week_only',
        title: 'week anchored session',
        started_at: '2026-03-26T01:00:00.000Z',
        market_bias: 'bullish',
        tags: ['opening-drive'],
      })
      insertTrade(db, nextIso, {
        id: 'trade_backfill',
        session_id: 'session_backfill',
        symbol: 'NQ',
        side: 'long',
        status: 'closed',
        pnl_r: 1.5,
        thesis: 'backfill month coverage',
      })
      insertAiRun(db, nextIso, {
        id: 'airun_backfill_market',
        session_id: 'session_backfill',
        structured_response_json: JSON.stringify({
          bias: 'bullish',
          confidence_pct: 71,
          reversal_probability_pct: 18,
          entry_zone: '100-101',
          stop_loss: '99',
          take_profit: '103',
          invalidation: 'lose reclaim',
          summary_short: 'backfill prompt seed',
          deep_analysis_md: 'backfill prompt seed',
          supporting_factors: ['seed'],
        }),
      })
      insertAnalysisCard(db, nextIso, {
        id: 'analysis_backfill_market',
        ai_run_id: 'airun_backfill_market',
        session_id: 'session_backfill',
        trade_id: 'trade_backfill',
        bias: 'bullish',
        confidence_pct: 71,
        summary_short: 'backfill prompt seed',
      })

      const defaultReview = await getPeriodReview(paths)
      assert.equal(defaultReview.period.id, 'period_week_only')

      const monthRow = db.prepare(`
        SELECT id
        FROM periods
        WHERE kind = 'month' AND label = '2026-03'
        LIMIT 1
      `).get()
      const dayRow = db.prepare(`
        SELECT id
        FROM periods
        WHERE kind = 'day' AND label = '2026-03-26'
        LIMIT 1
      `).get()

      assert.ok(monthRow)
      assert.ok(dayRow)

      const monthReview = await getPeriodReview(paths, { period_id: monthRow.id })
      const dayReview = await getPeriodReview(paths, { period_id: dayRow.id })
      const monthPrompt = await runMockAiAnalysis(paths, {
        session_id: 'session_backfill',
        period_id: monthRow.id,
        prompt_kind: 'period-review',
      })
      const preservedSessionPeriod = db.prepare('SELECT period_id FROM sessions WHERE id = ? LIMIT 1').get('session_backfill')

      assert.equal(monthReview.sessions.length, 1)
      assert.equal(monthReview.trade_metrics.length, 1)
      assert.equal(monthReview.trade_metrics[0]?.trade_id, 'trade_backfill')
      assert.equal(dayReview.sessions.length, 1)
      assert.equal(dayReview.trade_metrics[0]?.trade_id, 'trade_backfill')
      assert.equal(preservedSessionPeriod.period_id, 'period_week_only')
      assert.match(monthPrompt.prompt_preview, /Period key: month:2026-03/)
    })
  })
})
