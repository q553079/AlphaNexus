import type Database from 'better-sqlite3'
import type { LocalFirstPaths } from '@main/app-shell/paths'
import { getDatabase } from '@main/db/connection'
import { mapSession, mapTrade } from '@main/db/repositories/workbench-mappers'
import { selectRows } from '@main/db/repositories/workbench-utils'
import { loadPeriodRecord, loadSessionsForPeriod, resolveDefaultReviewPeriodId } from '@main/period/period-record-service'
import { buildPeriodTradeTags } from '@main/period/period-tag-taxonomy'
import type {
  PeriodReviewAiRecord,
  PeriodRollup,
  PeriodTagSummary,
  PeriodTradeMetric,
  TradeMetricResultLabel,
} from '@shared/contracts/period-review'

type PeriodMetricRow = Record<string, unknown> & {
  evaluation_score: number | null
  evaluation_note_md: string | null
  ai_supporting_factors_json: string | null
  ai_bias: 'bullish' | 'bearish' | 'range' | 'neutral' | null
}

const parseJsonArray = (value: unknown) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return [] as string[]
  }

  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : []
  } catch {
    return []
  }
}

const compact = (value: string) => value.replace(/\s+/g, ' ').trim()

const excerpt = (value: string) => {
  const trimmed = compact(value)
  if (!trimmed) {
    return '待补充'
  }

  return trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed
}

const average = (values: number[]) => values.length > 0
  ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2))
  : null

const averagePct = (values: number[]) => values.length > 0
  ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
  : null

const computeHoldingMinutes = (openedAt: string, closedAt: string | null) => {
  if (!closedAt) {
    return null
  }

  const opened = new Date(openedAt).getTime()
  const closed = new Date(closedAt).getTime()
  if (Number.isNaN(opened) || Number.isNaN(closed) || closed < opened) {
    return null
  }

  return Math.round((closed - opened) / 60_000)
}

const resolveResultLabel = (
  status: PeriodTradeMetric['trade']['status'],
  pnlR: number | null,
): TradeMetricResultLabel => {
  if (status === 'canceled') {
    return 'canceled'
  }
  if (status !== 'closed' || pnlR === null) {
    return 'pending'
  }
  if (pnlR > 0) {
    return 'win'
  }
  if (pnlR < 0) {
    return 'loss'
  }
  return 'flat'
}

const resolveAiAlignmentScore = (
  humanBias: PeriodMetricRow['ai_bias'],
  aiBias: PeriodMetricRow['ai_bias'],
) => {
  if (!humanBias || !aiBias) {
    return null
  }
  if (humanBias === aiBias) {
    return 100
  }
  const softPair = new Set([humanBias, aiBias])
  if (softPair.has('neutral') || softPair.has('range')) {
    return 60
  }
  return 0
}

const loadPeriodSessions = (
  db: Database.Database,
  period: Parameters<typeof loadSessionsForPeriod>[1],
) => loadSessionsForPeriod(db, period)

const loadPeriodMetricRows = (
  db: Database.Database,
  period: Pick<ReturnType<typeof loadPeriodRecord>, 'start_at' | 'end_at'>,
) =>
  selectRows(db, `
    SELECT
      t.*,
      e.score AS evaluation_score,
      e.note_md AS evaluation_note_md,
      s.title AS session_title,
      s.tags_json AS session_tags_json,
      s.market_bias AS session_market_bias,
      ac.bias AS ai_bias,
      ac.supporting_factors_json AS ai_supporting_factors_json
    FROM trades t
    INNER JOIN sessions s ON s.id = t.session_id
    LEFT JOIN evaluations e ON e.trade_id = t.id AND e.deleted_at IS NULL
    LEFT JOIN analysis_cards ac ON ac.id = (
      SELECT ac2.id
      FROM analysis_cards ac2
      INNER JOIN ai_runs ar2 ON ar2.id = ac2.ai_run_id
      WHERE ac2.trade_id = t.id
        AND ac2.deleted_at IS NULL
        AND ar2.deleted_at IS NULL
        AND ar2.prompt_kind = 'market-analysis'
      ORDER BY ac2.created_at DESC, ac2.rowid DESC
      LIMIT 1
    )
    WHERE s.deleted_at IS NULL
      AND t.deleted_at IS NULL
      AND datetime(s.started_at) >= datetime(?)
      AND datetime(s.started_at) <= datetime(?)
    ORDER BY t.opened_at ASC, t.rowid ASC
  `, [period.start_at, period.end_at]) as PeriodMetricRow[]

