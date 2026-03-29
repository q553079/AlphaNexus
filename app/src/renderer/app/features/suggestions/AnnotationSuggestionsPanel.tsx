import { translateAnnotationSemantic } from '@app/ui/display-text'
import type { AnnotationSuggestionView } from './types'

type AnnotationSuggestionsPanelProps = {
  busy: boolean
  suggestions: AnnotationSuggestionView[]
  onDiscard: (suggestionId: string) => void
  onKeep: (suggestionId: string) => void
  onMerge: (suggestionId: string) => void
}

const stateLabel: Record<AnnotationSuggestionView['state'], string> = {
  suggested: 'AI 建议',
  kept: '已保留',
  merged: '已合并',
  discarded: '已丢弃',
}

const isGenericReason = (value: string) => value.trim() === '基于当前 session 事件与现有标注生成候选层建议。'

export const AnnotationSuggestionsPanel = ({
  busy,
  suggestions,
  onDiscard,
  onKeep,
  onMerge,
}: AnnotationSuggestionsPanelProps) => {
  if (suggestions.length === 0) {
    return null
  }

  return (
    <details className="annotation-suggestions">
      <summary className="annotation-suggestions__head">
        <div>
          <strong>AI 候选已经上图</strong>
          <p>平时直接看图。只有要保留、合并或丢弃时，再展开这里。</p>
        </div>
        <span className="badge">{suggestions.length} 个候选</span>
      </summary>
      <div className="annotation-suggestions__body">
        {suggestions.map((suggestion) => (
          <article className={`annotation-suggestions__item state-${suggestion.state}`.trim()} key={suggestion.id}>
            <div className="annotation-suggestions__meta">
              <strong>{suggestion.label}</strong>
              <span className="status-pill">{translateAnnotationSemantic(suggestion.semantic_type)}</span>
              <span className="status-pill">{stateLabel[suggestion.state]}</span>
            </div>
            {suggestion.reason_summary && !isGenericReason(suggestion.reason_summary) ? (
              <p className="annotation-suggestions__reason">{suggestion.reason_summary}</p>
            ) : null}
            <div className="action-row">
              <button
                className="button is-secondary"
                disabled={busy || suggestion.state === 'kept'}
                onClick={() => onKeep(suggestion.id)}
                type="button"
              >
                保留
              </button>
              <button
                className="button is-secondary"
                disabled={busy || suggestion.state === 'merged'}
                onClick={() => onMerge(suggestion.id)}
                type="button"
              >
                合并
              </button>
              <button
                className="button is-ghost"
                disabled={busy || suggestion.state === 'discarded'}
                onClick={() => onDiscard(suggestion.id)}
                type="button"
              >
                丢弃
              </button>
            </div>
          </article>
        ))}
      </div>
    </details>
  )
}
