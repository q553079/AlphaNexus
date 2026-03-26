import type { LocalFirstPaths } from '@main/app-shell/paths'
import { getDatabase } from '@main/db/connection'
import type {
  CalibrationBucket,
  ComparisonMetric,
  EffectiveKnowledgeInsight,
  OutcomeSnapshot,
  PatternInsight,
  PeriodEvaluationRollup,
  TradeEvaluationSummary,
  TradeJudgmentSummary,
} from '@shared/contracts/evaluation'

type SessionTradeRow = {
  session_id: string
  session_title: string
  market_bias: 'bullish' | 'bearish' | 'range' | 'neutral'
  session_tags_json: string
  trade_id: string | null
  trade_side: 'long' | 'short' | null
  trade_status: 'planned' | 'open' | 'closed' | null
  pnl_r: number | null
  score: number | null
  note_md: string | null
  confidence_pct: number | null
  ai_bias: 'bullish' | 'bearish' | 'range' | 'neutral' | null
}

const loadTradeContextRow = (db: ReturnType<typeof getDatabase> extends Promise<infer T> ? T : never, tradeId: string) =>
  db.prepare(`
    SELECT
      s.id AS session_id,
      s.title AS session_title,
      s.market_bias,
      s.tags_json AS session_tags_json,
      t.id AS trade_id,
      t.side AS trade_side,
      t.status AS trade_status,
      t.pnl_r,
      e.score,
      e.note_md,
      a.confidence_pct,
      a.bias AS ai_bias
    FROM trades t
    INNER JOIN sessions s ON s.id = t.session_id
    LEFT JOIN evaluations e ON e.trade_id = t.id AND e.deleted_at IS NULL
    LEFT JOIN analysis_cards a ON a.id = (
      SELECT ac.id
      FROM analysis_cards ac
      WHERE ac.trade_id = t.id
        AND ac.deleted_at IS NULL
      ORDER BY ac.created_at DESC
      LIMIT 1
    )
    WHERE t.id = ?
      AND t.deleted_at IS NULL
    LIMIT 1
  `).get(tradeId) as SessionTradeRow | undefined

const loadPeriodRows = (db: ReturnType<typeof getDatabase> extends Promise<infer T> ? T : never, periodId?: string) => {
  const rows = db.prepare(`
    SELECT
      s.id AS session_id,
      s.title AS session_title,
      s.market_bias,
      s.tags_json AS session_tags_json,
      t.id AS trade_id,
      t.side AS trade_side,
      t.status AS trade_status,
      t.pnl_r,
      e.score,
      e.note_md,
      a.confidence_pct,
      a.bias AS ai_bias
    FROM trades t
    INNER JOIN sessions s ON s.id = t.session_id
    LEFT JOIN evaluations e ON e.trade_id = t.id AND e.deleted_at IS NULL
    LEFT JOIN analysis_cards a ON a.id = (
      SELECT ac.id
      FROM analysis_cards ac
      WHERE ac.trade_id = t.id
        AND ac.deleted_at IS NULL
      ORDER BY ac.created_at DESC
      LIMIT 1
    )
    WHERE s.deleted_at IS NULL
      AND t.deleted_at IS NULL
      AND (? IS NULL OR s.period_id = ?)
    ORDER BY s.started_at ASC, t.opened_at ASC
  `).all(periodId ?? null, periodId ?? null) as SessionTradeRow[]

  return rows
}

const resolveOutcome = (row: SessionTradeRow): OutcomeSnapshot => {
  if (!row.trade_id || row.trade_status === 'planned') {
    return {
      trade_id: row.trade_id,
      outcome_direction: 'unknown',
      pnl_r: row.pnl_r,
      status: 'insufficient',
      summary: '当前没有足够的 trade outcome。',
    }
  }

  if (row.trade_status !== 'closed' || row.pnl_r === null) {
    return {
      trade_id: row.trade_id,
      outcome_direction: 'unknown',
      pnl_r: row.pnl_r,
      status: 'pending',
      summary: '交易尚未闭环，结果仍待观察。',
    }
  }

  const outcomeDirection = row.pnl_r > 0
    ? (row.trade_side === 'long' ? 'up' : 'down')
    : row.pnl_r < 0
      ? (row.trade_side === 'long' ? 'down' : 'up')
      : 'range'

  return {
    trade_id: row.trade_id,
    outcome_direction: outcomeDirection,
    pnl_r: row.pnl_r,
    status: 'resolved',
    summary: `已闭环，结果 ${row.pnl_r > 0 ? '盈利' : row.pnl_r < 0 ? '亏损' : '打平'} ${row.pnl_r}R。`,
  }
}

