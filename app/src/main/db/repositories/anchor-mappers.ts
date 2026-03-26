import type { ActiveMarketAnchorRecord } from '@shared/contracts/knowledge'

type MarketAnchorStatusHistoryRow = {
  id: string
  schema_version: number
  created_at: string
  anchor_id: string
  previous_status: string | null
  next_status: string
  reason_md: string
  changed_by: string | null
}

const expectString = (value: unknown, field: string) => {
  if (typeof value !== 'string') {
    throw new Error(`Invalid ${field}.`)
  }

  return value
}

const expectNumber = (value: unknown, field: string) => {
  if (typeof value !== 'number') {
    throw new Error(`Invalid ${field}.`)
  }

  return value
}

const expectSchemaVersion = (value: unknown, field: string): 1 => {
  const version = expectNumber(value, field)
  if (version !== 1) {
    throw new Error(`Unsupported ${field}: ${version}.`)
  }

  return 1
}

export const mapMarketAnchor = (row: Record<string, unknown>): ActiveMarketAnchorRecord => ({
  id: expectString(row.id, 'market_anchors.id'),
  schema_version: expectSchemaVersion(row.schema_version, 'market_anchors.schema_version'),
  created_at: expectString(row.created_at, 'market_anchors.created_at'),
  updated_at: expectString(row.updated_at, 'market_anchors.updated_at'),
  deleted_at: typeof row.deleted_at === 'string' ? row.deleted_at : null,
  contract_id: expectString(row.contract_id, 'market_anchors.contract_id'),
  session_id: typeof row.session_id === 'string' ? row.session_id : null,
  trade_id: typeof row.trade_id === 'string' ? row.trade_id : null,
  origin_annotation_id: typeof row.source_annotation_id === 'string' ? row.source_annotation_id : null,
  origin_annotation_label: typeof row.source_annotation_label === 'string' ? row.source_annotation_label : null,
  origin_screenshot_id: typeof row.source_screenshot_id === 'string' ? row.source_screenshot_id : null,
  title: expectString(row.title, 'market_anchors.title'),
  semantic_type: typeof row.semantic_type === 'string' ? row.semantic_type as ActiveMarketAnchorRecord['semantic_type'] : null,
  timeframe_scope: typeof row.timeframe_scope === 'string' ? row.timeframe_scope : null,
  price_low: typeof row.price_low === 'number' ? row.price_low : null,
  price_high: typeof row.price_high === 'number' ? row.price_high : null,
  thesis_md: expectString(row.thesis_md, 'market_anchors.thesis_md'),
  invalidation_rule_md: expectString(row.invalidation_rule_md, 'market_anchors.invalidation_rule_md'),
  status: expectString(row.status, 'market_anchors.status') as ActiveMarketAnchorRecord['status'],
  carry_forward: Boolean(row.carry_forward),
})

export const mapMarketAnchorStatusHistory = (row: Record<string, unknown>): MarketAnchorStatusHistoryRow => ({
  id: expectString(row.id, 'market_anchor_status_history.id'),
  schema_version: expectSchemaVersion(row.schema_version, 'market_anchor_status_history.schema_version'),
  created_at: expectString(row.created_at, 'market_anchor_status_history.created_at'),
  anchor_id: expectString(row.anchor_id, 'market_anchor_status_history.anchor_id'),
  previous_status: typeof row.previous_status === 'string' ? row.previous_status : null,
  next_status: expectString(row.next_status, 'market_anchor_status_history.next_status'),
  reason_md: expectString(row.reason_md, 'market_anchor_status_history.reason_md'),
  changed_by: typeof row.changed_by === 'string' ? row.changed_by : null,
})

export type { MarketAnchorStatusHistoryRow }
