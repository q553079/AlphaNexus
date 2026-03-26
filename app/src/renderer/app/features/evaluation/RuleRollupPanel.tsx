import type { RuleRollupEntry } from '@shared/contracts/evaluation'

type RuleRollupPanelProps = {
  items: RuleRollupEntry[]
}

export const RuleRollupPanel = ({ items }: RuleRollupPanelProps) => {
  if (items.length === 0) {
    return <div className="empty-state">当前没有周期级规则聚合。</div>
  }

  return (
    <div className="compact-list">
      {items.map((item) => (
        <article className="compact-list__item" key={item.id}>
          <strong>{item.label}</strong>
          <p>{item.summary}</p>
          <div className="key-value-grid">
            <div>
              <dt>Matched</dt>
              <dd>{item.match_count}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>{item.total_count}</dd>
            </div>
            <div>
              <dt>Rate</dt>
              <dd>{item.match_rate_pct !== null ? `${item.match_rate_pct}%` : '暂无'}</dd>
            </div>
            <div>
              <dt>Severity</dt>
              <dd>{item.severity}</dd>
            </div>
          </div>
          <div className="action-row">
            {item.evidence.slice(0, 3).map((evidence) => (
              <span className="badge" key={evidence}>{evidence}</span>
            ))}
          </div>
        </article>
      ))}
    </div>
  )
}
