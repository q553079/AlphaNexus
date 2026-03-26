import type Database from 'better-sqlite3'
import { AiRunSchema, AnalysisCardSchema } from '@shared/contracts/analysis'
import type { AnnotationRecord, ScreenshotRecord } from '@shared/contracts/content'
import { ContentBlockSchema } from '@shared/contracts/content'
import { EventSchema } from '@shared/contracts/event'
import {
  REALTIME_VIEW_TITLE,
  buildSummary,
  createId,
  currentIso,
} from '@main/db/repositories/workbench-utils'
import {
  loadContentBlockById,
  loadAiRecordChainByAiRunId,
  loadAnnotationById,
  loadSessionRealtimeViewBlock,
  loadScreenshotById,
} from '@main/db/repositories/workbench-queries'

const syncSessionRealtimeView = (db: Database.Database, sessionId: string, content: string) => {
  db.prepare('UPDATE sessions SET my_realtime_view = ? WHERE id = ?').run(content, sessionId)
}

export const createImportedScreenshot = (
  db: Database.Database,
  input: {
    session_id: string
    kind: ScreenshotRecord['kind']
    file_path: string
    asset_url: string
    caption: string | null
    width: number
    height: number
  },
) => {
  const screenshotId = createId('screenshot')
  const eventId = createId('event')
  const createdAt = currentIso()

  db.transaction(() => {
    db.prepare(`
      INSERT INTO screenshots (id, schema_version, created_at, session_id, event_id, kind, file_path, asset_url, caption, width, height, deleted_at)
      VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
    `).run(screenshotId, createdAt, input.session_id, eventId, input.kind, input.file_path, input.asset_url, input.caption, input.width, input.height)

    db.prepare(`
      INSERT INTO events (id, schema_version, created_at, session_id, trade_id, event_type, title, summary, author_kind, occurred_at, content_block_ids_json, screenshot_id, ai_run_id, deleted_at)
      VALUES (?, 1, ?, ?, NULL, 'screenshot', ?, ?, 'user', ?, '[]', ?, NULL, NULL)
    `).run(
      eventId,
      createdAt,
      input.session_id,
      '导入截图',
      '截图已挂到当前 Session 上下文。',
      createdAt,
      screenshotId,
    )
  })()

  return {
    screenshot_id: screenshotId,
    event_id: eventId,
  }
}

export const replaceScreenshotAnnotations = (
  db: Database.Database,
  screenshotId: string,
  annotations: Omit<AnnotationRecord, 'id' | 'schema_version' | 'created_at'>[],
) => {
  const createdAt = currentIso()
  db.transaction(() => {
    db.prepare('DELETE FROM annotations WHERE screenshot_id = ? AND deleted_at IS NULL').run(screenshotId)

    for (const annotation of annotations) {
      db.prepare(`
        INSERT INTO annotations (id, schema_version, created_at, screenshot_id, shape, label, color, x1, y1, x2, y2, text, stroke_width, deleted_at)
        VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
      `).run(
        createId('annotation'),
        createdAt,
        screenshotId,
        annotation.shape,
        annotation.label,
        annotation.color,
        annotation.x1,
        annotation.y1,
        annotation.x2,
        annotation.y2,
        annotation.text,
        annotation.stroke_width,
      )
    }
  })()
}

export const createScreenshotAnnotation = (
  db: Database.Database,
  input: Omit<AnnotationRecord, 'id' | 'schema_version' | 'created_at'>,
) => {
  const annotationId = createId('annotation')
  const createdAt = currentIso()

  db.prepare(`
    INSERT INTO annotations (id, schema_version, created_at, screenshot_id, shape, label, color, x1, y1, x2, y2, text, stroke_width, deleted_at)
    VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
  `).run(
    annotationId,
    createdAt,
    input.screenshot_id,
    input.shape,
    input.label,
    input.color,
    input.x1,
    input.y1,
    input.x2,
    input.y2,
    input.text,
    input.stroke_width,
  )

  return annotationId
}

