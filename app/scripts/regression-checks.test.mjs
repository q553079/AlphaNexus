import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { getDatabase } from '../src/main/db/connection.ts'
import { applyMigrations } from '../src/main/db/migrations.ts'
import {
  adoptMarketAnchor,
  buildActiveAnchorRuntimeSummary,
  getMarketAnchor,
  updatePersistedMarketAnchorStatus,
} from '../src/main/domain/knowledge-service.ts'
import { getTradeEvaluationSummary, getPeriodEvaluationRollup } from '../src/main/evaluation/evaluation-service.ts'
import { recallSimilarCases } from '../src/main/domain/suggestion-service.ts'
import {
  getSessionWorkbench,
  softDeleteAiRecord,
  softDeleteAnnotation,
  softDeleteScreenshot,
  undeleteAiRecord,
  undeleteAnnotation,
  undeleteScreenshot,
} from '../src/main/domain/workbench-service.ts'

const createPaths = async(name) => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), `alpha-nexus-${name}-`))
  const dataDir = path.join(rootDir, 'data')
  const vaultDir = path.join(rootDir, 'vault')
  return {
    rootDir,
    dataDir,
    vaultDir,
    screenshotsDir: path.join(vaultDir, 'screenshots'),
    exportsDir: path.join(vaultDir, 'exports'),
    databaseFile: path.join(dataDir, 'alpha-nexus.sqlite'),
  }
}

const createClock = () => {
  let tick = 0
  const base = Date.parse('2026-03-26T01:00:00.000Z')
  return () => new Date(base + (tick++ * 60_000)).toISOString()
}

const withTempDb = async(name, run) => {
  const paths = await createPaths(name)
  const db = await getDatabase(paths)
  applyMigrations(db)
  const nextIso = createClock()

  try {
    await run({ paths, db, nextIso })
  } finally {
    db.close()
    await rm(paths.rootDir, { recursive: true, force: true })
  }
}

const insertContract = (db, nextIso, input) => {
  db.prepare(`
    INSERT INTO contracts (id, schema_version, created_at, symbol, name, venue, asset_class, quote_currency)
    VALUES (?, 1, ?, ?, ?, 'CME', 'future', 'USD')
  `).run(input.id, nextIso(), input.symbol, input.name ?? `${input.symbol} contract`)
}

const insertPeriod = (db, nextIso, input) => {
  db.prepare(`
    INSERT INTO periods (id, schema_version, created_at, kind, label, start_at, end_at)
    VALUES (?, 1, ?, 'week', ?, ?, ?)
  `).run(
    input.id,
    nextIso(),
    input.label ?? input.id,
    input.start_at ?? '2026-03-23T00:00:00.000Z',
    input.end_at ?? '2026-03-29T23:59:59.000Z',
  )
}

const insertSession = (db, nextIso, input) => {
  db.prepare(`
    INSERT INTO sessions (
      id, schema_version, created_at, contract_id, period_id, title, status, started_at, ended_at,
      market_bias, tags_json, my_realtime_view, trade_plan_md, context_focus, deleted_at
    ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, NULL, ?, ?, '', '', '', NULL)
  `).run(
    input.id,
    nextIso(),
    input.contract_id,
    input.period_id,
    input.title ?? input.id,
    input.status ?? 'active',
    input.started_at ?? nextIso(),
    input.market_bias ?? 'bullish',
    JSON.stringify(input.tags ?? []),
  )
}

const insertTrade = (db, nextIso, input) => {
  db.prepare(`
    INSERT INTO trades (
      id, schema_version, created_at, session_id, symbol, side, status, quantity, entry_price,
      stop_loss, take_profit, exit_price, pnl_r, opened_at, closed_at, thesis, deleted_at
    ) VALUES (?, 1, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
  `).run(
    input.id,
    nextIso(),
    input.session_id,
    input.symbol,
    input.side,
    input.status ?? 'closed',
    input.entry_price ?? 100,
    input.stop_loss ?? 95,
    input.take_profit ?? 110,
    input.exit_price ?? (input.status === 'closed' ? 108 : null),
    input.pnl_r ?? null,
    input.opened_at ?? nextIso(),
    input.closed_at ?? (input.status === 'closed' ? nextIso() : null),
    input.thesis ?? '',
  )
}

const insertEvaluation = (db, nextIso, input) => {
  db.prepare(`
    INSERT INTO evaluations (id, schema_version, created_at, session_id, trade_id, score, note_md, deleted_at)
    VALUES (?, 1, ?, ?, ?, ?, ?, NULL)
  `).run(input.id, nextIso(), input.session_id, input.trade_id, input.score ?? 80, input.note_md ?? '')
}

const insertEvent = (db, nextIso, input) => {
  db.prepare(`
    INSERT INTO events (
      id, schema_version, created_at, session_id, trade_id, event_type, title, summary,
      author_kind, occurred_at, content_block_ids_json, screenshot_id, ai_run_id, deleted_at
    ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
  `).run(
    input.id,
    nextIso(),
    input.session_id,
    input.trade_id ?? null,
    input.event_type,
    input.title,
    input.summary,
    input.author_kind ?? 'user',
    input.occurred_at ?? nextIso(),
    JSON.stringify(input.content_block_ids ?? []),
    input.screenshot_id ?? null,
    input.ai_run_id ?? null,
  )
}

