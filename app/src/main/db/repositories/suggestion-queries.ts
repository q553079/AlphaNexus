import type Database from 'better-sqlite3'
import { parseJsonArray, selectRows } from '@main/db/repositories/workbench-utils'

export type SuggestionSessionContext = {
  session_id: string
  contract_id: string
  contract_symbol: string
  session_title: string
  market_bias: string
  tags: string[]
  active_trade_id: string | null
  trade_state: 'pre_entry' | 'manage' | 'exit' | 'post_trade'
}

export type SuggestionEventRow = {
  id: string
  event_type: string
  title: string
  summary: string
  occurred_at: string
}

export type SuggestionAnnotationRow = {
  id: string
  screenshot_id: string
  shape: string
  label: string
  color: string
  x1: number
  y1: number
  x2: number
  y2: number
  text: string | null
  created_at: string
}

export type SimilarCaseCandidateRow = {
  session_id: string
  contract_symbol: string
  session_title: string
  market_bias: string
  tags: string[]
  started_at: string
  trade_id: string | null
  trade_side: string | null
  trade_status: string | null
  pnl_r: number | null
  thesis: string | null
  evaluation_score: number | null
  evaluation_note: string | null
  analysis_summary: string | null
  event_digest: string | null
}

const asString = (value: unknown) => (typeof value === 'string' ? value : '')
const asNullableString = (value: unknown) => (typeof value === 'string' ? value : null)
const asNullableNumber = (value: unknown) => (typeof value === 'number' ? value : null)

const inferTradeState = (tradeStatus: string | null) => {
  if (!tradeStatus) {
    return 'pre_entry'
  }
  if (tradeStatus === 'open') {
    return 'manage'
  }
  if (tradeStatus === 'closed') {
    return 'post_trade'
  }
  return 'exit'
}

export const loadSuggestionSessionContext = (db: Database.Database, sessionId: string): SuggestionSessionContext => {
  const row = db.prepare(`
    SELECT
      s.id AS session_id,
      s.contract_id AS contract_id,
      c.symbol AS contract_symbol,
      s.title AS session_title,
      s.market_bias AS market_bias,
      s.tags_json AS tags_json,
      (
        SELECT t.id FROM trades t
        WHERE t.session_id = s.id AND t.deleted_at IS NULL
        ORDER BY CASE WHEN t.status = 'open' THEN 0 ELSE 1 END, t.opened_at DESC
        LIMIT 1
      ) AS active_trade_id,
      (
        SELECT t.status FROM trades t
        WHERE t.session_id = s.id AND t.deleted_at IS NULL
        ORDER BY CASE WHEN t.status = 'open' THEN 0 ELSE 1 END, t.opened_at DESC
        LIMIT 1
      ) AS active_trade_status
    FROM sessions s
    INNER JOIN contracts c ON c.id = s.contract_id
    WHERE s.id = ? AND s.deleted_at IS NULL
    LIMIT 1
  `).get(sessionId) as Record<string, unknown> | undefined

  if (!row) {
    throw new Error(`未找到 Session ${sessionId}。`)
  }

  const activeTradeStatus = asNullableString(row.active_trade_status)
  return {
    session_id: asString(row.session_id),
    contract_id: asString(row.contract_id),
    contract_symbol: asString(row.contract_symbol),
    session_title: asString(row.session_title),
    market_bias: asString(row.market_bias),
    tags: parseJsonArray<string>(row.tags_json),
    active_trade_id: asNullableString(row.active_trade_id),
    trade_state: inferTradeState(activeTradeStatus),
  }
}

export const listRecentSessionEventsForSuggestions = (
  db: Database.Database,
  sessionId: string,
  limit = 8,
): SuggestionEventRow[] => selectRows(db, `
  SELECT id, event_type, title, summary, occurred_at
  FROM events
  WHERE session_id = ? AND deleted_at IS NULL
  ORDER BY occurred_at DESC
  LIMIT ?
`, [sessionId, Math.max(1, Math.min(limit, 30))]).map((row) => ({
  id: asString(row.id),
  event_type: asString(row.event_type),
  title: asString(row.title),
  summary: asString(row.summary),
  occurred_at: asString(row.occurred_at),
}))

export const loadContractSymbolById = (db: Database.Database, contractId: string): string => {
  const row = db.prepare(`
    SELECT symbol
    FROM contracts
    WHERE id = ?
    LIMIT 1
  `).get(contractId) as Record<string, unknown> | undefined

  if (!row || typeof row.symbol !== 'string' || row.symbol.trim().length === 0) {
    throw new Error(`未找到合约 ${contractId} 对应的 symbol。`)
  }

  return row.symbol.trim()
}