export const updateScreenshotAnnotation = (
  db: Database.Database,
  input: Pick<AnnotationRecord, 'id' | 'screenshot_id' | 'shape' | 'label' | 'color' | 'x1' | 'y1' | 'x2' | 'y2' | 'text' | 'stroke_width'>,
) => {
  db.prepare(`
    UPDATE annotations
    SET shape = ?, label = ?, color = ?, x1 = ?, y1 = ?, x2 = ?, y2 = ?, text = ?, stroke_width = ?, deleted_at = NULL
    WHERE id = ? AND screenshot_id = ?
  `).run(
    input.shape,
    input.label,
    input.color,
    input.x1,
    input.y1,
    input.x2,
    input.y2,
    input.text,
    input.stroke_width,
    input.id,
    input.screenshot_id,
  )
}

export const upsertSessionRealtimeViewBlock = (
  db: Database.Database,
  input: {
    session_id: string
    content_md: string
  },
) => {
  const existingBlock = loadSessionRealtimeViewBlock(db, input.session_id)
  const timestamp = currentIso()
  const summary = buildSummary(input.content_md)

  const transaction = db.transaction(() => {
    if (existingBlock) {
      db.prepare(`
        UPDATE content_blocks
        SET content_md = ?, soft_deleted = 0, deleted_at = NULL
        WHERE id = ?
      `).run(input.content_md, existingBlock.id)

      syncSessionRealtimeView(db, input.session_id, input.content_md)

      if (existingBlock.event_id) {
        db.prepare(`
          UPDATE events
          SET summary = ?, occurred_at = ?, deleted_at = NULL
          WHERE id = ?
        `).run(summary, timestamp, existingBlock.event_id)
      }

      return loadContentBlockById(db, existingBlock.id)
    }

    const blockId = createId('block')
    const eventId = createId('event')
    const nextSortOrderRow = db.prepare(`
      SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort_order
      FROM content_blocks
      WHERE session_id = ?
    `).get(input.session_id) as { next_sort_order: number }

    db.prepare(`
      INSERT INTO content_blocks (
        id, schema_version, created_at, session_id, event_id, block_type, title, content_md,
        sort_order, context_type, context_id, soft_deleted, deleted_at
      ) VALUES (?, 1, ?, ?, ?, 'markdown', ?, ?, ?, 'session', ?, 0, NULL)
    `).run(
      blockId,
      timestamp,
      input.session_id,
      eventId,
      REALTIME_VIEW_TITLE,
      input.content_md,
      nextSortOrderRow.next_sort_order,
      input.session_id,
    )

    db.prepare(`
      INSERT INTO events (
        id, schema_version, created_at, session_id, trade_id, event_type, title, summary, author_kind,
        occurred_at, content_block_ids_json, screenshot_id, ai_run_id, deleted_at
      ) VALUES (?, 1, ?, ?, NULL, 'thesis', ?, ?, 'user', ?, ?, NULL, NULL, NULL)
    `).run(
      eventId,
      timestamp,
      input.session_id,
      REALTIME_VIEW_TITLE,
      summary,
      timestamp,
      JSON.stringify([blockId]),
    )

    syncSessionRealtimeView(db, input.session_id, input.content_md)
    return loadContentBlockById(db, blockId)
  })

  return transaction()
}

