import type Database from 'better-sqlite3'
import { mapPeriod, mapSession } from '@main/db/repositories/workbench-mappers'
import { createId, selectRows } from '@main/db/repositories/workbench-utils'
import type { PeriodRecord } from '@shared/contracts/session'
import { PeriodSchema } from '@shared/contracts/session'

const periodKinds = ['day', 'week', 'month'] as const

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
  const absoluteOffsetMinutes = Math.abs(offsetMinutes)
  const offsetHours = pad(Math.floor(absoluteOffsetMinutes / 60))
  const offsetRemainder = pad(absoluteOffsetMinutes % 60)

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offsetHours}:${offsetRemainder}`
}

const formatLocalDateLabel = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const formatLocalMonthLabel = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`

const getIsoWeekParts = (date: Date) => {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNumber = utcDate.getUTCDay() || 7
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNumber)
  const weekYear = utcDate.getUTCFullYear()
  const yearStart = new Date(Date.UTC(weekYear, 0, 1))
  const week = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7)

  return {
    week,
    weekYear,
  }
}

const buildDayWindow = (referenceDate: Date) => {
  const start = new Date(referenceDate)
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setHours(23, 59, 59, 0)

  return {
    label: formatLocalDateLabel(referenceDate),
    start,
    end,
  }
}

const buildWeekWindow = (referenceDate: Date) => {
  const start = new Date(referenceDate)
  start.setHours(0, 0, 0, 0)
  const mondayOffset = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - mondayOffset)

  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 0)

  const { week, weekYear } = getIsoWeekParts(referenceDate)
  return {
    label: `${weekYear} W${pad(week)}`,
    start,
    end,
  }
}

const buildMonthWindow = (referenceDate: Date) => {
  const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1)
  start.setHours(0, 0, 0, 0)

  const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0)
  end.setHours(23, 59, 59, 0)

  return {
    label: formatLocalMonthLabel(referenceDate),
    start,
    end,
  }
}

const buildPeriodWindow = (
  kind: PeriodRecord['kind'],
  referenceDate: Date,
) => {
  if (kind === 'day') {
    return buildDayWindow(referenceDate)
  }
  if (kind === 'month') {
    return buildMonthWindow(referenceDate)
  }
  return buildWeekWindow(referenceDate)
}

const getExistingPeriod = (
  db: Database.Database,
  kind: PeriodRecord['kind'],
  startAt: string,
  endAt: string,
) => {
  const row = db.prepare(`
    SELECT *
    FROM periods
    WHERE kind = ? AND start_at = ? AND end_at = ?
    LIMIT 1
  `).get(kind, startAt, endAt) as Record<string, unknown> | undefined

  return row ? mapPeriod(row) : null
}

const ensurePeriodRecordInternal = (
  db: Database.Database,
  kind: PeriodRecord['kind'],
  referenceDate: Date,
) => {
  const window = buildPeriodWindow(kind, referenceDate)
  const startAt = toLocalIso(window.start)
  const endAt = toLocalIso(window.end)
  const existing = getExistingPeriod(db, kind, startAt, endAt)
  if (existing) {
    return {
      created: false,
      period: existing,
    }
  }

  const createdAt = toLocalIso(referenceDate)
  const period = PeriodSchema.parse({
    id: createId('period'),
    schema_version: 1,
    created_at: createdAt,
    kind,
    label: window.label,
    start_at: startAt,
    end_at: endAt,
    deleted_at: null,
  })

  db.prepare(`
    INSERT INTO periods (id, schema_version, created_at, kind, label, start_at, end_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(period.id, period.schema_version, period.created_at, period.kind, period.label, period.start_at, period.end_at)

  return {
    created: true,
    period,
  }
}

export const buildPeriodKey = (period: Pick<PeriodRecord, 'kind' | 'label'>) => `${period.kind}:${period.label}`
export const buildPeriodPromptMarker = (period: Pick<PeriodRecord, 'kind' | 'label'>) => `Period scope marker: [period_key=${buildPeriodKey(period)}]`

export const ensurePeriodRecord = (
  db: Database.Database,
  kind: PeriodRecord['kind'],
  referenceDate = new Date(),
) => ensurePeriodRecordInternal(db, kind, referenceDate).period

export const ensureCanonicalPeriodsForDate = (
  db: Database.Database,
  referenceDate = new Date(),
) => {
  const day = ensurePeriodRecordInternal(db, 'day', referenceDate).period
  const week = ensurePeriodRecordInternal(db, 'week', referenceDate).period
  const month = ensurePeriodRecordInternal(db, 'month', referenceDate).period

  return {
    day,
    week,
    month,
  }
}

export const ensurePeriodCatalogCoverage = (db: Database.Database) => {
  const sessionRows = db.prepare(`
    SELECT DISTINCT started_at
    FROM sessions
    WHERE deleted_at IS NULL
    ORDER BY started_at ASC
  `).all() as Array<{ started_at: string }>

  let createdCount = 0
  const transaction = db.transaction(() => {
    for (const row of sessionRows) {
      const referenceDate = new Date(row.started_at)
      if (Number.isNaN(referenceDate.getTime())) {
        continue
      }

      for (const kind of periodKinds) {
        if (ensurePeriodRecordInternal(db, kind, referenceDate).created) {
          createdCount += 1
        }
      }
    }
  })

  transaction()
  return createdCount
}

export const resolveDefaultReviewPeriodId = (db: Database.Database) => {
  const activeRow = db.prepare(`
    SELECT period_id
    FROM sessions
    WHERE status = 'active' AND deleted_at IS NULL
    ORDER BY started_at DESC, created_at DESC
    LIMIT 1
  `).get() as { period_id: string } | undefined
  if (activeRow) {
    return activeRow.period_id
  }

  const latestSessionRow = db.prepare(`
    SELECT period_id
    FROM sessions
    WHERE deleted_at IS NULL
    ORDER BY started_at DESC, created_at DESC
    LIMIT 1
  `).get() as { period_id: string } | undefined
  if (latestSessionRow) {
    return latestSessionRow.period_id
  }

  const latestWeekRow = db.prepare(`
    SELECT id
    FROM periods
    WHERE kind = 'week'
    ORDER BY start_at DESC, created_at DESC
    LIMIT 1
  `).get() as { id: string } | undefined
  if (latestWeekRow) {
    return latestWeekRow.id
  }

  const fallbackRow = db.prepare(`
    SELECT id
    FROM periods
    ORDER BY start_at ASC, created_at ASC
    LIMIT 1
  `).get() as { id: string } | undefined
  if (!fallbackRow) {
    throw new Error('当前没有可用于周期复盘的 Period。')
  }

  return fallbackRow.id
}

export const loadPeriodRecord = (
  db: Database.Database,
  periodId?: string,
) => {
  const resolvedPeriodId = periodId ?? resolveDefaultReviewPeriodId(db)
  const row = db.prepare('SELECT * FROM periods WHERE id = ? LIMIT 1').get(resolvedPeriodId) as Record<string, unknown> | undefined
  if (!row) {
    throw new Error(`未找到周期 ${resolvedPeriodId}。`)
  }

  return mapPeriod(row)
}

export const loadSessionsForPeriod = (
  db: Database.Database,
  period: Pick<PeriodRecord, 'start_at' | 'end_at'>,
) => selectRows(db, `
  SELECT *
  FROM sessions
  WHERE deleted_at IS NULL
    AND datetime(started_at) >= datetime(?)
    AND datetime(started_at) <= datetime(?)
  ORDER BY started_at ASC, rowid ASC
`, [period.start_at, period.end_at]).map(mapSession)
