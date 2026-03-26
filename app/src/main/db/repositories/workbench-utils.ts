import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import type { AnnotationRecord } from '@shared/contracts/content'

export const REALTIME_VIEW_TITLE = 'Realtime view'

export const parseJsonArray = <T>(value: unknown): T[] => {
  if (typeof value !== 'string' || value.length === 0) {
    return []
  }

  return JSON.parse(value) as T[]
}

export const createId = (prefix: string) => `${prefix}_${randomUUID()}`
export const currentIso = () => new Date().toISOString()

export const selectRows = (db: Database.Database, query: string, params?: unknown[] | Record<string, unknown>) => {
  const statement = db.prepare(query)
  if (params === undefined) {
    return statement.all() as Record<string, unknown>[]
  }

  return statement.all(params) as Record<string, unknown>[]
}

export const getFirstId = (db: Database.Database, tableName: string, orderBy: string) => {
  const row = db.prepare(`SELECT id FROM ${tableName} ORDER BY ${orderBy} ASC LIMIT 1`).get() as { id: string } | undefined
  if (!row) {
    throw new Error(`${tableName} 中没有可用数据。`)
  }

  return row.id
}

export const resolveDefaultSessionId = (db: Database.Database) => {
  const activeRow = db.prepare(`
    SELECT id FROM sessions
    WHERE status = 'active' AND deleted_at IS NULL
    ORDER BY started_at DESC, created_at DESC
    LIMIT 1
  `).get() as { id: string } | undefined

  if (activeRow) {
    return activeRow.id
  }

  const fallbackRow = db.prepare(`
    SELECT id FROM sessions
    WHERE deleted_at IS NULL
    ORDER BY started_at DESC, created_at DESC
    LIMIT 1
  `).get() as { id: string } | undefined

  if (!fallbackRow) {
    throw new Error('当前没有可用的 Session。')
  }

  return fallbackRow.id
}

export const buildSummary = (content: string) => {
  const compact = content.replace(/\s+/g, ' ').trim()
  if (!compact) {
    return '实时看法为空。'
  }

  return compact.length > 160 ? `${compact.slice(0, 157)}...` : compact
}

export const groupAnnotations = (annotations: AnnotationRecord[]) => {
  const groups = new Map<string, AnnotationRecord[]>()

  for (const annotation of annotations) {
    const list = groups.get(annotation.screenshot_id) ?? []
    list.push(annotation)
    groups.set(annotation.screenshot_id, list)
  }

  return groups
}
