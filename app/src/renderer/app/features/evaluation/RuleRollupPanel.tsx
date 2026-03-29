import { translateRuleSeverity } from '@app/ui/display-text'
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
              <dt>命中数</dt>
              <dd>{item.match_count}</dd>
            </div>
            <div>
              <dt>总数</dt>
              <dd>{item.total_count}</dd>
            </div>
            <div>
              <dt>命中率</dt>
              <dd>{item.match_rate_pct !== null ? `${item.match_rate_pct}%` : '暂无'}</dd>
            </div>
            <div>
              <dt>严重度</dt>
              <dd>{translateRuleSeverity(item.severity)}</dd>
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
