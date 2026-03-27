import type Database from 'better-sqlite3'
import type { ContentBlockRecord } from '@shared/contracts/content'
import { mapContentBlock, mapTrade } from '@main/db/repositories/workbench-mappers'
import { buildSummary, createId, currentIso } from '@main/db/repositories/workbench-utils'

export const TRADE_REVIEW_DRAFT_TITLE = 'Exit review draft'
const TRADE_REVIEW_EVENT_TITLE = 'Trade review draft'
const TRADE_REVIEW_EVENT_SUMMARY = '自动生成的离场复盘草稿，供后续补充。'

const loadTradeScope = (db: Database.Database, tradeId: string) => {
  const row = db.prepare('SELECT * FROM trades WHERE id = ? LIMIT 1').get(tradeId) as Record<string, unknown> | undefined
  if (!row) {
    throw new Error(`未找到交易 ${tradeId}。`)
  }

  return mapTrade(row)
}

const loadTradeReviewDraftRow = (db: Database.Database, tradeId: string) => (
  db.prepare(`
    SELECT id, event_id
    FROM content_blocks
    WHERE context_type = 'trade' AND context_id = ? AND title = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(tradeId, TRADE_REVIEW_DRAFT_TITLE) as { id: string, event_id: string | null } | undefined
)

const loadTradeReviewDraftBlockById = (db: Database.Database, blockId: string): ContentBlockRecord => {
  const row = db.prepare('SELECT * FROM content_blocks WHERE id = ? LIMIT 1').get(blockId) as Record<string, unknown> | undefined
  if (!row) {
    throw new Error(`未找到复盘草稿块 ${blockId}。`)
  }

  return mapContentBlock(row)
}

export const upsertTradeReviewDraftBlock = (
  db: Database.Database,
  input: {
    trade_id: string
    content_md: string
    occurred_at?: string
  },
) => {
  const trade = loadTradeScope(db, input.trade_id)
  const existing = loadTradeReviewDraftRow(db, input.trade_id)
  const timestamp = input.occurred_at ?? currentIso()
  const summary = buildSummary(input.content_md || TRADE_REVIEW_EVENT_SUMMARY)

  const transaction = db.transaction(() => {
    if (existing) {
      const nextEventId = existing.event_id
        ?? createId('event')
      const hasExistingEvent = existing.event_id
        ? Boolean(db.prepare('SELECT id FROM events WHERE id = ? LIMIT 1').get(existing.event_id))
        : false

      if (hasExistingEvent) {
        db.prepare(`
          UPDATE events
          SET session_id = ?, trade_id = ?, event_type = 'review', title = ?, summary = ?, author_kind = 'system',
              occurred_at = ?, content_block_ids_json = ?, deleted_at = NULL
          WHERE id = ?
        `).run(
          trade.session_id,
          trade.id,
          TRADE_REVIEW_EVENT_TITLE,
          summary,
          timestamp,
          JSON.stringify([existing.id]),
          nextEventId,
        )
      } else {
        db.prepare(`
          INSERT INTO events (
            id, schema_version, created_at, session_id, trade_id, event_type, title, summary, author_kind,
            occurred_at, content_block_ids_json, screenshot_id, ai_run_id, deleted_at
          ) VALUES (?, 1, ?, ?, ?, 'review', ?, ?, 'system', ?, ?, NULL, NULL, NULL)
        `).run(
          nextEventId,
          timestamp,
          trade.session_id,
          trade.id,
          TRADE_REVIEW_EVENT_TITLE,
          summary,
          timestamp,
          JSON.stringify([existing.id]),
        )
      }

      db.prepare(`
        UPDATE content_blocks
        SET event_id = ?, title = ?, content_md = ?, context_type = 'trade', context_id = ?, soft_deleted = 0, deleted_at = NULL
        WHERE id = ?
      `).run(
        nextEventId,
        TRADE_REVIEW_DRAFT_TITLE,
        input.content_md,
        trade.id,
        existing.id,
      )

      return loadTradeReviewDraftBlockById(db, existing.id)
    }

    const blockId = createId('block')
    const eventId = createId('event')
    const nextSortOrderRow = db.prepare(`
      SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort_order
      FROM content_blocks
      WHERE session_id = ?
    `).get(trade.session_id) as { next_sort_order: number }

    db.prepare(`
      INSERT INTO events (
        id, schema_version, created_at, session_id, trade_id, event_type, title, summary, author_kind,
        occurred_at, content_block_ids_json, screenshot_id, ai_run_id, deleted_at
      ) VALUES (?, 1, ?, ?, ?, 'review', ?, ?, 'system', ?, ?, NULL, NULL, NULL)
    `).run(
      eventId,
      timestamp,
      trade.session_id,
      trade.id,
      TRADE_REVIEW_EVENT_TITLE,
      summary,
      timestamp,
      JSON.stringify([blockId]),
    )

    db.prepare(`
      INSERT INTO content_blocks (
        id, schema_version, created_at, session_id, event_id, block_type, title, content_md,
        sort_order, context_type, context_id, soft_deleted, deleted_at
      ) VALUES (?, 1, ?, ?, ?, 'markdown', ?, ?, ?, 'trade', ?, 0, NULL)
    `).run(
      blockId,
      timestamp,
      trade.session_id,
      eventId,
      TRADE_REVIEW_DRAFT_TITLE,
      input.content_md,
      nextSortOrderRow.next_sort_order,
      trade.id,
    )

    return loadTradeReviewDraftBlockById(db, blockId)
  })

  return transaction()
}