const buildPeriodTradeMetrics = (
  rows: PeriodMetricRow[],
  sessionById: Map<string, ReturnType<typeof mapSession>>,
): PeriodTradeMetric[] => rows.map((row) => {
  const trade = mapTrade(row)
  const session = sessionById.get(trade.session_id)
  if (!session) {
    throw new Error(`Trade ${trade.id} 缺少所属 Session ${trade.session_id}。`)
  }

  const aiSupportingFactors = parseJsonArray(row.ai_supporting_factors_json)
  return {
    trade_id: trade.id,
    session_id: trade.session_id,
    session_title: String(row.session_title ?? session.title),
    trade,
    pnl_r: trade.pnl_r,
    holding_minutes: computeHoldingMinutes(trade.opened_at, trade.closed_at),
    result_label: resolveResultLabel(trade.status, trade.pnl_r),
    plan_adherence_score: typeof row.evaluation_score === 'number' ? row.evaluation_score : null,
    ai_alignment_score: resolveAiAlignmentScore(session.market_bias, row.ai_bias),
    thesis_excerpt: excerpt(trade.thesis),
    tags: buildPeriodTradeTags({
      session,
      trade,
      evaluation_note_md: typeof row.evaluation_note_md === 'string' ? row.evaluation_note_md : null,
      evaluation_score: typeof row.evaluation_score === 'number' ? row.evaluation_score : null,
      ai_supporting_factors: aiSupportingFactors,
    }),
  }
})

const buildTagSummary = (metrics: PeriodTradeMetric[]): PeriodTagSummary[] => {
  const summaryById = new Map<string, PeriodTagSummary>()
  for (const metric of metrics) {
    for (const tag of metric.tags) {
      const existing = summaryById.get(tag.id)
      if (existing) {
        existing.count += 1
        if (!existing.trade_ids.includes(metric.trade_id)) {
          existing.trade_ids.push(metric.trade_id)
        }
        continue
      }

      summaryById.set(tag.id, {
        id: tag.id,
        label: tag.label,
        category: tag.category,
        source: tag.source,
        count: 1,
        trade_ids: [metric.trade_id],
      })
    }
  }

  return [...summaryById.values()].sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count
    }
    return left.label.localeCompare(right.label)
  })
}

const buildPnlCurve = (metrics: PeriodTradeMetric[]) => {
  let cumulative = 0
  return metrics
    .filter((metric) => metric.trade.closed_at && metric.trade.pnl_r !== null)
    .sort((left, right) => new Date(left.trade.closed_at ?? left.trade.opened_at).getTime() - new Date(right.trade.closed_at ?? right.trade.opened_at).getTime())
    .map((metric) => {
      cumulative += metric.trade.pnl_r ?? 0
      return {
        trade_id: metric.trade_id,
        session_id: metric.session_id,
        point_at: metric.trade.closed_at ?? metric.trade.opened_at,
        pnl_r: metric.trade.pnl_r ?? 0,
        cumulative_pnl_r: Number(cumulative.toFixed(2)),
      }
    })
}

const scoreMetricForRanking = (metric: PeriodTradeMetric) => ({
  pnl_r: metric.pnl_r ?? Number.NEGATIVE_INFINITY,
  adherence: metric.plan_adherence_score ?? Number.NEGATIVE_INFINITY,
})

