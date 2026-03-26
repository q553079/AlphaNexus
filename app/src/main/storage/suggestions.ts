import { appendFile, mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { LocalFirstPaths } from '@main/app-shell/paths'

export type SuggestionAuditKind = 'annotation' | 'composer' | 'anchor-review' | 'similar-case'
export type SuggestionAuditType = 'generation' | 'action'

export type SuggestionAuditRecord = {
  id: string
  kind: SuggestionAuditKind
  audit_type?: SuggestionAuditType
  created_at: string
  session_id: string | null
  payload: unknown
}

type SuggestionAuditItem = Record<string, unknown> & { id: string }

const getAuditFilePath = (paths: LocalFirstPaths) => path.join(paths.dataDir, 'suggestion-audits.jsonl')

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const extractAuditItems = (payload: unknown): SuggestionAuditItem[] => {
  if (!isRecord(payload)) {
    return []
  }

  const suggestions = payload.suggestions
  if (Array.isArray(suggestions)) {
    return suggestions.filter((item): item is SuggestionAuditItem => isRecord(item) && typeof item.id === 'string')
  }

  const hits = payload.hits
  if (Array.isArray(hits)) {
    return hits.filter((item): item is SuggestionAuditItem => isRecord(item) && typeof item.id === 'string')
  }

  return []
}

export const appendSuggestionAuditRecord = async(
  paths: LocalFirstPaths,
  input: { kind: SuggestionAuditKind, audit_type?: SuggestionAuditType, session_id?: string | null, payload: unknown },
): Promise<SuggestionAuditRecord> => {
  const row: SuggestionAuditRecord = {
    id: `suggestion_audit_${randomUUID()}`,
    kind: input.kind,
    audit_type: input.audit_type ?? 'generation',
    created_at: new Date().toISOString(),
    session_id: input.session_id ?? null,
    payload: input.payload,
  }
  const filePath = getAuditFilePath(paths)
  await mkdir(path.dirname(filePath), { recursive: true })
  await appendFile(filePath, `${JSON.stringify(row)}\n`, 'utf8')
  return row
}

export const listSuggestionAuditRecords = async(
  paths: LocalFirstPaths,
  input: { kind?: SuggestionAuditKind, session_id?: string | null, limit?: number } = {},
) => {
  const limit = Math.max(1, Math.min(input.limit ?? 50, 200))
  const filePath = getAuditFilePath(paths)
  try {
    const content = await readFile(filePath, 'utf8')
    const rows = content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as SuggestionAuditRecord)
      .filter((row) => !input.kind || row.kind === input.kind)
      .filter((row) => !input.session_id || row.session_id === input.session_id)
      .slice(-limit)
      .reverse()
    return rows
  } catch {
    return []
  }
}

export const findSuggestionAuditItem = async(
  paths: LocalFirstPaths,
  input: { kind: SuggestionAuditKind, suggestion_id: string, session_id?: string | null },
): Promise<{ record: SuggestionAuditRecord, item: SuggestionAuditItem } | null> => {
  const filePath = getAuditFilePath(paths)
  try {
    const content = await readFile(filePath, 'utf8')
    const rows = content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as SuggestionAuditRecord)
      .reverse()

    for (const row of rows) {
      if (row.kind !== input.kind) {
        continue
      }
      if (row.audit_type === 'action') {
        continue
      }
      if (input.session_id && row.session_id !== input.session_id) {
        continue
      }

      const item = extractAuditItems(row.payload).find((candidate) => candidate.id === input.suggestion_id)
      if (item) {
        return { record: row, item }
      }
    }

    return null
  } catch {
    return null
  }
}
