import type Database from 'better-sqlite3'
import { ensureCanonicalPeriodsForDate } from '@main/period/period-record-service'
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

export const createSessionRecord = (db: Database.Database, input: CreateSessionInput) => {
  const now = new Date()
  const createdAt = toLocalIso(now)
  const contract = loadContract(db, input.contract_id)
  const periods = ensureCanonicalPeriodsForDate(db, now)
  const period = PeriodSchema.parse(periods.week)
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
