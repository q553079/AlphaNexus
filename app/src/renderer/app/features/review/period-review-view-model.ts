import type { PeriodReviewPayload } from '@shared/contracts/workbench'

export const buildPeriodReviewViewModel = (payload: PeriodReviewPayload) => {
  const metricById = new Map(payload.trade_metrics.map((metric) => [metric.trade_id, metric]))
  const bestTrades = payload.period_rollup.best_trade_ids
    .map((id) => metricById.get(id))
    .filter((metric): metric is NonNullable<typeof metric> => metric != null)
  const worstTrades = payload.period_rollup.worst_trade_ids
    .map((id) => metricById.get(id))
    .filter((metric): metric is NonNullable<typeof metric> => metric != null)
  const mistakeTags = payload.period_rollup.tag_summary.filter((tag) => tag.category === 'mistake').slice(0, 6)
  const highlightCards = payload.highlight_cards.slice(0, 3)
  const hasMeaningfulData = payload.sessions.length > 0
    || payload.trade_metrics.length > 0
    || payload.highlight_cards.length > 0
    || payload.feedback_items.length > 0
    || payload.rule_rollup.length > 0
    || payload.setup_leaderboard.length > 0
    || payload.training_insights.length > 0

  return {
    bestTrades,
    worstTrades,
    mistakeTags,
    highlightCards,
    hasMeaningfulData,
  }
}