const buildRankedTradeIds = (
  metrics: PeriodTradeMetric[],
  direction: 'best' | 'worst',
) => {
  const resolved = metrics.filter((metric) => metric.result_label === 'win' || metric.result_label === 'loss' || metric.result_label === 'flat')
  return [...resolved]
    .sort((left, right) => {
      const leftScore = scoreMetricForRanking(left)
      const rightScore = scoreMetricForRanking(right)
      if (direction === 'best') {
        if (rightScore.pnl_r !== leftScore.pnl_r) {
          return rightScore.pnl_r - leftScore.pnl_r
        }
        return rightScore.adherence - leftScore.adherence
      }
      if (leftScore.pnl_r !== rightScore.pnl_r) {
        return leftScore.pnl_r - rightScore.pnl_r
      }
      return leftScore.adherence - rightScore.adherence
    })
    .slice(0, 3)
    .map((metric) => metric.trade_id)
}

export const buildPeriodRollupBundle = async(
  paths: LocalFirstPaths,
  input: {
    period_id?: string
    latest_period_review?: PeriodReviewAiRecord | null
  },
): Promise<{
  rollup: PeriodRollup
  trade_metrics: PeriodTradeMetric[]
}> => {
  const db = await getDatabase(paths)
  const resolvedPeriodId = input.period_id
    ?? resolveDefaultReviewPeriodId(db)
  if (!resolvedPeriodId) {
    throw new Error('当前没有可用于周期聚合的 Period。')
  }
  const period = loadPeriodRecord(db, resolvedPeriodId)
  const sessions = loadPeriodSessions(db, period)
  const sessionById = new Map(sessions.map((session) => [session.id, session]))
  const rows = loadPeriodMetricRows(db, period)
  const tradeMetrics = buildPeriodTradeMetrics(rows, sessionById)
  const pnlCurve = buildPnlCurve(tradeMetrics)
  const resolvedMetrics = tradeMetrics.filter((metric) => metric.result_label === 'win' || metric.result_label === 'loss' || metric.result_label === 'flat')
  const planScores = tradeMetrics
    .map((metric) => metric.plan_adherence_score)
    .filter((value): value is number => value !== null)
  const aiAlignmentScores = tradeMetrics
    .map((metric) => metric.ai_alignment_score)
    .filter((value): value is number => value !== null)
  const holdingValues = tradeMetrics
    .map((metric) => metric.holding_minutes)
    .filter((value): value is number => value !== null)

  return {
    rollup: {
      schema_version: 1,
      period,
      period_key: `${period.kind}:${period.label}`,
      generated_at: new Date().toISOString(),
      generation_strategy: 'rebuild-from-local-records',
      session_ids: sessions.map((session) => session.id),
      trade_ids: tradeMetrics.map((metric) => metric.trade_id),
      stats: {
        trade_count: tradeMetrics.length,
        resolved_trade_count: resolvedMetrics.length,
        pending_trade_count: tradeMetrics.filter((metric) => metric.result_label === 'pending').length,
        canceled_trade_count: tradeMetrics.filter((metric) => metric.result_label === 'canceled').length,
        win_count: tradeMetrics.filter((metric) => metric.result_label === 'win').length,
        loss_count: tradeMetrics.filter((metric) => metric.result_label === 'loss').length,
        flat_count: tradeMetrics.filter((metric) => metric.result_label === 'flat').length,
        total_pnl_r: Number(resolvedMetrics.reduce((sum, metric) => sum + (metric.pnl_r ?? 0), 0).toFixed(2)),
        avg_pnl_r: average(resolvedMetrics.map((metric) => metric.pnl_r).filter((value): value is number => value !== null)),
        win_rate_pct: resolvedMetrics.length > 0
          ? Math.round((resolvedMetrics.filter((metric) => metric.result_label === 'win').length / resolvedMetrics.length) * 100)
          : null,
        avg_holding_minutes: averagePct(holdingValues),
        plan_adherence_avg_pct: averagePct(planScores),
        ai_alignment_avg_pct: averagePct(aiAlignmentScores),
      },
      pnl_curve: pnlCurve,
      tag_summary: buildTagSummary(tradeMetrics),
      best_trade_ids: buildRankedTradeIds(tradeMetrics, 'best'),
      worst_trade_ids: buildRankedTradeIds(tradeMetrics, 'worst'),
      latest_period_review_ai_run_id: input.latest_period_review?.ai_run.id ?? null,
      latest_period_review_generated_at: input.latest_period_review?.ai_run.created_at ?? null,
    },
    trade_metrics: tradeMetrics,
  }
}
