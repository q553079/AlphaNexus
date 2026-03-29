import type { LocalFirstPaths } from '@main/app-shell/paths'
import { getDatabase } from '@main/db/connection'
import { loadAiRecordChainByAiRunId } from '@main/db/repositories/workbench-repository'
import { buildPeriodPromptMarker, loadPeriodRecord } from '@main/period/period-record-service'
import {
  AiAnalysisDraftSchema,
  PeriodReviewDraftSchema,
  TradeReviewDraftSchema,
} from '@shared/ai/contracts'
import type {
  PeriodAiFailure,
  PeriodAiProviderQuality,
  PeriodAiQualitySummary,
  PeriodReviewAiRecord,
} from '@shared/contracts/period-review'

type PeriodAiRunRow = {
  id: string
  provider: 'deepseek' | 'openai' | 'anthropic' | 'custom-http'
  prompt_kind: 'market-analysis' | 'trade-review' | 'period-review'
  status: 'mocked' | 'queued' | 'completed' | 'failed'
  created_at: string
  raw_response_text: string
  structured_response_json: string
}

const safeParseStructured = (
  promptKind: PeriodAiRunRow['prompt_kind'],
  value: string,
) => {
  const parsed = JSON.parse(value) as unknown
  if (promptKind === 'market-analysis') {
    return AiAnalysisDraftSchema.parse(parsed)
  }
  if (promptKind === 'trade-review') {
    return TradeReviewDraftSchema.parse(parsed)
  }
  return PeriodReviewDraftSchema.parse(parsed)
}

const resolveFailureReason = (row: PeriodAiRunRow, structuredOk: boolean) => {
  if (row.status === 'failed') {
    const rawText = row.raw_response_text.trim()
    if (rawText.startsWith('ERROR:')) {
      return rawText.slice('ERROR:'.length).trim()
    }
    return rawText || 'AI 运行失败，但没有返回明确错误原因。'
  }

  if (!structuredOk) {
    return 'AI 运行完成，但 structured_response_json 未通过本地 schema 校验。'
  }

  return null
}

export const getLatestPeriodReviewAiRecord = async(
  paths: LocalFirstPaths,
  periodId: string,
): Promise<PeriodReviewAiRecord | null> => {
  const db = await getDatabase(paths)
  const period = loadPeriodRecord(db, periodId)
  const periodMarker = `%${buildPeriodPromptMarker(period)}%`
  const row = db.prepare(`
    SELECT ar.id
    FROM ai_runs ar
    WHERE ar.deleted_at IS NULL
      AND ar.prompt_kind = 'period-review'
      AND ar.status = 'completed'
      AND ar.prompt_preview LIKE ?
    ORDER BY ar.created_at DESC, ar.rowid DESC
    LIMIT 1
  `).get(periodMarker) as { id: string } | undefined

  if (!row) {
    return null
  }

  const record = loadAiRecordChainByAiRunId(db, row.id)
  try {
    return {
      ...record,
      structured: PeriodReviewDraftSchema.parse(JSON.parse(record.ai_run.structured_response_json)),
    }
  } catch {
    return {
      ...record,
      structured: null,
    }
  }
}

export const getPeriodAiQualitySummary = async(
  paths: LocalFirstPaths,
  periodId: string,
): Promise<PeriodAiQualitySummary> => {
  const db = await getDatabase(paths)
  const period = loadPeriodRecord(db, periodId)
  const periodMarker = `%${buildPeriodPromptMarker(period)}%`
  const rows = db.prepare(`
    SELECT ar.id, ar.provider, ar.prompt_kind, ar.status, ar.created_at, ar.raw_response_text, ar.structured_response_json
    FROM ai_runs ar
    INNER JOIN sessions s ON s.id = ar.session_id
    WHERE s.deleted_at IS NULL
      AND ar.deleted_at IS NULL
      AND (
        (
          ar.prompt_kind <> 'period-review'
          AND datetime(s.started_at) >= datetime(?)
          AND datetime(s.started_at) <= datetime(?)
        )
        OR (
          ar.prompt_kind = 'period-review'
          AND ar.prompt_preview LIKE ?
        )
      )
    ORDER BY ar.created_at DESC, ar.rowid DESC
  `).all(period.start_at, period.end_at, periodMarker) as PeriodAiRunRow[]
  const completedOrFailedRows = rows.filter((row) => row.status !== 'queued')

  const failures: PeriodAiFailure[] = []
  const providerMap = new Map<PeriodAiRunRow['provider'], PeriodAiProviderQuality>()
  let structuredSuccessCount = 0
  let structuredFailureCount = 0

  completedOrFailedRows.forEach((row) => {
    let structuredOk = false
    if (row.status === 'completed') {
      try {
        safeParseStructured(row.prompt_kind, row.structured_response_json)
        structuredOk = true
      } catch {
        structuredOk = false
      }
    }

    const providerStats = providerMap.get(row.provider) ?? {
      provider: row.provider,
      total_runs: 0,
      structured_success_count: 0,
      structured_failure_count: 0,
      success_rate_pct: null,
      last_failure_reason: null,
    }

    providerStats.total_runs += 1
    if (structuredOk) {
      structuredSuccessCount += 1
      providerStats.structured_success_count += 1
    } else {
      structuredFailureCount += 1
      providerStats.structured_failure_count += 1
      const reason = resolveFailureReason(row, structuredOk)
      if (reason) {
        providerStats.last_failure_reason ??= reason
        failures.push({
          ai_run_id: row.id,
          provider: row.provider,
          prompt_kind: row.prompt_kind,
          created_at: row.created_at,
          reason,
        })
      }
    }

    providerMap.set(row.provider, providerStats)
  })

  const providers = [...providerMap.values()]
    .map((provider) => ({
      ...provider,
      success_rate_pct: provider.total_runs > 0
        ? Math.round((provider.structured_success_count / provider.total_runs) * 100)
        : null,
    }))
    .sort((left, right) => {
      if (right.total_runs !== left.total_runs) {
        return right.total_runs - left.total_runs
      }
      return left.provider.localeCompare(right.provider)
    })

  return {
    schema_version: 1,
    period_id: period.id,
    total_runs: completedOrFailedRows.length,
    structured_success_count: structuredSuccessCount,
    structured_failure_count: structuredFailureCount,
    success_rate_pct: completedOrFailedRows.length > 0 ? Math.round((structuredSuccessCount / completedOrFailedRows.length) * 100) : null,
    providers,
    recent_failures: failures.slice(0, 5),
  }
}