const insertScreenshot = (db, nextIso, input) => {
  db.prepare(`
    INSERT INTO screenshots (
      id, schema_version, created_at, session_id, event_id, kind, file_path, asset_url,
      caption, width, height, deleted_at
    ) VALUES (?, 1, ?, ?, ?, 'chart', ?, ?, ?, 1600, 900, NULL)
  `).run(
    input.id,
    nextIso(),
    input.session_id,
    input.event_id ?? null,
    input.file_path ?? `${input.id}.png`,
    input.asset_url ?? `file:///${input.id}.png`,
    input.caption ?? input.id,
  )
}

const insertAnnotation = (db, nextIso, input) => {
  db.prepare(`
    INSERT INTO annotations (
      id, schema_version, created_at, screenshot_id, shape, label, color, x1, y1, x2, y2, text, stroke_width, deleted_at
    ) VALUES (?, 1, ?, ?, 'rectangle', ?, '#355c5a', 10, 20, 120, 180, NULL, 2, NULL)
  `).run(input.id, nextIso(), input.screenshot_id, input.label ?? input.id)
}

const insertAiRun = (db, nextIso, input) => {
  db.prepare(`
    INSERT INTO ai_runs (
      id, schema_version, created_at, session_id, event_id, provider, model, status,
      prompt_kind, input_summary, finished_at, deleted_at
    ) VALUES (?, 1, ?, ?, ?, 'deepseek', 'deepseek-reasoner', 'completed', ?, ?, ?, NULL)
  `).run(
    input.id,
    nextIso(),
    input.session_id,
    input.event_id ?? null,
    input.prompt_kind ?? 'market-analysis',
    input.input_summary ?? input.id,
    input.finished_at ?? nextIso(),
  )
}

const insertAnalysisCard = (db, nextIso, input) => {
  db.prepare(`
    INSERT INTO analysis_cards (
      id, schema_version, created_at, ai_run_id, session_id, trade_id, bias, confidence_pct,
      reversal_probability_pct, entry_zone, stop_loss, take_profit, invalidation,
      summary_short, deep_analysis_md, supporting_factors_json, deleted_at
    ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, 20, '100-101', '99', '103', 'loss of level', ?, 'deep analysis', '[]', NULL)
  `).run(
    input.id,
    nextIso(),
    input.ai_run_id,
    input.session_id,
    input.trade_id ?? null,
    input.bias,
    input.confidence_pct,
    input.summary_short ?? `${input.bias} summary`,
  )
}

const insertContentBlock = (db, nextIso, input) => {
  db.prepare(`
    INSERT INTO content_blocks (
      id, schema_version, created_at, session_id, event_id, block_type, title, content_md,
      sort_order, context_type, context_id, soft_deleted, deleted_at
    ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)
  `).run(
    input.id,
    nextIso(),
    input.session_id,
    input.event_id ?? null,
    input.block_type ?? 'markdown',
    input.title,
    input.content_md ?? input.title,
    input.sort_order ?? 1,
    input.context_type ?? 'event',
    input.context_id,
  )
}

const ids = (rows, selector = (row) => row.id ?? row.anchor_id) => rows.map(selector).sort()