const resolveVerdict = (
  bias: 'bullish' | 'bearish' | 'range' | 'neutral' | null,
  outcome: OutcomeSnapshot,
): TradeJudgmentSummary['verdict'] => {
  if (!bias) {
    return outcome.status === 'resolved' ? 'insufficient' : outcome.status
  }
  if (outcome.status !== 'resolved') {
    return outcome.status
  }
  if (bias === 'neutral') {
    return outcome.outcome_direction === 'range' ? 'correct' : 'partially-correct'
  }
  if (bias === 'range') {
    return outcome.outcome_direction === 'range' ? 'correct' : 'incorrect'
  }
  if (bias === 'bullish') {
    return outcome.outcome_direction === 'up' ? 'correct' : outcome.outcome_direction === 'range' ? 'partially-correct' : 'incorrect'
  }
  return outcome.outcome_direction === 'down' ? 'correct' : outcome.outcome_direction === 'range' ? 'partially-correct' : 'incorrect'
}

const buildJudgment = (
  source: 'human' | 'ai',
  bias: SessionTradeRow['market_bias'] | SessionTradeRow['ai_bias'] | null,
  confidencePct: number | null,
  outcome: OutcomeSnapshot,
): TradeJudgmentSummary => ({
  source,
  bias,
  confidence_pct: confidencePct,
  verdict: resolveVerdict(bias, outcome),
  reason_summary: outcome.status === 'resolved'
    ? `${source === 'ai' ? 'AI' : '我的判断'}偏向 ${bias ?? 'unknown'}，最终结果为 ${outcome.outcome_direction}，${outcome.pnl_r ?? '待补充'}R。`
    : outcome.summary,
})

const bucketDefs = [
  { id: 'bucket_0_40', label: '0-40', min: 0, max: 40 },
  { id: 'bucket_41_60', label: '41-60', min: 41, max: 60 },
  { id: 'bucket_61_75', label: '61-75', min: 61, max: 75 },
  { id: 'bucket_76_90', label: '76-90', min: 76, max: 90 },
  { id: 'bucket_91_100', label: '91-100', min: 91, max: 100 },
]

const scoreJudgment = (verdict: TradeJudgmentSummary['verdict']): number | null =>
  verdict === 'correct' ? 1 : verdict === 'partially-correct' ? 0.5 : verdict === 'incorrect' ? 0 : null

const isNumber = (value: number | null): value is number => value !== null

const averageRatioAsPct = (values: number[]) =>
  values.length > 0 ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) : null

const errorPatternKeywords: Array<{ id: string, label: string, terms: string[] }> = [
  { id: 'stop', label: '止损执行问题', terms: ['止损', 'stop', 'risk'] },
  { id: 'chase', label: '追单冲动', terms: ['追单', 'chase'] },
  { id: 'early_exit', label: '过早离场', terms: ['提前离场', 'early exit'] },
  { id: 'no_confirmation', label: '无确认入场', terms: ['无确认', '确认不足'] },
]

const buildErrorPatterns = (rows: SessionTradeRow[]): PatternInsight[] => {
  const notes = rows.map((row) => row.note_md ?? '').join('\n').toLowerCase()
  const patterns = errorPatternKeywords
    .map((item) => {
      const count = item.terms.reduce((sum, term) => sum + (notes.includes(term.toLowerCase()) ? 1 : 0), 0)
      return {
        id: item.id,
        label: item.label,
        count,
        summary: count > 0 ? `本周期出现 ${count} 次相关信号。` : '当前周期未明显命中该模式。',
      }
    })
    .filter((item) => item.count > 0)

  return patterns.slice(0, 4)
}

const buildEffectiveKnowledge = async(paths: LocalFirstPaths, periodId?: string): Promise<EffectiveKnowledgeInsight[]> => {
  const db = await getDatabase(paths)
  const rows = db.prepare(`
    SELECT
      g.knowledge_card_id,
      COUNT(*) AS hit_count,
      AVG(g.relevance_score) AS avg_relevance,
      MAX(k.title) AS title
    FROM knowledge_groundings g
    LEFT JOIN sessions s ON s.id = g.session_id
    LEFT JOIN knowledge_cards k ON k.id = g.knowledge_card_id
    WHERE (? IS NULL OR s.period_id = ?)
    GROUP BY g.knowledge_card_id
    ORDER BY hit_count DESC, avg_relevance DESC
    LIMIT 6
  `).all(periodId ?? null, periodId ?? null) as Array<{
    knowledge_card_id: string
    hit_count: number
    avg_relevance: number | null
    title: string | null
  }>

  return rows.map((row) => ({
    card_id: row.knowledge_card_id,
    title: row.title ?? row.knowledge_card_id,
    hit_count: row.hit_count,
    quality_score_pct: Math.round((row.avg_relevance ?? 0.6) * 100),
  }))
}

