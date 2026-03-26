import assert from 'node:assert/strict'
import test from 'node:test'
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
      })
      insertAiRun(db, nextIso, {
        id: 'airun_review_secondary',
        session_id: 'session_review_two',
      })
      insertAiRun(db, nextIso, {
        id: 'airun_review_session',
        session_id: 'session_review_two',
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
      assert.deepEqual(
        review.highlight_cards.map((card) => card.id),
        ['analysis_trade_secondary', 'analysis_trade_primary', 'analysis_session_noise'],
      )
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
      insertPeriod(db, nextIso, { id: 'period_review_filled', label: '2026-W12' })
      insertPeriod(db, nextIso, { id: 'period_review_empty', label: '2026-W14' })
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
      assert.deepEqual(emptyReview.sessions, [])
      assert.deepEqual(emptyReview.highlight_cards, [])
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
})
