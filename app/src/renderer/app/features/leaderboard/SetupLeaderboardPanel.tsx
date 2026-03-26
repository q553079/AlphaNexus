import type { SetupLeaderboardEntry } from '@shared/contracts/evaluation'

type SetupLeaderboardPanelProps = {
  entries: SetupLeaderboardEntry[]
}

export const SetupLeaderboardPanel = ({ entries }: SetupLeaderboardPanelProps) => {
  if (entries.length === 0) {
    return <div className="empty-state">当前没有 setup leaderboard 数据。</div>
  }

  return (
    <div className="compact-list">
      {entries.map((entry) => (
        <article className="compact-list__item" key={entry.id}>
          <strong>{entry.label}</strong>
          <div className="key-value-grid">
            <div>
              <dt>Samples</dt>
              <dd>{entry.sample_count}</dd>
            </div>
            <div>
              <dt>Win Rate</dt>
              <dd>{entry.win_rate_pct !== null ? `${entry.win_rate_pct}%` : '暂无'}</dd>
            </div>
            <div>
              <dt>Avg R</dt>
              <dd>{entry.avg_r !== null ? entry.avg_r : '暂无'}</dd>
            </div>
            <div>
              <dt>Discipline</dt>
              <dd>{entry.discipline_avg_pct !== null ? `${entry.discipline_avg_pct}%` : '暂无'}</dd>
            </div>
          </div>
          <div className="action-row">
            <span className="status-pill">
              AI alignment {entry.ai_alignment_pct !== null ? `${entry.ai_alignment_pct}%` : '暂无'}
            </span>
          </div>
        </article>
      ))}
    </div>
  )
}
