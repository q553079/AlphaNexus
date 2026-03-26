import type { FeedbackItem } from '@shared/contracts/evaluation'

type FeedbackListProps = {
  items: FeedbackItem[]
  emptyMessage?: string
}

export const FeedbackList = ({
  items,
  emptyMessage = '当前没有反馈建议。',
}: FeedbackListProps) => {
  if (items.length === 0) {
    return <div className="empty-state">{emptyMessage}</div>
  }

  return (
    <div className="compact-list">
      {items.map((item) => (
        <article className="compact-list__item" key={item.id}>
          <strong>{item.title}</strong>
          <p>{item.summary}</p>
          <div className="action-row">
            <span className="status-pill">{item.type}</span>
            <span className="status-pill">{item.priority}</span>
            {item.evidence.slice(0, 3).map((evidence) => (
              <span className="badge" key={evidence}>{evidence}</span>
            ))}
          </div>
        </article>
      ))}
    </div>
  )
}