export const getTradeEvaluationSummary = async(paths: LocalFirstPaths, tradeId: string): Promise<TradeEvaluationSummary | null> => {
  const db = await getDatabase(paths)
  const row = loadTradeContextRow(db, tradeId)
  if (!row) {
    return null
  }

  const outcome = resolveOutcome(row)
  const aiJudgment = row.ai_bias ? buildJudgment('ai', row.ai_bias, row.confidence_pct ?? null, outcome) : null
  const humanJudgment = buildJudgment('human', row.market_bias, null, outcome)
  return {
    ai_judgment: aiJudgment,
    human_judgment: humanJudgment,
    outcome,
    plan_adherence_pct: row.score ?? null,
    disagreement_summary: aiJudgment && aiJudgment.bias !== humanJudgment.bias
      ? `AI 偏向 ${aiJudgment.bias}，我的判断偏向 ${humanJudgment.bias}。`
      : null,
  }
}

export const getPeriodEvaluationRollup = async(paths: LocalFirstPaths, periodId?: string): Promise<PeriodEvaluationRollup> => {
  const db = await getDatabase(paths)
  const rows = loadPeriodRows(db, periodId)
  const summaries = rows.map((row) => {
    const outcome = resolveOutcome(row)
    return {
      outcome,
      ai: row.ai_bias ? buildJudgment('ai', row.ai_bias, row.confidence_pct ?? null, outcome) : null,
      human: buildJudgment('human', row.market_bias, null, outcome),
      confidence: row.confidence_pct ?? null,
      score: row.score,
    }
  })

  const calibrationBuckets: CalibrationBucket[] = bucketDefs.map((bucket) => {
    const bucketRows = summaries.filter((item) => item.confidence !== null && item.confidence >= bucket.min && item.confidence <= bucket.max)
    const resolved = bucketRows.filter((item) => item.outcome.status === 'resolved' && item.ai)
    const resolvedScores = resolved
      .map((item) => scoreJudgment(item.ai!.verdict))
      .filter(isNumber)
    const hitRate = resolvedScores.length > 0
      ? Math.round((resolvedScores.reduce((sum, value) => sum + value, 0) / resolvedScores.length) * 100)
      : null
    const avgConfidence = bucketRows.length > 0
      ? Math.round(bucketRows.reduce((sum, item) => sum + (item.confidence ?? 0), 0) / bucketRows.length)
      : Math.round((bucket.min + bucket.max) / 2)

    return {
      id: bucket.id,
      label: bucket.label,
      confidence_min: bucket.min,
      confidence_max: bucket.max,
      sample_count: bucketRows.length,
      resolved_count: resolved.length,
      hit_rate_pct: hitRate,
      avg_confidence_pct: avgConfidence,
      calibration_gap_pct: hitRate === null ? null : avgConfidence - hitRate,
      status: bucketRows.length === 0 ? 'sparse' : resolved.length === 0 ? 'pending' : 'ok',
    }
  })

  const resolvedAi = summaries.filter((item) => item.ai && item.outcome.status === 'resolved')
  const resolvedHuman = summaries.filter((item) => item.outcome.status === 'resolved')
  const aiScore = resolvedAi
    .map((item) => scoreJudgment(item.ai!.verdict))
    .filter(isNumber)
  const humanScore = resolvedHuman
    .map((item) => scoreJudgment(item.human.verdict))
    .filter(isNumber)
  const aiValue = averageRatioAsPct(aiScore)
  const humanValue = averageRatioAsPct(humanScore)
  const avgPlan = averageRatioAsPct(rows.filter((row) => row.score !== null).map((row) => (row.score ?? 0) / 100))
  const aiVsHuman: ComparisonMetric[] = [
    {
      id: 'direction_hit',
      label: '方向判断命中率',
      ai_value_pct: aiValue,
      human_value_pct: humanValue,
      delta_pct: aiValue !== null && humanValue !== null ? aiValue - humanValue : null,
      sample_count: resolvedHuman.length,
    },
    {
      id: 'plan_adherence',
      label: '计划遵守度',
      ai_value_pct: aiValue,
      human_value_pct: avgPlan,
      delta_pct: aiValue !== null && avgPlan !== null ? aiValue - avgPlan : null,
      sample_count: rows.filter((row) => row.score !== null).length,
    },
  ]

  return {
    calibration_buckets: calibrationBuckets,
    ai_vs_human: aiVsHuman,
    error_patterns: buildErrorPatterns(rows),
    effective_knowledge: await buildEffectiveKnowledge(paths, periodId),
    pending_count: summaries.filter((item) => item.outcome.status !== 'resolved').length,
    evaluated_count: summaries.filter((item) => item.outcome.status === 'resolved').length,
  }
}
