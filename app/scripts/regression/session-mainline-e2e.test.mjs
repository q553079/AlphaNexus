import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { savePendingSnip } from '../../src/main/capture/capture-service.ts'
import { createLauncherSession } from '../../src/main/domain/session-launcher-service.ts'
import {
  closeExistingTrade,
  getPeriodReview,
  getSessionWorkbench,
  getTradeDetail,
  openTradeForSession,
  updateSessionRealtimeView,
} from '../../src/main/domain/workbench-service.ts'
import { exportSessionMarkdown } from '../../src/main/export/service.ts'
import {
  createCaptureSaveDependencies,
  insertContract,
  setRegressionPendingCapture,
  withTempDb,
} from './helpers.mjs'

const fullSelection = {
  x: 0,
  y: 0,
  width: 1,
  height: 1,
}

const setPendingCaptureForTrade = (session, tradeId, kind = 'chart') => {
  setRegressionPendingCapture({
    session_id: session.id,
    contract_id: session.contract_id,
    period_id: session.period_id,
    trade_id: tradeId,
    kind,
    session_title: session.title,
    contract_symbol: 'NQ',
    target_label: tradeId ? 'NQ 做多' : session.title,
    open_trade_id: tradeId,
    open_trade_label: tradeId ? 'NQ 做多' : null,
  })
}