test('AlphaNexus regression guards', async(t) => {
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

  await t.test('delete and restore flows stay query-safe', async() => {
    await withTempDb('delete-guards', async({ paths, db, nextIso }) => {
      insertPeriod(db, nextIso, { id: 'period_delete' })
      insertContract(db, nextIso, { id: 'contract_delete', symbol: 'NQ' })
      insertSession(db, nextIso, {
        id: 'session_delete',
        contract_id: 'contract_delete',
        period_id: 'period_delete',
        title: 'delete session',
        tags: ['delete'],
      })
      insertTrade(db, nextIso, {
        id: 'trade_delete',
        session_id: 'session_delete',
        symbol: 'NQ',
        side: 'long',
        status: 'open',
        pnl_r: null,
        exit_price: null,
        closed_at: null,
        thesis: 'keep workbench clean',
      })

      insertScreenshot(db, nextIso, {
        id: 'shot_delete',
        session_id: 'session_delete',
        event_id: 'event_shot_delete',
        caption: 'delete shot',
      })
      insertAnnotation(db, nextIso, {
        id: 'ann_delete',
        screenshot_id: 'shot_delete',
        label: 'DEL-1',
      })
      insertEvent(db, nextIso, {
        id: 'event_shot_delete',
        session_id: 'session_delete',
        event_type: 'screenshot',
        title: 'import shot',
        summary: 'shot attached',
        screenshot_id: 'shot_delete',
      })

      insertAiRun(db, nextIso, {
        id: 'airun_delete',
        session_id: 'session_delete',
        event_id: 'event_ai_delete',
      })
      insertAnalysisCard(db, nextIso, {
        id: 'analysis_delete',
        ai_run_id: 'airun_delete',
        session_id: 'session_delete',
        trade_id: 'trade_delete',
        bias: 'bullish',
        confidence_pct: 73,
        summary_short: 'delete me',
      })
      insertContentBlock(db, nextIso, {
        id: 'block_ai_delete',
        session_id: 'session_delete',
        event_id: 'event_ai_delete',
        block_type: 'ai-summary',
        title: 'AI summary',
        content_md: 'delete chain content',
        context_type: 'event',
        context_id: 'event_ai_delete',
        sort_order: 1,
      })
      insertEvent(db, nextIso, {
        id: 'event_ai_delete',
        session_id: 'session_delete',
        trade_id: 'trade_delete',
        event_type: 'ai_summary',
        title: 'AI event',
        summary: 'ai summary visible',
        author_kind: 'ai',
        content_block_ids: ['block_ai_delete'],
        screenshot_id: 'shot_delete',
        ai_run_id: 'airun_delete',
      })

      const before = await getSessionWorkbench(paths, { session_id: 'session_delete' })
      assert(before.screenshots.some((shot) => shot.id === 'shot_delete'))
      assert(before.screenshots[0]?.annotations.some((annotation) => annotation.id === 'ann_delete'))
      assert(before.ai_runs.some((run) => run.id === 'airun_delete'))
      assert(before.analysis_cards.some((card) => card.id === 'analysis_delete'))
      assert(before.events.some((eventItem) => eventItem.id === 'event_shot_delete'))
      assert(before.events.some((eventItem) => eventItem.id === 'event_ai_delete'))

      await softDeleteAnnotation(paths, { annotation_id: 'ann_delete' })
      const afterAnnotationDelete = await getSessionWorkbench(paths, { session_id: 'session_delete' })
      const annotationShot = afterAnnotationDelete.screenshots.find((shot) => shot.id === 'shot_delete')
      assert(annotationShot)
      assert.equal(annotationShot.annotations.some((annotation) => annotation.id === 'ann_delete'), false)
      assert.equal(annotationShot.deleted_annotations.some((annotation) => annotation.id === 'ann_delete'), true)

      await undeleteAnnotation(paths, { annotation_id: 'ann_delete' })
      const afterAnnotationRestore = await getSessionWorkbench(paths, { session_id: 'session_delete' })
      const restoredShot = afterAnnotationRestore.screenshots.find((shot) => shot.id === 'shot_delete')
      assert(restoredShot?.annotations.some((annotation) => annotation.id === 'ann_delete'))

      await softDeleteScreenshot(paths, { screenshot_id: 'shot_delete' })
      const afterScreenshotDelete = await getSessionWorkbench(paths, { session_id: 'session_delete' })
      assert.equal(afterScreenshotDelete.screenshots.some((shot) => shot.id === 'shot_delete'), false)
      assert.equal(afterScreenshotDelete.deleted_screenshots.some((shot) => shot.id === 'shot_delete'), true)
      assert.equal(afterScreenshotDelete.events.some((eventItem) => eventItem.id === 'event_shot_delete'), false)

      await undeleteScreenshot(paths, { screenshot_id: 'shot_delete' })
      const afterScreenshotRestore = await getSessionWorkbench(paths, { session_id: 'session_delete' })
      assert(afterScreenshotRestore.screenshots.some((shot) => shot.id === 'shot_delete'))
      assert(afterScreenshotRestore.events.some((eventItem) => eventItem.id === 'event_shot_delete'))

      await softDeleteAiRecord(paths, { ai_run_id: 'airun_delete' })
      const afterAiDelete = await getSessionWorkbench(paths, { session_id: 'session_delete' })
      assert.equal(afterAiDelete.ai_runs.some((run) => run.id === 'airun_delete'), false)
      assert.equal(afterAiDelete.analysis_cards.some((card) => card.id === 'analysis_delete'), false)
      assert.equal(afterAiDelete.events.some((eventItem) => eventItem.id === 'event_ai_delete'), false)
      assert.equal(afterAiDelete.deleted_ai_records.some((record) => record.ai_run.id === 'airun_delete'), true)
      assert.equal(
        afterAiDelete.content_blocks.find((block) => block.id === 'block_ai_delete')?.soft_deleted,
        true,
      )

      await undeleteAiRecord(paths, { ai_run_id: 'airun_delete' })
      const afterAiRestore = await getSessionWorkbench(paths, { session_id: 'session_delete' })
      assert(afterAiRestore.ai_runs.some((run) => run.id === 'airun_delete'))
      assert(afterAiRestore.analysis_cards.some((card) => card.id === 'analysis_delete'))
      assert(afterAiRestore.events.some((eventItem) => eventItem.id === 'event_ai_delete'))
      assert.equal(afterAiRestore.deleted_ai_records.some((record) => record.ai_run.id === 'airun_delete'), false)
      assert.equal(
        afterAiRestore.content_blocks.find((block) => block.id === 'block_ai_delete')?.soft_deleted,
        false,
      )
    })
  })
})
