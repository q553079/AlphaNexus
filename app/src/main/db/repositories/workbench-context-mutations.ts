import type Database from 'better-sqlite3'
import type { AnnotationRecord, ScreenshotRecord } from '@shared/contracts/content'
import { REALTIME_VIEW_TITLE, buildSummary, createId, currentIso } from '@main/db/repositories/workbench-utils'
import {
  loadContentBlockById,
} from '@main/db/repositories/workbench-queries'
import { type CurrentContext } from '@shared/contracts/current-context'

const syncSessionRealtimeView = (db: Database.Database, sessionId: string, content: string) => {
  db.prepare('UPDATE sessions SET my_realtime_view = ? WHERE id = ?').run(content, sessionId)
}

const captureTitles: Record<ScreenshotRecord['kind'], string> = {
  chart: '截图',
  execution: '执行截图',
  exit: '离场截图',
}

const buildCaptureEventSummary = (
  input: {
    trade_id: string | null
    kind: ScreenshotRecord['kind']
    note_text?: string | null
  },
) => {
  const noteText = input.note_text?.trim()
  if (noteText) {
    return buildSummary(noteText)
  }

  if (input.kind === 'exit') {
    return input.trade_id ? '离场截图已挂到当前 Trade 目标。' : '离场截图已保存到当前 Session。'
  }

  return input.trade_id ? '截图已挂到当前 Trade 目标。' : '截图已挂到当前 Session 上下文。'
}

