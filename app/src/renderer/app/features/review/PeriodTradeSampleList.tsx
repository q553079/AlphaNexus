import { Link } from 'react-router-dom'
import { translateTradeMetricResultLabel } from '@app/ui/display-text'
import type { PeriodReviewPayload } from '@shared/contracts/workbench'

type PeriodTradeSampleListProps = {
  metrics: PeriodReviewPayload['trade_metrics']
}

const formatPct = (value: number | null | undefined) => value === null || value === undefined ? '待补充' : `${value}%`
const formatR = (value: number | null | undefined) => value === null || value === undefined ? '待补充' : `${value}R`

export const PeriodTradeSampleList = ({ metrics }: PeriodTradeSampleListProps) => {
  if (metrics.length === 0) {
    return <div className="empty-state">当前没有可展示的交易样本。</div>
  }

  return (
    <div className="compact-list">
      {metrics.map((metric) => (
        <article className="compact-list__item" key={metric.trade_id}>
          <div className="action-row">
            <Link className="button is-secondary" to={`/trades/${metric.trade_id}`}>查看交易</Link>
            <Link className="button is-secondary" to={`/sessions/${metric.session_id}`}>查看工作过程</Link>
            <span className="status-pill">{translateTradeMetricResultLabel(metric.result_label)}</span>
            <span className="status-pill">{formatR(metric.pnl_r)}</span>
          </div>
          <strong>{metric.session_title}</strong>
          <p>{metric.thesis_excerpt}</p>
          <div className="action-row">
            <span className="badge">计划遵守度 {formatPct(metric.plan_adherence_score)}</span>
            <span className="badge">AI 一致度 {formatPct(metric.ai_alignment_score)}</span>
            {metric.tags.slice(0, 3).map((tag) => (
              <span className="badge" key={`${metric.trade_id}_${tag.id}`}>{tag.label}</span>
            ))}
          </div>
        </article>
      ))}
    </div>
  )
}
