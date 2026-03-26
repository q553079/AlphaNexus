import type { SimilarCaseView } from './types'

type SimilarCasesPanelProps = {
  cases: SimilarCaseView[]
  onSelectCase?: (caseId: string) => void
}

export const SimilarCasesPanel = ({ cases, onSelectCase }: SimilarCasesPanelProps) => {
  if (cases.length === 0) {
    return <p className="empty-state">当前没有可用的相似案例。</p>
  }

  return (
    <div className="similar-cases">
      {cases.map((item) => (
        <article className="similar-cases__item" key={item.id}>
          <div className="similar-cases__meta">
            <strong>{item.title}</strong>
            <span className="status-pill">score {item.relevance_score.toFixed(2)}</span>
          </div>
          <p className="workbench-text">{item.summary}</p>
          <div className="action-row">
            <span className="badge">{item.contract_symbol}</span>
            <span className="status-pill">{item.timeframe_label}</span>
            {onSelectCase ? (
              <button
                className="button is-ghost"
                onClick={() => onSelectCase(item.id)}
                type="button"
              >
                查看摘要
              </button>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  )
}
