import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addToExistingTrade,
  cancelExistingTrade,
  closeExistingTrade,
  createWorkbenchNoteBlockForContext,
  getCurrentWorkbenchContext,
  getSessionWorkbench,
  getTradeDetail,
  listWorkbenchTargetOptions,
  openTradeForSession,
  recordAiAnalysis,
  reduceExistingTrade,
  retargetContentBlock,
  setCurrentWorkbenchContext,
  softDeleteAiRecord,
  softDeleteAnnotation,
  softDeleteContentBlock,
  softDeleteScreenshot,
  undeleteAiRecord,
  undeleteAnnotation,
  undeleteContentBlock,
  undeleteScreenshot,
  updateWorkbenchNoteBlockContent,
  updateSessionRealtimeView,
} from '../../src/main/domain/workbench-service.ts'
import {
  continueLauncherSession,
  createLauncherSession,
} from '../../src/main/domain/session-launcher-service.ts'
import { selectCurrentTrade } from '../../src/shared/contracts/workbench.ts'
import { createImportedScreenshotForContext } from '../../src/main/db/repositories/workbench-repository.ts'
import {
  insertAiRun,
  insertAnalysisCard,
  insertAnnotation,
  insertContentBlock,
  insertContract,
  insertEvaluation,
  insertEvent,
  insertPeriod,
  insertScreenshot,
  insertSession,
  insertTrade,
  withTempDb,
} from './helpers.mjs'

