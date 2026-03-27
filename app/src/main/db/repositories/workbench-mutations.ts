import type Database from 'better-sqlite3'
import { AiRunSchema, AnalysisCardSchema } from '@shared/contracts/analysis'
import type { AnnotationRecord, ScreenshotRecord } from '@shared/contracts/content'
import { ContentBlockSchema } from '@shared/contracts/content'
import { EventSchema } from '@shared/contracts/event'
import { ContentBlockMoveResultSchema, MoveContentBlockInputSchema, MoveScreenshotInputSchema } from '@shared/contracts/workbench'
import {
  REALTIME_VIEW_TITLE,
  buildSummary,
  createId,
  currentIso,
  parseJsonArray,
} from '@main/db/repositories/workbench-utils'
import {
  loadContentBlockById,
  loadAiRecordChainByAiRunId,
  loadAnnotationById,
  loadSessionRealtimeViewBlock,
  loadScreenshotById,
} from '@main/db/repositories/workbench-queries'
import { insertContentBlockMoveAudit } from '@main/db/repositories/workbench-block-move-history'
import {
  insertStandaloneContentEvent,
  syncEventAfterContentBlockMutation,
} from '@main/db/repositories/workbench-note-mutations'

const syncSessionRealtimeView = (db: Database.Database, sessionId: string, content: string) => {
  db.prepare('UPDATE sessions SET my_realtime_view = ? WHERE id = ?').run(content, sessionId)
}

