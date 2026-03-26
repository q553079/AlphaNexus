import type Database from 'better-sqlite3'
import { ContentBlockMoveAuditSchema, type ContentBlockMoveAuditRecord } from '@shared/contracts/content'
import { createId, currentIso, selectRows } from '@main/db/repositories/workbench-utils'

const mapContentBlockMoveAudit = (row: Record<string, unknown>): ContentBlockMoveAuditRecord =>
  ContentBlockMoveAuditSchema.parse(row)

export const loadContentBlockMoveHistory = (
  db: Database.Database,
  blockIds: string[],
) => {
  const historyByBlock = new Map<string, ContentBlockMoveAuditRecord[]>()
  if (blockIds.length === 0) {
    return historyByBlock
  }

  const placeholders = blockIds.map(() => '?').join(', ')
  const rows = selectRows(db, `
    SELECT *
    FROM content_block_move_audit
    WHERE block_id IN (${placeholders})
    ORDER BY moved_at DESC
  `, blockIds).map(mapContentBlockMoveAudit)

  for (const row of rows) {
    const list = historyByBlock.get(row.block_id) ?? []
    list.push(row)
    historyByBlock.set(row.block_id, list)
  }

  return historyByBlock
}

export const loadContentBlockMoveHistoryForBlock = (
  db: Database.Database,
  blockId: string,
) => (
  loadContentBlockMoveHistory(db, [blockId]).get(blockId) ?? []
)

export const insertContentBlockMoveAudit = (
  db: Database.Database,
  input: Omit<ContentBlockMoveAuditRecord, 'id' | 'schema_version' | 'moved_at'> & {
    moved_at?: string
  },
) => {
  const record = ContentBlockMoveAuditSchema.parse({
    id: createId('block_move'),
    schema_version: 1,
    moved_at: input.moved_at ?? currentIso(),
    ...input,
  })

  db.prepare(`
    INSERT INTO content_block_move_audit (
      id, schema_version, block_id, from_context_type, from_context_id, to_context_type, to_context_id,
      from_session_id, to_session_id, moved_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    record.id,
    record.schema_version,
    record.block_id,
    record.from_context_type,
    record.from_context_id,
    record.to_context_type,
    record.to_context_id,
    record.from_session_id,
    record.to_session_id,
    record.moved_at,
  )

  return record
}
