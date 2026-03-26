import type { MarketAnchorStatus, MarketAnchorView } from './types'

type ActiveAnchorsPanelProps = {
  busy: boolean
  anchors: MarketAnchorView[]
  onSetStatus: (anchorId: string, status: MarketAnchorStatus) => void
}

const statusLabel: Record<MarketAnchorStatus, string> = {
  active: 'active',
  invalidated: 'invalidated',
  archived: 'archived',
}

export const ActiveAnchorsPanel = ({
  busy,
  anchors,
  onSetStatus,
}: ActiveAnchorsPanelProps) => {
  if (anchors.length === 0) {
    return <p className="empty-state">还没有 Anchor。先从标注采纳一个关键区域。</p>
  }

  return (
    <div className="anchor-list">
      {anchors.map((anchor) => (
        <article className={`anchor-list__item status-${anchor.status}`.trim()} key={anchor.id}>
          <div className="anchor-list__meta">
            <strong>{anchor.title}</strong>
            <span className="status-pill">{statusLabel[anchor.status]}</span>
          </div>
          <p className="workbench-text">semantic: {anchor.semantic_type ?? 'unknown'}</p>
          <p className="workbench-text">source annotation: {anchor.source_annotation_label}</p>
          {anchor.thesis_md ? <p className="workbench-text">{anchor.thesis_md}</p> : null}
          <div className="action-row">
            <button
              className="button is-secondary"
              disabled={busy || anchor.status === 'active'}
              onClick={() => onSetStatus(anchor.id, 'active')}
              type="button"
            >
              激活
            </button>
            <button
              className="button is-secondary"
              disabled={busy || anchor.status === 'invalidated'}
              onClick={() => onSetStatus(anchor.id, 'invalidated')}
              type="button"
            >
              失效
            </button>
            <button
              className="button is-ghost"
              disabled={busy || anchor.status === 'archived'}
              onClick={() => onSetStatus(anchor.id, 'archived')}
              type="button"
            >
              归档
            </button>
          </div>
        </article>
      ))}
    </div>
  )
}