test('AlphaNexus workbench regression guards', async(t) => {
  await t.test('launcher create and continue session keep active session and current context real', async() => {
    await withTempDb('launcher-session-activation', async({ paths, db, nextIso }) => {
      insertContract(db, nextIso, { id: 'contract_launcher_real', symbol: 'NQ' })

      const first = await createLauncherSession(paths, {
        contract_id: 'contract_launcher_real',
        bucket: 'am',
        title: 'first real session',
        market_bias: 'neutral',
        context_focus: 'first focus',
        trade_plan_md: '',
        tags: ['first'],
      })
      const second = await createLauncherSession(paths, {
        contract_id: 'contract_launcher_real',
        bucket: 'pm',
        title: 'second real session',
        market_bias: 'bullish',
        context_focus: 'second focus',
        trade_plan_md: '',
        tags: ['second'],
      })

      let sessions = getSessionWorkbench(paths, { session_id: second.session.id })
      let currentContext = getCurrentWorkbenchContext(paths, { session_id: second.session.id })
      const [afterSecondPayload, afterSecondContext] = await Promise.all([sessions, currentContext])
      assert.equal(afterSecondPayload.session.status, 'active')
      assert.equal(afterSecondContext.session_id, second.session.id)

      const continued = await continueLauncherSession(paths, { session_id: first.session.id })
      assert.equal(continued.session.id, first.session.id)
      const afterContinue = await getSessionWorkbench(paths, { session_id: first.session.id })
      const afterContinueContext = await getCurrentWorkbenchContext(paths, { session_id: first.session.id })
      const secondRow = db.prepare('SELECT status FROM sessions WHERE id = ? LIMIT 1').get(second.session.id)

      assert.equal(afterContinue.session.status, 'active')
      assert.equal(afterContinueContext.session_id, first.session.id)
      assert.equal(secondRow.status, 'planned')
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
      assert.equal(afterAiDelete.content_blocks.find((block) => block.id === 'block_ai_delete')?.soft_deleted, true)

      await undeleteAiRecord(paths, { ai_run_id: 'airun_delete' })
      const afterAiRestore = await getSessionWorkbench(paths, { session_id: 'session_delete' })
      assert(afterAiRestore.ai_runs.some((run) => run.id === 'airun_delete'))
      assert(afterAiRestore.analysis_cards.some((card) => card.id === 'analysis_delete'))
      assert(afterAiRestore.events.some((eventItem) => eventItem.id === 'event_ai_delete'))
      assert.equal(afterAiRestore.deleted_ai_records.some((record) => record.ai_run.id === 'airun_delete'), false)
      assert.equal(afterAiRestore.content_blocks.find((block) => block.id === 'block_ai_delete')?.soft_deleted, false)
    })
  })

  await t.test('trade lifecycle writes snapshots and audited events end-to-end', async() => {
    await withTempDb('trade-lifecycle', async({ paths, db, nextIso }) => {
      insertPeriod(db, nextIso, { id: 'period_trade_flow' })
      insertContract(db, nextIso, { id: 'contract_trade_flow', symbol: 'NQ' })
      insertSession(db, nextIso, {
        id: 'session_trade_flow',
        contract_id: 'contract_trade_flow',
        period_id: 'period_trade_flow',
        title: 'trade lifecycle session',
        tags: ['lifecycle'],
      })

      const opened = await openTradeForSession(paths, {
        session_id: 'session_trade_flow',
        side: 'long',
        quantity: 2,
        entry_price: 100,
        stop_loss: 95,
        take_profit: 110,
        thesis: 'opening reclaim continuation',
      })
      assert.equal(opened.trade.status, 'open')
      assert.equal(opened.trade.quantity, 2)
      assert.equal(opened.event.event_type, 'trade_open')
      assert.equal(opened.event.trade_id, opened.trade.id)

      const added = await addToExistingTrade(paths, {
        trade_id: opened.trade.id,
        quantity: 1,
        price: 101,
      })
      assert.equal(added.trade.quantity, 3)
      assert.equal(added.event.event_type, 'trade_add')
      assert.equal(added.event.trade_id, opened.trade.id)

      const reduced = await reduceExistingTrade(paths, {
        trade_id: opened.trade.id,
        quantity: 1,
        price: 104,
      })
      assert.equal(reduced.trade.quantity, 2)
      assert.equal(reduced.event.event_type, 'trade_reduce')
      assert.equal(reduced.event.trade_id, opened.trade.id)

      const closed = await closeExistingTrade(paths, {
        trade_id: opened.trade.id,
        exit_price: 112,
      })
      assert.equal(closed.trade.status, 'closed')
      assert.equal(closed.trade.exit_price, 112)
      assert.equal(closed.trade.closed_at !== null, true)
      assert.equal(closed.event.event_type, 'trade_close')
      assert.equal(closed.event.trade_id, opened.trade.id)
      assert.ok(Math.abs((closed.trade.pnl_r ?? 0) - 2.1875) < 0.0001)

      const payload = await getSessionWorkbench(paths, { session_id: 'session_trade_flow' })
      assert.equal(payload.trades.length, 1)
      assert.equal(payload.trades[0].status, 'closed')
      assert.deepEqual(
        payload.events.filter((eventItem) => eventItem.trade_id === opened.trade.id).map((eventItem) => eventItem.event_type),
        ['trade_open', 'trade_add', 'trade_reduce', 'trade_close', 'review'],
      )

      const detail = await getTradeDetail(paths, { trade_id: opened.trade.id })
      assert.deepEqual(
        detail.related_events.map((eventItem) => eventItem.event_type),
        ['trade_open', 'trade_add', 'trade_reduce', 'trade_close', 'review'],
      )
      assert.equal(detail.trade.id, opened.trade.id)
      assert.equal(detail.review_draft_block !== null, true)
    })
  })

  await t.test('trade cancel writes terminal event and keeps review draft attached to the same trade', async() => {
    await withTempDb('trade-cancel-lifecycle', async({ paths, db, nextIso }) => {
      insertPeriod(db, nextIso, { id: 'period_trade_cancel' })
      insertContract(db, nextIso, { id: 'contract_trade_cancel', symbol: 'NQ' })
      insertSession(db, nextIso, {
        id: 'session_trade_cancel',
        contract_id: 'contract_trade_cancel',
        period_id: 'period_trade_cancel',
        title: 'trade cancel session',
      })

      const opened = await openTradeForSession(paths, {
        session_id: 'session_trade_cancel',
        side: 'short',
        quantity: 1,
        entry_price: 100,
        stop_loss: 103,
        take_profit: 96,
        thesis: 'cancel when reclaim premise fails',
      })
      const canceled = await cancelExistingTrade(paths, {
        trade_id: opened.trade.id,
        reason_md: 'opening reclaim invalidated before full execution',
      })

      assert.equal(canceled.trade.status, 'canceled')
      assert.equal(canceled.trade.exit_price, null)
      assert.equal(canceled.trade.pnl_r, null)
      assert.equal(canceled.trade.closed_at !== null, true)
      assert.equal(canceled.event.event_type, 'trade_cancel')
      assert.equal(canceled.event.trade_id, opened.trade.id)
      assert.match(canceled.event.summary, /invalidated/)

      const payload = await getSessionWorkbench(paths, { session_id: 'session_trade_cancel' })
      assert.deepEqual(
        payload.events.filter((eventItem) => eventItem.trade_id === opened.trade.id).map((eventItem) => eventItem.event_type),
        ['trade_open', 'trade_cancel', 'review'],
      )

      const detail = await getTradeDetail(paths, { trade_id: opened.trade.id })
      assert.equal(detail.trade.status, 'canceled')
      assert.deepEqual(
        detail.execution_events.map((eventItem) => eventItem.event_type),
        ['trade_open', 'trade_cancel'],
      )
      assert.equal(detail.review_draft_block !== null, true)
      assert.match(detail.review_draft_block?.content_md ?? '', /交易已取消/)
    })
  })

  await t.test('current trade selection prefers open trade, otherwise latest trade', async() => {
    await withTempDb('current-trade-selection', async({ paths, db, nextIso }) => {
      insertPeriod(db, nextIso, { id: 'period_current_trade' })
      insertContract(db, nextIso, { id: 'contract_current_trade', symbol: 'NQ' })
      insertSession(db, nextIso, {
        id: 'session_current_trade_open',
        contract_id: 'contract_current_trade',
        period_id: 'period_current_trade',
        title: 'open wins',
      })

      insertTrade(db, nextIso, {
        id: 'trade_open_priority',
        session_id: 'session_current_trade_open',
        symbol: 'NQ',
        side: 'long',
        status: 'open',
        quantity: 2,
        entry_price: 100,
        stop_loss: 95,
        take_profit: 110,
        opened_at: '2026-03-26T01:02:00.000Z',
        closed_at: null,
        exit_price: null,
        thesis: 'still open',
      })
      insertTrade(db, nextIso, {
        id: 'trade_latest_closed',
        session_id: 'session_current_trade_open',
        symbol: 'NQ',
        side: 'short',
        status: 'closed',
        quantity: 1,
        entry_price: 101,
        stop_loss: 104,
        take_profit: 96,
        opened_at: '2026-03-26T01:05:00.000Z',
        closed_at: '2026-03-26T01:09:00.000Z',
        exit_price: 99,
        pnl_r: 0.6,
        thesis: 'already closed',
      })

      const openPreferred = await getSessionWorkbench(paths, { session_id: 'session_current_trade_open' })
      assert.equal(selectCurrentTrade(openPreferred.trades)?.id, 'trade_open_priority')

      insertSession(db, nextIso, {
        id: 'session_current_trade_latest',
        contract_id: 'contract_current_trade',
        period_id: 'period_current_trade',
        title: 'latest closed fallback',
      })
      insertTrade(db, nextIso, {
        id: 'trade_closed_old',
        session_id: 'session_current_trade_latest',
        symbol: 'NQ',
        side: 'long',
        status: 'closed',
        quantity: 1,
        opened_at: '2026-03-26T02:00:00.000Z',
        closed_at: '2026-03-26T02:10:00.000Z',
        exit_price: 103,
        pnl_r: 0.6,
        thesis: 'older trade',
      })
      insertTrade(db, nextIso, {
        id: 'trade_closed_latest',
        session_id: 'session_current_trade_latest',
        symbol: 'NQ',
        side: 'short',
        status: 'closed',
        quantity: 1,
        opened_at: '2026-03-26T02:20:00.000Z',
        closed_at: '2026-03-26T02:25:00.000Z',
        exit_price: 98,
        pnl_r: 1.2,
        thesis: 'latest trade',
      })

      const latestFallback = await getSessionWorkbench(paths, { session_id: 'session_current_trade_latest' })
      assert.equal(selectCurrentTrade(latestFallback.trades)?.id, 'trade_closed_latest')
    })
  })

  await t.test('current context defaults to session target and scopes note, AI, capture writes', async() => {
    await withTempDb('current-context-scope', async({ paths, db, nextIso }) => {
      insertPeriod(db, nextIso, { id: 'period_current_context' })
      insertContract(db, nextIso, { id: 'contract_current_context', symbol: 'NQ' })
      insertSession(db, nextIso, {
        id: 'session_current_context',
        contract_id: 'contract_current_context',
        period_id: 'period_current_context',
        title: 'context scoped session',
        tags: ['context'],
      })
      insertTrade(db, nextIso, {
        id: 'trade_context_open',
        session_id: 'session_current_context',
        symbol: 'NQ',
        side: 'long',
        status: 'open',
        quantity: 2,
        entry_price: 100,
        stop_loss: 95,
        take_profit: 110,
        opened_at: '2026-03-26T03:00:00.000Z',
        closed_at: null,
        exit_price: null,
        pnl_r: null,
        thesis: 'open trade context',
      })
      insertTrade(db, nextIso, {
        id: 'trade_context_closed',
        session_id: 'session_current_context',
        symbol: 'NQ',
        side: 'short',
        status: 'closed',
        quantity: 1,
        entry_price: 102,
        stop_loss: 105,
        take_profit: 96,
        opened_at: '2026-03-26T03:20:00.000Z',
        closed_at: '2026-03-26T03:30:00.000Z',
        exit_price: 99,
        pnl_r: 1,
        thesis: 'closed trade context',
      })

      const initialPayload = await getSessionWorkbench(paths, { session_id: 'session_current_context' })
      assert.equal(initialPayload.current_context.session_id, 'session_current_context')
      assert.equal(initialPayload.current_context.trade_id, null)
      assert.equal(initialPayload.current_context.source_view, 'session-workbench')
      assert.equal(initialPayload.target_options.length, 3)
      assert.equal(initialPayload.target_options.find((option) => option.trade_id === null)?.is_current, true)

      const defaultDetail = await getTradeDetail(paths)
      assert.equal(defaultDetail.trade.id, 'trade_context_open')

      const tradeContext = await setCurrentWorkbenchContext(paths, {
        session_id: 'session_current_context',
        trade_id: 'trade_context_closed',
        source_view: 'session-workbench',
        capture_kind: 'execution',
      })
      assert.equal(tradeContext.trade_id, 'trade_context_closed')
      assert.equal(tradeContext.capture_kind, 'execution')

      const storedTradeContext = await getCurrentWorkbenchContext(paths, { session_id: 'session_current_context' })
      assert.equal(storedTradeContext.trade_id, 'trade_context_closed')

      const tradeOptions = await listWorkbenchTargetOptions(paths, { session_id: 'session_current_context' })
      assert.equal(tradeOptions.current_context.trade_id, 'trade_context_closed')
      assert.equal(tradeOptions.options.find((option) => option.trade_id === 'trade_context_closed')?.is_current, true)

      const tradeScopedDetail = await getTradeDetail(paths)
      assert.equal(tradeScopedDetail.trade.id, 'trade_context_closed')

      const tradeNote = await updateSessionRealtimeView(paths, {
        session_id: 'session_current_context',
        trade_id: 'trade_context_closed',
        content_md: 'trade scoped realtime note',
      })
      assert.equal(tradeNote.context_type, 'trade')
      assert.equal(tradeNote.context_id, 'trade_context_closed')

      const tradeAi = await recordAiAnalysis(paths, {
        session_id: 'session_current_context',
        provider: 'deepseek',
        model: 'mock-model',
        prompt_kind: 'market-analysis',
        input_summary: 'trade scoped ai',
        prompt_preview: 'trade scoped ai prompt',
        raw_response_text: '{"summary_short":"trade scoped analysis"}',
        structured_response_json: '{"bias":"bearish"}',
        screenshot_id: null,
        trade_id: storedTradeContext.trade_id,
        event_title: 'Trade scoped AI',
        block_title: 'Trade scoped AI block',
        summary_short: 'trade scoped analysis',
        content_md: '# Trade scoped AI',
        analysis: {
          bias: 'bearish',
          confidence_pct: 61,
          reversal_probability_pct: 28,
          entry_zone: '101-102',
          stop_loss: '105',
          take_profit: '98',
          invalidation: 'break above 105',
          summary_short: 'trade scoped analysis',
          deep_analysis_md: 'trade scoped AI content',
          supporting_factors: ['context scoped factor'],
        },
      })
      assert.equal(tradeAi.event.trade_id, 'trade_context_closed')
      assert.equal(tradeAi.analysis_card.trade_id, 'trade_context_closed')

      const createdScreenshot = createImportedScreenshotForContext(db, {
        session_id: 'session_current_context',
        trade_id: storedTradeContext.trade_id,
        kind: 'execution',
        file_path: 'screenshots/context-trade.png',
        asset_url: 'file:///screenshots/context-trade.png',
        caption: 'trade scoped screenshot',
        width: 1600,
        height: 900,
      })

      const tradeScopedPayload = await getSessionWorkbench(paths, { session_id: 'session_current_context' })
      assert.equal(tradeScopedPayload.current_context.trade_id, 'trade_context_closed')
      assert.equal(tradeScopedPayload.panels.my_realtime_view, 'trade scoped realtime note')
      assert.equal(tradeScopedPayload.content_blocks.find((block) => block.id === tradeNote.id)?.context_type, 'trade')
      assert.equal(tradeScopedPayload.events.find((eventItem) => eventItem.id === tradeNote.event_id)?.trade_id, 'trade_context_closed')
      assert.equal(tradeScopedPayload.events.find((eventItem) => eventItem.id === tradeAi.event.id)?.trade_id, 'trade_context_closed')
      assert.equal(tradeScopedPayload.events.find((eventItem) => eventItem.id === createdScreenshot.event_id)?.trade_id, 'trade_context_closed')

      const sessionContext = await setCurrentWorkbenchContext(paths, {
        session_id: 'session_current_context',
        trade_id: null,
        source_view: 'session-workbench',
        capture_kind: 'chart',
      })
      assert.equal(sessionContext.trade_id, null)

      const sessionNote = await updateSessionRealtimeView(paths, {
        session_id: 'session_current_context',
        trade_id: null,
        content_md: 'session scoped realtime note',
      })
      assert.equal(sessionNote.context_type, 'session')
      assert.equal(sessionNote.context_id, 'session_current_context')

      const sessionAi = await recordAiAnalysis(paths, {
        session_id: 'session_current_context',
        provider: 'deepseek',
        model: 'mock-model',
        prompt_kind: 'market-analysis',
        input_summary: 'session scoped ai',
        prompt_preview: 'session scoped ai prompt',
        raw_response_text: '{"summary_short":"session scoped analysis"}',
        structured_response_json: '{"bias":"neutral"}',
        screenshot_id: null,
        trade_id: sessionContext.trade_id,
        event_title: 'Session scoped AI',
        block_title: 'Session scoped AI block',
        summary_short: 'session scoped analysis',
        content_md: '# Session scoped AI',
        analysis: {
          bias: 'neutral',
          confidence_pct: 57,
          reversal_probability_pct: 33,
          entry_zone: 'session',
          stop_loss: 'session',
          take_profit: 'session',
          invalidation: 'session invalidation',
          summary_short: 'session scoped analysis',
          deep_analysis_md: 'session scoped AI content',
          supporting_factors: ['session scoped factor'],
        },
      })
      assert.equal(sessionAi.event.trade_id, null)
      assert.equal(sessionAi.analysis_card.trade_id, null)

      const finalPayload = await getSessionWorkbench(paths, { session_id: 'session_current_context' })
      assert.equal(finalPayload.current_context.trade_id, null)
      assert.equal(finalPayload.panels.my_realtime_view, 'session scoped realtime note')
      assert.equal(finalPayload.content_blocks.find((block) => block.id === sessionNote.id)?.context_type, 'session')
      assert.equal(finalPayload.events.find((eventItem) => eventItem.id === sessionNote.event_id)?.trade_id, null)
      assert.equal(finalPayload.events.find((eventItem) => eventItem.id === sessionAi.event.id)?.trade_id, null)
      assert.equal(finalPayload.target_options.find((option) => option.trade_id === null)?.is_current, true)
    })
  })

  await t.test('standalone note blocks persist, autosave updates events, delete/restore sync timeline, and move keeps visibility', async() => {
    await withTempDb('note-block-lifecycle', async({ paths, db, nextIso }) => {
      insertPeriod(db, nextIso, { id: 'period_note_flow' })
      insertContract(db, nextIso, { id: 'contract_note_flow', symbol: 'NQ' })
      insertSession(db, nextIso, {
        id: 'session_note_flow',
        contract_id: 'contract_note_flow',
        period_id: 'period_note_flow',
        title: 'note lifecycle session',
      })
      insertTrade(db, nextIso, {
        id: 'trade_note_flow',
        session_id: 'session_note_flow',
        symbol: 'NQ',
        side: 'long',
        status: 'open',
        quantity: 1,
        entry_price: 100,
        stop_loss: 96,
        take_profit: 108,
        exit_price: null,
        pnl_r: null,
        closed_at: null,
        thesis: 'note lifecycle trade',
      })

      const created = await createWorkbenchNoteBlockForContext(paths, {
        session_id: 'session_note_flow',
        trade_id: null,
        title: '我的实时看法',
        content_md: '第一次记录：只观察 opening reclaim，不急着追。'
      })
      assert.equal(created.context_type, 'session')
      assert.equal(created.context_id, 'session_note_flow')
      assert.equal(created.event_id !== null, true)

      const updated = await updateWorkbenchNoteBlockContent(paths, {
        block_id: created.id,
        title: '我的实时看法（更新）',
        content_md: '第二次记录：回踩确认后再考虑开仓。'
      })
      assert.equal(updated.title, '我的实时看法（更新）')

      const payloadAfterUpdate = await getSessionWorkbench(paths, { session_id: 'session_note_flow' })
      const noteEventAfterUpdate = payloadAfterUpdate.events.find((event) => event.id === updated.event_id)
      assert.equal(noteEventAfterUpdate?.event_type, 'observation')
      assert.equal(noteEventAfterUpdate?.title, '我的实时看法（更新）')
      assert.equal(noteEventAfterUpdate?.summary, '第二次记录：回踩确认后再考虑开仓。')
      assert.deepEqual(noteEventAfterUpdate?.content_block_ids, [updated.id])

      await softDeleteContentBlock(paths, { block_id: updated.id })
      const payloadAfterDelete = await getSessionWorkbench(paths, { session_id: 'session_note_flow' })
      assert.equal(payloadAfterDelete.events.some((event) => event.id === updated.event_id), false)
      assert.equal(payloadAfterDelete.content_blocks.find((block) => block.id === updated.id)?.soft_deleted, true)

      await undeleteContentBlock(paths, { block_id: updated.id })
      const payloadAfterRestore = await getSessionWorkbench(paths, { session_id: 'session_note_flow' })
      const restoredEvent = payloadAfterRestore.events.find((event) => event.id === updated.event_id)
      assert.equal(restoredEvent?.id, updated.event_id)
      assert.equal(restoredEvent?.title, '我的实时看法（更新）')
      assert.equal(restoredEvent?.trade_id, null)

      const moved = await retargetContentBlock(paths, {
        block_id: updated.id,
        target_kind: 'trade',
        session_id: 'session_note_flow',
        trade_id: 'trade_note_flow',
      })
      assert.equal(moved.block.context_type, 'trade')
      assert.equal(moved.block.context_id, 'trade_note_flow')
      assert.equal(moved.block.event_id !== null, true)

      const payloadAfterMove = await getSessionWorkbench(paths, { session_id: 'session_note_flow' })
      const movedEvent = payloadAfterMove.events.find((event) => event.id === moved.block.event_id)
      assert.equal(movedEvent?.trade_id, 'trade_note_flow')
      assert.equal(movedEvent?.title, '我的实时看法（更新）')
      assert.deepEqual(movedEvent?.content_block_ids, [updated.id])
      assert.equal(payloadAfterMove.events.some((event) => event.id === updated.event_id), false)
      assert.equal(payloadAfterMove.content_blocks.find((block) => block.id === updated.id)?.move_history.length, 1)
    })
  })

  await t.test('image note can attach to an existing screenshot event without creating a fake extra event', async() => {
    await withTempDb('event-image-note', async({ paths, db, nextIso }) => {
      insertPeriod(db, nextIso, { id: 'period_image_note' })
      insertContract(db, nextIso, { id: 'contract_image_note', symbol: 'GC' })
      insertSession(db, nextIso, {
        id: 'session_image_note',
        contract_id: 'contract_image_note',
        period_id: 'period_image_note',
        title: 'image note session',
      })
      insertScreenshot(db, nextIso, {
        id: 'shot_image_note',
        session_id: 'session_image_note',
        event_id: 'event_image_note',
        caption: '截图 · IG27Q',
      })
      insertEvent(db, nextIso, {
        id: 'event_image_note',
        session_id: 'session_image_note',
        event_type: 'screenshot',
        title: '截图',
        summary: '原始截图事件',
        screenshot_id: 'shot_image_note',
      })

      const block = await createWorkbenchNoteBlockForContext(paths, {
        session_id: 'session_image_note',
        trade_id: null,
        event_id: 'event_image_note',
        title: '事件图说明',
        content_md: '这里是手动补充的事件图说明。',
      })

      assert.equal(block.event_id, 'event_image_note')
      assert.equal(block.context_type, 'event')
      assert.equal(block.context_id, 'event_image_note')

      const payload = await getSessionWorkbench(paths, { session_id: 'session_image_note' })
      const screenshotEvent = payload.events.find((event) => event.id === 'event_image_note')
      assert.deepEqual(screenshotEvent?.content_block_ids, [block.id])
      assert.equal(payload.events.filter((event) => event.event_type === 'observation').length, 0)
      assert.equal(payload.content_blocks.find((item) => item.id === block.id)?.content_md, '这里是手动补充的事件图说明。')
    })
  })
})
