import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { savePendingSnip } from '../../src/main/capture/capture-service.ts'
import {
  getSessionWorkbench,
  softDeleteScreenshot,
  undeleteScreenshot,
} from '../../src/main/domain/workbench-service.ts'
import {
  createCaptureSaveDependencies,
  insertContract,
  insertPeriod,
  insertSession,
  insertTrade,
  setRegressionPendingCapture,
  testCaptureDataUrl,
  withTempDb,
} from './helpers.mjs'

const fullSelection = {
  x: 0,
  y: 0,
  width: 1,
  height: 1,
}

const overlayAnnotations = [
  {
    shape: 'rectangle',
    label: 'B1',
    color: '#355c5a',
    x1: 120,
    y1: 160,
    x2: 420,
    y2: 360,
    text: null,
    stroke_width: 2.6,
  },
  {
    shape: 'text',
    label: 'T1',
    color: '#7a5f2a',
    x1: 460,
    y1: 220,
    x2: 700,
    y2: 292,
    text: '第一次回踩不破，延续优先。',
    stroke_width: 2.6,
  },
]

const annotationDocumentJson = JSON.stringify({
  schema_version: 1,
  source_width: 1600,
  source_height: 900,
  annotations: overlayAnnotations,
}, null, 2)

test('AlphaNexus capture overlay regression guards', async(t) => {
  await t.test('overlay save persists screenshot, annotations, and note, and screenshot delete/restore keeps note block in sync', async() => {
    await withTempDb('capture-overlay-save', async({ paths, db, nextIso }) => {
      insertPeriod(db, nextIso, { id: 'period_capture_save' })
      insertContract(db, nextIso, { id: 'contract_capture_save', symbol: 'NQ' })
      insertSession(db, nextIso, {
        id: 'session_capture_save',
        contract_id: 'contract_capture_save',
        period_id: 'period_capture_save',
        title: 'overlay save session',
      })

      setRegressionPendingCapture({
        session_id: 'session_capture_save',
        contract_id: 'contract_capture_save',
        period_id: 'period_capture_save',
        session_title: 'overlay save session',
        contract_symbol: 'NQ',
      })

      const result = await savePendingSnip(paths, {}, {
        selection: fullSelection,
        target_context: {
          session_id: 'session_capture_save',
          trade_id: null,
          source_view: 'capture-overlay',
          kind: 'chart',
        },
        annotations: overlayAnnotations,
        note_text: '回踩不破，先按延续处理。',
        annotated_image_data_url: testCaptureDataUrl,
        annotation_document_json: annotationDocumentJson,
        run_ai: false,
      }, createCaptureSaveDependencies(paths))

      assert.equal(result.ai_error, null)
      assert.equal(result.created_note_block_id !== null, true)

      const payload = await getSessionWorkbench(paths, { session_id: 'session_capture_save' })
      const savedEvent = payload.events.find((event) => event.id === result.created_event_id)
      const savedBlock = payload.content_blocks.find((block) => block.id === result.created_note_block_id)
      const savedScreenshot = payload.screenshots.find((shot) => shot.id === result.screenshot.id)
      assert(savedEvent)
      assert.equal(savedScreenshot?.annotations.length, 2)
      assert.deepEqual(savedScreenshot?.annotations.map((annotation) => annotation.label), ['B1', 'T1'])
      assert.equal(savedScreenshot?.annotations.find((annotation) => annotation.label === 'T1')?.text, '第一次回踩不破，延续优先。')
      assert.deepEqual(savedEvent.content_block_ids, [result.created_note_block_id])
      assert.equal(savedBlock?.content_md, '回踩不破，先按延续处理。')
      assert.equal(savedBlock?.soft_deleted, false)
      assert.equal(savedScreenshot?.raw_file_path?.length > 0, true)
      assert.equal(savedScreenshot?.annotated_file_path?.length > 0, true)
      assert.equal(savedScreenshot?.annotations_json_path?.length > 0, true)
      await access(path.join(paths.vaultDir, savedScreenshot.raw_file_path))
      await access(path.join(paths.vaultDir, savedScreenshot.annotated_file_path))
      await access(path.join(paths.vaultDir, savedScreenshot.annotations_json_path))
      const persistedAnnotationDocument = await readFile(path.join(paths.vaultDir, savedScreenshot.annotations_json_path), 'utf8')
      assert.match(persistedAnnotationDocument, /"schema_version": 1/)
      assert.match(persistedAnnotationDocument, /"label": "B1"/)

      await softDeleteScreenshot(paths, { screenshot_id: result.screenshot.id })
      const afterDelete = await getSessionWorkbench(paths, { session_id: 'session_capture_save' })
      assert.equal(afterDelete.screenshots.some((shot) => shot.id === result.screenshot.id), false)
      assert.equal(afterDelete.deleted_screenshots.some((shot) => shot.id === result.screenshot.id), true)
      assert.equal(afterDelete.content_blocks.find((block) => block.id === result.created_note_block_id)?.soft_deleted, true)

      await undeleteScreenshot(paths, { screenshot_id: result.screenshot.id })
      const afterRestore = await getSessionWorkbench(paths, { session_id: 'session_capture_save' })
      assert(afterRestore.screenshots.some((shot) => shot.id === result.screenshot.id))
      assert.equal(afterRestore.content_blocks.find((block) => block.id === result.created_note_block_id)?.soft_deleted, false)
    })
  })

  await t.test('overlay save plus AI creates analysis records attributed to the screenshot trade', async() => {
    await withTempDb('capture-overlay-ai', async({ paths, db, nextIso }) => {
      insertPeriod(db, nextIso, { id: 'period_capture_ai' })
      insertContract(db, nextIso, { id: 'contract_capture_ai', symbol: 'NQ' })
      insertSession(db, nextIso, {
        id: 'session_capture_ai',
        contract_id: 'contract_capture_ai',
        period_id: 'period_capture_ai',
        title: 'overlay ai session',
      })
      insertTrade(db, nextIso, {
        id: 'trade_capture_ai_open',
        session_id: 'session_capture_ai',
        symbol: 'NQ',
        side: 'long',
        status: 'open',
        quantity: 2,
        entry_price: 100,
        stop_loss: 95,
        take_profit: 110,
        closed_at: null,
        exit_price: null,
        pnl_r: null,
        thesis: 'open trade for capture ai',
      })

      setRegressionPendingCapture({
        session_id: 'session_capture_ai',
        contract_id: 'contract_capture_ai',
        period_id: 'period_capture_ai',
        trade_id: 'trade_capture_ai_open',
        session_title: 'overlay ai session',
        contract_symbol: 'NQ',
        target_label: 'NQ 做多',
        open_trade_id: 'trade_capture_ai_open',
        open_trade_label: 'NQ 做多',
      })

      const result = await savePendingSnip(paths, {}, {
        selection: fullSelection,
        target_context: {
          session_id: 'session_capture_ai',
          trade_id: 'trade_capture_ai_open',
          source_view: 'capture-overlay',
          kind: 'chart',
        },
        note_text: '突破后第一次回踩继续观察。',
        annotated_image_data_url: testCaptureDataUrl,
        annotation_document_json: annotationDocumentJson,
        run_ai: true,
      }, createCaptureSaveDependencies(paths))

      assert.equal(result.ai_error, null)
      assert.equal(result.ai_run_id !== null, true)

      const payload = await getSessionWorkbench(paths, { session_id: 'session_capture_ai' })
      const screenshotEvent = payload.events.find((event) => event.id === result.created_event_id)
      const aiRun = payload.ai_runs.find((run) => run.id === result.ai_run_id)
      const aiEvent = payload.events.find((event) => event.ai_run_id === result.ai_run_id)
      const aiCard = payload.analysis_cards.find((card) => card.ai_run_id === result.ai_run_id)

      assert.equal(payload.current_context.trade_id, null)
      assert.equal(screenshotEvent?.trade_id, 'trade_capture_ai_open')
      assert.equal(aiRun?.id, result.ai_run_id)
      assert.equal(aiRun?.prompt_preview, 'capture overlay regression prompt')
      assert.equal(aiRun?.raw_response_text.length > 0, true)
      assert.equal(aiRun?.structured_response_json.length > 0, true)
      assert.equal(aiEvent?.trade_id, 'trade_capture_ai_open')
      assert.equal(aiCard?.trade_id, 'trade_capture_ai_open')
    })
  })

  await t.test('overlay save as exit forces exit kind and prefers the current open trade', async() => {
    await withTempDb('capture-overlay-exit', async({ paths, db, nextIso }) => {
      insertPeriod(db, nextIso, { id: 'period_capture_exit' })
      insertContract(db, nextIso, { id: 'contract_capture_exit', symbol: 'NQ' })
      insertSession(db, nextIso, {
        id: 'session_capture_exit',
        contract_id: 'contract_capture_exit',
        period_id: 'period_capture_exit',
        title: 'overlay exit session',
      })
      insertTrade(db, nextIso, {
        id: 'trade_capture_exit_open',
        session_id: 'session_capture_exit',
        symbol: 'NQ',
        side: 'short',
        status: 'open',
        quantity: 1,
        entry_price: 100,
        stop_loss: 103,
        take_profit: 96,
        closed_at: null,
        exit_price: null,
        pnl_r: null,
        thesis: 'open trade for exit capture',
      })

      setRegressionPendingCapture({
        session_id: 'session_capture_exit',
        contract_id: 'contract_capture_exit',
        period_id: 'period_capture_exit',
        session_title: 'overlay exit session',
        contract_symbol: 'NQ',
        open_trade_id: 'trade_capture_exit_open',
        open_trade_label: 'NQ 做空',
      })

      const result = await savePendingSnip(paths, {}, {
        selection: fullSelection,
        target_context: {
          session_id: 'session_capture_exit',
          trade_id: null,
          source_view: 'capture-overlay',
          kind: 'chart',
        },
        note_text: '离场截图应该优先挂到 open trade。',
        annotated_image_data_url: testCaptureDataUrl,
        annotation_document_json: annotationDocumentJson,
        run_ai: false,
        kind: 'exit',
      }, createCaptureSaveDependencies(paths))

      const payload = await getSessionWorkbench(paths, { session_id: 'session_capture_exit' })
      const savedShot = payload.screenshots.find((shot) => shot.id === result.screenshot.id)
      const savedEvent = payload.events.find((event) => event.id === result.created_event_id)

      assert.equal(savedShot?.kind, 'exit')
      assert.equal(savedEvent?.trade_id, 'trade_capture_exit_open')
      assert.equal(savedEvent?.summary, '离场截图应该优先挂到 open trade。')
      assert.equal(result.resolved_target?.target_kind, 'trade')
      assert.equal(result.resolved_target?.trade_id, 'trade_capture_exit_open')
      assert.equal(result.resolved_target?.capture_kind, 'exit')
      assert.match(result.resolved_target?.resolution_note ?? '', /自动挂到当前 open trade/)
    })
  })

  await t.test('overlay save as exit degrades to session target when no open trade exists', async() => {
    await withTempDb('capture-overlay-exit-fallback', async({ paths, db, nextIso }) => {
      insertPeriod(db, nextIso, { id: 'period_capture_exit_fallback' })
      insertContract(db, nextIso, { id: 'contract_capture_exit_fallback', symbol: 'NQ' })
      insertSession(db, nextIso, {
        id: 'session_capture_exit_fallback',
        contract_id: 'contract_capture_exit_fallback',
        period_id: 'period_capture_exit_fallback',
        title: 'overlay exit fallback session',
      })

      setRegressionPendingCapture({
        session_id: 'session_capture_exit_fallback',
        contract_id: 'contract_capture_exit_fallback',
        period_id: 'period_capture_exit_fallback',
        session_title: 'overlay exit fallback session',
        contract_symbol: 'NQ',
      })

      const result = await savePendingSnip(paths, {}, {
        selection: fullSelection,
        target_context: {
          session_id: 'session_capture_exit_fallback',
          trade_id: null,
          source_view: 'capture-overlay',
          kind: 'chart',
        },
        note_text: '没有 open trade 时应退回 Session 主线。',
        run_ai: false,
        kind: 'exit',
      }, createCaptureSaveDependencies(paths))

      const payload = await getSessionWorkbench(paths, { session_id: 'session_capture_exit_fallback' })
      const savedEvent = payload.events.find((event) => event.id === result.created_event_id)

      assert.equal(result.screenshot.kind, 'exit')
      assert.equal(savedEvent?.trade_id, null)
      assert.equal(result.resolved_target?.target_kind, 'session')
      assert.equal(result.resolved_target?.trade_id, null)
      assert.equal(result.resolved_target?.session_id, 'session_capture_exit_fallback')
      assert.match(result.resolved_target?.resolution_note ?? '', /降级保存到当前 Session 目标/)
    })
  })

  await t.test('overlay save keeps local persistence when AI is unavailable', async() => {
    await withTempDb('capture-overlay-ai-unavailable', async({ paths, db, nextIso }) => {
      insertPeriod(db, nextIso, { id: 'period_capture_ai_unavailable' })
      insertContract(db, nextIso, { id: 'contract_capture_ai_unavailable', symbol: 'NQ' })
      insertSession(db, nextIso, {
        id: 'session_capture_ai_unavailable',
        contract_id: 'contract_capture_ai_unavailable',
        period_id: 'period_capture_ai_unavailable',
        title: 'overlay ai unavailable session',
      })

      setRegressionPendingCapture({
        session_id: 'session_capture_ai_unavailable',
        contract_id: 'contract_capture_ai_unavailable',
        period_id: 'period_capture_ai_unavailable',
        session_title: 'overlay ai unavailable session',
        contract_symbol: 'NQ',
      })

      const result = await savePendingSnip(paths, {}, {
        selection: fullSelection,
        target_context: {
          session_id: 'session_capture_ai_unavailable',
          trade_id: null,
          source_view: 'capture-overlay',
          kind: 'chart',
        },
        note_text: '先落本地，再决定是否发 AI。',
        annotated_image_data_url: testCaptureDataUrl,
        annotation_document_json: annotationDocumentJson,
        run_ai: true,
      }, createCaptureSaveDependencies(paths, {
        providers: [],
      }))

      assert.equal(result.ai_error, '当前没有已启用且已配置完成的 AI provider。')
      assert.equal(result.created_note_block_id !== null, true)

      const payload = await getSessionWorkbench(paths, { session_id: 'session_capture_ai_unavailable' })
      assert(payload.screenshots.some((shot) => shot.id === result.screenshot.id))
      assert.equal(payload.ai_runs.length, 0)
      assert.equal(payload.analysis_cards.length, 0)
      assert.equal(payload.content_blocks.find((block) => block.id === result.created_note_block_id)?.content_md, '先落本地，再决定是否发 AI。')
    })
  })
})
