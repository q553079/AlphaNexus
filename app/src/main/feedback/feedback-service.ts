import type { LocalFirstPaths } from '@main/app-shell/paths'
import { getDatabase } from '@main/db/connection'
import { loadTradeDetail } from '@main/db/repositories/workbench-repository'
import { getPeriodEvaluationRollup, getTradeEvaluationSummary } from '@main/evaluation/evaluation-service'
import { buildPeriodRollupBundle } from '@main/period/period-rollup-service'
import { getTradeRuleHits } from '@main/rules/rules-service'
import {
  type DisciplineScore,
  type FeedbackItem,
  type PeriodEvaluationRollup,
  type RuleHit,
  type SetupLeaderboardEntry,
  type TradeEvaluationSummary,
} from '@shared/contracts/evaluation'
import type { PeriodRollup, PeriodTradeMetric } from '@shared/contracts/period-review'
import type { TradeDetailPayload } from '@shared/contracts/workbench'

const average = (values: number[]) => values.length > 0
  ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2))
  : null

const formatPct = (value: number | null | undefined) => value === null || value === undefined ? '待补充' : `${value}%`

const formatR = (value: number | null | undefined) => value === null || value === undefined ? '待补充' : `${value}R`

const loadPeriodEvidenceLabel = (
  db: Awaited<ReturnType<typeof getDatabase>>,
  periodId?: string,
) => {
  if (!periodId) {
    return '当前样本池'
  }

  const row = db.prepare('SELECT label FROM periods WHERE id = ? LIMIT 1').get(periodId) as { label: string } | undefined

  return row?.label ?? periodId ?? '当前周期'
}

const buildSetupLeaderboardFromTradeMetrics = (
  tradeMetrics: PeriodTradeMetric[],
): SetupLeaderboardEntry[] => {
  const setupMap = new Map<string, PeriodTradeMetric[]>()
  for (const metric of tradeMetrics) {
    const setupTag = metric.tags.find((tag) => tag.category === 'setup')?.label ?? 'untagged'
    const list = setupMap.get(setupTag) ?? []
    list.push(metric)
    setupMap.set(setupTag, list)
  }

  return [...setupMap.entries()]
    .map(([label, items]) => {
      const pnlValues = items.map((item) => item.pnl_r).filter((item): item is number => item !== null)
      return {
        id: `setup_${label}`,
        label,
        sample_count: items.length,
        win_rate_pct: pnlValues.length > 0
          ? Math.round((pnlValues.filter((item) => item > 0).length / pnlValues.length) * 100)
          : null,
        avg_r: average(pnlValues),
        discipline_avg_pct: average(items.map((item) => item.plan_adherence_score).filter((item): item is number => item !== null)),
        ai_alignment_pct: average(items.map((item) => item.ai_alignment_score).filter((item): item is number => item !== null)),
      }
    })
    .sort((left, right) => {
      if (right.sample_count !== left.sample_count) {
        return right.sample_count - left.sample_count
      }

      const rightAvgR = right.avg_r ?? Number.NEGATIVE_INFINITY
      const leftAvgR = left.avg_r ?? Number.NEGATIVE_INFINITY
      if (rightAvgR !== leftAvgR) {
        return rightAvgR - leftAvgR
      }

      const rightWinRate = right.win_rate_pct ?? Number.NEGATIVE_INFINITY
      const leftWinRate = left.win_rate_pct ?? Number.NEGATIVE_INFINITY
      if (rightWinRate !== leftWinRate) {
        return rightWinRate - leftWinRate
      }

      return left.label.localeCompare(right.label)
    })
    .slice(0, 6)
}

