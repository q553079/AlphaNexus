import type { RankingExplanationPayload } from '@shared/contracts/evaluation'

type RankingExplanationPanelProps = {
  payload: RankingExplanationPayload
}

export const RankingExplanationPanel = ({ payload }: RankingExplanationPanelProps) => {
  if (payload.explanations.length === 0) {
    return <div className="empty-state">当前没有排序解释。</div>
  }

  return (
    <div className="compact-list">
      {payload.explanations.map((item) => (
        <article className="compact-list__item" key={item.id}>
          <strong>{item.target_kind}</strong>
          <p>{item.reason_summary}</p>
          <div className="action-row">
            {item.factors.map((factor) => (
              <span className="badge" key={factor}>{factor}</span>
            ))}
          </div>
        </article>
      ))}
    </div>
  )
}
