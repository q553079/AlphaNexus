import assert from 'node:assert/strict'
import test from 'node:test'
import { getSessionWorkbench } from '../../src/main/domain/workbench-service.ts'
import { buildEventStreamViewModel } from '../../src/renderer/app/features/session-workbench/modules/session-event-stream.ts'
import { buildScreenshotGalleryState } from '../../src/renderer/app/features/session-workbench/modules/session-screenshot-gallery.ts'
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

test('AlphaNexus timeline regression guards', async(t) => {
  await t.test('timeline view model reads real session events from DB payload with stable time ordering and type filters', async() => {
    await withTempDb('timeline-real-payload', async({ paths, db, nextIso }) => {
      insertPeriod(db, nextIso, { id: 'period_timeline_real' })
      insertContract(db, nextIso, { id: 'contract_timeline_real', symbol: 'NQ' })
      insertSession(db, nextIso, {
        id: 'session_timeline_real',
        contract_id: 'contract_timeline_real',
        period_id: 'period_timeline_real',
        title: 'timeline real session',
      })
      insertTrade(db, nextIso, {
        id: 'trade_timeline_real',
        session_id: 'session_timeline_real',
        symbol: 'NQ',
        side: 'long',
        status: 'open',
        quantity: 1,
        entry_price: 100,
        stop_loss: 96,
        take_profit: 106,
        opened_at: '2026-03-26T01:00:00.000Z',
        closed_at: null,
        exit_price: null,
        pnl_r: null,
        thesis: 'timeline scope trade',
      })

      insertEvent(db, nextIso, {
        id: 'event_timeline_open',
        session_id: 'session_timeline_real',
        trade_id: 'trade_timeline_real',
        event_type: 'trade_open',
        title: 'Open',
        summary: 'trade opened',
        occurred_at: '2026-03-26T01:00:00.000Z',
      })
      insertScreenshot(db, nextIso, {
        id: 'shot_timeline_chart',
        session_id: 'session_timeline_real',
        event_id: 'event_timeline_chart',
        kind: 'chart',
        caption: 'Opening chart',
      })
      insertEvent(db, nextIso, {
        id: 'event_timeline_chart',
        session_id: 'session_timeline_real',
        trade_id: 'trade_timeline_real',
        event_type: 'screenshot',
        title: '截图',
        summary: 'chart saved',
        screenshot_id: 'shot_timeline_chart',
        occurred_at: '2026-03-26T01:01:00.000Z',
      })
      insertContentBlock(db, nextIso, {
        id: 'block_timeline_note',
        session_id: 'session_timeline_real',
        event_id: 'event_timeline_note',
        title: '观察',
        content_md: 'watch reclaim first',
        context_type: 'session',
        context_id: 'session_timeline_real',
        sort_order: 1,
      })
      insertEvent(db, nextIso, {
        id: 'event_timeline_note',
        session_id: 'session_timeline_real',
        trade_id: null,
        event_type: 'observation',
        title: '观察',
        summary: 'watch reclaim first',
        content_block_ids: ['block_timeline_note'],
        occurred_at: '2026-03-26T01:01:00.000Z',
      })
      insertAiRun(db, nextIso, {
        id: 'airun_timeline_real',
        session_id: 'session_timeline_real',
        event_id: 'event_timeline_ai',
      })
      insertAnalysisCard(db, nextIso, {
        id: 'analysis_timeline_real',
        ai_run_id: 'airun_timeline_real',
        session_id: 'session_timeline_real',
        trade_id: 'trade_timeline_real',
        bias: 'bullish',
        confidence_pct: 71,
        summary_short: 'timeline ai',
      })
      insertContentBlock(db, nextIso, {
        id: 'block_timeline_ai',
        session_id: 'session_timeline_real',
        event_id: 'event_timeline_ai',
        block_type: 'ai-summary',
        title: 'AI summary',
        content_md: 'timeline ai content',
        context_type: 'event',
        context_id: 'event_timeline_ai',
        sort_order: 2,
      })
      insertEvent(db, nextIso, {
        id: 'event_timeline_ai',
        session_id: 'session_timeline_real',
        trade_id: 'trade_timeline_real',
        event_type: 'ai_summary',
        title: 'AI',
        summary: 'timeline ai summary',
        author_kind: 'ai',
        screenshot_id: 'shot_timeline_chart',
        ai_run_id: 'airun_timeline_real',
        content_block_ids: ['block_timeline_ai'],
        occurred_at: '2026-03-26T01:02:00.000Z',
      })

      const payload = await getSessionWorkbench(paths, { session_id: 'session_timeline_real' })
      assert.deepEqual(
        payload.events.map((event) => event.id),
        ['event_timeline_open', 'event_timeline_chart', 'event_timeline_note', 'event_timeline_ai'],
      )

      const allView = buildEventStreamViewModel({
        activeFilter: 'all',
        collapseAi: false,
        collapseBackground: false,
        collapseNotes: false,
        currentTrade: null,
        events: payload.events,
        screenshots: payload.screenshots,
        selectedEventId: 'event_timeline_chart',
        tradeFocusId: null,
        trades: payload.trades,
      })
      assert.equal(allView.visibleEventCount, 4)
      assert.equal(allView.items.find((item) => item.event.id === 'event_timeline_chart')?.screenshotKind, 'chart')
      assert.equal(allView.items.find((item) => item.event.id === 'event_timeline_ai')?.isAiEvent, true)

      const screenshotOnlyView = buildEventStreamViewModel({
        activeFilter: 'screenshot',
        collapseAi: false,
        collapseBackground: false,
        collapseNotes: false,
        currentTrade: null,
        events: payload.events,
        screenshots: payload.screenshots,
        selectedEventId: null,
        tradeFocusId: null,
        trades: payload.trades,
      })
      assert.equal(screenshotOnlyView.visibleEventCount, 1)
      assert.equal(screenshotOnlyView.items[0]?.event.id, 'event_timeline_chart')
    })
  })

  await t.test('screenshot gallery builds real tabs and setup/exit compare state from session payload', async() => {
    await withTempDb('timeline-gallery-state', async({ paths, db, nextIso }) => {
      insertPeriod(db, nextIso, { id: 'period_timeline_gallery' })
      insertContract(db, nextIso, { id: 'contract_timeline_gallery', symbol: 'NQ' })
      insertSession(db, nextIso, {
        id: 'session_timeline_gallery',
        contract_id: 'contract_timeline_gallery',
        period_id: 'period_timeline_gallery',
        title: 'gallery session',
      })
      insertTrade(db, nextIso, {
        id: 'trade_timeline_gallery',
        session_id: 'session_timeline_gallery',
        symbol: 'NQ',
        side: 'short',
        status: 'closed',
        quantity: 1,
        entry_price: 101,
        stop_loss: 104,
        take_profit: 96,
        opened_at: '2026-03-26T02:00:00.000Z',
        closed_at: '2026-03-26T02:20:00.000Z',
        exit_price: 97,
        pnl_r: 1.1,
        thesis: 'gallery trade',
      })

      insertScreenshot(db, nextIso, {
        id: 'shot_gallery_setup',
        session_id: 'session_timeline_gallery',
        event_id: 'event_gallery_setup',
        kind: 'chart',
        caption: 'Setup shot',
      })
      insertEvent(db, nextIso, {
        id: 'event_gallery_setup',
        session_id: 'session_timeline_gallery',
        trade_id: 'trade_timeline_gallery',
        event_type: 'screenshot',
        title: 'Setup',
        summary: 'setup',
        screenshot_id: 'shot_gallery_setup',
        occurred_at: '2026-03-26T02:01:00.000Z',
      })
      insertScreenshot(db, nextIso, {
        id: 'shot_gallery_manage',
        session_id: 'session_timeline_gallery',
        event_id: 'event_gallery_manage',
        kind: 'execution',
        caption: 'Manage shot',
      })
      insertEvent(db, nextIso, {
        id: 'event_gallery_manage',
        session_id: 'session_timeline_gallery',
        trade_id: 'trade_timeline_gallery',
        event_type: 'screenshot',
        title: 'Manage',
        summary: 'manage',
        screenshot_id: 'shot_gallery_manage',
        occurred_at: '2026-03-26T02:05:00.000Z',
      })
      insertScreenshot(db, nextIso, {
        id: 'shot_gallery_exit',
        session_id: 'session_timeline_gallery',
        event_id: 'event_gallery_exit',
        kind: 'exit',
        caption: 'Exit shot',
      })
      insertEvent(db, nextIso, {
        id: 'event_gallery_exit',
        session_id: 'session_timeline_gallery',
        trade_id: 'trade_timeline_gallery',
        event_type: 'screenshot',
        title: 'Exit',
        summary: 'exit',
        screenshot_id: 'shot_gallery_exit',
        occurred_at: '2026-03-26T02:19:00.000Z',
      })
      insertScreenshot(db, nextIso, {
        id: 'shot_gallery_session',
        session_id: 'session_timeline_gallery',
        event_id: 'event_gallery_session',
        kind: 'chart',
        caption: 'Session-only shot',
      })
      insertEvent(db, nextIso, {
        id: 'event_gallery_session',
        session_id: 'session_timeline_gallery',
        trade_id: null,
        event_type: 'screenshot',
        title: 'Session screenshot',
        summary: 'session',
        screenshot_id: 'shot_gallery_session',
        occurred_at: '2026-03-26T02:30:00.000Z',
      })

      const payload = await getSessionWorkbench(paths, { session_id: 'session_timeline_gallery' })

      const tradeGallery = buildScreenshotGalleryState({
        current_trade_id: 'trade_timeline_gallery',
        payload,
        selected_screenshot_id: 'shot_gallery_setup',
      })
      assert.equal(tradeGallery.scope, 'trade')
      assert.deepEqual(tradeGallery.screenshots.map((screenshot) => screenshot.id), [
        'shot_gallery_setup',
        'shot_gallery_manage',
        'shot_gallery_exit',
      ])
      assert.equal(tradeGallery.compare_pair?.setup?.id, 'shot_gallery_setup')
      assert.equal(tradeGallery.compare_pair?.exit?.id, 'shot_gallery_exit')
      assert.equal(tradeGallery.target_trade_id, 'trade_timeline_gallery')

      const sessionGallery = buildScreenshotGalleryState({
        current_trade_id: 'trade_timeline_gallery',
        payload,
        selected_screenshot_id: 'shot_gallery_session',
      })
      assert.equal(sessionGallery.scope, 'session')
      assert.deepEqual(sessionGallery.screenshots.map((screenshot) => screenshot.id), ['shot_gallery_session'])
      assert.equal(sessionGallery.compare_pair, null)
    })
  })
})
