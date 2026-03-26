import type Database from 'better-sqlite3'
import { createHash } from 'node:crypto'
import { currentIso, createId } from '@main/db/repositories/workbench-utils'
import type {
  KnowledgeCardRecord,
  KnowledgeFragmentRecord,
  KnowledgeGroundingRecord,
  KnowledgeImportJobRecord,
  KnowledgeSourceRecord,
} from '@main/knowledge/pipeline'
import { getKnowledgeCardById } from '@main/db/repositories/knowledge-queries'

type NewKnowledgeSourceInput = {
  source_type: KnowledgeSourceRecord['source_type']
  title: string
  author?: string | null
  language?: string | null
  content_md: string
}

type NewKnowledgeImportJobInput = {
  source_id: string
  input_snapshot_json: string
  provider?: string
  model?: string
  job_type?: string
  status?: KnowledgeImportJobRecord['status']
}

type NewKnowledgeFragmentInput = {
  source_id: string
  job_id: string
  sequence_no: number
  content_md: string
}

type NewKnowledgeDraftCardInput = {
  source_id: string
  fragment_id: string
  card_type: KnowledgeCardRecord['card_type']
  title: string
  summary: string
  content_md: string
  trigger_conditions_md: string
  invalidation_md: string
  risk_rule_md: string
  contract_scope: string
  timeframe_scope: string
  tags_json: string
  status: 'draft'
  version: number
}

type NewKnowledgeGroundingInput = {
  knowledge_card_id: string
  session_id?: string | null
  trade_id?: string | null
  screenshot_id?: string | null
  annotation_id?: string | null
  anchor_id?: string | null
  ai_run_id?: string | null
  match_reason_md: string
  relevance_score: number
}

const checksum = (content: string) => createHash('sha256').update(content).digest('hex')

export const createKnowledgeSource = (db: Database.Database, input: NewKnowledgeSourceInput): KnowledgeSourceRecord => {
  const id = createId('knowledge_source')
  const createdAt = currentIso()
  const row: KnowledgeSourceRecord = {
    id,
    schema_version: 1,
    created_at: createdAt,
    source_type: input.source_type,
    title: input.title,
    author: input.author ?? null,
    language: input.language ?? 'zh-CN',
    content_md: input.content_md,
    checksum: checksum(input.content_md),
    deleted_at: null,
  }

  db.prepare(`
    INSERT INTO knowledge_sources (
      id, schema_version, created_at, source_type, title, author, language, content_md, checksum, deleted_at
    ) VALUES (
      @id, @schema_version, @created_at, @source_type, @title, @author, @language, @content_md, @checksum, @deleted_at
    )
  `).run(row)

  return row
}

export const createKnowledgeImportJob = (db: Database.Database, input: NewKnowledgeImportJobInput): KnowledgeImportJobRecord => {
  const id = createId('knowledge_job')
  const createdAt = currentIso()
  const row: KnowledgeImportJobRecord = {
    id,
    schema_version: 1,
    created_at: createdAt,
    source_id: input.source_id,
    provider: input.provider ?? 'local',
    model: input.model ?? 'deterministic-v1',
    job_type: input.job_type ?? 'ingest-and-draft',
    status: input.status ?? 'pending',
    input_snapshot_json: input.input_snapshot_json,
    output_summary: '',
    finished_at: null,
    deleted_at: null,
  }

  db.prepare(`
    INSERT INTO knowledge_import_jobs (
      id, schema_version, created_at, source_id, provider, model, job_type, status,
      input_snapshot_json, output_summary, finished_at, deleted_at
    ) VALUES (
      @id, @schema_version, @created_at, @source_id, @provider, @model, @job_type, @status,
      @input_snapshot_json, @output_summary, @finished_at, @deleted_at
    )
  `).run(row)

  return row
}

export const completeKnowledgeImportJob = (
  db: Database.Database,
  input: { job_id: string, output_summary: string },
) => {
  const finishedAt = currentIso()
  db.prepare(`
    UPDATE knowledge_import_jobs
    SET status = 'completed', output_summary = ?, finished_at = ?
    WHERE id = ?
  `).run(input.output_summary, finishedAt, input.job_id)
}

export const markKnowledgeImportJobProcessing = (
  db: Database.Database,
  input: { job_id: string, output_summary?: string },
) => {
  db.prepare(`
    UPDATE knowledge_import_jobs
    SET status = 'pending', output_summary = COALESCE(?, output_summary)
    WHERE id = ?
  `).run(input.output_summary ?? null, input.job_id)
}

export const failKnowledgeImportJob = (
  db: Database.Database,
  input: { job_id: string, output_summary: string },
) => {
  const finishedAt = currentIso()
  db.prepare(`
    UPDATE knowledge_import_jobs
    SET status = 'failed', output_summary = ?, finished_at = ?
    WHERE id = ?
  `).run(input.output_summary, finishedAt, input.job_id)
}

