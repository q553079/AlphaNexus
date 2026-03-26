import assert from 'node:assert/strict'
import test from 'node:test'
import { savePendingSnip } from '../../src/main/capture/capture-service.ts'
import {
  closeExistingTrade,
  getTradeDetail,
  openTradeForSession,
} from '../../src/main/domain/workbench-service.ts'
import {
  createCaptureSaveDependencies,
  insertAiRun,
  insertAnalysisCard,
  insertContentBlock,
  insertContract,
  insertEvaluation,
  insertEvent,
  insertPeriod,
  insertScreenshot,
  insertSession,
  insertTrade,
  setRegressionPendingCapture,
  withTempDb,
} from './helpers.mjs'

const fullSelection = {
  x: 0,
  y: 0,
  width: 1,
  height: 1,
}

test('AlphaNexus trade detail regression guards', async(t) => {
  await t.test('trade detail payload exposes layered thread sections for one trade only', async() => {
    await withTempDb('trade-detail-layered-payload', async({ paths, db, nextIso }) => {
      insertPeriod(db, nextIso, { id: 'period_trade_detail_layered' })
      insertContract(db, nextIso, { id: 'contract_trade_detail_layered', symbol: 'NQ' })
      insertSession(db, nextIso, {
        id: 'session_trade_detail_layered',
        contract_id: 'contract_trade_detail_layered',
        period_id: 'period_trade_detail_layered',
        title: 'trade detail layered session',
      })
      insertTrade(db, nextIso, {
        id: 'trade_detail_layered',
        session_id: 'session_trade_detail_layered',
        symbol: 'NQ',
        side: 'long',
        status: 'closed',
        quantity: 2,
        entry_price: 100,
        stop_loss: 95,
        take_profit: 110,
        opened_at: '2026-03-26T03:00:00.000Z',
        closed_at: '2026-03-26T03:18:00.000Z',
        exit_price: 109,
        pnl_r: 1.8,
        thesis: 'layered target trade thesis',
      })

      insertScreenshot(db, nextIso, {
        id: 'shot_trade_layered_setup',
        session_id: 'session_trade_detail_layered',
        event_id: 'event_trade_layered_setup',
        kind: 'chart',
        caption: 'setup screenshot',
      })
      insertContentBlock(db, nextIso, {
        id: 'block_trade_layered_plan',
        session_id: 'session_trade_detail_layered',
        event_id: 'event_trade_layered_open',
        title: 'Trade execution checklist',
        content_md: 'wait reclaim and first pullback',
        context_type: 'trade',
        context_id: 'trade_detail_layered',
      })
      insertEvent(db, nextIso, {
        id: 'event_trade_layered_setup',
        session_id: 'session_trade_detail_layered',
        trade_id: 'trade_detail_layered',
        event_type: 'screenshot',
        title: 'Setup screenshot',
        summary: 'setup screenshot for the trade',
        screenshot_id: 'shot_trade_layered_setup',
        occurred_at: '2026-03-26T02:58:00.000Z',
      })
      insertEvent(db, nextIso, {
        id: 'event_trade_layered_open',
        session_id: 'session_trade_detail_layered',
        trade_id: 'trade_detail_layered',
        event_type: 'trade_open',
        title: 'Trade open',
        summary: 'opened the trade',
        content_block_ids: ['block_trade_layered_plan'],
        occurred_at: '2026-03-26T03:00:00.000Z',
      })

      insertScreenshot(db, nextIso, {
        id: 'shot_trade_layered_manage',
        session_id: 'session_trade_detail_layered',
        event_id: 'event_trade_layered_manage',
        kind: 'execution',
        caption: 'manage screenshot',
      })
      insertContentBlock(db, nextIso, {
        id: 'block_trade_layered_manage_note',
        session_id: 'session_trade_detail_layered',
        event_id: 'event_trade_layered_manage',
        title: 'Manage note',
        content_md: 'held through second confirmation',
        context_type: 'event',
        context_id: 'event_trade_layered_manage',
      })
      insertEvent(db, nextIso, {
        id: 'event_trade_layered_manage',
        session_id: 'session_trade_detail_layered',
        trade_id: 'trade_detail_layered',
        event_type: 'screenshot',
        title: 'Manage screenshot',
        summary: 'manage screenshot for the trade',
        screenshot_id: 'shot_trade_layered_manage',
        content_block_ids: ['block_trade_layered_manage_note'],
        occurred_at: '2026-03-26T03:08:00.000Z',
      })

      insertAiRun(db, nextIso, {
        id: 'airun_trade_layered',
        session_id: 'session_trade_detail_layered',
        event_id: 'event_trade_layered_ai',
      })
      insertContentBlock(db, nextIso, {
        id: 'block_trade_layered_ai',
        session_id: 'session_trade_detail_layered',
        event_id: 'event_trade_layered_ai',
        title: 'AI summary block',
        block_type: 'ai-summary',
        content_md: 'ai summary for the target trade',
        context_type: 'event',
        context_id: 'event_trade_layered_ai',
      })
      insertAnalysisCard(db, nextIso, {
        id: 'analysis_trade_layered',
        ai_run_id: 'airun_trade_layered',
        session_id: 'session_trade_detail_layered',
        trade_id: 'trade_detail_layered',
        bias: 'bullish',
        confidence_pct: 74,
        summary_short: 'layered ai summary',
      })
      insertEvent(db, nextIso, {
        id: 'event_trade_layered_ai',
        session_id: 'session_trade_detail_layered',
        trade_id: 'trade_detail_layered',
        event_type: 'ai_summary',
        title: 'AI summary',
        summary: 'ai summary for the target trade',
        ai_run_id: 'airun_trade_layered',
        content_block_ids: ['block_trade_layered_ai'],
        occurred_at: '2026-03-26T03:05:00.000Z',
      })

      insertScreenshot(db, nextIso, {
        id: 'shot_trade_layered_exit',
        session_id: 'session_trade_detail_layered',
        event_id: 'event_trade_layered_exit',
        kind: 'exit',
        caption: 'exit screenshot',
      })
      insertContentBlock(db, nextIso, {
        id: 'block_trade_layered_exit',
        session_id: 'session_trade_detail_layered',
        event_id: 'event_trade_layered_exit',
        title: 'Exit note',
        content_md: 'saved the exit evidence before close',
        context_type: 'event',
        context_id: 'event_trade_layered_exit',
      })
      insertEvent(db, nextIso, {
        id: 'event_trade_layered_exit',
        session_id: 'session_trade_detail_layered',
        trade_id: 'trade_detail_layered',
        event_type: 'screenshot',
        title: 'Exit screenshot',
        summary: 'exit screenshot for the trade',
        screenshot_id: 'shot_trade_layered_exit',
        content_block_ids: ['block_trade_layered_exit'],
        occurred_at: '2026-03-26T03:16:00.000Z',
      })

      insertContentBlock(db, nextIso, {
        id: 'block_trade_layered_review',
        session_id: 'session_trade_detail_layered',
        event_id: 'event_trade_layered_review',
        title: 'Exit review draft',
        content_md: [
          '# Exit review draft',
          '',
          '## 偏差',
          '',
          '- 执行时有一段提前评估了流动性变化。',
          '',
          '## 下次改进',
          '',
          '- 继续保留 setup reclaim 的确认动作。',
        ].join('\n'),
        context_type: 'trade',
        context_id: 'trade_detail_layered',
      })
      insertEvent(db, nextIso, {
        id: 'event_trade_layered_review',
        session_id: 'session_trade_detail_layered',
        trade_id: 'trade_detail_layered',
        event_type: 'review',
        title: 'Trade review draft',
        summary: 'review draft for the target trade',
        content_block_ids: ['block_trade_layered_review'],
        occurred_at: '2026-03-26T03:19:00.000Z',
      })

      insertEvaluation(db, nextIso, {
        id: 'evaluation_trade_layered',
        session_id: 'session_trade_detail_layered',
        trade_id: 'trade_detail_layered',
        score: 82,
        note_md: 'execution stayed reasonably close to plan',
      })

      const detail = await getTradeDetail(paths, { trade_id: 'trade_detail_layered' })
      assert.equal(detail.setup_screenshot?.id, 'shot_trade_layered_setup')
      assert.equal(detail.exit_screenshot?.id, 'shot_trade_layered_exit')
      assert.deepEqual(detail.manage_screenshots.map((shot) => shot.id), ['shot_trade_layered_manage'])
      assert.equal(detail.original_plan_blocks.some((block) => block.id === 'block_trade_layered_plan'), true)
      assert.equal(detail.original_plan_blocks.some((block) => block.id === 'block_trade_layered_review'), false)
      assert.deepEqual(detail.linked_ai_cards.map((card) => card.id), ['analysis_trade_layered'])
      assert.equal(detail.review_blocks.some((block) => block.id === 'block_trade_layered_review'), true)
      assert.equal(detail.review_sections.deviation_analysis.length > 0, true)
      assert.equal(detail.review_sections.result_assessment.length > 0, true)
      assert.equal(detail.review_sections.next_improvements.length > 0, true)
      assert.equal(detail.related_events.every((event) => event.trade_id === 'trade_detail_layered'), true)
    })
  })

  await t.test('trade close auto-creates review draft and detail stays scoped to one trade', async() => {
    await withTempDb('trade-detail-close-draft', async({ paths, db, nextIso }) => {
      insertPeriod(db, nextIso, { id: 'period_trade_detail_close' })
      insertContract(db, nextIso, { id: 'contract_trade_detail_close', symbol: 'NQ' })
      insertSession(db, nextIso, {
        id: 'session_trade_detail_close',
        contract_id: 'contract_trade_detail_close',
        period_id: 'period_trade_detail_close',
        title: 'trade detail close session',
      })

      insertTrade(db, nextIso, {
        id: 'trade_detail_other',
        session_id: 'session_trade_detail_close',
        symbol: 'NQ',
        side: 'short',
        status: 'closed',
        quantity: 1,
        entry_price: 103,
        stop_loss: 106,
        take_profit: 98,
        opened_at: '2026-03-26T01:05:00.000Z',
        closed_at: '2026-03-26T01:12:00.000Z',
        exit_price: 100,
        pnl_r: 1,
        thesis: 'other trade noise',
      })
      insertScreenshot(db, nextIso, {
        id: 'shot_other_trade',
        session_id: 'session_trade_detail_close',
        event_id: 'event_other_trade',
        kind: 'chart',
        caption: 'other trade screenshot',
      })
      insertContentBlock(db, nextIso, {
        id: 'block_other_trade',
        session_id: 'session_trade_detail_close',
        event_id: 'event_other_trade',
        title: 'Other trade note',
        content_md: 'must not leak into the target trade detail',
        context_type: 'trade',
        context_id: 'trade_detail_other',
      })
      insertEvent(db, nextIso, {
        id: 'event_other_trade',
        session_id: 'session_trade_detail_close',
        trade_id: 'trade_detail_other',
        event_type: 'screenshot',
        title: 'Other trade event',
        summary: 'belongs to the other trade',
        screenshot_id: 'shot_other_trade',
        content_block_ids: ['block_other_trade'],
      })

      const opened = await openTradeForSession(paths, {
        session_id: 'session_trade_detail_close',
        side: 'long',
        quantity: 2,
        entry_price: 100,
        stop_loss: 95,
        take_profit: 110,
        thesis: 'target trade thesis',
      })
      const closed = await closeExistingTrade(paths, {
        trade_id: opened.trade.id,
        exit_price: 109,
      })

      const detail = await getTradeDetail(paths, { trade_id: opened.trade.id })
      assert.equal(closed.trade.status, 'closed')
      assert.equal(detail.trade.id, opened.trade.id)
      assert.equal(detail.review_draft_block?.title, 'Exit review draft')
      assert.equal(detail.related_events.every((event) => event.trade_id === opened.trade.id), true)
      assert.deepEqual(
        detail.execution_events.map((event) => event.event_type),
        ['trade_open', 'trade_close'],
      )
      assert.equal(detail.related_events.some((event) => event.id === 'event_other_trade'), false)
      assert.equal(detail.screenshots.some((shot) => shot.id === 'shot_other_trade'), false)
      assert.equal(detail.content_blocks.some((block) => block.id === 'block_other_trade'), false)
      assert.match(detail.review_draft_block?.content_md ?? '', /## 计划 vs 实际 vs 结果/)
      assert.match(detail.review_draft_block?.content_md ?? '', /当前结果：已平仓/)
    })
  })

  await t.test('exit screenshot seeds trade thread media and later close updates the same review draft', async() => {
    await withTempDb('trade-detail-exit-draft', async({ paths, db, nextIso }) => {
      insertPeriod(db, nextIso, { id: 'period_trade_detail_exit' })
      insertContract(db, nextIso, { id: 'contract_trade_detail_exit', symbol: 'NQ' })
      insertSession(db, nextIso, {
        id: 'session_trade_detail_exit',
        contract_id: 'contract_trade_detail_exit',
        period_id: 'period_trade_detail_exit',
        title: 'trade detail exit session',
      })
      insertTrade(db, nextIso, {
        id: 'trade_detail_exit_open',
        session_id: 'session_trade_detail_exit',
        symbol: 'NQ',
        side: 'long',
        status: 'open',
        quantity: 2,
        entry_price: 100,
        stop_loss: 95,
        take_profit: 110,
        opened_at: '2026-03-26T02:00:00.000Z',
        closed_at: null,
        exit_price: null,
        pnl_r: null,
        thesis: 'open trade for exit draft',
      })

      insertScreenshot(db, nextIso, {
        id: 'shot_trade_setup',
        session_id: 'session_trade_detail_exit',
        event_id: 'event_trade_setup',
        kind: 'chart',
        caption: 'setup screenshot',
      })
      insertEvent(db, nextIso, {
        id: 'event_trade_setup',
        session_id: 'session_trade_detail_exit',
        trade_id: 'trade_detail_exit_open',
        event_type: 'screenshot',
        title: 'Setup screenshot',
        summary: 'setup image for the trade',
        screenshot_id: 'shot_trade_setup',
        occurred_at: '2026-03-26T01:55:00.000Z',
      })

      insertScreenshot(db, nextIso, {
        id: 'shot_trade_manage',
        session_id: 'session_trade_detail_exit',
        event_id: 'event_trade_manage',
        kind: 'execution',
        caption: 'manage screenshot',
      })
      insertEvent(db, nextIso, {
        id: 'event_trade_manage',
        session_id: 'session_trade_detail_exit',
        trade_id: 'trade_detail_exit_open',
        event_type: 'screenshot',
        title: 'Manage screenshot',
        summary: 'manage image for the trade',
        screenshot_id: 'shot_trade_manage',
        occurred_at: '2026-03-26T02:05:00.000Z',
      })

      setRegressionPendingCapture({
        session_id: 'session_trade_detail_exit',
        contract_id: 'contract_trade_detail_exit',
        period_id: 'period_trade_detail_exit',
        session_title: 'trade detail exit session',
        contract_symbol: 'NQ',
        open_trade_id: 'trade_detail_exit_open',
        open_trade_label: 'NQ 做多',
      })

      const exitSave = await savePendingSnip(paths, {}, {
        selection: fullSelection,
        target_context: {
          session_id: 'session_trade_detail_exit',
          trade_id: null,
          source_view: 'capture-overlay',
          kind: 'chart',
        },
        note_text: '先把 exit 图挂到当前 open trade。',
        run_ai: false,
        kind: 'exit',
      }, createCaptureSaveDependencies(paths))

      const detailAfterExit = await getTradeDetail(paths, { trade_id: 'trade_detail_exit_open' })
      assert.equal(detailAfterExit.review_draft_block !== null, true)
      assert.equal(detailAfterExit.review_draft_block?.title, 'Exit review draft')
      assert.deepEqual(detailAfterExit.setup_screenshots.map((shot) => shot.id), ['shot_trade_setup'])
      assert.deepEqual(detailAfterExit.manage_screenshots.map((shot) => shot.id), ['shot_trade_manage'])
      assert.equal(detailAfterExit.exit_screenshots.some((shot) => shot.id === exitSave.screenshot.id), true)
      assert.match(detailAfterExit.review_draft_block?.content_md ?? '', /Exit 图：已记录 1 张。/)

      const closed = await closeExistingTrade(paths, {
        trade_id: 'trade_detail_exit_open',
        exit_price: 109,
      })

      const detailAfterClose = await getTradeDetail(paths, { trade_id: 'trade_detail_exit_open' })
      assert.equal(closed.trade.status, 'closed')
      assert.equal(detailAfterClose.review_draft_block?.id, detailAfterExit.review_draft_block?.id)
      assert.equal(detailAfterClose.related_events.filter((event) => event.event_type === 'review').length, 1)
      assert.match(detailAfterClose.review_draft_block?.content_md ?? '', /当前结果：已平仓/)
      assert.match(detailAfterClose.review_draft_block?.content_md ?? '', /109/)
    })
  })
})
