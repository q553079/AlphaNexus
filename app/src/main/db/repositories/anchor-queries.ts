import type Database from 'better-sqlite3'
import { mapMarketAnchor } from '@main/db/repositories/anchor-mappers'
import { selectRows } from '@main/db/repositories/workbench-utils'
import type { ActiveMarketAnchorRecord } from '@shared/contracts/knowledge'

export type AnchorGroundingSignalRow = {
  anchor_id: string
  session_id: string | null
  ai_run_id: string | null
  knowledge_card_id: string
  knowledge_card_title: string | null
  relevance_score: number
  match_reason_md: string
  created_at: string
}

export type ListMarketAnchorsInput = {
  contract_id?: string | null
  session_id?: string | null
  trade_id?: string | null
  status?: ActiveMarketAnchorRecord['status'] | null
  limit?: number
}

const asString = (value: unknown) => (typeof value === 'string' ? value : '')
const asNullableString = (value: unknown) => (typeof value === 'string' ? value : null)

export const getMarketAnchorById = (
  db: Database.Database,
  anchorId: string,
): ActiveMarketAnchorRecord => {
  const row = db.prepare(`
    SELECT * FROM market_anchors
    WHERE id = ? AND deleted_at IS NULL
    LIMIT 1
  `).get(anchorId) as Record<string, unknown> | undefined

  if (!row) {
    throw new Error(`未找到 Anchor ${anchorId}。`)
  }

  return mapMarketAnchor(row)
}

export const findMarketAnchorBySourceAnnotation = (
  db: Database.Database,
  input: {
    contract_id: string
    session_id?: string | null
    trade_id?: string | null
    source_annotation_id: string
  },
) => {
  const row = db.prepare(`
    SELECT * FROM market_anchors
    WHERE contract_id = ?
      AND source_annotation_id = ?
      AND deleted_at IS NULL
      AND (? IS NULL OR session_id = ?)
      AND (? IS NULL OR trade_id = ?)
    ORDER BY updated_at DESC
    LIMIT 1
  `).get(
    input.contract_id,
    input.source_annotation_id,
    input.session_id ?? null,
    input.session_id ?? null,
    input.trade_id ?? null,
    input.trade_id ?? null,
  ) as Record<string, unknown> | undefined

  return row ? mapMarketAnchor(row) : null
}

export const listMarketAnchors = (
  db: Database.Database,
  input: ListMarketAnchorsInput = {},
): ActiveMarketAnchorRecord[] => {
  const cappedLimit = Math.max(1, Math.min(input.limit ?? 24, 100))
  const rows = selectRows(db, `
    SELECT * FROM market_anchors
    WHERE deleted_at IS NULL
      AND (? IS NULL OR contract_id = ?)
      AND (? IS NULL OR session_id = ?)
      AND (? IS NULL OR trade_id = ?)
      AND (? IS NULL OR status = ?)
    ORDER BY updated_at DESC, created_at DESC
    LIMIT ?
  `, [
    input.contract_id ?? null,
    input.contract_id ?? null,
    input.session_id ?? null,
    input.session_id ?? null,
    input.trade_id ?? null,
    input.trade_id ?? null,
    input.status ?? null,
    input.status ?? null,
    cappedLimit,
  ])

  return rows.map(mapMarketAnchor)
}

export const listAnchorGroundingSignals = (
  db: Database.Database,
  input: { session_id?: string | null, trade_id?: string | null, anchor_ids?: string[], limit?: number } = {},
): AnchorGroundingSignalRow[] => {
  const cappedLimit = Math.max(10, Math.min(input.limit ?? 240, 500))
  const anchorIds = (input.anchor_ids ?? []).filter(Boolean)
  const anchorClause = anchorIds.length > 0
    ? ` AND kg.anchor_id IN (${anchorIds.map(() => '?').join(', ')})`
    : ''
  const params: unknown[] = []

  let query = `
    SELECT
      kg.anchor_id,
      kg.session_id,
      kg.ai_run_id,
      kg.knowledge_card_id,
      kc.title AS knowledge_card_title,
      kg.relevance_score,
      kg.match_reason_md,
      kg.created_at
    FROM knowledge_groundings kg
    LEFT JOIN knowledge_cards kc ON kc.id = kg.knowledge_card_id
    WHERE kg.anchor_id IS NOT NULL
  `

  if (input.session_id) {
    query += ' AND kg.session_id = ?'
    params.push(input.session_id)
  }
  if (input.trade_id) {
    query += ' AND kg.trade_id = ?'
    params.push(input.trade_id)
  }
  if (anchorIds.length > 0) {
    query += anchorClause
    params.push(...anchorIds)
  }
  query += ' ORDER BY kg.created_at DESC LIMIT ?'
  params.push(cappedLimit)

  const rows = selectRows(db, query, params)
  return rows.map((row) => ({
    anchor_id: asString(row.anchor_id),
    session_id: asNullableString(row.session_id),
    ai_run_id: asNullableString(row.ai_run_id),
    knowledge_card_id: asString(row.knowledge_card_id),
    knowledge_card_title: asNullableString(row.knowledge_card_title),
    relevance_score: Number(row.relevance_score ?? 0),
    match_reason_md: asString(row.match_reason_md),
    created_at: asString(row.created_at),
  }))
}
