import type Database from 'better-sqlite3'
import { REALTIME_VIEW_TITLE, buildSummary, createId, currentIso } from '@main/db/repositories/workbench-utils'
import { loadContentBlockById } from '@main/db/repositories/workbench-queries'
import { ReorderContentBlocksInputSchema } from '@shared/contracts/workbench'

const standaloneUserEventTypes = new Set(['observation', 'thesis', 'review'])

const loadEventRow = (db: Database.Database, eventId: string) =>
  db.prepare(`
    SELECT id, event_type, screenshot_id, ai_run_id
    FROM events
    WHERE id = ?
    LIMIT 1
  `).get(eventId) as {
    id: string
    event_type: string
    screenshot_id: string | null
    ai_run_id: string | null
  } | undefined

const loadActiveEventBlocks = (db: Database.Database, eventId: string) =>
  db.prepare(`
    SELECT id, title, content_md, context_type, context_id
    FROM content_blocks
    WHERE event_id = ? AND soft_deleted = 0 AND deleted_at IS NULL
    ORDER BY sort_order ASC, created_at ASC
  `).all(eventId) as Array<{
    id: string
    title: string
    content_md: string
    context_type: string
    context_id: string
  }>

export const syncEventAfterContentBlockMutation = (
  db: Database.Database,
  eventId: string,
  timestamp = currentIso(),
) => {
  const eventRow = loadEventRow(db, eventId)
  if (!eventRow) {
    return
  }

  const activeBlocks = loadActiveEventBlocks(db, eventId)
  const blockIdsJson = JSON.stringify(activeBlocks.map((block) => block.id))
  const isStandaloneUserEvent = eventRow.screenshot_id == null
    && eventRow.ai_run_id == null
    && standaloneUserEventTypes.has(eventRow.event_type)

  if (!isStandaloneUserEvent) {
    db.prepare(`
      UPDATE events
      SET content_block_ids_json = ?
      WHERE id = ?
    `).run(blockIdsJson, eventId)
    return
  }

  if (activeBlocks.length === 0) {
    db.prepare(`
      UPDATE events
      SET content_block_ids_json = '[]', deleted_at = ?
      WHERE id = ?
    `).run(timestamp, eventId)
    return
  }

  const primaryBlock = activeBlocks[0]
  db.prepare(`
    UPDATE events
    SET
      trade_id = ?,
      title = ?,
      summary = ?,
      content_block_ids_json = ?,
      deleted_at = NULL
    WHERE id = ?
  `).run(
    primaryBlock.context_type === 'trade' ? primaryBlock.context_id : null,
    primaryBlock.title,
    buildSummary(primaryBlock.content_md),
    blockIdsJson,
    eventId,
  )
}

export const insertStandaloneContentEvent = (
  db: Database.Database,
  input: {
    session_id: string
    trade_id: string | null
    event_type: 'observation' | 'thesis' | 'review'
    title: string
    content_md: string
    occurred_at?: string
    content_block_ids?: string[]
  },
) => {
  const eventId = createId('event')
  const timestamp = input.occurred_at ?? currentIso()
  db.prepare(`
    INSERT INTO events (
      id, schema_version, created_at, session_id, trade_id, event_type, title, summary, author_kind,
      occurred_at, content_block_ids_json, screenshot_id, ai_run_id, deleted_at
    ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, 'user', ?, ?, NULL, NULL, NULL)
  `).run(
    eventId,
    timestamp,
    input.session_id,
    input.trade_id,
    input.event_type,
    input.title,
    buildSummary(input.content_md),
    timestamp,
    JSON.stringify(input.content_block_ids ?? []),
  )

  return eventId
}

