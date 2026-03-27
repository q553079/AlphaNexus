import type { KnowledgeCardView } from './types'

type KnowledgeApprovedCardsProps = {
  cards: KnowledgeCardView[]
}

export const KnowledgeApprovedCards = ({ cards }: KnowledgeApprovedCardsProps) => {
  if (cards.length === 0) {
    return <p className="empty-state">当前没有 approved cards。</p>
  }

  return (
    <div className="knowledge-shell__list">
      {cards.map((card) => (
        <article className="knowledge-shell__item" key={card.id}>
          <div className="knowledge-shell__item-meta">
            <span className="badge">{card.card_type}</span>
            <span className="status-pill">approved</span>
            <span className="status-pill">{card.updated_at ? new Date(card.updated_at).toLocaleString() : 'recently updated'}</span>
          </div>
          <h3 className="knowledge-shell__item-title">{card.title}</h3>
          <p className="workbench-text">{card.summary}</p>
          <p className="workbench-text">{card.content_md}</p>
          <div className="knowledge-shell__tags">
            {card.contract_scope.map((scope) => <span className="badge" key={`contract-${card.id}-${scope}`}>{scope}</span>)}
            {card.timeframe_scope.map((scope) => <span className="badge" key={`timeframe-${card.id}-${scope}`}>{scope}</span>)}
            {card.tags.map((tag) => <span className="badge" key={tag}>{tag}</span>)}
          </div>
        </article>
      ))}
    </div>
  )
}
