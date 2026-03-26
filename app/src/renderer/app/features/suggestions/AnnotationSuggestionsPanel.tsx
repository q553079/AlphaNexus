import type { AnnotationSuggestionView } from './types'

type AnnotationSuggestionsPanelProps = {
  busy: boolean
  suggestions: AnnotationSuggestionView[]
  onDiscard: (suggestionId: string) => void
  onKeep: (suggestionId: string) => void
  onMerge: (suggestionId: string) => void
}

const stateLabel: Record<AnnotationSuggestionView['state'], string> = {
  suggested: 'AI suggestion',
  kept: 'kept',
  merged: 'merged',
  discarded: 'discarded',
}

export const AnnotationSuggestionsPanel = ({
  busy,
  suggestions,
  onDiscard,
  onKeep,
  onMerge,
}: AnnotationSuggestionsPanelProps) => {
  if (suggestions.length === 0) {
    return <p className="empty-state">当前没有 AI 候选标注。</p>
  }

  return (
    <div className="annotation-suggestions">
      {suggestions.map((suggestion) => (
        <article className={`annotation-suggestions__item state-${suggestion.state}`.trim()} key={suggestion.id}>
          <div className="annotation-suggestions__meta">
            <span className="badge">AI</span>
            <strong>{suggestion.label}</strong>
            <span className="status-pill">{suggestion.semantic_type}</span>
            <span className="status-pill">{stateLabel[suggestion.state]}</span>
            <span className="status-pill">conf {suggestion.confidence_pct}%</span>
          </div>
          <p className="workbench-text">{suggestion.reason_summary}</p>
          <div className="action-row">
            <button
              className="button is-secondary"
              disabled={busy || suggestion.state === 'kept'}
              onClick={() => onKeep(suggestion.id)}
              type="button"
            >
              Keep
            </button>
            <button
              className="button is-secondary"
              disabled={busy || suggestion.state === 'merged'}
              onClick={() => onMerge(suggestion.id)}
              type="button"
            >
              Merge
            </button>
            <button
              className="button is-ghost"
              disabled={busy || suggestion.state === 'discarded'}
              onClick={() => onDiscard(suggestion.id)}
              type="button"
            >
              Discard
            </button>
          </div>
        </article>
      ))}
    </div>
  )
}
