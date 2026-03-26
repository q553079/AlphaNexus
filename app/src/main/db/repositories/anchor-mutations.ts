import type Database from 'better-sqlite3'
import { createId, currentIso } from '@main/db/repositories/workbench-utils'
import type { ActiveMarketAnchorRecord } from '@shared/contracts/knowledge'

export type NewMarketAnchorInput = {
  contract_id: string
  session_id?: string | null
  trade_id?: string | null
  source_annotation_id?: string | null
  source_annotation_label?: string | null
  source_screenshot_id?: string | null
  title: string
  semantic_type?: ActiveMarketAnchorRecord['semantic_type']
  timeframe_scope?: string | null
  price_low?: number | null
  price_high?: number | null
  thesis_md: string
  invalidation_rule_md: string
  status?: ActiveMarketAnchorRecord['status']
  carry_forward?: boolean
}

export type RecordAnchorStatusHistoryInput = {
  anchor_id: string
  previous_status?: ActiveMarketAnchorRecord['status'] | null
  next_status: ActiveMarketAnchorRecord['status']
  reason_md?: string | null
  changed_by?: string | null
}

export const insertMarketAnchor = (
  db: Database.Database,
  input: NewMarketAnchorInput,
): ActiveMarketAnchorRecord => {
  const now = currentIso()
  const row: ActiveMarketAnchorRecord = {
    id: createId('anchor'),
    schema_version: 1,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    contract_id: input.contract_id,
    session_id: input.session_id ?? null,
    trade_id: input.trade_id ?? null,
    origin_annotation_id: input.source_annotation_id ?? null,
    origin_annotation_label: input.source_annotation_label ?? null,
    origin_screenshot_id: input.source_screenshot_id ?? null,
    title: input.title,
    semantic_type: input.semantic_type ?? null,
    timeframe_scope: input.timeframe_scope ?? null,
    price_low: input.price_low ?? null,
    price_high: input.price_high ?? null,
    thesis_md: input.thesis_md,
    invalidation_rule_md: input.invalidation_rule_md,
    status: input.status ?? 'active',
    carry_forward: input.carry_forward ?? true,
  }

  db.prepare(`
    INSERT INTO market_anchors (
      id, schema_version, created_at, updated_at, contract_id, session_id, trade_id,
      source_annotation_id, source_annotation_label, source_screenshot_id, title, semantic_type,
      timeframe_scope, price_low, price_high, thesis_md, invalidation_rule_md, status, carry_forward, deleted_at
    ) VALUES (
      @id, @schema_version, @created_at, @updated_at, @contract_id, @session_id, @trade_id,
      @origin_annotation_id, @origin_annotation_label, @origin_screenshot_id, @title, @semantic_type,
      @timeframe_scope, @price_low, @price_high, @thesis_md, @invalidation_rule_md, @status, @carry_forward, @deleted_at
    )
  `).run({
    ...row,
    carry_forward: row.carry_forward ? 1 : 0,
  })

  return row
}

export const updateMarketAnchor = (
  db: Database.Database,
  input: ActiveMarketAnchorRecord,
) => {
  const nextUpdatedAt = currentIso()
  db.prepare(`
    UPDATE market_anchors
    SET
      updated_at = @updated_at,
      contract_id = @contract_id,
      session_id = @session_id,
      trade_id = @trade_id,
      source_annotation_id = @origin_annotation_id,
      source_annotation_label = @origin_annotation_label,
      source_screenshot_id = @origin_screenshot_id,
      title = @title,
      semantic_type = @semantic_type,
      timeframe_scope = @timeframe_scope,
      price_low = @price_low,
      price_high = @price_high,
      thesis_md = @thesis_md,
      invalidation_rule_md = @invalidation_rule_md,
      status = @status,
      carry_forward = @carry_forward,
      deleted_at = @deleted_at
    WHERE id = @id
  `).run({
    ...input,
    updated_at: nextUpdatedAt,
    carry_forward: input.carry_forward ? 1 : 0,
  })
}

export const insertMarketAnchorStatusHistory = (
  db: Database.Database,
  input: RecordAnchorStatusHistoryInput,
) => {
  db.prepare(`
    INSERT INTO market_anchor_status_history (
      id, schema_version, created_at, anchor_id, previous_status, next_status, reason_md, changed_by
    ) VALUES (
      ?, 1, ?, ?, ?, ?, ?, ?
    )
  `).run(
    createId('anchor_status_history'),
    currentIso(),
    input.anchor_id,
    input.previous_status ?? null,
    input.next_status,
    input.reason_md ?? '',
    input.changed_by ?? null,
  )
}
