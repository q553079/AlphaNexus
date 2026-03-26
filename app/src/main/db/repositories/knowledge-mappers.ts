import type {
  KnowledgeCardRecord,
  KnowledgeFragmentRecord,
  KnowledgeGroundingRecord,
  KnowledgeImportJobRecord,
  KnowledgeSourceRecord,
} from '@main/knowledge/pipeline'

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

export const mapKnowledgeSource = (row: Record<string, unknown>): KnowledgeSourceRecord => ({
  id: expectString(row.id, 'knowledge_sources.id'),
  schema_version: expectNumber(row.schema_version, 'knowledge_sources.schema_version'),
  created_at: expectString(row.created_at, 'knowledge_sources.created_at'),
  source_type: expectString(row.source_type, 'knowledge_sources.source_type') as KnowledgeSourceRecord['source_type'],
  title: expectString(row.title, 'knowledge_sources.title'),
  author: typeof row.author === 'string' ? row.author : null,
  language: expectString(row.language, 'knowledge_sources.language'),
  content_md: expectString(row.content_md, 'knowledge_sources.content_md'),
  checksum: typeof row.checksum === 'string' ? row.checksum : null,
  deleted_at: typeof row.deleted_at === 'string' ? row.deleted_at : null,
})

export const mapKnowledgeImportJob = (row: Record<string, unknown>): KnowledgeImportJobRecord => ({
  id: expectString(row.id, 'knowledge_import_jobs.id'),
  schema_version: expectNumber(row.schema_version, 'knowledge_import_jobs.schema_version'),
  created_at: expectString(row.created_at, 'knowledge_import_jobs.created_at'),
  source_id: expectString(row.source_id, 'knowledge_import_jobs.source_id'),
  provider: expectString(row.provider, 'knowledge_import_jobs.provider'),
  model: expectString(row.model, 'knowledge_import_jobs.model'),
  job_type: expectString(row.job_type, 'knowledge_import_jobs.job_type'),
  status: expectString(row.status, 'knowledge_import_jobs.status') as KnowledgeImportJobRecord['status'],
  input_snapshot_json: expectString(row.input_snapshot_json, 'knowledge_import_jobs.input_snapshot_json'),
  output_summary: expectString(row.output_summary, 'knowledge_import_jobs.output_summary'),
  finished_at: typeof row.finished_at === 'string' ? row.finished_at : null,
  deleted_at: typeof row.deleted_at === 'string' ? row.deleted_at : null,
})

export const mapKnowledgeFragment = (row: Record<string, unknown>): KnowledgeFragmentRecord => ({
  id: expectString(row.id, 'knowledge_fragments.id'),
  schema_version: expectNumber(row.schema_version, 'knowledge_fragments.schema_version'),
  created_at: expectString(row.created_at, 'knowledge_fragments.created_at'),
  source_id: expectString(row.source_id, 'knowledge_fragments.source_id'),
  job_id: expectString(row.job_id, 'knowledge_fragments.job_id'),
  sequence_no: expectNumber(row.sequence_no, 'knowledge_fragments.sequence_no'),
  chapter_label: typeof row.chapter_label === 'string' ? row.chapter_label : null,
  page_from: typeof row.page_from === 'number' ? row.page_from : null,
  page_to: typeof row.page_to === 'number' ? row.page_to : null,
  content_md: expectString(row.content_md, 'knowledge_fragments.content_md'),
  tokens_estimate: expectNumber(row.tokens_estimate, 'knowledge_fragments.tokens_estimate'),
  deleted_at: typeof row.deleted_at === 'string' ? row.deleted_at : null,
})

export const mapKnowledgeCard = (row: Record<string, unknown>): KnowledgeCardRecord => ({
  id: expectString(row.id, 'knowledge_cards.id'),
  schema_version: expectNumber(row.schema_version, 'knowledge_cards.schema_version'),
  created_at: expectString(row.created_at, 'knowledge_cards.created_at'),
  updated_at: expectString(row.updated_at, 'knowledge_cards.updated_at'),
  source_id: expectString(row.source_id, 'knowledge_cards.source_id'),
  fragment_id: expectString(row.fragment_id, 'knowledge_cards.fragment_id'),
  card_type: expectString(row.card_type, 'knowledge_cards.card_type') as KnowledgeCardRecord['card_type'],
  title: expectString(row.title, 'knowledge_cards.title'),
  summary: expectString(row.summary, 'knowledge_cards.summary'),
  content_md: expectString(row.content_md, 'knowledge_cards.content_md'),
  trigger_conditions_md: expectString(row.trigger_conditions_md, 'knowledge_cards.trigger_conditions_md'),
  invalidation_md: expectString(row.invalidation_md, 'knowledge_cards.invalidation_md'),
  risk_rule_md: expectString(row.risk_rule_md, 'knowledge_cards.risk_rule_md'),
  contract_scope: expectString(row.contract_scope, 'knowledge_cards.contract_scope'),
  timeframe_scope: expectString(row.timeframe_scope, 'knowledge_cards.timeframe_scope'),
  tags_json: expectString(row.tags_json, 'knowledge_cards.tags_json'),
  status: expectString(row.status, 'knowledge_cards.status') as KnowledgeCardRecord['status'],
  version: expectNumber(row.version, 'knowledge_cards.version'),
  deleted_at: typeof row.deleted_at === 'string' ? row.deleted_at : null,
})

export const mapKnowledgeGrounding = (row: Record<string, unknown>): KnowledgeGroundingRecord => ({
  id: expectString(row.id, 'knowledge_groundings.id'),
  schema_version: expectNumber(row.schema_version, 'knowledge_groundings.schema_version'),
  created_at: expectString(row.created_at, 'knowledge_groundings.created_at'),
  knowledge_card_id: expectString(row.knowledge_card_id, 'knowledge_groundings.knowledge_card_id'),
  session_id: typeof row.session_id === 'string' ? row.session_id : null,
  trade_id: typeof row.trade_id === 'string' ? row.trade_id : null,
  screenshot_id: typeof row.screenshot_id === 'string' ? row.screenshot_id : null,
  annotation_id: typeof row.annotation_id === 'string' ? row.annotation_id : null,
  anchor_id: typeof row.anchor_id === 'string' ? row.anchor_id : null,
  ai_run_id: typeof row.ai_run_id === 'string' ? row.ai_run_id : null,
  match_reason_md: expectString(row.match_reason_md, 'knowledge_groundings.match_reason_md'),
  relevance_score: expectNumber(row.relevance_score, 'knowledge_groundings.relevance_score'),
})
