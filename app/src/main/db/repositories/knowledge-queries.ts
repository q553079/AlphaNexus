import type Database from 'better-sqlite3'
import {
  mapKnowledgeCard,
  mapKnowledgeFragment,
  mapKnowledgeGrounding,
  mapKnowledgeImportJob,
  mapKnowledgeSource,
} from '@main/db/repositories/knowledge-mappers'
import type {
  KnowledgeCardRecord,
  KnowledgeFragmentRecord,
  KnowledgeGroundingRecord,
  KnowledgeImportJobRecord,
  KnowledgeSourceRecord,
} from '@main/knowledge/pipeline'

const asRows = (rows: unknown[]) => rows as Record<string, unknown>[]

const parseTags = (tagsJson: string) => {
  if (!tagsJson) {
    return []
  }

  try {
    const parsed = JSON.parse(tagsJson) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.filter((value): value is string => typeof value === 'string').map((tag) => tag.toLowerCase())
  } catch {
    return []
  }
}

export type ApprovedCardFilters = {
  contract_scope?: string | null
  timeframe_scope?: string | null
  tags?: string[]
  annotation_semantic?: string | null
  trade_state?: string | null
  context_tags?: string[]
  limit?: number
}

const normalizeTags = (tags: string[]) => tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean)

const cardTypeByTradeState: Record<string, KnowledgeCardRecord['card_type'][]> = {
  pre_entry: ['setup', 'entry-rule', 'risk-rule'],
  entry: ['entry-rule', 'setup', 'risk-rule'],
  manage: ['management-rule', 'risk-rule', 'invalidation-rule'],
  exit: ['management-rule', 'review-principle', 'mistake-pattern'],
  post_trade: ['review-principle', 'mistake-pattern', 'risk-rule'],
}

const matchesTradeState = (card: KnowledgeCardRecord, tradeState: string | null | undefined) => {
  if (!tradeState) {
    return true
  }
  const expectedTypes = cardTypeByTradeState[tradeState.trim().toLowerCase()]
  if (!expectedTypes) {
    return true
  }
  return expectedTypes.includes(card.card_type)
}

const matchesAnnotationSemantic = (card: KnowledgeCardRecord, annotationSemantic: string | null | undefined) => {
  if (!annotationSemantic) {
    return true
  }
  const semantic = annotationSemantic.trim().toLowerCase()
  if (!semantic) {
    return true
  }
  const tags = parseTags(card.tags_json)
  return tags.includes(semantic)
}

const matchesContextTags = (card: KnowledgeCardRecord, contextTags: string[] | undefined) => {
  if (!contextTags || contextTags.length === 0) {
    return true
  }
  const expected = normalizeTags(contextTags)
  if (expected.length === 0) {
    return true
  }
  const tags = parseTags(card.tags_json)
  return expected.some((tag) => tags.includes(tag))
}

export const listKnowledgeSources = (db: Database.Database): KnowledgeSourceRecord[] => asRows(
  db.prepare(`
    SELECT * FROM knowledge_sources
    WHERE deleted_at IS NULL
    ORDER BY created_at DESC
  `).all(),
).map(mapKnowledgeSource)

export const listKnowledgeImportJobs = (db: Database.Database): KnowledgeImportJobRecord[] => asRows(
  db.prepare(`
    SELECT * FROM knowledge_import_jobs
    WHERE deleted_at IS NULL
    ORDER BY created_at DESC
  `).all(),
).map(mapKnowledgeImportJob)

export const listKnowledgeFragmentsBySource = (db: Database.Database, sourceId: string): KnowledgeFragmentRecord[] => asRows(
  db.prepare(`
    SELECT * FROM knowledge_fragments
    WHERE source_id = ? AND deleted_at IS NULL
    ORDER BY sequence_no ASC
  `).all(sourceId),
).map(mapKnowledgeFragment)

export const listDraftKnowledgeCards = (db: Database.Database, limit = 100): KnowledgeCardRecord[] => asRows(
  db.prepare(`
    SELECT * FROM knowledge_cards
    WHERE status = 'draft' AND deleted_at IS NULL
    ORDER BY created_at ASC
    LIMIT ?
  `).all(limit),
).map(mapKnowledgeCard)

export const getKnowledgeCardById = (db: Database.Database, cardId: string): KnowledgeCardRecord => {
  const row = db.prepare('SELECT * FROM knowledge_cards WHERE id = ? AND deleted_at IS NULL LIMIT 1').get(cardId) as Record<string, unknown> | undefined
  if (!row) {
    throw new Error(`未找到知识卡 ${cardId}。`)
  }

  return mapKnowledgeCard(row)
}

export const listApprovedKnowledgeCards = (db: Database.Database, filters: ApprovedCardFilters = {}): KnowledgeCardRecord[] => {
  const limit = Math.max(1, Math.min(filters.limit ?? 24, 200))
  const contractScope = filters.contract_scope?.trim()
  const timeframeScope = filters.timeframe_scope?.trim()
  const queryRows = asRows(
    db.prepare(`
      SELECT * FROM knowledge_cards
      WHERE status = 'approved'
      AND deleted_at IS NULL
      AND (
        ? IS NULL
        OR contract_scope = '*'
        OR contract_scope = ?
      )
      AND (
        ? IS NULL
        OR timeframe_scope = '*'
        OR timeframe_scope = ?
      )
      ORDER BY updated_at DESC
      LIMIT ?
    `).all(contractScope ?? null, contractScope ?? null, timeframeScope ?? null, timeframeScope ?? null, limit * 2),
  ).map(mapKnowledgeCard)

  const expectedTags = normalizeTags(filters.tags ?? [])
  return queryRows
    .filter((row) => {
      if (expectedTags.length > 0) {
        const tags = parseTags(row.tags_json)
        if (!expectedTags.every((tag) => tags.includes(tag))) {
          return false
        }
      }
      if (!matchesAnnotationSemantic(row, filters.annotation_semantic)) {
        return false
      }
      if (!matchesTradeState(row, filters.trade_state)) {
        return false
      }
      if (!matchesContextTags(row, filters.context_tags)) {
        return false
      }
      return true
    })
    .slice(0, limit)
}

export const listKnowledgeGroundingsByAiRun = (db: Database.Database, aiRunId: string): KnowledgeGroundingRecord[] => asRows(
  db.prepare(`
    SELECT * FROM knowledge_groundings
    WHERE ai_run_id = ?
    ORDER BY created_at ASC
  `).all(aiRunId),
).map(mapKnowledgeGrounding)

export const listRecentAnchorGroundings = (db: Database.Database, limit = 200): KnowledgeGroundingRecord[] => asRows(
  db.prepare(`
    SELECT * FROM knowledge_groundings
    WHERE anchor_id IS NOT NULL
    ORDER BY created_at DESC
    LIMIT ?
  `).all(Math.max(1, Math.min(limit, 500))),
).map(mapKnowledgeGrounding)
