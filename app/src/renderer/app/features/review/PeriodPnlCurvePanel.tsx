import type { PeriodReviewPayload } from '@shared/contracts/workbench'

type PeriodPnlCurvePanelProps = {
  points: PeriodReviewPayload['period_rollup']['pnl_curve']
}

const buildPath = (points: PeriodPnlCurvePanelProps['points']) => {
  if (points.length === 0) {
    return ''
  }

  const width = 320
  const height = 140
  const values = points.map((point) => point.cumulative_pnl_r)
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 0)
  const span = Math.max(max - min, 1)

  return points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width
    const y = height - ((point.cumulative_pnl_r - min) / span) * height
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
  }).join(' ')
}

export const PeriodPnlCurvePanel = ({ points }: PeriodPnlCurvePanelProps) => {
  if (points.length === 0) {
    return <div className="empty-state">当前周期还没有可绘制的离场盈亏曲线。</div>
  }

  const latest = points[points.length - 1]

  return (
    <div className="period-curve">
      <div className="action-row">
        <span className="status-pill">样本 {points.length}</span>
        <span className="status-pill">最新累计 {latest.cumulative_pnl_r}R</span>
      </div>
      <svg aria-label="盈亏曲线" className="period-curve__svg" viewBox="0 0 320 140">
        <line className="period-curve__baseline" x1="0" x2="320" y1="70" y2="70" />
        <path className="period-curve__path" d={buildPath(points)} fill="none" />
      </svg>
      <div className="period-curve__footer">
        <span>首笔 {points[0].point_at}</span>
        <span>末笔 {latest.point_at}</span>
      </div>
    </div>
  )
}
