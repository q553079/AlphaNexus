import type Database from 'better-sqlite3'
import { ReviewCaseSchema, SaveReviewCaseInputSchema, type ReviewCaseRecord } from '@shared/contracts/review-case'
import { createId, currentIso, parseJsonArray, selectRows } from '@main/db/repositories/workbench-utils'

const loadReviewCaseEventIds = (db: Database.Database, reviewCaseId: string) => (
  selectRows(db, `
    SELECT event_id
    FROM review_case_events
    WHERE review_case_id = ?
    ORDER BY sort_order ASC, created_at ASC
  `, [reviewCaseId]).map((row) => String(row.event_id))
)

const loadReviewCaseSnapshot = (db: Database.Database, reviewCaseId: string) => {
  const row = db.prepare(`
    SELECT snapshot_json
    FROM review_case_snapshots
    WHERE review_case_id = ?
    LIMIT 1
  `).get(reviewCaseId) as { snapshot_json: string } | undefined

  if (!row?.snapshot_json) {
    return null
  }

  return JSON.parse(row.snapshot_json) as ReviewCaseRecord['snapshot']
}

const mapReviewCaseRow = (
  db: Database.Database,
  row: Record<string, unknown>,
) => ReviewCaseSchema.parse({
  id: String(row.id),
  schema_version: Number(row.schema_version),
  created_at: String(row.created_at),
  updated_at: String(row.updated_at),
  source_session_id: String(row.source_session_id),
  title: String(row.title),
  summary_md: String(row.summary_md ?? ''),
  ai_summary_md: String(row.ai_summary_md ?? ''),
  selection_mode: String(row.selection_mode),
  time_range_start: row.time_range_start == null ? null : String(row.time_range_start),
  time_range_end: row.time_range_end == null ? null : String(row.time_range_end),
  event_ids: loadReviewCaseEventIds(db, String(row.id)),
  screenshot_ids: parseJsonArray<string>(row.screenshot_ids_json),
  snapshot: loadReviewCaseSnapshot(db, String(row.id)),
})

const ensureSessionExists = (db: Database.Database, sessionId: string) => {
  const row = db.prepare(`
    SELECT id
    FROM sessions
    WHERE id = ? AND deleted_at IS NULL
    LIMIT 1
  `).get(sessionId) as { id: string } | undefined

  if (!row) {
    throw new Error(`未找到 Session ${sessionId}。`)
  }
}

const ensureEventsBelongToSession = (
  db: Database.Database,
  sessionId: string,
  eventIds: string[],
) => {
  if (eventIds.length === 0) {
    throw new Error('保存 review case 时至少需要一条事件。')
  }

  const placeholders = eventIds.map(() => '?').join(', ')
  const rows = selectRows(db, `
    SELECT id
    FROM events
    WHERE session_id = ? AND id IN (${placeholders}) AND deleted_at IS NULL
  `, [sessionId, ...eventIds])

  if (rows.length !== eventIds.length) {
    throw new Error('review case 中包含不属于当前 Session 的事件，或事件已删除。')
  }
}

export const createReviewCase = (
  db: Database.Database,
  rawInput: unknown,
) => {
  const input = SaveReviewCaseInputSchema.parse(rawInput)
  ensureSessionExists(db, input.source_session_id)
  ensureEventsBelongToSession(db, input.source_session_id, input.event_ids)

  const timestamp = currentIso()
  const reviewCaseId = createId('review_case')

  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO review_cases (
        id, schema_version, created_at, updated_at, source_session_id, title, summary_md,
        ai_summary_md, selection_mode, time_range_start, time_range_end, screenshot_ids_json
      ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      reviewCaseId,
      timestamp,
      timestamp,
      input.source_session_id,
      input.title,
      input.summary_md,
      input.ai_summary_md,
      input.selection_mode,
      input.time_range_start ?? null,
      input.time_range_end ?? null,
      JSON.stringify(input.screenshot_ids),
    )

    input.event_ids.forEach((eventId, index) => {
      db.prepare(`
        INSERT INTO review_case_events (
          id, schema_version, created_at, review_case_id, event_id, sort_order
        ) VALUES (?, 1, ?, ?, ?, ?)
      `).run(
        createId('review_case_event'),
        timestamp,
        reviewCaseId,
        eventId,
        index,
      )
    })

    if (input.snapshot) {
      db.prepare(`
        INSERT INTO review_case_snapshots (
          review_case_id, updated_at, snapshot_json
        ) VALUES (?, ?, ?)
      `).run(
        reviewCaseId,
        timestamp,
        JSON.stringify(input.snapshot),
      )
    }
  })

  transaction()
  return loadReviewCaseById(db, reviewCaseId)
}

export const loadReviewCaseById = (
  db: Database.Database,
  reviewCaseId: string,
) => {
  const row = db.prepare(`
    SELECT *
    FROM review_cases
    WHERE id = ?
    LIMIT 1
  `).get(reviewCaseId) as Record<string, unknown> | undefined

  if (!row) {
    throw new Error(`未找到 review case ${reviewCaseId}。`)
  }

  return mapReviewCaseRow(db, row)
}

export const listReviewCasesBySession = (
  db: Database.Database,
  sessionId?: string,
) => {
  const rows = sessionId
    ? selectRows(db, `
      SELECT *
      FROM review_cases
      WHERE source_session_id = ?
      ORDER BY updated_at DESC, created_at DESC
    `, [sessionId])
    : selectRows(db, `
      SELECT *
      FROM review_cases
      ORDER BY updated_at DESC, created_at DESC
    `)

  return rows.map((row) => mapReviewCaseRow(db, row))
}
