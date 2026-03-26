import type { TradeDetailInsightItem } from '@shared/contracts/workbench'

type TradeInsightBoardProps = {
  emptyMessage: string
  items: TradeDetailInsightItem[]
}

export const TradeInsightBoard = ({
  emptyMessage,
  items,
}: TradeInsightBoardProps) => {
  if (items.length === 0) {
    return <div className="empty-state">{emptyMessage}</div>
  }

  return (
    <div className="trade-insight-board">
      {items.map((item) => (
        <article className={`trade-insight-board__item is-${item.tone}`.trim()} key={item.id}>
          <div className="trade-insight-board__header">
            <strong>{item.title}</strong>
            <span className={`status-pill is-${item.tone}`.trim()}>{item.tone}</span>
          </div>
          <p>{item.summary}</p>
          {item.evidence.length > 0 ? (
            <div className="trade-insight-board__evidence">
              {item.evidence.map((evidence) => (
                <span className="badge" key={evidence}>{evidence}</span>
              ))}
            </div>
          ) : null}
        </article>
      ))}
    </div>
  )
}
