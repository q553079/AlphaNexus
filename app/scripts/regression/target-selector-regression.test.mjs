import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getPeriodReview,
  getSessionWorkbench,
  getTradeDetail,
  listWorkbenchTargetOptions,
  moveScreenshotToTarget,
  retargetContentBlock,
} from '../../src/main/domain/workbench-service.ts'
import {
  insertAiRun,
  insertAnalysisCard,
  insertContentBlock,
  insertContract,
  insertEvent,
  insertPeriod,
  insertScreenshot,
  insertSession,
  insertTrade,
  withTempDb,
} from './helpers.mjs'

test('AlphaNexus target selector regression guards', async(t) => {
  await t.test('target option payload exposes current, recent, history, previous-period trades, and searchable nth-trade hints', async() => {
    await withTempDb('target-selector-groups', async({ paths, db, nextIso }) => {
      insertContract(db, nextIso, { id: 'contract_target_groups', symbol: 'NQ' })
      insertPeriod(db, nextIso, {
        id: 'period_target_previous',
        label: '2026-W12',
        start_at: '2026-03-16T00:00:00.000Z',
        end_at: '2026-03-22T23:59:59.000Z',
      })
      insertPeriod(db, nextIso, {
        id: 'period_target_current',
        label: '2026-W13',
        start_at: '2026-03-23T00:00:00.000Z',
        end_at: '2026-03-29T23:59:59.000Z',
      })

      insertSession(db, nextIso, {
        id: 'session_target_previous_a',
        contract_id: 'contract_target_groups',
        period_id: 'period_target_previous',
        title: 'Previous A',
        started_at: '2026-03-18T01:00:00.000Z',
      })
      insertSession(db, nextIso, {
        id: 'session_target_previous_b',
        contract_id: 'contract_target_groups',
        period_id: 'period_target_previous',
        title: 'Previous B',
        started_at: '2026-03-19T01:00:00.000Z',
      })
      insertSession(db, nextIso, {
        id: 'session_target_current',
        contract_id: 'contract_target_groups',
        period_id: 'period_target_current',
        title: 'Current Session',
        started_at: '2026-03-26T01:00:00.000Z',
      })

      insertTrade(db, nextIso, {
        id: 'trade_target_prev_1',
        session_id: 'session_target_previous_a',
        symbol: 'NQ',
        side: 'long',
        status: 'closed',
        opened_at: '2026-03-18T01:05:00.000Z',
        closed_at: '2026-03-18T01:16:00.000Z',
        pnl_r: 1,
        thesis: 'previous trade one',
      })
      insertTrade(db, nextIso, {
        id: 'trade_target_prev_2',
        session_id: 'session_target_previous_b',
        symbol: 'NQ',
        side: 'short',
        status: 'closed',
        opened_at: '2026-03-19T01:05:00.000Z',
        closed_at: '2026-03-19T01:16:00.000Z',
        pnl_r: -0.5,
        thesis: 'previous trade two',
      })
      insertTrade(db, nextIso, {
        id: 'trade_target_current_open',
        session_id: 'session_target_current',
        symbol: 'NQ',
        side: 'long',
        status: 'open',
        opened_at: '2026-03-26T01:10:00.000Z',
        closed_at: null,
        exit_price: null,
        pnl_r: null,
        thesis: 'current open trade',
      })

      const targetOptions = await listWorkbenchTargetOptions(paths, {
        session_id: 'session_target_current',
        include_period_targets: true,
      })

      assert.equal(targetOptions.current_context.session_id, 'session_target_current')
      assert.equal(targetOptions.groups.current[0]?.session_id, 'session_target_current')
      assert.ok(targetOptions.groups.recent.some((option) => option.session_id === 'session_target_previous_b'))
      assert.ok(targetOptions.groups.history.some((option) => option.target_kind === 'session' && option.session_id === 'session_target_previous_a'))
      assert.ok(targetOptions.groups.history.some((option) => option.target_kind === 'period' && option.period_id === 'period_target_previous'))
      assert.deepEqual(
        targetOptions.groups.previous_period_trades.map((option) => option.trade_id),
        ['trade_target_prev_1', 'trade_target_prev_2'],
      )
      assert.deepEqual(
        targetOptions.groups.previous_period_trades.map((option) => option.previous_period_trade_index),
        [1, 2],
      )
      assert.match(
        targetOptions.options.find((option) => option.trade_id === 'trade_target_prev_2')?.search_text ?? '',
        /上一周期 第2笔 trade/,
      )

      const payload = await getSessionWorkbench(paths, { session_id: 'session_target_current' })
      assert.equal(payload.target_option_groups.current[0]?.session_id, 'session_target_current')
      assert.ok(payload.target_option_groups.history.some((option) => option.session_id === 'session_target_previous_a'))
    })
  })

  await t.test('content block move updates mount, persists move audit, and keeps old trade detail/query scopes clean', async() => {
    await withTempDb('target-selector-moves', async({ paths, db, nextIso }) => {
      insertContract(db, nextIso, { id: 'contract_target_moves', symbol: 'NQ' })
      insertPeriod(db, nextIso, {
        id: 'period_target_moves_previous',
        label: '2026-W12',
        start_at: '2026-03-16T00:00:00.000Z',
        end_at: '2026-03-22T23:59:59.000Z',
      })
      insertPeriod(db, nextIso, {
        id: 'period_target_moves_current',
        label: '2026-W13',
        start_at: '2026-03-23T00:00:00.000Z',
        end_at: '2026-03-29T23:59:59.000Z',
      })

      insertSession(db, nextIso, {
        id: 'session_move_previous',
        contract_id: 'contract_target_moves',
        period_id: 'period_target_moves_previous',
        title: 'Previous move session',
      })
      insertSession(db, nextIso, {
        id: 'session_move_current',
        contract_id: 'contract_target_moves',
        period_id: 'period_target_moves_current',
        title: 'Current move session',
      })

      insertTrade(db, nextIso, {
        id: 'trade_move_current',
        session_id: 'session_move_current',
        symbol: 'NQ',
        side: 'long',
        status: 'open',
        opened_at: '2026-03-26T01:10:00.000Z',
        closed_at: null,
        exit_price: null,
        pnl_r: null,
        thesis: 'move target trade',
      })

      insertEvent(db, nextIso, {
        id: 'event_move_source',
        session_id: 'session_move_current',
        trade_id: 'trade_move_current',
        event_type: 'observation',
        title: 'Source event',
        summary: 'source event summary',
        content_block_ids: ['block_move_target'],
      })
      insertContentBlock(db, nextIso, {
        id: 'block_move_target',
        session_id: 'session_move_current',
        event_id: 'event_move_source',
        title: 'Move me',
        content_md: 'original event-mounted content',
        context_type: 'event',
        context_id: 'event_move_source',
        sort_order: 1,
      })

      const movedToTrade = await retargetContentBlock(paths, {
        block_id: 'block_move_target',
        target_kind: 'trade',
        session_id: 'session_move_current',
        trade_id: 'trade_move_current',
      })

      assert.equal(movedToTrade.block.context_type, 'trade')
      assert.equal(movedToTrade.block.context_id, 'trade_move_current')
      assert.equal(movedToTrade.block.event_id !== null, true)
      assert.equal(movedToTrade.move_audit.from_context_type, 'event')
      assert.equal(movedToTrade.move_audit.to_context_type, 'trade')

      const tradeDetailAfterMove = await getTradeDetail(paths, { trade_id: 'trade_move_current' })
      assert.equal(tradeDetailAfterMove.content_blocks.some((block) => block.id === 'block_move_target'), true)

      const sourceEventAfterMove = (await getSessionWorkbench(paths, { session_id: 'session_move_current' }))
        .events.find((event) => event.id === 'event_move_source')
      assert.deepEqual(sourceEventAfterMove?.content_block_ids ?? [], [])
      const tradeMountedEvent = (await getSessionWorkbench(paths, { session_id: 'session_move_current' }))
        .events.find((event) => event.id === movedToTrade.block.event_id)
      assert.equal(tradeMountedEvent?.trade_id, 'trade_move_current')
      assert.deepEqual(tradeMountedEvent?.content_block_ids ?? [], ['block_move_target'])

      const movedToPeriod = await retargetContentBlock(paths, {
        block_id: 'block_move_target',
        target_kind: 'period',
        session_id: 'session_move_previous',
        period_id: 'period_target_moves_previous',
      })

      assert.equal(movedToPeriod.block.context_type, 'period')
      assert.equal(movedToPeriod.block.context_id, 'period_target_moves_previous')
      assert.equal(movedToPeriod.block.session_id, 'session_move_previous')
      assert.equal(movedToPeriod.block.move_history.length, 2)

      const tradeDetailAfterPeriodMove = await getTradeDetail(paths, { trade_id: 'trade_move_current' })
      assert.equal(tradeDetailAfterPeriodMove.content_blocks.some((block) => block.id === 'block_move_target'), false)

      const periodReview = await getPeriodReview(paths, { period_id: 'period_target_moves_previous' })
      assert.equal(periodReview.content_blocks.some((block) => block.id === 'block_move_target'), true)
      assert.equal(periodReview.content_blocks.find((block) => block.id === 'block_move_target')?.move_history.length, 2)

      const moveAuditRows = db.prepare(`
        SELECT from_context_type, to_context_type
        FROM content_block_move_audit
        WHERE block_id = ?
        ORDER BY moved_at ASC
      `).all('block_move_target')
      assert.deepEqual(
        moveAuditRows.map((row) => [row.from_context_type, row.to_context_type]),
        [['event', 'trade'], ['trade', 'period']],
      )
    })
  })

  await t.test('screenshot move retargets screenshot, linked event chain, and historical trade visibility together', async() => {
    await withTempDb('target-selector-screenshot-move', async({ paths, db, nextIso }) => {
      insertContract(db, nextIso, { id: 'contract_shot_move', symbol: 'NQ' })
      insertPeriod(db, nextIso, {
        id: 'period_shot_move_previous',
        label: '2026-W12',
        start_at: '2026-03-16T00:00:00.000Z',
        end_at: '2026-03-22T23:59:59.000Z',
      })
      insertPeriod(db, nextIso, {
        id: 'period_shot_move_current',
        label: '2026-W13',
        start_at: '2026-03-23T00:00:00.000Z',
        end_at: '2026-03-29T23:59:59.000Z',
      })

      insertSession(db, nextIso, {
        id: 'session_shot_move_previous',
        contract_id: 'contract_shot_move',
        period_id: 'period_shot_move_previous',
        title: 'Previous shot session',
      })
      insertSession(db, nextIso, {
        id: 'session_shot_move_current',
        contract_id: 'contract_shot_move',
        period_id: 'period_shot_move_current',
        title: 'Current shot session',
      })
      insertTrade(db, nextIso, {
        id: 'trade_shot_move_previous',
        session_id: 'session_shot_move_previous',
        symbol: 'NQ',
        side: 'short',
        status: 'closed',
        opened_at: '2026-03-20T01:05:00.000Z',
        closed_at: '2026-03-20T01:16:00.000Z',
        exit_price: 98,
        pnl_r: 1.2,
        thesis: 'historical target trade',
      })

      insertScreenshot(db, nextIso, {
        id: 'shot_move_target',
        session_id: 'session_shot_move_current',
        event_id: 'event_shot_move_source',
        kind: 'chart',
        caption: 'Move this screenshot',
        file_path: 'shots/current/move-me.png',
        asset_url: 'file:///shots/current/move-me.png',
      })
      insertEvent(db, nextIso, {
        id: 'event_shot_move_source',
        session_id: 'session_shot_move_current',
        trade_id: null,
        event_type: 'screenshot',
        title: '截图',
        summary: 'session-scoped screenshot',
        screenshot_id: 'shot_move_target',
        content_block_ids: ['block_shot_move_note'],
        occurred_at: '2026-03-26T01:10:00.000Z',
      })
      insertContentBlock(db, nextIso, {
        id: 'block_shot_move_note',
        session_id: 'session_shot_move_current',
        event_id: 'event_shot_move_source',
        title: '截图备注',
        content_md: 'session scoped screenshot note',
        context_type: 'event',
        context_id: 'event_shot_move_source',
        sort_order: 1,
      })
      insertAiRun(db, nextIso, {
        id: 'airun_shot_move',
        session_id: 'session_shot_move_current',
        event_id: 'event_ai_shot_move',
      })
      insertAnalysisCard(db, nextIso, {
        id: 'analysis_shot_move',
        ai_run_id: 'airun_shot_move',
        session_id: 'session_shot_move_current',
        trade_id: null,
        bias: 'bearish',
        confidence_pct: 66,
        summary_short: 'move linked ai',
      })
      insertContentBlock(db, nextIso, {
        id: 'block_ai_shot_move',
        session_id: 'session_shot_move_current',
        event_id: 'event_ai_shot_move',
        block_type: 'ai-summary',
        title: 'Linked AI block',
        content_md: 'linked ai content',
        context_type: 'event',
        context_id: 'event_ai_shot_move',
        sort_order: 2,
      })
      insertEvent(db, nextIso, {
        id: 'event_ai_shot_move',
        session_id: 'session_shot_move_current',
        trade_id: null,
        event_type: 'ai_summary',
        title: 'Linked AI',
        summary: 'ai linked to screenshot',
        author_kind: 'ai',
        screenshot_id: 'shot_move_target',
        ai_run_id: 'airun_shot_move',
        content_block_ids: ['block_ai_shot_move'],
        occurred_at: '2026-03-26T01:11:00.000Z',
      })

      const moved = await moveScreenshotToTarget(paths, {
        screenshot_id: 'shot_move_target',
        target_kind: 'trade',
        session_id: 'session_shot_move_previous',
        trade_id: 'trade_shot_move_previous',
      })

      assert.equal(moved.session_id, 'session_shot_move_previous')

      const currentPayload = await getSessionWorkbench(paths, { session_id: 'session_shot_move_current' })
      assert.equal(currentPayload.screenshots.some((screenshot) => screenshot.id === 'shot_move_target'), false)
      assert.equal(currentPayload.events.some((event) => event.id === 'event_shot_move_source'), false)
      assert.equal(currentPayload.events.some((event) => event.id === 'event_ai_shot_move'), false)
      assert.equal(currentPayload.content_blocks.some((block) => block.id === 'block_shot_move_note'), false)
      assert.equal(currentPayload.ai_runs.some((run) => run.id === 'airun_shot_move'), false)

      const previousPayload = await getSessionWorkbench(paths, { session_id: 'session_shot_move_previous' })
      assert.equal(previousPayload.screenshots.some((screenshot) => screenshot.id === 'shot_move_target'), true)
      assert.equal(previousPayload.events.find((event) => event.id === 'event_shot_move_source')?.trade_id, 'trade_shot_move_previous')
      assert.equal(previousPayload.events.find((event) => event.id === 'event_ai_shot_move')?.trade_id, 'trade_shot_move_previous')
      assert.equal(previousPayload.ai_runs.find((run) => run.id === 'airun_shot_move')?.session_id, 'session_shot_move_previous')
      assert.equal(previousPayload.analysis_cards.find((card) => card.id === 'analysis_shot_move')?.trade_id, 'trade_shot_move_previous')
      assert.equal(previousPayload.content_blocks.find((block) => block.id === 'block_shot_move_note')?.session_id, 'session_shot_move_previous')

      const previousTradeDetail = await getTradeDetail(paths, { trade_id: 'trade_shot_move_previous' })
      assert.equal(previousTradeDetail.screenshots.some((screenshot) => screenshot.id === 'shot_move_target'), true)
      assert.equal(previousTradeDetail.linked_ai_cards.some((card) => card.id === 'analysis_shot_move'), true)
    })
  })
})
