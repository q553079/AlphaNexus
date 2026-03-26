import type { KnowledgeCardView, ReviewKnowledgeCardInput } from './types'

type KnowledgeDraftCardsProps = {
  busy: boolean
  cards: KnowledgeCardView[]
  onReviewCard: (input: ReviewKnowledgeCardInput) => Promise<void>
}

const toSuggestedEditPayload = (card: KnowledgeCardView) => ({
  title: card.title,
  summary: card.summary,
  content_md: card.content_md,
  tags: card.tags,
})

export const KnowledgeDraftCards = ({ busy, cards, onReviewCard }: KnowledgeDraftCardsProps) => {
  if (cards.length === 0) {
    return <p className="empty-state">没有 draft cards。导入资料后将在这里等待审核。</p>
  }

  return (
    <div className="knowledge-shell__list">
      {cards.map((card) => (
        <article className="knowledge-shell__item" key={card.id}>
          <div className="knowledge-shell__item-meta">
            <span className="badge">{card.card_type}</span>
            <span className="status-pill">fragment {card.fragment_id}</span>
            <span className="status-pill">status {card.status}</span>
          </div>
          <h3 className="knowledge-shell__item-title">{card.title}</h3>
          <p className="workbench-text">{card.summary}</p>
          <p className="workbench-text">{card.content_md}</p>
          <div className="knowledge-shell__tags">
            {card.tags.map((tag) => <span className="badge" key={tag}>{tag}</span>)}
          </div>
          <div className="action-row">
            <button
              className="button is-primary"
              disabled={busy}
              onClick={() => {
                void onReviewCard({ card_id: card.id, action: 'approve' })
              }}
              type="button"
            >
              Approve
            </button>
            <button
              className="button is-secondary"
              disabled={busy}
              onClick={() => {
                void onReviewCard({
                  card_id: card.id,
                  action: 'edit-approve',
                  edit_payload: toSuggestedEditPayload(card),
                })
              }}
              type="button"
            >
              Edit & Approve
            </button>
            <button
              className="button is-ghost"
              disabled={busy}
              onClick={() => {
                void onReviewCard({ card_id: card.id, action: 'archive' })
              }}
              type="button"
            >
              Archive
            </button>
          </div>
        </article>
      ))}
    </div>
  )
}
