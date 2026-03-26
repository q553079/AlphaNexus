import type { ApprovedKnowledgeHit, ComposerSuggestion } from './types'

type ComposerSuggestionShellProps = {
  activeAnchorLabels: string[]
  approvedKnowledgeHits: ApprovedKnowledgeHit[]
  suggestions: ComposerSuggestion[]
  textareaValue: string
  contextSummary?: string
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

const normalizeCompletion = (value: string) => value.replace(/\s+/g, ' ').trim()

const deriveCompletionSuggestions = (textareaValue: string): ComposerSuggestion[] => {
  const seed = normalizeCompletion(textareaValue)
  if (!seed) {
    return []
  }
  const prefix = seed.length > 72 ? `${seed.slice(0, 72)}...` : seed
  return [
    {
      id: `completion_local_1_${prefix.length}`,
      type: 'completion',
      label: '补全：触发确认',
      text: `${prefix}\n触发确认：等待回踩后买盘重新吸收。`,
      source: 'rule',
      rationale: '保持记录结构化，补全触发确认句。',
      ranking_reasons: ['与当前句子前缀最匹配', '历史执行类模板优先'],
    },
    {
      id: `completion_local_2_${prefix.length}`,
      type: 'completion',
      label: '补全：失效条件',
      text: `${prefix}\n失效条件：跌回关键区域下方并反抽失败。`,
      source: 'knowledge',
      rationale: '强调失效条件，避免只写方向不写边界。',
      ranking_reasons: ['风险控制优先', '与 active anchor 语义对齐'],
    },
  ]
}

const suggestionLabel = (suggestion: ComposerSuggestion) => {
  if (suggestion.type === 'template') {
    return `模板 · ${suggestion.label}`
  }
  if (suggestion.type === 'completion') {
    return `补全 · ${suggestion.label}`
  }
  return suggestion.label
}

export const ComposerSuggestionShell = ({
  activeAnchorLabels,
  approvedKnowledgeHits,
  suggestions,
  textareaValue,
  contextSummary,
  onTextareaChange,
}: ComposerSuggestionShellProps) => {
  const phraseSuggestions = suggestions.filter((item) => item.type === 'phrase')
  const templateSuggestions = suggestions.filter((item) => item.type === 'template')
  const completionSuggestions = [
    ...suggestions.filter((item) => item.type === 'completion'),
    ...deriveCompletionSuggestions(textareaValue),
  ].slice(0, 6)

  return (
    <section className="composer-shell">
      <header className="composer-shell__header">
        <p className="composer-shell__title">Context-Aware Composer</p>
        <div className="composer-shell__anchors">
          {activeAnchorLabels.length > 0 ? (
            activeAnchorLabels.map((label) => <span className="status-pill" key={label}>{label}</span>)
          ) : (
            <span className="status-pill">暂无 active anchors</span>
          )}
        </div>
        {contextSummary ? <p className="composer-shell__summary">{contextSummary}</p> : null}
      </header>

      <div className="composer-shell__group">
        <p className="composer-shell__group-title">Phrase Suggestions</p>
        <div className="composer-shell__chips">
          {phraseSuggestions.length > 0 ? phraseSuggestions.map((suggestion) => (
            <button
              className={`composer-shell__chip source-${sourceLabel(suggestion.source)}`.trim()}
              key={suggestion.id}
              onClick={() => onTextareaChange(appendSuggestion(textareaValue, suggestion.text))}
              type="button"
            >
              {suggestionLabel(suggestion)}
            </button>
          )) : <span className="composer-shell__empty">暂无候选短语</span>}
        </div>
      </div>

      <div className="composer-shell__group">
        <p className="composer-shell__group-title">Template Suggestions</p>
        <div className="composer-shell__chips">
          {templateSuggestions.length > 0 ? templateSuggestions.map((suggestion) => (
            <button
              className={`composer-shell__chip is-template source-${sourceLabel(suggestion.source)}`.trim()}
              key={suggestion.id}
              onClick={() => onTextareaChange(appendSuggestion(textareaValue, suggestion.text))}
              type="button"
            >
              {suggestionLabel(suggestion)}
            </button>
          )) : <span className="composer-shell__empty">暂无模板建议</span>}
        </div>
      </div>

      <div className="composer-shell__group">
        <p className="composer-shell__group-title">Completion Suggestions</p>
        <div className="composer-shell__chips">
          {completionSuggestions.length > 0 ? completionSuggestions.map((suggestion) => (
            <button
              className={`composer-shell__chip is-completion source-${sourceLabel(suggestion.source)}`.trim()}
              key={suggestion.id}
              onClick={() => onTextareaChange(appendSuggestion(textareaValue, suggestion.text))}
              type="button"
            >
              {suggestionLabel(suggestion)}
            </button>
          )) : <span className="composer-shell__empty">输入几句后会出现补全建议</span>}
        </div>
      </div>

      <label className="field">
        <span>Realtime Note</span>
        <textarea
          className="inline-input composer-shell__textarea"
          onChange={(event) => onTextareaChange(event.target.value)}
          placeholder="建议只会追加到当前文本，不会覆盖已有内容。"
          rows={8}
          value={textareaValue}
        />
      </label>

      <div className="composer-shell__group">
        <p className="composer-shell__group-title">Ranking Reasons</p>
        <div className="composer-shell__reasons">
          {suggestions.flatMap((item) => item.ranking_reasons ?? []).slice(0, 4).map((reason) => (
            <span className="status-pill" key={reason}>{reason}</span>
          ))}
          {suggestions.every((item) => !item.ranking_reasons || item.ranking_reasons.length === 0) ? (
            <span className="composer-shell__empty">当前使用默认排序：相关度 {'>'} 采纳率 {'>'} 最近命中。</span>
          ) : null}
        </div>
      </div>

      <div className="composer-shell__group">
        <p className="composer-shell__group-title">Approved Knowledge Hits</p>
        {approvedKnowledgeHits.length > 0 ? (
          <div className="composer-shell__hits">
            {approvedKnowledgeHits.map((hit) => (
              <article className="composer-shell__hit" key={hit.card_id}>
                <h4>{hit.title}</h4>
                <p>{hit.summary}</p>
                <div className="action-row">
                  <span className="badge">approved</span>
                  {typeof hit.relevance_score === 'number' ? (
                    <span className="status-pill">score {hit.relevance_score.toFixed(2)}</span>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="composer-shell__empty">暂无命中的 approved knowledge。</p>
        )}
      </div>
    </section>
  )
}
