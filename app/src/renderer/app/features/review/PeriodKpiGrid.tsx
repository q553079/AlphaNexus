import type { PeriodReviewPayload } from '@shared/contracts/workbench'

type PeriodKpiGridProps = {
  rollup: PeriodReviewPayload['period_rollup']
}

const formatValue = (value: number | null | undefined, suffix = '') =>
  value === null || value === undefined ? '待补充' : `${value}${suffix}`

export const PeriodKpiGrid = ({ rollup }: PeriodKpiGridProps) => {
  const items = [
    { id: 'trade_count', label: '交易数', value: String(rollup.stats.trade_count) },
    { id: 'net_pnl', label: '净 R', value: formatValue(rollup.stats.total_pnl_r, 'R') },
    { id: 'win_rate', label: '胜率', value: formatValue(rollup.stats.win_rate_pct, '%') },
    { id: 'avg_r', label: '平均 R', value: formatValue(rollup.stats.avg_pnl_r, 'R') },
    { id: 'plan', label: '计划遵守度', value: formatValue(rollup.stats.plan_adherence_avg_pct, '%') },
    { id: 'ai_align', label: 'AI 一致度', value: formatValue(rollup.stats.ai_alignment_avg_pct, '%') },
  ]

  return (
    <div className="period-kpi-grid">
      {items.map((item) => (
        <article className="period-kpi-card" key={item.id}>
          <span className="period-kpi-card__label">{item.label}</span>
          <strong className="period-kpi-card__value">{item.value}</strong>
        </article>
      ))}
    </div>
  )
}
