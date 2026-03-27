import os from 'node:os'
import path from 'node:path'
import { mkdtemp, rm } from 'node:fs/promises'
import { getDatabase } from '../../src/main/db/connection.ts'
import { applyMigrations } from '../../src/main/db/migrations.ts'
import { clearPendingSnipCapture, setPendingSnipCapture } from '../../src/main/capture/capture-overlay-state.ts'
import { getSessionWorkbench, recordAiAnalysis } from '../../src/main/domain/workbench-service.ts'

export const createPaths = async(name) => {
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

export const createClock = () => {
  let tick = 0
  const base = Date.parse('2026-03-26T01:00:00.000Z')
  return () => new Date(base + (tick++ * 60_000)).toISOString()
}

export const withTempDb = async(name, run) => {
  const paths = await createPaths(name)
  const db = await getDatabase(paths)
  applyMigrations(db)
  const nextIso = createClock()

  try {
    await run({ paths, db, nextIso })
  } finally {
    clearPendingSnipCapture()
    db.close()
    await rm(paths.rootDir, { recursive: true, force: true })
  }
}

export const insertContract = (db, nextIso, input) => {
  db.prepare(`
    INSERT INTO contracts (id, schema_version, created_at, symbol, name, venue, asset_class, quote_currency)
    VALUES (?, 1, ?, ?, ?, 'CME', 'future', 'USD')
  `).run(input.id, nextIso(), input.symbol, input.name ?? `${input.symbol} contract`)
}

export const insertPeriod = (db, nextIso, input) => {
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

export const insertSession = (db, nextIso, input) => {
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

export const insertTrade = (db, nextIso, input) => {
  db.prepare(`
    INSERT INTO trades (
      id, schema_version, created_at, session_id, symbol, side, status, quantity, entry_price,
      stop_loss, take_profit, exit_price, pnl_r, opened_at, closed_at, thesis, deleted_at
    ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
  `).run(
    input.id,
    nextIso(),
    input.session_id,
    input.symbol,
    input.side,
    input.status ?? 'closed',
    input.quantity ?? 1,
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

export const insertEvaluation = (db, nextIso, input) => {
  db.prepare(`
    INSERT INTO evaluations (id, schema_version, created_at, session_id, trade_id, score, note_md, deleted_at)
    VALUES (?, 1, ?, ?, ?, ?, ?, NULL)
  `).run(input.id, nextIso(), input.session_id, input.trade_id, input.score ?? 80, input.note_md ?? '')
}

export const insertEvent = (db, nextIso, input) => {
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

export const insertScreenshot = (db, nextIso, input) => {
  db.prepare(`
    INSERT INTO screenshots (
      id, schema_version, created_at, session_id, event_id, kind, file_path, asset_url,
      caption, width, height, deleted_at
    ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, 1600, 900, NULL)
  `).run(
    input.id,
    nextIso(),
    input.session_id,
    input.event_id ?? null,
    input.kind ?? 'chart',
    input.file_path ?? `${input.id}.png`,
    input.asset_url ?? `file:///${input.id}.png`,
    input.caption ?? input.id,
  )
}

export const insertAnnotation = (db, nextIso, input) => {
  db.prepare(`
    INSERT INTO annotations (
      id, schema_version, created_at, screenshot_id, shape, label, color, x1, y1, x2, y2, text, stroke_width, deleted_at
    ) VALUES (?, 1, ?, ?, 'rectangle', ?, '#355c5a', 10, 20, 120, 180, NULL, 2, NULL)
  `).run(input.id, nextIso(), input.screenshot_id, input.label ?? input.id)
}

export const insertAiRun = (db, nextIso, input) => {
  db.prepare(`
    INSERT INTO ai_runs (
      id, schema_version, created_at, session_id, event_id, provider, model, status,
      prompt_kind, input_summary, prompt_preview, raw_response_text, structured_response_json, finished_at, deleted_at
    ) VALUES (?, 1, ?, ?, ?, 'deepseek', 'deepseek-reasoner', 'completed', ?, ?, ?, ?, ?, ?, NULL)
  `).run(
    input.id,
    nextIso(),
    input.session_id,
    input.event_id ?? null,
    input.prompt_kind ?? 'market-analysis',
    input.input_summary ?? input.id,
    input.prompt_preview ?? `${input.id} prompt`,
    input.raw_response_text ?? `${input.id} raw response`,
    input.structured_response_json ?? '{"summary_short":"mock"}',
    input.finished_at ?? nextIso(),
  )
}

export const insertAnalysisCard = (db, nextIso, input) => {
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

export const insertContentBlock = (db, nextIso, input) => {
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

export const ids = (rows, selector = (row) => row.id ?? row.anchor_id) => rows.map(selector).sort()

export const testCaptureDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9VE3d2kAAAAASUVORK5CYII='

export const setRegressionPendingCapture = (input) => {
  setPendingSnipCapture({
    session_id: input.session_id,
    contract_id: input.contract_id,
    period_id: input.period_id,
    trade_id: input.trade_id ?? null,
    source_view: 'capture-overlay',
    kind: input.kind ?? 'chart',
    display_label: input.display_label ?? 'Regression overlay',
    target_kind: input.trade_id ? 'trade' : 'session',
    target_label: input.target_label ?? (input.trade_id ? `${input.contract_symbol} Trade` : input.session_title),
    target_subtitle: input.target_subtitle ?? (input.trade_id ? 'Trade 级目标' : 'Session 级目标 · Realtime view'),
    session_title: input.session_title,
    contract_symbol: input.contract_symbol,
    open_trade_id: input.open_trade_id ?? null,
    open_trade_label: input.open_trade_label ?? null,
    source_width: 1,
    source_height: 1,
    source_data_url: testCaptureDataUrl,
  })
}

export const createCaptureSaveDependencies = (paths, input = {}) => ({
  listAiProviders: async() => input.providers ?? [
    {
      provider: 'deepseek',
      label: 'DeepSeek',
      enabled: true,
      configured: true,
      model: 'mock-model',
      base_url: null,
      configured_via: 'local',
      secret_storage: 'local-file',
      supports_base_url_override: true,
      supports_local_api_key: false,
    },
  ],
  runAiAnalysis: async(_paths, _env, analysisInput) => {
    if (input.runAiAnalysis) {
      return input.runAiAnalysis(_paths, _env, analysisInput)
    }

    const payload = await getSessionWorkbench(paths, { session_id: analysisInput.session_id })
    const screenshotTradeId = analysisInput.screenshot_id
      ? payload.events.find((event) =>
        event.event_type === 'screenshot'
        && event.screenshot_id === analysisInput.screenshot_id)?.trade_id ?? null
      : payload.current_context.trade_id
    const persisted = await recordAiAnalysis(paths, {
      session_id: analysisInput.session_id,
      provider: analysisInput.provider,
      model: 'mock-model',
      prompt_kind: analysisInput.prompt_kind,
      input_summary: 'capture overlay regression',
      prompt_preview: 'capture overlay regression prompt',
      raw_response_text: '{"summary_short":"capture overlay regression analysis"}',
      structured_response_json: '{"bias":"bullish","confidence_pct":68}',
      screenshot_id: analysisInput.screenshot_id ?? null,
      trade_id: screenshotTradeId,
      event_title: 'Capture overlay AI',
      block_title: 'Capture overlay AI block',
      summary_short: 'capture overlay regression analysis',
      content_md: '# Capture overlay AI\n\nRegression AI content.',
      analysis: {
        bias: 'bullish',
        confidence_pct: 68,
        reversal_probability_pct: 21,
        entry_zone: '100-101',
        stop_loss: '99',
        take_profit: '104',
        invalidation: 'lose reclaim',
        summary_short: 'capture overlay regression analysis',
        deep_analysis_md: 'Regression AI content.',
        supporting_factors: ['overlay screenshot', 'local-first save'],
      },
    })

    return {
      ...persisted,
      prompt_preview: 'capture overlay regression prompt',
    }
  },
  buildImage: async() => ({
    toPNG: () => Buffer.from('mock-capture-image'),
    getSize: () => ({
      width: 1600,
      height: 900,
    }),
  }),
  closeOverlayWindow: () => {},
  notifySaved: () => {},
})