const buildScreenshotEventSummary = (
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

const resolveMoveTargetScope = (
  db: Database.Database,
  input: ReturnType<typeof MoveContentBlockInputSchema.parse>,
) => {
  if (input.target_kind === 'session') {
    const sessionRow = db.prepare(`
      SELECT id, period_id
      FROM sessions
      WHERE id = ? AND deleted_at IS NULL
      LIMIT 1
    `).get(input.session_id) as { id: string, period_id: string } | undefined
    if (!sessionRow) {
      throw new Error(`未找到目标 Session ${input.session_id}。`)
    }

    return {
      session_id: sessionRow.id,
      period_id: sessionRow.period_id,
      context_type: 'session' as const,
      context_id: sessionRow.id,
    }
  }

  if (input.target_kind === 'trade') {
    if (!input.trade_id) {
      throw new Error('移动到 Trade 目标时必须提供 trade_id。')
    }

    const tradeRow = db.prepare(`
      SELECT trades.id, trades.session_id, sessions.period_id
      FROM trades
      INNER JOIN sessions ON sessions.id = trades.session_id
      WHERE trades.id = ? AND trades.deleted_at IS NULL AND sessions.deleted_at IS NULL
      LIMIT 1
    `).get(input.trade_id) as { id: string, session_id: string, period_id: string } | undefined
    if (!tradeRow) {
      throw new Error(`未找到目标 Trade ${input.trade_id}。`)
    }

    return {
      session_id: tradeRow.session_id,
      period_id: tradeRow.period_id,
      context_type: 'trade' as const,
      context_id: tradeRow.id,
    }
  }

  if (!input.period_id) {
    throw new Error('移动到 Period 目标时必须提供 period_id。')
  }

  const sessionRow = db.prepare(`
    SELECT id, period_id
    FROM sessions
    WHERE id = ? AND deleted_at IS NULL
    LIMIT 1
  `).get(input.session_id) as { id: string, period_id: string } | undefined
  if (!sessionRow) {
    throw new Error(`未找到 Period 目标使用的代表 Session ${input.session_id}。`)
  }
  if (sessionRow.period_id !== input.period_id) {
    throw new Error(`Session ${input.session_id} 不属于 Period ${input.period_id}。`)
  }

  return {
    session_id: sessionRow.id,
    period_id: sessionRow.period_id,
    context_type: 'period' as const,
    context_id: input.period_id,
  }
}

const resolveScreenshotTargetScope = (
  db: Database.Database,
  input: ReturnType<typeof MoveScreenshotInputSchema.parse>,
) => {
  if (input.target_kind === 'session') {
    const sessionRow = db.prepare(`
      SELECT id, period_id
      FROM sessions
      WHERE id = ? AND deleted_at IS NULL
      LIMIT 1
    `).get(input.session_id) as { id: string, period_id: string } | undefined
    if (!sessionRow) {
      throw new Error(`未找到目标 Session ${input.session_id}。`)
    }

    return {
      session_id: sessionRow.id,
      period_id: sessionRow.period_id,
      trade_id: null as string | null,
    }
  }

  if (!input.trade_id) {
    throw new Error('移动截图到 Trade 目标时必须提供 trade_id。')
  }

  const tradeRow = db.prepare(`
    SELECT trades.id, trades.session_id, sessions.period_id
    FROM trades
    INNER JOIN sessions ON sessions.id = trades.session_id
    WHERE trades.id = ? AND trades.deleted_at IS NULL AND sessions.deleted_at IS NULL
    LIMIT 1
  `).get(input.trade_id) as { id: string, session_id: string, period_id: string } | undefined
  if (!tradeRow) {
    throw new Error(`未找到目标 Trade ${input.trade_id}。`)
  }

  return {
    session_id: tradeRow.session_id,
    period_id: tradeRow.period_id,
    trade_id: tradeRow.id,
  }
}

const loadEventNoteText = (db: Database.Database, eventId: string) => {
  const row = db.prepare(`
    SELECT content_md
    FROM content_blocks
    WHERE event_id = ? AND soft_deleted = 0 AND deleted_at IS NULL
    ORDER BY sort_order ASC, created_at ASC
    LIMIT 1
  `).get(eventId) as { content_md: string } | undefined

  return row?.content_md ?? null
}

const reassignEventBlocksToSession = (
  db: Database.Database,
  eventId: string,
  sessionId: string,
) => {
  const blockRows = db.prepare(`
    SELECT id
    FROM content_blocks
    WHERE event_id = ?
    ORDER BY sort_order ASC, created_at ASC
  `).all(eventId) as Array<{ id: string }>

  if (blockRows.length === 0) {
    return
  }

  const nextSortOrderRow = db.prepare(`
    SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort_order
    FROM content_blocks
    WHERE session_id = ?
  `).get(sessionId) as { next_sort_order: number }

  blockRows.forEach((row, index) => {
    db.prepare(`
      UPDATE content_blocks
      SET session_id = ?, sort_order = ?
      WHERE id = ?
    `).run(sessionId, nextSortOrderRow.next_sort_order + index, row.id)
  })
}

const detachBlockFromEvent = (
  db: Database.Database,
  blockId: string,
  eventId: string | null,
) => {
  if (!eventId) {
    return
  }

  const eventRow = db.prepare('SELECT content_block_ids_json FROM events WHERE id = ? LIMIT 1').get(eventId) as { content_block_ids_json: string } | undefined
  if (!eventRow) {
    return
  }

  const nextBlockIds = parseJsonArray<string>(eventRow.content_block_ids_json).filter((id) => id !== blockId)
  db.prepare('UPDATE events SET content_block_ids_json = ? WHERE id = ?').run(JSON.stringify(nextBlockIds), eventId)
}

export const createImportedScreenshot = (
  db: Database.Database,
  input: {
    session_id: string
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
  annotations: Omit<AnnotationRecord, 'id' | 'schema_version' | 'created_at' | 'screenshot_id'>[],
  assets?: {
    annotated_file_path?: string | null
    annotated_asset_url?: string | null
    annotations_json_path?: string | null
  },
) => {
  const createdAt = currentIso()
  db.transaction(() => {
    if (assets) {
      db.prepare(`
        UPDATE screenshots
        SET annotated_file_path = ?, annotated_asset_url = ?, annotations_json_path = ?
        WHERE id = ?
      `).run(
        assets.annotated_file_path ?? null,
        assets.annotated_asset_url ?? null,
        assets.annotations_json_path ?? null,
        screenshotId,
      )
    }

    db.prepare('DELETE FROM annotations WHERE screenshot_id = ? AND deleted_at IS NULL').run(screenshotId)

    for (const annotation of annotations) {
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
}

export const createScreenshotAnnotation = (
  db: Database.Database,
  input: Omit<AnnotationRecord, 'id' | 'schema_version' | 'created_at'>,
) => {
  const annotationId = createId('annotation')
  const createdAt = currentIso()

  db.prepare(`
    INSERT INTO annotations (
      id, schema_version, created_at, screenshot_id, shape, label, title, semantic_type, color,
      x1, y1, x2, y2, text, note_md, add_to_memory, stroke_width, deleted_at
    )
    VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
  `).run(
    annotationId,
    createdAt,
    input.screenshot_id,
    input.shape,
    input.label,
    input.title,
    input.semantic_type,
    input.color,
    input.x1,
    input.y1,
    input.x2,
    input.y2,
    input.text,
    input.note_md,
    input.add_to_memory ? 1 : 0,
    input.stroke_width,
  )

  return annotationId
}

export const updateScreenshotAnnotation = (
  db: Database.Database,
  input: Pick<AnnotationRecord, 'id' | 'screenshot_id' | 'shape' | 'label' | 'title' | 'semantic_type' | 'color' | 'x1' | 'y1' | 'x2' | 'y2' | 'text' | 'note_md' | 'add_to_memory' | 'stroke_width'>,
) => {
  db.prepare(`
    UPDATE annotations
    SET shape = ?, label = ?, title = ?, semantic_type = ?, color = ?, x1 = ?, y1 = ?, x2 = ?, y2 = ?, text = ?, note_md = ?, add_to_memory = ?, stroke_width = ?, deleted_at = NULL
    WHERE id = ? AND screenshot_id = ?
  `).run(
    input.shape,
    input.label,
    input.title,
    input.semantic_type,
    input.color,
    input.x1,
    input.y1,
    input.x2,
    input.y2,
    input.text,
    input.note_md,
    input.add_to_memory ? 1 : 0,
    input.stroke_width,
    input.id,
    input.screenshot_id,
  )
}

export const updateAnnotationMetadata = (
  db: Database.Database,
  input: {
    annotation_id: string
    label: string
    title: string
    semantic_type: AnnotationRecord['semantic_type']
    text: string | null
    note_md: string
    add_to_memory: boolean
  },
) => {
  const existingAnnotation = loadAnnotationById(db, input.annotation_id)

  db.prepare(`
    UPDATE annotations
    SET label = ?, title = ?, semantic_type = ?, text = ?, note_md = ?, add_to_memory = ?
    WHERE id = ?
  `).run(
    input.label,
    input.title,
    input.semantic_type,
    input.text,
    input.note_md,
    input.add_to_memory ? 1 : 0,
    existingAnnotation.id,
  )

  return loadAnnotationById(db, existingAnnotation.id)
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

      db.prepare(`
        UPDATE content_blocks
        SET soft_deleted = ?, deleted_at = ?
        WHERE event_id = ?
      `).run(input.deleted ? 1 : 0, deletedAt, existingScreenshot.event_id)
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

    if (existingBlock.event_id) {
      syncEventAfterContentBlockMutation(db, existingBlock.event_id, deletedAt ?? currentIso())
    }

    return loadContentBlockById(db, existingBlock.id)
  })

  return transaction()
}

export const moveContentBlock = (
  db: Database.Database,
  rawInput: unknown,
) => {
  const input = MoveContentBlockInputSchema.parse(rawInput)
  const existingBlock = loadContentBlockById(db, input.block_id)
  if (existingBlock.soft_deleted) {
    throw new Error(`内容块 ${existingBlock.id} 已删除，无法改挂载。`)
  }
  if (existingBlock.block_type === 'ai-summary') {
    throw new Error('AI 摘要块暂不支持改挂载。')
  }
  if (existingBlock.title === REALTIME_VIEW_TITLE) {
    throw new Error('Realtime view 块暂不支持改挂载。')
  }

  const targetScope = resolveMoveTargetScope(db, input)
  const sourceEventRow = existingBlock.event_id
    ? db.prepare(`
      SELECT event_type
      FROM events
      WHERE id = ?
      LIMIT 1
    `).get(existingBlock.event_id) as { event_type: 'observation' | 'thesis' | 'review' | 'screenshot' | 'ai_summary' | 'trade_open' | 'trade_add' | 'trade_reduce' | 'trade_close' | 'trade_cancel' } | undefined
    : undefined
  if (
    existingBlock.session_id === targetScope.session_id
    && existingBlock.context_type === targetScope.context_type
    && existingBlock.context_id === targetScope.context_id
  ) {
    throw new Error('内容块已经挂在目标上下文上。')
  }

  const movedAt = currentIso()
  const transaction = db.transaction(() => {
    const sourceEventId = existingBlock.event_id
    detachBlockFromEvent(db, existingBlock.id, sourceEventId)

    const nextSortOrderRow = db.prepare(`
      SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort_order
      FROM content_blocks
      WHERE session_id = ?
    `).get(targetScope.session_id) as { next_sort_order: number }

    const nextEventType = sourceEventRow?.event_type === 'thesis'
      ? 'thesis'
      : sourceEventRow?.event_type === 'review'
        ? 'review'
        : 'observation'
    const nextEventId = insertStandaloneContentEvent(db, {
      session_id: targetScope.session_id,
      trade_id: targetScope.context_type === 'trade' ? targetScope.context_id : null,
      event_type: nextEventType,
      title: existingBlock.title,
      content_md: existingBlock.content_md,
      occurred_at: movedAt,
      content_block_ids: [existingBlock.id],
    })

    db.prepare(`
      UPDATE content_blocks
      SET session_id = ?, event_id = ?, sort_order = ?, context_type = ?, context_id = ?, soft_deleted = 0, deleted_at = NULL
      WHERE id = ?
    `).run(
      targetScope.session_id,
      nextEventId,
      nextSortOrderRow.next_sort_order,
      targetScope.context_type,
      targetScope.context_id,
      existingBlock.id,
    )

    if (sourceEventId) {
      syncEventAfterContentBlockMutation(db, sourceEventId, movedAt)
    }

    const moveAudit = insertContentBlockMoveAudit(db, {
      block_id: existingBlock.id,
      from_context_type: existingBlock.context_type,
      from_context_id: existingBlock.context_id,
      to_context_type: targetScope.context_type,
      to_context_id: targetScope.context_id,
      from_session_id: existingBlock.session_id,
      to_session_id: targetScope.session_id,
      moved_at: movedAt,
    })

    return ContentBlockMoveResultSchema.parse({
      block: loadContentBlockById(db, existingBlock.id),
      move_audit: moveAudit,
    })
  })

  return transaction()
}

export const moveScreenshot = (
  db: Database.Database,
  rawInput: unknown,
) => {
  const input = MoveScreenshotInputSchema.parse(rawInput)
  const existingScreenshot = loadScreenshotById(db, input.screenshot_id)
  if (existingScreenshot.deleted_at) {
    throw new Error(`截图 ${existingScreenshot.id} 已删除，无法改挂载。`)
  }

  const targetScope = resolveScreenshotTargetScope(db, input)
  const sourceEventRow = existingScreenshot.event_id
    ? db.prepare(`
      SELECT session_id, trade_id
      FROM events
      WHERE id = ?
      LIMIT 1
    `).get(existingScreenshot.event_id) as { session_id: string, trade_id: string | null } | undefined
    : undefined
  const currentTradeId = sourceEventRow?.trade_id ?? null

  if (
    existingScreenshot.session_id === targetScope.session_id
    && currentTradeId === targetScope.trade_id
  ) {
    throw new Error('截图已经挂在目标上下文上。')
  }

  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE screenshots
      SET session_id = ?
      WHERE id = ?
    `).run(targetScope.session_id, existingScreenshot.id)

    if (existingScreenshot.event_id) {
      db.prepare(`
        UPDATE events
        SET session_id = ?, trade_id = ?, summary = ?
        WHERE id = ?
      `).run(
        targetScope.session_id,
        targetScope.trade_id,
        buildScreenshotEventSummary({
          trade_id: targetScope.trade_id,
          kind: existingScreenshot.kind,
          note_text: loadEventNoteText(db, existingScreenshot.event_id),
        }),
        existingScreenshot.event_id,
      )
      reassignEventBlocksToSession(db, existingScreenshot.event_id, targetScope.session_id)
    }

    const linkedAiEvents = db.prepare(`
      SELECT id, ai_run_id
      FROM events
      WHERE screenshot_id = ? AND ai_run_id IS NOT NULL
      ORDER BY occurred_at ASC, created_at ASC, id ASC
    `).all(existingScreenshot.id) as Array<{ id: string, ai_run_id: string | null }>

    linkedAiEvents.forEach((eventRow) => {
      db.prepare(`
        UPDATE events
        SET session_id = ?, trade_id = ?
        WHERE id = ?
      `).run(targetScope.session_id, targetScope.trade_id, eventRow.id)

      if (eventRow.ai_run_id) {
        db.prepare(`
          UPDATE ai_runs
          SET session_id = ?
          WHERE id = ?
        `).run(targetScope.session_id, eventRow.ai_run_id)

        db.prepare(`
          UPDATE analysis_cards
          SET session_id = ?, trade_id = ?
          WHERE ai_run_id = ?
        `).run(targetScope.session_id, targetScope.trade_id, eventRow.ai_run_id)
      }

      reassignEventBlocksToSession(db, eventRow.id, targetScope.session_id)
    })

    return loadScreenshotById(db, existingScreenshot.id)
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
    prompt_preview?: string
    raw_response_text?: string
    structured_response_json?: string
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
  const promptPreview = input.prompt_preview ?? ''
  const rawResponseText = input.raw_response_text ?? ''
  const structuredResponseJson = input.structured_response_json ?? JSON.stringify(input.analysis)

  const transaction = db.transaction(() => {
    const nextSortOrderRow = db.prepare(`
      SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort_order
      FROM content_blocks
      WHERE session_id = ?
    `).get(input.session_id) as { next_sort_order: number }

    db.prepare(`
      INSERT INTO ai_runs (
        id, schema_version, created_at, session_id, event_id, provider, model, status,
        prompt_kind, input_summary, prompt_preview, raw_response_text, structured_response_json, finished_at, deleted_at
      ) VALUES (?, 1, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?, NULL)
    `).run(
      aiRunId,
      timestamp,
      input.session_id,
      eventId,
      input.provider,
      input.model,
      input.prompt_kind,
      input.input_summary,
      promptPreview,
      rawResponseText,
      structuredResponseJson,
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
        prompt_preview: promptPreview,
        raw_response_text: rawResponseText,
        structured_response_json: structuredResponseJson,
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

export {
  addToTrade,
  cancelTrade,
  closeTrade,
  openTrade,
  reduceTrade,
} from '@main/db/repositories/workbench-trade-mutations'
