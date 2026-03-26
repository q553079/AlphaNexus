import type Database from 'better-sqlite3'
import { LauncherHomePayloadSchema, LauncherSessionSummarySchema, type LauncherSessionSummary } from '@shared/contracts/launcher'
import { mapContract } from '@main/db/repositories/workbench-mappers'
import { resolveDefaultSessionId, selectRows } from '@main/db/repositories/workbench-utils'

const sessionSummaryQuery = `
  SELECT
    sessions.id,
    sessions.title,
    sessions.status,
    sessions.started_at,
    contracts.symbol AS contract_symbol,
    (
      SELECT COUNT(*)
      FROM events
      WHERE events.session_id = sessions.id AND events.deleted_at IS NULL
    ) AS event_count,
    (
      SELECT COUNT(*)
      FROM trades
      WHERE trades.session_id = sessions.id AND trades.deleted_at IS NULL
    ) AS trade_count
  FROM sessions
  INNER JOIN contracts ON contracts.id = sessions.contract_id
`

const mapLauncherSessionSummary = (row: Record<string, unknown>): LauncherSessionSummary => LauncherSessionSummarySchema.parse({
  ...row,
  event_count: Number(row.event_count ?? 0),
  trade_count: Number(row.trade_count ?? 0),
})

export const loadLauncherSessionSummary = (db: Database.Database, sessionId: string) => {
  const row = db.prepare(`
    ${sessionSummaryQuery}
    WHERE sessions.id = ? AND sessions.deleted_at IS NULL
    LIMIT 1
  `).get(sessionId) as Record<string, unknown> | undefined

  return row ? mapLauncherSessionSummary(row) : null
}

export const loadLauncherHome = (db: Database.Database) => {
  const contracts = selectRows(db, 'SELECT * FROM contracts ORDER BY symbol ASC').map(mapContract)
  const recentSessions = selectRows(db, `
    ${sessionSummaryQuery}
    WHERE sessions.deleted_at IS NULL
    ORDER BY
      CASE WHEN sessions.status = 'active' THEN 0 ELSE 1 END ASC,
      sessions.started_at DESC,
      sessions.created_at DESC
    LIMIT 8
  `).map(mapLauncherSessionSummary)

  let activeSession: LauncherSessionSummary | null = recentSessions[0] ?? null
  try {
    const resolvedSessionId = resolveDefaultSessionId(db)
    activeSession = loadLauncherSessionSummary(db, resolvedSessionId)
  } catch {
    activeSession = recentSessions[0] ?? null
  }

  return LauncherHomePayloadSchema.parse({
    contracts,
    active_session: activeSession,
    recent_sessions: recentSessions,
  })
}
