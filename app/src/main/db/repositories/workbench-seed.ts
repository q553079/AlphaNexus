import type Database from 'better-sqlite3'
import { createMockWorkbenchDataset } from '@shared/mock-data/session-workbench'

export const seedMockData = (db: Database.Database) => {
  const dataset = createMockWorkbenchDataset()
  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO contracts (id, schema_version, created_at, symbol, name, venue, asset_class, quote_currency)
      VALUES (@id, @schema_version, @created_at, @symbol, @name, @venue, @asset_class, @quote_currency)
    `).run(dataset.contract)

    db.prepare(`
      INSERT INTO periods (id, schema_version, created_at, kind, label, start_at, end_at)
      VALUES (@id, @schema_version, @created_at, @kind, @label, @start_at, @end_at)
    `).run(dataset.period)

    db.prepare(`
      INSERT INTO sessions (id, schema_version, created_at, contract_id, period_id, title, status, started_at, ended_at, market_bias, tags_json, my_realtime_view, trade_plan_md, context_focus, deleted_at)
      VALUES (@id, @schema_version, @created_at, @contract_id, @period_id, @title, @status, @started_at, @ended_at, @market_bias, @tags_json, @my_realtime_view, @trade_plan_md, @context_focus, NULL)
    `).run({ ...dataset.session, tags_json: JSON.stringify(dataset.session.tags) })

    for (const trade of dataset.trades) {
      db.prepare(`
        INSERT INTO trades (id, schema_version, created_at, session_id, symbol, side, status, quantity, entry_price, stop_loss, take_profit, exit_price, pnl_r, opened_at, closed_at, thesis, deleted_at)
        VALUES (@id, @schema_version, @created_at, @session_id, @symbol, @side, @status, @quantity, @entry_price, @stop_loss, @take_profit, @exit_price, @pnl_r, @opened_at, @closed_at, @thesis, NULL)
      `).run(trade)
    }

    for (const event of dataset.events) {
      db.prepare(`
        INSERT INTO events (id, schema_version, created_at, session_id, trade_id, event_type, title, summary, author_kind, occurred_at, content_block_ids_json, screenshot_id, ai_run_id, deleted_at)
        VALUES (@id, @schema_version, @created_at, @session_id, @trade_id, @event_type, @title, @summary, @author_kind, @occurred_at, @content_block_ids_json, @screenshot_id, @ai_run_id, NULL)
      `).run({ ...event, content_block_ids_json: JSON.stringify(event.content_block_ids) })
    }

    for (const screenshot of dataset.screenshots) {
      db.prepare(`
        INSERT INTO screenshots (id, schema_version, created_at, session_id, event_id, kind, file_path, asset_url, caption, width, height, deleted_at)
        VALUES (@id, @schema_version, @created_at, @session_id, @event_id, @kind, @file_path, @asset_url, @caption, @width, @height, NULL)
      `).run(screenshot)
    }

    for (const annotation of dataset.annotations) {
      db.prepare(`
        INSERT INTO annotations (id, schema_version, created_at, screenshot_id, shape, label, color, x1, y1, x2, y2, text, stroke_width, deleted_at)
        VALUES (@id, @schema_version, @created_at, @screenshot_id, @shape, @label, @color, @x1, @y1, @x2, @y2, @text, @stroke_width, NULL)
      `).run(annotation)
    }

    for (const block of dataset.content_blocks) {
      db.prepare(`
        INSERT INTO content_blocks (id, schema_version, created_at, session_id, event_id, block_type, title, content_md, sort_order, context_type, context_id, soft_deleted, deleted_at)
        VALUES (@id, @schema_version, @created_at, @session_id, @event_id, @block_type, @title, @content_md, @sort_order, @context_type, @context_id, @soft_deleted, NULL)
      `).run({ ...block, soft_deleted: block.soft_deleted ? 1 : 0 })
    }

    for (const aiRun of dataset.ai_runs) {
      db.prepare(`
        INSERT INTO ai_runs (id, schema_version, created_at, session_id, event_id, provider, model, status, prompt_kind, input_summary, finished_at, deleted_at)
        VALUES (@id, @schema_version, @created_at, @session_id, @event_id, @provider, @model, @status, @prompt_kind, @input_summary, @finished_at, NULL)
      `).run(aiRun)
    }

    for (const card of dataset.analysis_cards) {
      db.prepare(`
        INSERT INTO analysis_cards (id, schema_version, created_at, ai_run_id, session_id, trade_id, bias, confidence_pct, reversal_probability_pct, entry_zone, stop_loss, take_profit, invalidation, summary_short, deep_analysis_md, supporting_factors_json, deleted_at)
        VALUES (@id, @schema_version, @created_at, @ai_run_id, @session_id, @trade_id, @bias, @confidence_pct, @reversal_probability_pct, @entry_zone, @stop_loss, @take_profit, @invalidation, @summary_short, @deep_analysis_md, @supporting_factors_json, NULL)
      `).run({ ...card, supporting_factors_json: JSON.stringify(card.supporting_factors) })
    }

    for (const evaluation of dataset.evaluations) {
      db.prepare(`
        INSERT INTO evaluations (id, schema_version, created_at, session_id, trade_id, score, note_md, deleted_at)
        VALUES (@id, @schema_version, @created_at, @session_id, @trade_id, @score, @note_md, NULL)
      `).run(evaluation)
    }
  })

  tx()
}
