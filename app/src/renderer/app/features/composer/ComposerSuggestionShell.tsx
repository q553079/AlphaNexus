import type { ApprovedKnowledgeHit, ComposerSuggestion } from './types'

type ComposerSuggestionShellProps = {
  activeAnchorLabels: string[]
  approvedKnowledgeHits: ApprovedKnowledgeHit[]
  suggestions: ComposerSuggestion[]
  textareaValue: string
  contextSummary?: string
  onSuggestionAccept: (suggestion: ComposerSuggestion) => void
  onTextareaChange: (value: string) => void
}

const appendSuggestion = (existing: string, next: string) => {
  const trimmedExisting = existing.trimEnd()
  if (!trimmedExisting) {
    return next
  }
  return `${trimmedExisting}\n${next}`
}

const sourceLabel = (source: ComposerSuggestion['source']) => {
  if (source === 'system-template') {
    return 'system-template'
  }
  if (source === 'knowledge') {
    return 'knowledge'
  }
  if (source === 'rule') {
    return 'rule'
  }
  if (source === 'history') {
    return 'history'
  }
  if (source === 'ai') {
    return 'ai'
  }
  return 'local'
}

const suggestionLabel = (suggestion: ComposerSuggestion) => {
  if (suggestion.type === 'template') {
    return `模板：${suggestion.label}`
  }
  if (suggestion.type === 'completion') {
    return `续写：${suggestion.label}`
  }
  return suggestion.label
}

export const ComposerSuggestionShell = ({
  activeAnchorLabels,
  approvedKnowledgeHits,
  suggestions,
  textareaValue,
  contextSummary,
  onSuggestionAccept,
  onTextareaChange,
}: ComposerSuggestionShellProps) => {
  const phraseSuggestions = suggestions.filter((item) => item.type === 'phrase')
  const templateSuggestions = suggestions.filter((item) => item.type === 'template')
  const completionSuggestions = suggestions.filter((item) => item.type === 'completion').slice(0, 6)
  const rankingReasons = suggestions
    .map((item) => item.ranking_reason)
    .filter((reason): reason is string => Boolean(reason))
    .slice(0, 2)
  const hasQuickSuggestions = phraseSuggestions.length > 0 || templateSuggestions.length > 0 || completionSuggestions.length > 0
  const hasKnowledgeHits = approvedKnowledgeHits.length > 0

  return (
    <section className="composer-shell">
      {activeAnchorLabels.length > 0 ? (
        <div className="composer-shell__anchors">
          {activeAnchorLabels.map((label) => <span className="status-pill" key={label}>{label}</span>)}
        </div>
      ) : null}
      {contextSummary && rankingReasons.length === 0 ? <p className="composer-shell__summary">{contextSummary}</p> : null}

      {hasQuickSuggestions ? (
        <div className="composer-shell__group">
          <p className="composer-shell__group-title">可直接插入</p>
          <div className="composer-shell__chips">
            {phraseSuggestions.map((suggestion) => (
            <button
              className={`composer-shell__chip source-${sourceLabel(suggestion.source)}`.trim()}
              key={suggestion.id}
              onClick={() => {
                onSuggestionAccept(suggestion)
                onTextareaChange(appendSuggestion(textareaValue, suggestion.text))
              }}
              type="button"
            >
              {suggestionLabel(suggestion)}
            </button>
            ))}
            {templateSuggestions.map((suggestion) => (
              <button
                className={`composer-shell__chip is-template source-${sourceLabel(suggestion.source)}`.trim()}
                key={suggestion.id}
                onClick={() => {
                  onSuggestionAccept(suggestion)
                  onTextareaChange(appendSuggestion(textareaValue, suggestion.text))
                }}
                type="button"
              >
                {suggestionLabel(suggestion)}
              </button>
            ))}
            {completionSuggestions.map((suggestion) => (
              <button
                className={`composer-shell__chip is-completion source-${sourceLabel(suggestion.source)}`.trim()}
                key={suggestion.id}
                onClick={() => {
                  onSuggestionAccept(suggestion)
                  onTextareaChange(appendSuggestion(textareaValue, suggestion.text))
                }}
                type="button"
              >
                {suggestionLabel(suggestion)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {rankingReasons.length > 0 ? (
        <details className="composer-shell__details">
          <summary className="composer-shell__details-summary">
            <span>建议来源</span>
            <span className="status-pill">{rankingReasons.length}</span>
          </summary>
          <div className="composer-shell__reasons">
            {rankingReasons.map((reason) => (
              <span className="status-pill" key={reason}>{reason}</span>
            ))}
          </div>
        </details>
      ) : null}

      {hasKnowledgeHits ? (
        <details className="composer-shell__details">
          <summary className="composer-shell__details-summary">
            <span>命中的已确认知识</span>
            <span className="status-pill">{approvedKnowledgeHits.length}</span>
          </summary>
        {approvedKnowledgeHits.length > 0 ? (
          <div className="composer-shell__hits">
            {approvedKnowledgeHits.map((hit) => (
              <article className="composer-shell__hit" key={hit.card_id}>
                <h4>{hit.title}</h4>
                <p>{hit.summary}</p>
                <div className="action-row">
                  <span className="badge">已确认</span>
                  {typeof hit.relevance_score === 'number' ? (
                    <span className="status-pill">相关度 {hit.relevance_score.toFixed(2)}</span>
                  ) : null}
                  {hit.match_reasons?.[0] ? (
                    <span className="status-pill">{hit.match_reasons[0]}</span>
                  ) : null}
                </div>
                {hit.fragment_excerpt ? <p>{hit.fragment_excerpt}</p> : null}
              </article>
            ))}
          </div>
        ) : null}
        </details>
      ) : null}
    </section>
  )
}