export const getTradeFeedbackBundle = async(
  paths: LocalFirstPaths,
  tradeId: string,
  input?: {
    detail?: TradeDetailPayload
    summary?: TradeEvaluationSummary | null
    rule_hits?: RuleHit[]
  },
) => {
  const db = await getDatabase(paths)
  const [summary, ruleHits] = await Promise.all([
    input?.summary !== undefined ? Promise.resolve(input.summary) : getTradeEvaluationSummary(paths, tradeId),
    input?.rule_hits !== undefined ? Promise.resolve(input.rule_hits) : getTradeRuleHits(paths, tradeId),
  ])
  const detail = input?.detail ?? loadTradeDetail(db, tradeId)

  return buildTradeFeedbackBundle({
    detail,
    summary,
    rule_hits: ruleHits,
  })
}

export const buildTradeFeedbackBundle = (input: {
  detail: TradeDetailPayload
  summary: TradeEvaluationSummary | null
  rule_hits: RuleHit[]
}) => {
  const { detail, summary, rule_hits: ruleHits } = input

  const evidence = [
    detail.trade.thesis || '无明确 thesis。',
    detail.evaluation?.note_md ?? '无人工评估记录。',
  ]
  const feedbackItems: FeedbackItem[] = []
  if (summary?.human_judgment?.verdict === 'incorrect') {
    feedbackItems.push({
      id: `feedback_trade_${detail.trade.id}_setup`,
      type: 'setup-selection',
      title: '重新校验 setup 选择',
      summary: 'Human judgment 与最终 outcome 偏离，下一次先等确认再入场。',
      priority: 'high',
      evidence,
    })
  }
  if ((detail.trade.pnl_r ?? 0) < 0) {
    feedbackItems.push({
      id: `feedback_trade_${detail.trade.id}_risk`,
      type: 'risk',
      title: '优先收紧风险边界',
      summary: '本笔结果为负，建议复核止损与失效条件是否提前写清。',
      priority: 'medium',
      evidence,
    })
  }
  if (feedbackItems.length === 0) {
    feedbackItems.push({
      id: `feedback_trade_${detail.trade.id}_execution`,
      type: 'execution',
      title: '维持当前执行节奏',
      summary: '这笔交易没有明显额外纪律告警，保持结构化记录。',
      priority: 'low',
      evidence,
    })
  }

  const disciplineDimensions = [
    {
      id: 'plan-respect',
      label: '按计划执行',
      score_pct: detail.evaluation?.score ?? 72,
      summary: '基于 trade evaluation score 作为计划遵守度代理值。',
      evidence,
    },
    {
      id: 'risk-boundary',
      label: '风险边界',
      score_pct: (detail.trade.pnl_r ?? 0) < 0 ? 58 : 78,
      summary: '结合 pnl_r 与 stop / target 结构给出轻量 discipline 打分。',
      evidence: [
        `pnl_r=${detail.trade.pnl_r ?? 'pending'}`,
        `stop_loss=${detail.trade.stop_loss}`,
        `take_profit=${detail.trade.take_profit}`,
      ],
    },
  ]

  const disciplineScore: DisciplineScore = {
    overall_pct: Math.round(disciplineDimensions.reduce((sum, item) => sum + item.score_pct, 0) / disciplineDimensions.length),
    summary: '当前纪律分基于计划遵守度与风险边界两条透明规则计算。',
    dimensions: disciplineDimensions,
  }

  return {
    feedback_items: feedbackItems,
    discipline_score: disciplineScore,
    rule_hits: ruleHits,
  }
}

