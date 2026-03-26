import type { TrainingInsight } from '@shared/contracts/evaluation'

type TrainingInsightListProps = {
  insights: TrainingInsight[]
}

export const TrainingInsightList = ({ insights }: TrainingInsightListProps) => {
  if (insights.length === 0) {
    return <div className="empty-state">当前没有训练建议。</div>
  }

  return (
    <div className="compact-list">
      {insights.map((insight) => (
        <article className="compact-list__item" key={insight.id}>
          <strong>{insight.title}</strong>
          <p>{insight.summary}</p>
          <div className="action-row">
            <span className="status-pill">{insight.priority}</span>
            {insight.evidence.slice(0, 3).map((evidence) => (
              <span className="badge" key={evidence}>{evidence}</span>
            ))}
          </div>
        </article>
      ))}
    </div>
  )
}