export const listSessionAnnotationsForSuggestions = (
  db: Database.Database,
  input: { session_id: string, screenshot_id?: string | null, limit?: number },
): SuggestionAnnotationRow[] => {
  const limit = Math.max(1, Math.min(input.limit ?? 30, 120))
  if (input.screenshot_id) {
    return selectRows(db, `
      SELECT
        a.id, a.screenshot_id, a.shape, a.label, a.color, a.x1, a.y1, a.x2, a.y2, a.text, a.created_at
      FROM annotations a
      WHERE a.screenshot_id = ? AND a.deleted_at IS NULL
      ORDER BY a.created_at DESC
      LIMIT ?
    `, [input.screenshot_id, limit]).map((row) => ({
      id: asString(row.id),
      screenshot_id: asString(row.screenshot_id),
      shape: asString(row.shape),
      label: asString(row.label),
      color: asString(row.color),
      x1: Number(row.x1 ?? 0),
      y1: Number(row.y1 ?? 0),
      x2: Number(row.x2 ?? 0),
      y2: Number(row.y2 ?? 0),
      text: asNullableString(row.text),
      created_at: asString(row.created_at),
    }))
  }

  return selectRows(db, `
    SELECT
      a.id, a.screenshot_id, a.shape, a.label, a.color, a.x1, a.y1, a.x2, a.y2, a.text, a.created_at
    FROM annotations a
    INNER JOIN screenshots s ON s.id = a.screenshot_id
    WHERE s.session_id = ? AND a.deleted_at IS NULL
    ORDER BY a.created_at DESC
    LIMIT ?
  `, [input.session_id, limit]).map((row) => ({
    id: asString(row.id),
    screenshot_id: asString(row.screenshot_id),
    shape: asString(row.shape),
    label: asString(row.label),
    color: asString(row.color),
    x1: Number(row.x1 ?? 0),
    y1: Number(row.y1 ?? 0),
    x2: Number(row.x2 ?? 0),
    y2: Number(row.y2 ?? 0),
    text: asNullableString(row.text),
    created_at: asString(row.created_at),
  }))
}

export const listSimilarCaseCandidates = (
  db: Database.Database,
  input: { contract_symbol?: string | null, limit?: number },
): SimilarCaseCandidateRow[] => {
  const cappedLimit = Math.max(8, Math.min(input.limit ?? 80, 160))
  const rows = selectRows(db, `
    SELECT
      s.id AS session_id,
      c.symbol AS contract_symbol,
      s.title AS session_title,
      s.market_bias AS market_bias,
      s.tags_json AS tags_json,
      s.started_at AS started_at,
      t.id AS trade_id,
      t.side AS trade_side,
      t.status AS trade_status,
      t.pnl_r AS pnl_r,
      t.thesis AS thesis,
      ev.score AS evaluation_score,
      ev.note_md AS evaluation_note,
      (
        SELECT ac.summary_short
        FROM analysis_cards ac
        WHERE ac.session_id = s.id AND ac.deleted_at IS NULL
        ORDER BY ac.created_at DESC
        LIMIT 1
      ) AS analysis_summary,
      (
        SELECT GROUP_CONCAT(e.summary, ' | ')
        FROM (
          SELECT summary
          FROM events
          WHERE session_id = s.id AND deleted_at IS NULL
          ORDER BY occurred_at DESC
          LIMIT 6
        ) e
      ) AS event_digest
    FROM sessions s
    INNER JOIN contracts c ON c.id = s.contract_id
    LEFT JOIN trades t ON t.session_id = s.id AND t.deleted_at IS NULL
    LEFT JOIN evaluations ev ON ev.trade_id = t.id AND ev.deleted_at IS NULL
    WHERE s.deleted_at IS NULL
      AND (? IS NULL OR c.symbol = ?)
    ORDER BY s.started_at DESC
    LIMIT ?
  `, [input.contract_symbol ?? null, input.contract_symbol ?? null, cappedLimit])

  return rows.map((row) => ({
    session_id: asString(row.session_id),
    contract_symbol: asString(row.contract_symbol),
    session_title: asString(row.session_title),
    market_bias: asString(row.market_bias),
    tags: parseJsonArray<string>(row.tags_json),
    started_at: asString(row.started_at),
    trade_id: asNullableString(row.trade_id),
    trade_side: asNullableString(row.trade_side),
    trade_status: asNullableString(row.trade_status),
    pnl_r: asNullableNumber(row.pnl_r),
    thesis: asNullableString(row.thesis),
    evaluation_score: asNullableNumber(row.evaluation_score),
    evaluation_note: asNullableString(row.evaluation_note),
    analysis_summary: asNullableString(row.analysis_summary),
    event_digest: asNullableString(row.event_digest),
  }))
}