export const setScreenshotDeletedState = (
  db: Database.Database,
  input: {
    screenshot_id: string
    deleted: boolean
  },
) => {
  const existingScreenshot = loadScreenshotById(db, input.screenshot_id)
  const deletedAt = input.deleted ? currentIso() : null

  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE screenshots
      SET deleted_at = ?
      WHERE id = ?
    `).run(deletedAt, existingScreenshot.id)

    if (existingScreenshot.event_id) {
      db.prepare(`
        UPDATE events
        SET deleted_at = ?
        WHERE id = ?
      `).run(deletedAt, existingScreenshot.event_id)
    }

    return loadScreenshotById(db, existingScreenshot.id)
  })

  return transaction()
}

export const setAnnotationDeletedState = (
  db: Database.Database,
  input: {
    annotation_id: string
    deleted: boolean
  },
) => {
  const existingAnnotation = loadAnnotationById(db, input.annotation_id)
  const deletedAt = input.deleted ? currentIso() : null

  db.prepare(`
    UPDATE annotations
    SET deleted_at = ?
    WHERE id = ?
  `).run(deletedAt, existingAnnotation.id)

  return loadAnnotationById(db, existingAnnotation.id)
}

export const setAiRecordDeletedState = (
  db: Database.Database,
  input: {
    ai_run_id: string
    deleted: boolean
  },
) => {
  const existingRecord = loadAiRecordChainByAiRunId(db, input.ai_run_id)
  const deletedAt = input.deleted ? currentIso() : null

  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE ai_runs
      SET deleted_at = ?
      WHERE id = ?
    `).run(deletedAt, existingRecord.ai_run.id)

    db.prepare(`
      UPDATE analysis_cards
      SET deleted_at = ?
      WHERE ai_run_id = ?
    `).run(deletedAt, existingRecord.ai_run.id)

    db.prepare(`
      UPDATE events
      SET deleted_at = ?
      WHERE ai_run_id = ?
    `).run(deletedAt, existingRecord.ai_run.id)

    if (existingRecord.event) {
      db.prepare(`
        UPDATE content_blocks
        SET soft_deleted = ?, deleted_at = ?
        WHERE event_id = ?
      `).run(input.deleted ? 1 : 0, deletedAt, existingRecord.event.id)
    }

    return loadAiRecordChainByAiRunId(db, existingRecord.ai_run.id)
  })

  return transaction()
}