export const createImportedScreenshotForContext = (
  db: Database.Database,
  input: {
    session_id: string
    trade_id: string | null
    kind: ScreenshotRecord['kind']
    file_path: string
    asset_url: string
    raw_file_path?: string
    raw_asset_url?: string
    annotated_file_path?: string | null
    annotated_asset_url?: string | null
    annotations_json_path?: string | null
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
      INSERT INTO screenshots (
        id, schema_version, created_at, session_id, event_id, kind, file_path, asset_url,
        raw_file_path, raw_asset_url, annotated_file_path, annotated_asset_url, annotations_json_path,
        caption, width, height, deleted_at
      )
      VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
    `).run(
      screenshotId,
      createdAt,
      input.session_id,
      eventId,
      input.kind,
      input.file_path,
      input.asset_url,
      input.raw_file_path ?? input.file_path,
      input.raw_asset_url ?? input.asset_url,
      input.annotated_file_path ?? null,
      input.annotated_asset_url ?? null,
      input.annotations_json_path ?? null,
      input.caption,
      input.width,
      input.height,
    )

    db.prepare(`
      INSERT INTO events (id, schema_version, created_at, session_id, trade_id, event_type, title, summary, author_kind, occurred_at, content_block_ids_json, screenshot_id, ai_run_id, deleted_at)
      VALUES (?, 1, ?, ?, ?, 'screenshot', ?, ?, 'user', ?, '[]', ?, NULL, NULL)
    `).run(
      eventId,
      createdAt,
      input.session_id,
      input.trade_id,
      input.trade_id ? '导入截图到当前 Trade' : '导入截图',
      input.trade_id ? '截图已挂到当前 Trade 目标。' : '截图已挂到当前 Session 上下文。',
      createdAt,
      screenshotId,
    )
  })()

  return {
    screenshot_id: screenshotId,
    event_id: eventId,
  }
}

export const createCapturedScreenshotArtifactsForContext = (
  db: Database.Database,
  input: {
    session_id: string
    trade_id: string | null
    kind: ScreenshotRecord['kind']
    file_path: string
    asset_url: string
    raw_file_path?: string
    raw_asset_url?: string
    annotated_file_path?: string | null
    annotated_asset_url?: string | null
    annotations_json_path?: string | null
    caption: string | null
    width: number
    height: number
    note_text?: string | null
    note_title?: string
    annotations?: Omit<AnnotationRecord, 'id' | 'schema_version' | 'created_at' | 'screenshot_id'>[]
  },
) => {
  const screenshotId = createId('screenshot')
  const eventId = createId('event')
  const noteText = input.note_text?.trim() || null
  const noteBlockId = noteText ? createId('block') : null
  const createdAt = currentIso()

  db.transaction(() => {
    db.prepare(`
      INSERT INTO screenshots (
        id, schema_version, created_at, session_id, event_id, kind, file_path, asset_url,
        raw_file_path, raw_asset_url, annotated_file_path, annotated_asset_url, annotations_json_path,
        caption, width, height, deleted_at
      )
      VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
    `).run(
      screenshotId,
      createdAt,
      input.session_id,
      eventId,
      input.kind,
      input.file_path,
      input.asset_url,
      input.raw_file_path ?? input.file_path,
      input.raw_asset_url ?? input.asset_url,
      input.annotated_file_path ?? null,
      input.annotated_asset_url ?? null,
      input.annotations_json_path ?? null,
      input.caption,
      input.width,
      input.height,
    )

    db.prepare(`
      INSERT INTO events (id, schema_version, created_at, session_id, trade_id, event_type, title, summary, author_kind, occurred_at, content_block_ids_json, screenshot_id, ai_run_id, deleted_at)
      VALUES (?, 1, ?, ?, ?, 'screenshot', ?, ?, 'user', ?, ?, ?, NULL, NULL)
    `).run(
      eventId,
      createdAt,
      input.session_id,
      input.trade_id,
      captureTitles[input.kind],
      buildCaptureEventSummary({
        trade_id: input.trade_id,
        kind: input.kind,
        note_text: noteText,
      }),
      createdAt,
      JSON.stringify(noteBlockId ? [noteBlockId] : []),
      screenshotId,
    )

    if (noteBlockId && noteText) {
      const nextSortOrderRow = db.prepare(`
        SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort_order
        FROM content_blocks
        WHERE session_id = ?
      `).get(input.session_id) as { next_sort_order: number }

      db.prepare(`
        INSERT INTO content_blocks (
          id, schema_version, created_at, session_id, event_id, block_type, title, content_md,
          sort_order, context_type, context_id, soft_deleted, deleted_at
        ) VALUES (?, 1, ?, ?, ?, 'markdown', ?, ?, ?, 'event', ?, 0, NULL)
      `).run(
        noteBlockId,
        createdAt,
        input.session_id,
        eventId,
        input.note_title ?? '当时观点',
        noteText,
        nextSortOrderRow.next_sort_order,
        eventId,
      )
    }

    for (const annotation of input.annotations ?? []) {
      db.prepare(`
        INSERT INTO annotations (
          id, schema_version, created_at, screenshot_id, shape, label, title, semantic_type, color,
          x1, y1, x2, y2, text, note_md, add_to_memory, stroke_width, deleted_at
        )
        VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
      `).run(
        createId('annotation'),
        createdAt,
        screenshotId,
        annotation.shape,
        annotation.label,
        annotation.title,
        annotation.semantic_type,
        annotation.color,
        annotation.x1,
        annotation.y1,
        annotation.x2,
        annotation.y2,
        annotation.text,
        annotation.note_md,
        annotation.add_to_memory ? 1 : 0,
        annotation.stroke_width,
      )
    }
  })()

  return {
    screenshot_id: screenshotId,
    event_id: eventId,
    content_block_id: noteBlockId,
  }
}

export const upsertRealtimeViewBlockForCurrentContext = (
  db: Database.Database,
  input: {
    current_context: CurrentContext
    content_md: string
  },
) => {
  const timestamp = currentIso()
  const summary = buildSummary(input.content_md)
  const contextType = input.current_context.trade_id ? 'trade' : 'session'
  const contextId = input.current_context.trade_id ?? input.current_context.session_id
  const existingBlockRow = db.prepare(`
    SELECT id, event_id
    FROM content_blocks
    WHERE session_id = ? AND context_type = ? AND context_id = ? AND title = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(
    input.current_context.session_id,
    contextType,
    contextId,
    REALTIME_VIEW_TITLE,
  ) as { id: string, event_id: string | null } | undefined

  const transaction = db.transaction(() => {
    if (existingBlockRow) {
      db.prepare(`
        UPDATE content_blocks
        SET content_md = ?, soft_deleted = 0, deleted_at = NULL
        WHERE id = ?
      `).run(input.content_md, existingBlockRow.id)

      if (!input.current_context.trade_id) {
        syncSessionRealtimeView(db, input.current_context.session_id, input.content_md)
      }

      if (existingBlockRow.event_id) {
        db.prepare(`
          UPDATE events
          SET summary = ?, occurred_at = ?, trade_id = ?, deleted_at = NULL
          WHERE id = ?
        `).run(summary, timestamp, input.current_context.trade_id, existingBlockRow.event_id)
      }

      return loadContentBlockById(db, existingBlockRow.id)
    }

    const blockId = createId('block')
    const eventId = createId('event')
    const nextSortOrderRow = db.prepare(`
      SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort_order
      FROM content_blocks
      WHERE session_id = ?
    `).get(input.current_context.session_id) as { next_sort_order: number }

    db.prepare(`
      INSERT INTO content_blocks (
        id, schema_version, created_at, session_id, event_id, block_type, title, content_md,
        sort_order, context_type, context_id, soft_deleted, deleted_at
      ) VALUES (?, 1, ?, ?, ?, 'markdown', ?, ?, ?, ?, ?, 0, NULL)
    `).run(
      blockId,
      timestamp,
      input.current_context.session_id,
      eventId,
      REALTIME_VIEW_TITLE,
      input.content_md,
      nextSortOrderRow.next_sort_order,
      contextType,
      contextId,
    )

    db.prepare(`
      INSERT INTO events (
        id, schema_version, created_at, session_id, trade_id, event_type, title, summary, author_kind,
        occurred_at, content_block_ids_json, screenshot_id, ai_run_id, deleted_at
      ) VALUES (?, 1, ?, ?, ?, 'thesis', ?, ?, 'user', ?, ?, NULL, NULL, NULL)
    `).run(
      eventId,
      timestamp,
      input.current_context.session_id,
      input.current_context.trade_id,
      REALTIME_VIEW_TITLE,
      summary,
      timestamp,
      JSON.stringify([blockId]),
    )

    if (!input.current_context.trade_id) {
      syncSessionRealtimeView(db, input.current_context.session_id, input.content_md)
    }

    return loadContentBlockById(db, blockId)
  })

  return transaction()
}
