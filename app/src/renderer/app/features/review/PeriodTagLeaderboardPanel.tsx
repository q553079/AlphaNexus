import { translatePeriodTagCategory, translatePeriodTagSource } from '@app/ui/display-text'
import type { PeriodReviewPayload } from '@shared/contracts/workbench'

type PeriodTagLeaderboardPanelProps = {
  items: PeriodReviewPayload['period_rollup']['tag_summary']
}

export const PeriodTagLeaderboardPanel = ({ items }: PeriodTagLeaderboardPanelProps) => {
  if (items.length === 0) {
    return <div className="empty-state">当前周期还没有结构化标签汇总。</div>
  }

  return (
    <div className="compact-list">
      {items.map((item) => (
        <article className="compact-list__item" key={item.id}>
          <strong>{item.label}</strong>
          <div className="action-row">
            <span className="status-pill">{translatePeriodTagCategory(item.category)}</span>
            <span className="status-pill">{translatePeriodTagSource(item.source)}</span>
            <span className="status-pill">命中 {item.count}</span>
            <span className="status-pill">样本 {item.trade_ids.length}</span>
          </div>
        </article>
      ))}
    </div>
  )
}
