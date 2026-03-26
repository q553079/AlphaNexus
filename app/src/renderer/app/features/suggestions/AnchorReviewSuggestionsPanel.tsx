import type { AnchorReviewSuggestionView } from './types'

type AnchorReviewSuggestionsPanelProps = {
  suggestions: AnchorReviewSuggestionView[]
}

const verdictLabel: Record<AnchorReviewSuggestionView['verdict'], string> = {
  still_valid: 'still valid',
  weakened: 'weakened',
  invalidated: 'invalidated',
}

export const AnchorReviewSuggestionsPanel = ({ suggestions }: AnchorReviewSuggestionsPanelProps) => {
  if (suggestions.length === 0) {
    return <p className="empty-state">当前没有 anchor review 建议。</p>
  }

  return (
    <div className="anchor-review-list">
      {suggestions.map((suggestion) => (
        <article className={`anchor-review-list__item verdict-${suggestion.verdict}`.trim()} key={suggestion.id}>
          <div className="anchor-review-list__meta">
            <strong>{suggestion.anchor_title}</strong>
            <span className="status-pill">{verdictLabel[suggestion.verdict]}</span>
            <span className="status-pill">conf {suggestion.confidence_pct}%</span>
          </div>
          <p className="workbench-text">{suggestion.reason_summary}</p>
        </article>
      ))}
    </div>
  )
}
