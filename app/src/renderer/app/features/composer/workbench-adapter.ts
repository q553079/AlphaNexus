import type { ApprovedKnowledgeHit, ComposerShellData, ComposerSuggestion, ComposerSuggestionType } from './types'

const defaultShellData: ComposerShellData = {
  active_anchor_labels: [],
  suggestions: [],
  approved_knowledge_hits: [],
}

const toStringArray = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

const toSuggestionType = (value: unknown): ComposerSuggestionType => {
  if (value === 'template') {
    return 'template'
  }
  if (value === 'completion') {
    return 'completion'
  }
  return 'phrase'
}

const toSuggestionSource = (value: unknown): ComposerSuggestion['source'] => {
  if (value === 'knowledge' || value === 'rule' || value === 'ai' || value === 'history') {
    return value
  }
  return undefined
}

const toComposerSuggestion = (value: unknown): ComposerSuggestion | null => {
  if (!value || typeof value !== 'object') {
    return null
  }
  const raw = value as {
    id?: unknown
    type?: unknown
    label?: unknown
    text?: unknown
    source?: unknown
    rationale?: unknown
    ranking_reason?: unknown
    ranking_reasons?: unknown
  }
  const id = typeof raw.id === 'string' ? raw.id.trim() : ''
  const label = typeof raw.label === 'string' ? raw.label.trim() : ''
  const text = typeof raw.text === 'string' ? raw.text.trim() : ''
  if (!id || !label || !text) {
    return null
  }

  return {
    id,
    type: toSuggestionType(raw.type),
    label,
    text,
    source: toSuggestionSource(raw.source),
    rationale: typeof raw.rationale === 'string' ? raw.rationale : undefined,
    ranking_reasons: typeof raw.ranking_reason === 'string'
      ? [raw.ranking_reason]
      : toStringArray(raw.ranking_reasons),
  }
}

const toApprovedKnowledgeHits = (value: unknown): ApprovedKnowledgeHit[] => {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null
      }
      const raw = item as {
        card_id?: unknown
        title?: unknown
        summary?: unknown
        relevance_score?: unknown
      }
      const cardId = typeof raw.card_id === 'string' ? raw.card_id : ''
      const title = typeof raw.title === 'string' ? raw.title : ''
      const summary = typeof raw.summary === 'string' ? raw.summary : ''
      if (!cardId || !title || !summary) {
        return null
      }
      return {
        card_id: cardId,
        title,
        summary,
        relevance_score: typeof raw.relevance_score === 'number' ? raw.relevance_score : undefined,
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
}

export const readComposerShellFromSessionPayload = (payload: unknown): ComposerShellData => {
  if (!payload || typeof payload !== 'object') {
    return defaultShellData
  }

  const rawShell = (payload as { composer_shell?: unknown }).composer_shell
  if (!rawShell || typeof rawShell !== 'object') {
    return defaultShellData
  }

  const maybeShell = rawShell as {
    active_anchor_labels?: unknown
    suggestions?: unknown
    approved_knowledge_hits?: unknown
    context_summary?: unknown
  }

  return {
    active_anchor_labels: toStringArray(maybeShell.active_anchor_labels),
    suggestions: Array.isArray(maybeShell.suggestions)
      ? maybeShell.suggestions
        .map(toComposerSuggestion)
        .filter((item): item is ComposerSuggestion => item !== null)
      : [],
    approved_knowledge_hits: toApprovedKnowledgeHits(maybeShell.approved_knowledge_hits),
    context_summary: typeof maybeShell.context_summary === 'string' ? maybeShell.context_summary : undefined,
  }
}