test('AlphaNexus session mainline e2e regression', async() => {
  await withTempDb('session-mainline-e2e', async({ paths, db, nextIso: _nextIso }) => {
    insertContract(db, () => new Date('2026-03-27T09:00:00.000+08:00').toISOString(), {
      id: 'contract_session_mainline_e2e',
      symbol: 'NQ',
    })

    const created = await createLauncherSession(paths, {
      contract_id: 'contract_session_mainline_e2e',
      bucket: 'am',
      market_bias: 'bullish',
      context_focus: 'Opening reclaim 需要等第一次回踩确认。',
      trade_plan_md: [
        '# Opening reclaim plan',
        '',
        '- 先看 VWAP reclaim 是否成立',
        '- 只做第一次确认后的延续',
        '- 如果重新跌回 VWAP 下方就取消交易',
      ].join('\n'),
      tags: ['opening-drive'],
    })
    const session = created.session

    await updateSessionRealtimeView(paths, {
      session_id: session.id,
      trade_id: null,
      content_md: '盘前偏向继续做 opening reclaim，跌回 VWAP 下方就取消做多计划。',
    })

    const opened = await openTradeForSession(paths, {
      session_id: session.id,
      side: 'long',
      quantity: 2,
      entry_price: 100,
      stop_loss: 96,
      take_profit: 108,
      thesis: '重新站上 VWAP 后等第一次回踩确认，再顺着 opening drive continuation 开仓。',
    })

    setPendingCaptureForTrade(session, opened.trade.id, 'chart')
    const setupSave = await savePendingSnip(paths, {}, {
      selection: fullSelection,
      target_context: {
        session_id: session.id,
        trade_id: opened.trade.id,
        source_view: 'capture-overlay',
        kind: 'chart',
      },
      note_text: 'Setup：reclaim 后第一次回踩不破，允许按计划开仓并看向 108。',
      run_ai: true,
    }, createCaptureSaveDependencies(paths))

    setPendingCaptureForTrade(session, opened.trade.id, 'execution')
    const manageSave = await savePendingSnip(paths, {}, {
      selection: fullSelection,
      target_context: {
        session_id: session.id,
        trade_id: opened.trade.id,
        source_view: 'capture-overlay',
        kind: 'execution',
      },
      note_text: 'Manage：加速段不追价，等二次确认继续持有，先不主观提前减仓。',
      run_ai: false,
    }, createCaptureSaveDependencies(paths))

    setPendingCaptureForTrade(session, opened.trade.id, 'exit')
    const exitSave = await savePendingSnip(paths, {}, {
      selection: fullSelection,
      target_context: {
        session_id: session.id,
        trade_id: null,
        source_view: 'capture-overlay',
        kind: 'chart',
      },
      note_text: 'Exit：目标位出现衰竭，先保存 exit 图和原始想法，再执行平仓。',
      run_ai: false,
      kind: 'exit',
    }, createCaptureSaveDependencies(paths))

    const closed = await closeExistingTrade(paths, {
      trade_id: opened.trade.id,
      exit_price: 108,
    })

    const sessionPayload = await getSessionWorkbench(paths, { session_id: session.id })
    const tradeDetail = await getTradeDetail(paths, { trade_id: opened.trade.id })
    const periodReview = await getPeriodReview(paths, { period_id: session.period_id })
    const markdownExport = await exportSessionMarkdown(paths, { session_id: session.id })
    const savedMarkdown = await readFile(markdownExport.file_path, 'utf8')

    assert.equal(setupSave.ai_error, null)
    assert.equal(setupSave.ai_run_id !== null, true)
    assert.equal(closed.trade.status, 'closed')
    assert.equal(sessionPayload.trades.length, 1)
    const tradeEventTypes = sessionPayload.events
      .filter((event) => event.trade_id === opened.trade.id)
      .map((event) => event.event_type)
    assert.equal(tradeEventTypes.includes('trade_open'), true)
    assert.equal(tradeEventTypes.includes('ai_summary'), true)
    assert.equal(tradeEventTypes.includes('trade_close'), true)
    assert.equal(tradeEventTypes.filter((type) => type === 'screenshot').length, 3)
    assert.equal(tradeEventTypes.at(-1), 'review')
    assert.equal(sessionPayload.ai_runs.some((run) => run.id === setupSave.ai_run_id), true)
    assert.equal(sessionPayload.analysis_cards.some((card) => card.ai_run_id === setupSave.ai_run_id && card.trade_id === opened.trade.id), true)

    assert.equal(tradeDetail.trade.id, opened.trade.id)
    assert.equal(tradeDetail.setup_screenshot?.id, setupSave.screenshot.id)
    assert.equal(tradeDetail.manage_screenshots.some((shot) => shot.id === manageSave.screenshot.id), true)
    assert.equal(tradeDetail.exit_screenshot?.id, exitSave.screenshot.id)
    assert.equal(tradeDetail.review_draft_block !== null, true)
    assert.match(tradeDetail.review_draft_block?.content_md ?? '', /当前结果：已平仓/)

    assert.equal(periodReview.period.id, session.period_id)
    assert.equal(periodReview.sessions.some((item) => item.id === session.id), true)
    assert.equal(periodReview.highlight_cards.some((card) => card.ai_run_id === setupSave.ai_run_id), true)
    assert.equal(periodReview.setup_leaderboard[0]?.label, 'opening-drive')
    assert.equal(periodReview.training_insights.length > 0, true)

    assert.equal(savedMarkdown, markdownExport.markdown)
    assert.match(markdownExport.markdown, new RegExp(`# ${session.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
    assert.match(markdownExport.markdown, /## Event Spine/)
    assert.match(markdownExport.markdown, /## Trade Threads/)
    assert.match(markdownExport.markdown, /### Trade #1 · NQ 做多 · 已关闭/)
    assert.match(markdownExport.markdown, /Setup：reclaim 后第一次回踩不破/)
    assert.match(markdownExport.markdown, /Manage：加速段不追价/)
    assert.match(markdownExport.markdown, /Exit：目标位出现衰竭/)
    assert.match(markdownExport.markdown, /Review Draft \/ Exit Review/)
    assert.match(markdownExport.markdown, /Exit review draft/)
    assert.match(markdownExport.markdown, new RegExp(setupSave.screenshot.asset_url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    assert.match(markdownExport.markdown, new RegExp(manageSave.screenshot.asset_url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    assert.match(markdownExport.markdown, new RegExp(exitSave.screenshot.asset_url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  })
})
