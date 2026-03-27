import assert from 'node:assert/strict'
import test from 'node:test'
import {
  adoptMarketAnchor,
  buildActiveAnchorRuntimeSummary,
  getApprovedKnowledgeRuntime,
  getMarketAnchor,
  ingestKnowledgeSource,
  reviewKnowledgeDraftCard,
  updatePersistedMarketAnchorStatus,
} from '../../src/main/domain/knowledge-service.ts'
import { getTradeEvaluationSummary, getPeriodEvaluationRollup } from '../../src/main/evaluation/evaluation-service.ts'
import { recallSimilarCases } from '../../src/main/domain/suggestion-service.ts'
import {
  ids,
  insertAiRun,
  insertAnalysisCard,
  insertAnnotation,
  insertContract,
  insertEvaluation,
  insertEvent,
  insertPeriod,
  insertScreenshot,
  insertSession,
  insertTrade,
  withTempDb,
} from './helpers.mjs'

test('AlphaNexus knowledge regression guards', async(t) => {
  await t.test('knowledge draft edit-approve publishes approved runtime hits with scoped fields', async() => {
    await withTempDb('knowledge-review-runtime', async({ paths }) => {
      const ingested = await ingestKnowledgeSource(paths, {
        source_type: 'article',
        title: 'VWAP reclaim handbook',
        contract_scope: 'NQ',
        timeframe_scope: '5m',
        tags: ['opening-drive', 'support'],
        extraction_mode: 'heuristic',
        content_md: [
          '# VWAP reclaim continuation',
          '',
          'setup: 重新站上 VWAP 后，等待第一次回踩不破再考虑顺势参与。',
          '',
          'entry-rule: 回踩重新吸收时入场，不在第一根扩展 K 上追价。',
          '',
          'invalidation: 跌回 VWAP 下方并反抽失败时，放弃延续假设。',
          '',
          'risk-rule: 单次风险不超过账户 1%。',
        ].join('\n'),
      })

      assert.equal(ingested.draft_cards.length > 0, true)
      const reviewed = await reviewKnowledgeDraftCard(paths, {
        knowledge_card_id: ingested.draft_cards[0].id,
        action: 'edit-approve',
        reviewed_by: 'regression',
        review_note_md: 'promote after scoped edit',
        edit_payload: {
          card_type: 'setup',
          title: 'VWAP reclaim continuation',
          summary: '重新站上 VWAP 后，第一次回踩不破才按延续处理。',
          content_md: '重新站上 VWAP 后，等待第一次回踩不破，再按延续处理。',
          trigger_conditions_md: '- 第一次回踩不破\n- 买盘重新吸收',
          invalidation_md: '跌回 VWAP 下方并反抽失败。',
          risk_rule_md: '单次风险不超过账户 1%。',
          contract_scope: ['NQ'],
          timeframe_scope: ['5m'],
          tags: ['opening-drive', 'support'],
        },
      })

      assert.equal(reviewed.status, 'approved')
      assert.equal(reviewed.title, 'VWAP reclaim continuation')
      assert.equal(reviewed.contract_scope, 'NQ')
      assert.equal(reviewed.timeframe_scope, '5m')
      assert.equal(reviewed.tags_json, JSON.stringify(['opening-drive', 'support']))

      const runtime = await getApprovedKnowledgeRuntime(paths, {
        contract_scope: 'NQ',
        timeframe_scope: '5m',
        tags: ['opening-drive'],
        annotation_semantic: 'support',
        trade_state: 'pre_entry',
        context_tags: ['opening-drive'],
        limit: 4,
      })

      assert.equal(runtime.hits.length, 1)
      assert.equal(runtime.hits[0]?.knowledge_card_id, reviewed.id)
      assert.equal(runtime.hits[0]?.relevance_score >= 0.55, true)
      assert.equal(runtime.hits[0]?.fragment_excerpt.length > 0, true)
      assert.equal(runtime.hits[0]?.match_reasons.some((reason) => reason.includes('annotation_semantic=support')), true)
    })
  })

  await t.test('anchor persistence and filters stay correct', async() => {
    await withTempDb('anchor-guards', async({ paths, db, nextIso }) => {
      insertPeriod(db, nextIso, { id: 'period_anchor' })
      insertContract(db, nextIso, { id: 'contract_nq', symbol: 'NQ' })
      insertContract(db, nextIso, { id: 'contract_es', symbol: 'ES' })
      insertSession(db, nextIso, {
        id: 'session_nq',
        contract_id: 'contract_nq',
        period_id: 'period_anchor',
        title: 'NQ session',
        tags: ['opening', 'reclaim'],
      })
      insertSession(db, nextIso, {
        id: 'session_es',
        contract_id: 'contract_es',
        period_id: 'period_anchor',
        title: 'ES session',
        tags: ['opening', 'reclaim'],
      })
      insertTrade(db, nextIso, {
        id: 'trade_nq',
        session_id: 'session_nq',
        symbol: 'NQ',
        side: 'long',
        status: 'open',
        pnl_r: null,
        exit_price: null,
        closed_at: null,
        thesis: 'opening reclaim',
      })
      insertTrade(db, nextIso, {
        id: 'trade_es',
        session_id: 'session_es',
        symbol: 'ES',
        side: 'short',
        status: 'open',
        pnl_r: null,
        exit_price: null,
        closed_at: null,
        thesis: 'fade rejection',
      })
      insertScreenshot(db, nextIso, { id: 'shot_nq', session_id: 'session_nq', caption: 'NQ shot' })
      insertScreenshot(db, nextIso, { id: 'shot_es', session_id: 'session_es', caption: 'ES shot' })
      insertAnnotation(db, nextIso, { id: 'ann_nq', screenshot_id: 'shot_nq', label: 'A1' })
      insertAnnotation(db, nextIso, { id: 'ann_es', screenshot_id: 'shot_es', label: 'B1' })

      const adoptedNq = await adoptMarketAnchor(paths, {
        contract_id: 'contract_nq',
        session_id: 'session_nq',
        trade_id: 'trade_nq',
        source_annotation_id: 'ann_nq',
        source_annotation_label: 'A1',
        source_screenshot_id: 'shot_nq',
        title: 'NQ Opening Reclaim',
        semantic_type: 'support',
        carry_forward: true,
        thesis_md: 'hold reclaim',
        invalidation_rule_md: 'lose reclaim',
      })
      const adoptedEs = await adoptMarketAnchor(paths, {
        contract_id: 'contract_es',
        session_id: 'session_es',
        trade_id: 'trade_es',
        source_annotation_id: 'ann_es',
        source_annotation_label: 'B1',
        source_screenshot_id: 'shot_es',
        title: 'ES Opening Fade',
        semantic_type: 'resistance',
        carry_forward: true,
        thesis_md: 'fade rejection',
        invalidation_rule_md: 'break higher',
      })

      await updatePersistedMarketAnchorStatus(paths, {
        anchor_id: adoptedNq.id,
        status: 'invalidated',
        reason_md: 'structure broke',
      })

      const reread = await getMarketAnchor(paths, adoptedNq.id)
      assert.equal(reread.status, 'invalidated')
      assert.equal(reread.title, 'NQ Opening Reclaim')
      assert.equal(reread.origin_annotation_id, 'ann_nq')

      const bySession = await buildActiveAnchorRuntimeSummary(paths, {
        session_id: 'session_es',
        status: 'active',
      })
      assert.deepEqual(ids(bySession.anchors), [adoptedEs.id])

      const byContract = await buildActiveAnchorRuntimeSummary(paths, {
        contract_id: 'contract_es',
        status: 'active',
      })
      assert.deepEqual(ids(byContract.anchors), [adoptedEs.id])

      const byStatus = await buildActiveAnchorRuntimeSummary(paths, {
        contract_id: 'contract_nq',
        status: 'invalidated',
      })
      assert.deepEqual(ids(byStatus.anchors), [adoptedNq.id])

      const byTrade = await buildActiveAnchorRuntimeSummary(paths, {
        trade_id: 'trade_nq',
        status: 'invalidated',
      })
      assert.deepEqual(ids(byTrade.anchors), [adoptedNq.id])
    })
  })

  await t.test('trade evaluation stays trade-scoped inside one session', async() => {
    await withTempDb('evaluation-guards', async({ paths, db, nextIso }) => {
      insertPeriod(db, nextIso, { id: 'period_eval' })
      insertContract(db, nextIso, { id: 'contract_nq_eval', symbol: 'NQ' })
      insertSession(db, nextIso, {
        id: 'session_eval',
        contract_id: 'contract_nq_eval',
        period_id: 'period_eval',
        title: 'multi-trade session',
        market_bias: 'bullish',
        tags: ['multi', 'trade'],
      })
      insertTrade(db, nextIso, {
        id: 'trade_eval_1',
        session_id: 'session_eval',
        symbol: 'NQ',
        side: 'long',
        status: 'closed',
        pnl_r: 2,
        exit_price: 104,
        thesis: 'reclaim continuation',
      })
      insertTrade(db, nextIso, {
        id: 'trade_eval_2',
        session_id: 'session_eval',
        symbol: 'NQ',
        side: 'short',
        status: 'closed',
        pnl_r: -1.5,
        exit_price: 102,
        thesis: 'failed fade',
      })
      insertEvaluation(db, nextIso, {
        id: 'eval_1',
        session_id: 'session_eval',
        trade_id: 'trade_eval_1',
        score: 81,
        note_md: 'good execution',
      })
      insertEvaluation(db, nextIso, {
        id: 'eval_2',
        session_id: 'session_eval',
        trade_id: 'trade_eval_2',
        score: 64,
        note_md: 'late risk response',
      })

      insertAiRun(db, nextIso, { id: 'airun_trade_1', session_id: 'session_eval' })
      insertAnalysisCard(db, nextIso, {
        id: 'analysis_trade_1',
        ai_run_id: 'airun_trade_1',
        session_id: 'session_eval',
        trade_id: 'trade_eval_1',
        bias: 'bullish',
        confidence_pct: 82,
        summary_short: 'trade one bullish',
      })

      insertAiRun(db, nextIso, { id: 'airun_trade_2', session_id: 'session_eval' })
      insertAnalysisCard(db, nextIso, {
        id: 'analysis_trade_2',
        ai_run_id: 'airun_trade_2',
        session_id: 'session_eval',
        trade_id: 'trade_eval_2',
        bias: 'bearish',
        confidence_pct: 55,
        summary_short: 'trade two bearish',
      })

      insertAiRun(db, nextIso, { id: 'airun_session_level', session_id: 'session_eval' })
      insertAnalysisCard(db, nextIso, {
        id: 'analysis_session_level',
        ai_run_id: 'airun_session_level',
        session_id: 'session_eval',
        trade_id: null,
        bias: 'neutral',
        confidence_pct: 97,
        summary_short: 'session level only',
      })

      const tradeOneSummary = await getTradeEvaluationSummary(paths, 'trade_eval_1')
      const tradeTwoSummary = await getTradeEvaluationSummary(paths, 'trade_eval_2')
      assert.equal(tradeOneSummary?.ai_judgment?.bias, 'bullish')
      assert.equal(tradeOneSummary?.ai_judgment?.confidence_pct, 82)
      assert.equal(tradeTwoSummary?.ai_judgment?.bias, 'bearish')
      assert.equal(tradeTwoSummary?.ai_judgment?.confidence_pct, 55)

      const rollup = await getPeriodEvaluationRollup(paths, 'period_eval')
      const bucket76to90 = rollup.calibration_buckets.find((bucket) => bucket.label === '76-90')
      const bucket41to60 = rollup.calibration_buckets.find((bucket) => bucket.label === '41-60')
      const bucket91to100 = rollup.calibration_buckets.find((bucket) => bucket.label === '91-100')
      assert.equal(bucket76to90?.sample_count, 1)
      assert.equal(bucket41to60?.sample_count, 1)
      assert.equal(bucket91to100?.sample_count, 0)
      assert.equal(rollup.evaluated_count, 2)
    })
  })

  await t.test('similar cases honor contract_id filtering', async() => {
    await withTempDb('similar-case-guards', async({ paths, db, nextIso }) => {
      insertPeriod(db, nextIso, { id: 'period_cases' })
      insertContract(db, nextIso, { id: 'contract_nq_cases', symbol: 'NQ' })
      insertContract(db, nextIso, { id: 'contract_es_cases', symbol: 'ES' })

      insertSession(db, nextIso, {
        id: 'session_case_nq',
        contract_id: 'contract_nq_cases',
        period_id: 'period_cases',
        title: 'NQ opening drive reclaim',
        tags: ['opening', 'drive', 'reclaim'],
        market_bias: 'bullish',
      })
      insertTrade(db, nextIso, {
        id: 'trade_case_nq',
        session_id: 'session_case_nq',
        symbol: 'NQ',
        side: 'long',
        status: 'closed',
        pnl_r: 1.8,
        thesis: 'opening drive reclaim continuation',
      })
      insertEvaluation(db, nextIso, {
        id: 'eval_case_nq',
        session_id: 'session_case_nq',
        trade_id: 'trade_case_nq',
        score: 88,
        note_md: 'opening drive reclaim continuation worked well',
      })
      insertEvent(db, nextIso, {
        id: 'event_case_nq',
        session_id: 'session_case_nq',
        trade_id: 'trade_case_nq',
        event_type: 'observation',
        title: 'opening drive reclaim',
        summary: 'opening drive reclaim continuation held',
      })
      insertAiRun(db, nextIso, { id: 'airun_case_nq', session_id: 'session_case_nq' })
      insertAnalysisCard(db, nextIso, {
        id: 'analysis_case_nq',
        ai_run_id: 'airun_case_nq',
        session_id: 'session_case_nq',
        trade_id: 'trade_case_nq',
        bias: 'bullish',
        confidence_pct: 79,
        summary_short: 'opening drive reclaim continuation',
      })

      insertSession(db, nextIso, {
        id: 'session_case_es',
        contract_id: 'contract_es_cases',
        period_id: 'period_cases',
        title: 'ES opening drive reclaim',
        tags: ['opening', 'drive', 'reclaim'],
        market_bias: 'bullish',
      })
      insertTrade(db, nextIso, {
        id: 'trade_case_es',
        session_id: 'session_case_es',
        symbol: 'ES',
        side: 'long',
        status: 'closed',
        pnl_r: 2.1,
        thesis: 'opening drive reclaim continuation',
      })
      insertEvaluation(db, nextIso, {
        id: 'eval_case_es',
        session_id: 'session_case_es',
        trade_id: 'trade_case_es',
        score: 91,
        note_md: 'opening drive reclaim continuation also matched here',
      })
      insertEvent(db, nextIso, {
        id: 'event_case_es',
        session_id: 'session_case_es',
        trade_id: 'trade_case_es',
        event_type: 'observation',
        title: 'opening drive reclaim',
        summary: 'opening drive reclaim continuation held',
      })
      insertAiRun(db, nextIso, { id: 'airun_case_es', session_id: 'session_case_es' })
      insertAnalysisCard(db, nextIso, {
        id: 'analysis_case_es',
        ai_run_id: 'airun_case_es',
        session_id: 'session_case_es',
        trade_id: 'trade_case_es',
        bias: 'bullish',
        confidence_pct: 83,
        summary_short: 'opening drive reclaim continuation',
      })

      const result = await recallSimilarCases(paths, {
        contract_id: 'contract_nq_cases',
        semantic_tags: ['opening', 'drive', 'reclaim'],
        timeframe_scope: '5m',
        trade_context: 'opening drive reclaim continuation',
        limit: 5,
      })

      assert.equal(result.hits.length, 1)
      assert.equal(result.hits[0]?.session_id, 'session_case_nq')
      assert.equal(result.hits[0]?.trade_id, 'trade_case_nq')
    })
  })
})