export const createWorkbenchNoteBlock = (
  db: Database.Database,
  input: {
    session_id: string
    trade_id: string | null
    title: string
    content_md: string
  },
) => {
  const timestamp = currentIso()
  const blockId = createId('block')
  const eventId = insertStandaloneContentEvent(db, {
    session_id: input.session_id,
    trade_id: input.trade_id,
    event_type: 'observation',
    title: input.title,
    content_md: input.content_md,
    occurred_at: timestamp,
    content_block_ids: [blockId],
  })
  const nextSortOrderRow = db.prepare(`
    SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort_order
    FROM content_blocks
    WHERE session_id = ?
  `).get(input.session_id) as { next_sort_order: number }

  db.prepare(`
    INSERT INTO content_blocks (
      id, schema_version, created_at, session_id, event_id, block_type, title, content_md,
      sort_order, context_type, context_id, soft_deleted, deleted_at
    ) VALUES (?, 1, ?, ?, ?, 'markdown', ?, ?, ?, ?, ?, 0, NULL)
  `).run(
    blockId,
    timestamp,
    input.session_id,
    eventId,
    input.title,
    input.content_md,
    nextSortOrderRow.next_sort_order,
    input.trade_id ? 'trade' : 'session',
    input.trade_id ?? input.session_id,
  )

  return loadContentBlockById(db, blockId)
}

export const updateWorkbenchNoteBlock = (
  db: Database.Database,
  input: {
    block_id: string
    title: string
    content_md: string
  },
) => {
  const existingBlock = loadContentBlockById(db, input.block_id)
  if (existingBlock.block_type === 'ai-summary') {
    throw new Error('AI 摘要块不能按用户笔记方式编辑。')
  }
  if (existingBlock.title === REALTIME_VIEW_TITLE) {
    throw new Error('Realtime view 仍使用专门的保存链路。')
  }

  db.prepare(`
    UPDATE content_blocks
    SET title = ?, content_md = ?, soft_deleted = 0, deleted_at = NULL
    WHERE id = ?
  `).run(input.title, input.content_md, existingBlock.id)

  if (existingBlock.event_id) {
    syncEventAfterContentBlockMutation(db, existingBlock.event_id)
  }

  return loadContentBlockById(db, existingBlock.id)
}

export const reorderWorkbenchContentBlocks = (
  db: Database.Database,
  rawInput: unknown,
) => {
  const input = ReorderContentBlocksInputSchema.parse(rawInput)
  const existingBlocks = db.prepare(`
    SELECT content_blocks.id, content_blocks.sort_order
    FROM content_blocks
    LEFT JOIN events ON events.id = content_blocks.event_id
    WHERE content_blocks.session_id = ?
      AND content_blocks.context_type = ?
      AND content_blocks.context_id = ?
      AND content_blocks.block_type = 'markdown'
      AND content_blocks.soft_deleted = 0
      AND content_blocks.deleted_at IS NULL
      AND content_blocks.title <> ?
      AND (events.event_type IS NULL OR events.event_type <> 'review')
    ORDER BY content_blocks.sort_order ASC, content_blocks.created_at ASC
  `).all(
    input.session_id,
    input.context_type,
    input.context_id,
    REALTIME_VIEW_TITLE,
  ) as Array<{ id: string, sort_order: number }>

  if (existingBlocks.length === 0) {
    throw new Error('当前上下文下没有可重排的文本块。')
  }

  if (existingBlocks.length !== input.ordered_block_ids.length) {
    throw new Error('重排请求与当前上下文中的真实文本块数量不一致。')
  }

  const existingIds = new Set(existingBlocks.map((block) => block.id))
  const orderedIds = new Set(input.ordered_block_ids)
  if (orderedIds.size !== input.ordered_block_ids.length || existingIds.size !== orderedIds.size) {
    throw new Error('重排请求中存在重复或缺失的文本块。')
  }
  for (const blockId of input.ordered_block_ids) {
    if (!existingIds.has(blockId)) {
      throw new Error(`文本块 ${blockId} 不属于当前可编辑上下文。`)
    }
  }

  const baseSortOrder = Math.min(...existingBlocks.map((block) => block.sort_order))
  const transaction = db.transaction(() => {
    input.ordered_block_ids.forEach((blockId, index) => {
      db.prepare(`
        UPDATE content_blocks
        SET sort_order = ?
        WHERE id = ?
      `).run(baseSortOrder + index, blockId)
    })

    return loadContentBlockById(db, input.ordered_block_ids[0])
  })

  return transaction()
}
