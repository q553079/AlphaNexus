import type Database from 'better-sqlite3'
import { ContractSchema, PeriodSchema, SessionSchema } from '@shared/contracts/session'
import type { CreateSessionInput, SessionBucket } from '@shared/contracts/launcher'
import { createId } from '@main/db/repositories/workbench-utils'

const bucketLabels: Record<SessionBucket, string> = {
  am: '上午',
  pm: '下午',
  night: '夜盘',
  custom: '自定义',
}

const pad = (value: number) => String(value).padStart(2, '0')

const toLocalIso = (date: Date) => {
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())
  const seconds = pad(date.getSeconds())
  const offsetMinutes = -date.getTimezoneOffset()
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const absMinutes = Math.abs(offsetMinutes)
  const offsetHours = pad(Math.floor(absMinutes / 60))
  const offsetRemainder = pad(absMinutes % 60)

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offsetHours}:${offsetRemainder}`
}

const formatLocalDateLabel = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

const getIsoWeekParts = (date: Date) => {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNumber = utcDate.getUTCDay() || 7
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNumber)
  const weekYear = utcDate.getUTCFullYear()
  const yearStart = new Date(Date.UTC(weekYear, 0, 1))
  const week = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)

  return { weekYear, week }
}

const getCurrentWeekRange = (referenceDate = new Date()) => {
  const start = new Date(referenceDate)
  start.setHours(0, 0, 0, 0)
  const mondayOffset = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - mondayOffset)

  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 0)

  return {
    start,
    end,
    ...getIsoWeekParts(referenceDate),
  }
}

const loadContract = (db: Database.Database, contractId: string) => {
  const row = db.prepare('SELECT * FROM contracts WHERE id = ? LIMIT 1').get(contractId) as Record<string, unknown> | undefined
  if (!row) {
    throw new Error(`未找到合约 ${contractId}。`)
  }

  return ContractSchema.parse(row)
}

const markOnlySessionAsActive = (db: Database.Database, sessionId: string) => {
  db.prepare(`
    UPDATE sessions
    SET status = 'planned'
    WHERE id <> ? AND status = 'active' AND deleted_at IS NULL
  `).run(sessionId)

  db.prepare(`
    UPDATE sessions
    SET status = 'active', ended_at = NULL
    WHERE id = ? AND deleted_at IS NULL
  `).run(sessionId)
}

const getOrCreateCurrentWeekPeriod = (db: Database.Database, referenceDate = new Date()) => {
  const { start, end, weekYear, week } = getCurrentWeekRange(referenceDate)
  const startAt = toLocalIso(start)
  const endAt = toLocalIso(end)
  const existingRow = db.prepare(`
    SELECT * FROM periods
    WHERE kind = 'week' AND start_at = ? AND end_at = ?
    LIMIT 1
  `).get(startAt, endAt) as Record<string, unknown> | undefined

  if (existingRow) {
    return PeriodSchema.parse(existingRow)
  }

  const createdAt = toLocalIso(referenceDate)
  const period = PeriodSchema.parse({
    id: createId('period'),
    schema_version: 1,
    created_at: createdAt,
    kind: 'week',
    label: `${weekYear} W${pad(week)}`,
    start_at: startAt,
    end_at: endAt,
    deleted_at: null,
  })

  db.prepare(`
    INSERT INTO periods (id, schema_version, created_at, kind, label, start_at, end_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(period.id, period.schema_version, period.created_at, period.kind, period.label, period.start_at, period.end_at)

  return period
}

export const createSessionRecord = (db: Database.Database, input: CreateSessionInput) => {
  const now = new Date()
  const createdAt = toLocalIso(now)
  const contract = loadContract(db, input.contract_id)
  const period = getOrCreateCurrentWeekPeriod(db, now)
  const title = input.title?.trim() || `${contract.symbol} ${bucketLabels[input.bucket]} Session · ${formatLocalDateLabel(now)}`
  const session = SessionSchema.parse({
    id: createId('session'),
    schema_version: 1,
    created_at: createdAt,
    contract_id: contract.id,
    period_id: period.id,
    title,
    status: 'active',
    started_at: createdAt,
    ended_at: null,
    market_bias: input.market_bias,
    tags: input.tags,
    my_realtime_view: '',
    trade_plan_md: input.trade_plan_md,
    context_focus: input.context_focus,
    deleted_at: null,
  })

  db.transaction(() => {
    markOnlySessionAsActive(db, session.id)
    db.prepare(`
      INSERT INTO sessions (
        id, schema_version, created_at, contract_id, period_id, title, status, started_at, ended_at,
        market_bias, tags_json, my_realtime_view, trade_plan_md, context_focus, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
    `).run(
      session.id,
      session.schema_version,
      session.created_at,
      session.contract_id,
      session.period_id,
      session.title,
      session.status,
      session.started_at,
      session.ended_at,
      session.market_bias,
      JSON.stringify(session.tags),
      session.my_realtime_view,
      session.trade_plan_md,
      session.context_focus,
    )
  })()

  return session
}

export const activateSessionRecord = (db: Database.Database, sessionId: string) => {
  const row = db.prepare('SELECT * FROM sessions WHERE id = ? AND deleted_at IS NULL LIMIT 1').get(sessionId) as Record<string, unknown> | undefined
  if (!row) {
    throw new Error(`未找到 Session ${sessionId}。`)
  }

  db.transaction(() => {
    markOnlySessionAsActive(db, sessionId)
  })()

  const updated = db.prepare('SELECT * FROM sessions WHERE id = ? LIMIT 1').get(sessionId) as Record<string, unknown>
  return SessionSchema.parse({
    ...updated,
    tags: JSON.parse(String(updated.tags_json ?? '[]')) as string[],
  })
}
