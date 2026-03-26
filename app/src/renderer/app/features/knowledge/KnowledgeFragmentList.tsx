import type { KnowledgeFragmentView } from './types'

type KnowledgeFragmentListProps = {
  fragments: KnowledgeFragmentView[]
}

export const KnowledgeFragmentList = ({ fragments }: KnowledgeFragmentListProps) => {
  if (fragments.length === 0) {
    return <p className="empty-state">还没有 fragment。导入 source 后会显示分块结果。</p>
  }

  return (
    <div className="knowledge-shell__list">
      {fragments.map((fragment) => (
        <article className="knowledge-shell__item" key={fragment.id}>
          <div className="knowledge-shell__item-meta">
            <span className="badge">#{fragment.sequence_no}</span>
            <span className="status-pill">source {fragment.source_id}</span>
            {fragment.chapter_label ? <span className="status-pill">{fragment.chapter_label}</span> : null}
            {(fragment.page_from || fragment.page_to) ? (
              <span className="status-pill">p.{fragment.page_from ?? '-'}-{fragment.page_to ?? '-'}</span>
            ) : null}
          </div>
          <p className="workbench-text">{fragment.content_md}</p>
        </article>
      ))}
    </div>
  )
}