export const insertKnowledgeFragments = (
  db: Database.Database,
  inputs: NewKnowledgeFragmentInput[],
): KnowledgeFragmentRecord[] => {
  if (inputs.length === 0) {
    return []
  }

  const insert = db.prepare(`
    INSERT INTO knowledge_fragments (
      id, schema_version, created_at, source_id, job_id, sequence_no, chapter_label,
      page_from, page_to, content_md, tokens_estimate, deleted_at
    ) VALUES (
      @id, @schema_version, @created_at, @source_id, @job_id, @sequence_no, @chapter_label,
      @page_from, @page_to, @content_md, @tokens_estimate, @deleted_at
    )
  `)

  const rows: KnowledgeFragmentRecord[] = []
  for (const input of inputs) {
    const row: KnowledgeFragmentRecord = {
      id: createId('knowledge_fragment'),
      schema_version: 1,
      created_at: currentIso(),
      source_id: input.source_id,
      job_id: input.job_id,
      sequence_no: input.sequence_no,
      chapter_label: `Fragment ${input.sequence_no}`,
      page_from: null,
      page_to: null,
      content_md: input.content_md,
      tokens_estimate: Math.max(1, Math.ceil(input.content_md.length / 4)),
      deleted_at: null,
    }
    insert.run(row)
    rows.push(row)
  }

  return rows
}

export const insertDraftKnowledgeCards = (
  db: Database.Database,
  inputs: NewKnowledgeDraftCardInput[],
): KnowledgeCardRecord[] => {
  if (inputs.length === 0) {
    return []
  }

  const insert = db.prepare(`
    INSERT INTO knowledge_cards (
      id, schema_version, created_at, updated_at, source_id, fragment_id, card_type,
      title, summary, content_md, trigger_conditions_md, invalidation_md, risk_rule_md,
      contract_scope, timeframe_scope, tags_json, status, version, deleted_at
    ) VALUES (
      @id, @schema_version, @created_at, @updated_at, @source_id, @fragment_id, @card_type,
      @title, @summary, @content_md, @trigger_conditions_md, @invalidation_md, @risk_rule_md,
      @contract_scope, @timeframe_scope, @tags_json, @status, @version, @deleted_at
    )
  `)

  const rows: KnowledgeCardRecord[] = []
  for (const input of inputs) {
    const now = currentIso()
    const row: KnowledgeCardRecord = {
      id: createId('knowledge_card'),
      schema_version: 1,
      created_at: now,
      updated_at: now,
      source_id: input.source_id,
      fragment_id: input.fragment_id,
      card_type: input.card_type,
      title: input.title,
      summary: input.summary,
      content_md: input.content_md,
      trigger_conditions_md: input.trigger_conditions_md,
      invalidation_md: input.invalidation_md,
      risk_rule_md: input.risk_rule_md,
      contract_scope: input.contract_scope,
      timeframe_scope: input.timeframe_scope,
      tags_json: input.tags_json,
      status: 'draft',
      version: input.version,
      deleted_at: null,
    }
    insert.run(row)
    rows.push(row)
  }

  return rows
}

export type ReviewKnowledgeCardInput = {
  knowledge_card_id: string
  action: 'approve' | 'archive'
  reviewed_by?: string | null
  review_note_md?: string | null
}

export const reviewKnowledgeCard = (db: Database.Database, input: ReviewKnowledgeCardInput): KnowledgeCardRecord => {
  const current = getKnowledgeCardById(db, input.knowledge_card_id)
  const nextStatus = input.action === 'approve' ? 'approved' : 'archived'
  const now = currentIso()

  db.prepare(`
    UPDATE knowledge_cards
    SET status = ?, updated_at = ?, version = version + 1
    WHERE id = ?
  `).run(nextStatus, now, input.knowledge_card_id)

  db.prepare(`
    INSERT INTO knowledge_reviews (
      id, schema_version, created_at, knowledge_card_id, review_action, review_note_md, reviewed_by, payload_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    createId('knowledge_review'),
    1,
    now,
    input.knowledge_card_id,
    input.action,
    input.review_note_md ?? '',
    input.reviewed_by ?? 'local-user',
    JSON.stringify({
      from_status: current.status,
      to_status: nextStatus,
    }),
  )

  return getKnowledgeCardById(db, input.knowledge_card_id)
}

export const insertKnowledgeGroundings = (
  db: Database.Database,
  inputs: NewKnowledgeGroundingInput[],
): KnowledgeGroundingRecord[] => {
  if (inputs.length === 0) {
    return []
  }

  const statement = db.prepare(`
    INSERT INTO knowledge_groundings (
      id, schema_version, created_at, knowledge_card_id, session_id, trade_id,
      screenshot_id, annotation_id, anchor_id, ai_run_id, match_reason_md, relevance_score
    ) VALUES (
      @id, @schema_version, @created_at, @knowledge_card_id, @session_id, @trade_id,
      @screenshot_id, @annotation_id, @anchor_id, @ai_run_id, @match_reason_md, @relevance_score
    )
  `)

  const rows: KnowledgeGroundingRecord[] = []
  for (const input of inputs) {
    const row: KnowledgeGroundingRecord = {
      id: createId('knowledge_grounding'),
      schema_version: 1,
      created_at: currentIso(),
      knowledge_card_id: input.knowledge_card_id,
      session_id: input.session_id ?? null,
      trade_id: input.trade_id ?? null,
      screenshot_id: input.screenshot_id ?? null,
      annotation_id: input.annotation_id ?? null,
      anchor_id: input.anchor_id ?? null,
      ai_run_id: input.ai_run_id ?? null,
      match_reason_md: input.match_reason_md,
      relevance_score: Math.max(0, Math.min(input.relevance_score, 1)),
    }
    statement.run(row)
    rows.push(row)
  }

  return rows
}
