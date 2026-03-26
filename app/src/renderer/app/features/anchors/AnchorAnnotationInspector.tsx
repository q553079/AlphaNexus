import type { AnnotationInspectorItem } from './types'

type AnchorAnnotationInspectorProps = {
  busy: boolean
  adoptedKeys: Set<string>
  items: AnnotationInspectorItem[]
  onAdopt: (item: AnnotationInspectorItem) => void
}

export const AnchorAnnotationInspector = ({
  busy,
  adoptedKeys,
  items,
  onAdopt,
}: AnchorAnnotationInspectorProps) => {
  if (items.length === 0) {
    return <p className="empty-state">当前截图暂无可采纳标注。</p>
  }

  return (
    <div className="anchor-inspector">
      {items.map((item) => (
        <article className="anchor-inspector__item" key={item.key}>
          <div className="anchor-inspector__meta">
            <span className="badge">{item.label}</span>
            <span className="status-pill">{item.semantic_type}</span>
            <span className="status-pill">{item.annotation.shape}</span>
          </div>
          <div className="anchor-inspector__actions">
            <button
              className="button is-secondary"
              disabled={busy}
              onClick={() => onAdopt(item)}
              type="button"
            >
              {adoptedKeys.has(item.key) ? '重新激活 Anchor' : '采纳为 Anchor'}
            </button>
          </div>
        </article>
      ))}
    </div>
  )
}
