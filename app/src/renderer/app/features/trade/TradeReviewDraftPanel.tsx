import type { ContentBlockRecord } from '@shared/contracts/content'

type TradeReviewDraftPanelProps = {
  blocks: ContentBlockRecord[]
  draftBlock: ContentBlockRecord | null
}

export const TradeReviewDraftPanel = ({
  blocks,
  draftBlock,
}: TradeReviewDraftPanelProps) => {
  if (blocks.length === 0) {
    return <div className="empty-state">关闭交易或保存 Exit 图后，会在这里自动生成复盘草稿。</div>
  }

  return (
    <div className="trade-review-draft">
      <div className="trade-review-draft__intro">
        <span className="badge badge-closed">事后复盘</span>
        <p>这里保留原始 review block 和自动草稿；它们与盘中原始记录分开展示，不会互相覆盖。</p>
      </div>

      <div className="trade-review-draft__list">
        {blocks.map((block) => (
          <article
            className={`trade-review-draft__item ${block.id === draftBlock?.id ? 'is-draft' : ''}`.trim()}
            key={block.id}
          >
            <div className="trade-review-draft__meta">
              <strong>{block.title}</strong>
              <span className="metric-pill">{block.id === draftBlock?.id ? 'Auto draft' : 'Review block'}</span>
            </div>
            <div className="trade-review-draft__body workbench-text">{block.content_md}</div>
          </article>
        ))}
      </div>
    </div>
  )
}
