export type ComposerSuggestionType = 'phrase' | 'template' | 'completion'

export type ComposerSuggestion = {
  id: string
  type: ComposerSuggestionType
  label: string
  text: string
  source?: 'knowledge' | 'rule' | 'ai' | 'history'
  rationale?: string
  ranking_reasons?: string[]
}

export type ApprovedKnowledgeHit = {
  card_id: string
  title: string
  summary: string
  relevance_score?: number
}

export type ComposerShellData = {
  active_anchor_labels: string[]
  suggestions: ComposerSuggestion[]
  approved_knowledge_hits: ApprovedKnowledgeHit[]
  context_summary?: string
}