export const setContentBlockDeletedState = (
  db: Database.Database,
  input: {
    block_id: string
    deleted: boolean
  },
) => {
  const existingBlock = loadContentBlockById(db, input.block_id)
  const deletedAt = input.deleted ? currentIso() : null

  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE content_blocks
      SET soft_deleted = ?, deleted_at = ?
      WHERE id = ?
    `).run(input.deleted ? 1 : 0, deletedAt, existingBlock.id)

    if (existingBlock.context_type === 'session' && existingBlock.context_id === existingBlock.session_id && existingBlock.title === REALTIME_VIEW_TITLE) {
      syncSessionRealtimeView(db, existingBlock.session_id, input.deleted ? '' : existingBlock.content_md)
    }

    return loadContentBlockById(db, existingBlock.id)
  })

  return transaction()
}

export const createAiAnalysisArtifacts = (
  db: Database.Database,
  input: {
    session_id: string
    provider: 'deepseek' | 'openai' | 'anthropic' | 'custom-http'
    model: string
    prompt_kind: 'market-analysis' | 'trade-review' | 'period-review'
    input_summary: string
    screenshot_id: string | null
    trade_id: string | null
    event_title: string
    block_title: string
    summary_short: string
    content_md: string
    analysis: {
      bias: 'bullish' | 'bearish' | 'range' | 'neutral'
      confidence_pct: number
      reversal_probability_pct: number
      entry_zone: string
      stop_loss: string
      take_profit: string
      invalidation: string
      summary_short: string
      deep_analysis_md: string
      supporting_factors: string[]
    }
  },
) => {
  const timestamp = currentIso()
  const aiRunId = createId('airun')
  const analysisCardId = createId('analysis')
  const eventId = createId('event')
  const blockId = createId('block')

  const transaction = db.transaction(() => {
    const nextSortOrderRow = db.prepare(`
      SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort_order
      FROM content_blocks
      WHERE session_id = ?
    `).get(input.session_id) as { next_sort_order: number }

    db.prepare(`
      INSERT INTO ai_runs (
        id, schema_version, created_at, session_id, event_id, provider, model, status,
        prompt_kind, input_summary, finished_at, deleted_at
      ) VALUES (?, 1, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, NULL)
    `).run(
      aiRunId,
      timestamp,
      input.session_id,
      eventId,
      input.provider,
      input.model,
      input.prompt_kind,
      input.input_summary,
      timestamp,
    )

    db.prepare(`
      INSERT INTO analysis_cards (
        id, schema_version, created_at, ai_run_id, session_id, trade_id, bias, confidence_pct,
        reversal_probability_pct, entry_zone, stop_loss, take_profit, invalidation,
        summary_short, deep_analysis_md, supporting_factors_json, deleted_at
      ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
    `).run(
      analysisCardId,
      timestamp,
      aiRunId,
      input.session_id,
      input.trade_id,
      input.analysis.bias,
      input.analysis.confidence_pct,
      input.analysis.reversal_probability_pct,
      input.analysis.entry_zone,
      input.analysis.stop_loss,
      input.analysis.take_profit,
      input.analysis.invalidation,
      input.analysis.summary_short,
      input.analysis.deep_analysis_md,
      JSON.stringify(input.analysis.supporting_factors),
    )

    db.prepare(`
      INSERT INTO content_blocks (
        id, schema_version, created_at, session_id, event_id, block_type, title, content_md,
        sort_order, context_type, context_id, soft_deleted, deleted_at
      ) VALUES (?, 1, ?, ?, ?, 'ai-summary', ?, ?, ?, 'event', ?, 0, NULL)
    `).run(
      blockId,
      timestamp,
      input.session_id,
      eventId,
      input.block_title,
      input.content_md,
      nextSortOrderRow.next_sort_order,
      eventId,
    )

    db.prepare(`
      INSERT INTO events (
        id, schema_version, created_at, session_id, trade_id, event_type, title, summary, author_kind,
        occurred_at, content_block_ids_json, screenshot_id, ai_run_id, deleted_at
      ) VALUES (?, 1, ?, ?, ?, 'ai_summary', ?, ?, 'ai', ?, ?, ?, ?, NULL)
    `).run(
      eventId,
      timestamp,
      input.session_id,
      input.trade_id,
      input.event_title,
      input.summary_short,
      timestamp,
      JSON.stringify([blockId]),
      input.screenshot_id,
      aiRunId,
    )

    return {
      ai_run: AiRunSchema.parse({
        id: aiRunId,
        schema_version: 1,
        created_at: timestamp,
        session_id: input.session_id,
        event_id: eventId,
        provider: input.provider,
        model: input.model,
        status: 'completed',
        prompt_kind: input.prompt_kind,
        input_summary: input.input_summary,
        finished_at: timestamp,
        deleted_at: null,
      }),
      analysis_card: AnalysisCardSchema.parse({
        id: analysisCardId,
        schema_version: 1,
        created_at: timestamp,
        ai_run_id: aiRunId,
        session_id: input.session_id,
        trade_id: input.trade_id,
        bias: input.analysis.bias,
        confidence_pct: input.analysis.confidence_pct,
        reversal_probability_pct: input.analysis.reversal_probability_pct,
        entry_zone: input.analysis.entry_zone,
        stop_loss: input.analysis.stop_loss,
        take_profit: input.analysis.take_profit,
        invalidation: input.analysis.invalidation,
        summary_short: input.analysis.summary_short,
        deep_analysis_md: input.analysis.deep_analysis_md,
        supporting_factors: input.analysis.supporting_factors,
        deleted_at: null,
      }),
      content_block: ContentBlockSchema.parse({
        id: blockId,
        schema_version: 1,
        created_at: timestamp,
        session_id: input.session_id,
        event_id: eventId,
        block_type: 'ai-summary',
        title: input.block_title,
        content_md: input.content_md,
        sort_order: nextSortOrderRow.next_sort_order,
        context_type: 'event',
        context_id: eventId,
        soft_deleted: false,
        deleted_at: null,
      }),
      event: EventSchema.parse({
        id: eventId,
        schema_version: 1,
        created_at: timestamp,
        session_id: input.session_id,
        trade_id: input.trade_id,
        event_type: 'ai_summary',
        title: input.event_title,
        summary: input.summary_short,
        author_kind: 'ai',
        occurred_at: timestamp,
        content_block_ids: [blockId],
        screenshot_id: input.screenshot_id,
        ai_run_id: aiRunId,
        deleted_at: null,
      }),
    }
  })

  return transaction()
}
