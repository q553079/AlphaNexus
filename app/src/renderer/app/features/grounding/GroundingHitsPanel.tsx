import type { GroundingHitView } from './types'

type GroundingHitsPanelProps = {
  hits: GroundingHitView[]
}

export const GroundingHitsPanel = ({ hits }: GroundingHitsPanelProps) => {
  if (hits.length === 0) {
    return <p className="empty-state">当前 AI run 还没有 grounding 命中。</p>
  }

  return (
    <div className="grounding-list">
      {hits.slice(0, 6).map((hit, index) => (
        <article className="grounding-list__item" key={hit.id ?? `${hit.card_id}_${index + 1}`}>
          <div className="grounding-list__meta">
            <strong>{hit.title}</strong>
            {typeof hit.relevance_score === 'number' ? (
              <span className="status-pill">score {hit.relevance_score.toFixed(2)}</span>
            ) : null}
          </div>
          <p className="workbench-text">{hit.summary}</p>
          {hit.anchor_id ? <span className="badge">anchor {hit.anchor_id}</span> : null}
          {hit.match_reasons && hit.match_reasons.length > 0 ? (
            <ul className="grounding-list__reasons">
              {hit.match_reasons.slice(0, 3).map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
          ) : null}
        </article>
      ))}
    </div>
  )
}