export const getPeriodFeedbackBundle = async(
  paths: LocalFirstPaths,
  periodId?: string,
  input?: {
    evaluation_rollup?: PeriodEvaluationRollup
    period_rollup?: PeriodRollup
    trade_metrics?: PeriodTradeMetric[]
  },
) => {
  const db = await getDatabase(paths)
  const periodLabel = loadPeriodEvidenceLabel(db, periodId)
  const rollup = input?.evaluation_rollup ?? await getPeriodEvaluationRollup(paths, periodId)
  const tradeMetrics = input?.trade_metrics
    ?? (await buildPeriodRollupBundle(paths, {
      period_id: periodId,
      latest_period_review: null,
    })).trade_metrics
  const setupLeaderboard = buildSetupLeaderboardFromTradeMetrics(tradeMetrics)

  const hasPeriodEvidence = tradeMetrics.length > 0
    || rollup.evaluated_count > 0
    || rollup.pending_count > 0
    || rollup.error_patterns.length > 0

  if (!hasPeriodEvidence) {
    return {
      feedback_items: [],
      setup_leaderboard: [],
    }
  }

  const feedbackItems: FeedbackItem[] = rollup.error_patterns.slice(0, 2).map((pattern, index) => ({
    id: `period_feedback_pattern_${index + 1}`,
    type: 'discipline',
    title: pattern.label,
    summary: pattern.summary,
    priority: index === 0 ? 'high' : 'medium',
    evidence: [pattern.label, `count=${pattern.count}`],
  }))

  const strongestSetup = setupLeaderboard[0] ?? null
  if (strongestSetup) {
    feedbackItems.push({
      id: 'period_feedback_strongest_setup',
      type: 'setup-selection',
      title: `继续优先 ${strongestSetup.label}`,
      summary: `当前最稳定的 setup 是 ${strongestSetup.label}，样本 ${strongestSetup.sample_count}，胜率 ${formatPct(strongestSetup.win_rate_pct)}，avg R ${formatR(strongestSetup.avg_r)}。`,
      priority: (strongestSetup.avg_r ?? 0) > 0 ? 'low' : 'medium',
      evidence: [
        `sample_count=${strongestSetup.sample_count}`,
        `win_rate=${formatPct(strongestSetup.win_rate_pct)}`,
        `avg_r=${formatR(strongestSetup.avg_r)}`,
      ],
    })
  }

  if (rollup.pending_count > 0) {
    feedbackItems.push({
      id: 'period_feedback_pending_review',
      type: 'execution',
      title: '补齐待闭环样本',
      summary: `当前仍有 ${rollup.pending_count} 笔 trade 尚未闭环或待验证，周期复盘前先补齐这些样本，避免结论被幸存记录带偏。`,
      priority: 'medium',
      evidence: [
        periodLabel,
        `pending_count=${rollup.pending_count}`,
      ],
    })
  }

  const aiDirectionMetric = rollup.ai_vs_human.find((metric) => metric.id === 'direction_hit') ?? null
  if (aiDirectionMetric && aiDirectionMetric.delta_pct !== null && Math.abs(aiDirectionMetric.delta_pct) >= 15) {
    feedbackItems.push({
      id: 'period_feedback_ai_alignment',
      type: 'anchor-usage',
      title: '重新校准 AI 协同方式',
      summary: aiDirectionMetric.delta_pct > 0
        ? `AI 方向命中率领先人工 ${aiDirectionMetric.delta_pct}% ，可以回头梳理哪些 AI 信号值得保留成固定检查项。`
        : `人工判断当前领先 AI ${Math.abs(aiDirectionMetric.delta_pct)}% ，需要复核哪些 AI 提示词或 target 上下文还不够稳定。`,
      priority: Math.abs(aiDirectionMetric.delta_pct) >= 25 ? 'high' : 'medium',
      evidence: [
        `ai=${formatPct(aiDirectionMetric.ai_value_pct)}`,
        `human=${formatPct(aiDirectionMetric.human_value_pct)}`,
        `delta=${aiDirectionMetric.delta_pct}%`,
      ],
    })
  }

  if (feedbackItems.length === 0) {
    feedbackItems.push({
      id: 'period_feedback_default',
      type: 'execution',
      title: '保持轻量复盘节奏',
      summary: '当前周期没有突出的纪律错误模式，继续沿用结构化复盘。',
      priority: 'low',
      evidence: [periodLabel],
    })
  }

  return {
    feedback_items: feedbackItems,
    setup_leaderboard: setupLeaderboard,
  }
}
