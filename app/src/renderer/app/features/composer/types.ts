export type ComposerSuggestionType = 'phrase' | 'template' | 'completion'

export type ComposerSuggestion = {
  id: string
  type: ComposerSuggestionType
  label: string
  text: string
  source?: 'system-template' | 'knowledge' | 'rule' | 'ai' | 'history'
  rationale?: string
  ranking_reason?: string
  confidence_pct?: number
  knowledge_card_id?: string | null
}

export type ApprovedKnowledgeHit = {
  card_id: string
  title: string
  summary: string
  relevance_score?: number
  fragment_excerpt?: string
  match_reasons?: string[]
}

export type ComposerShellData = {
  active_anchor_labels: string[]
  suggestions: ComposerSuggestion[]
  approved_knowledge_hits: ApprovedKnowledgeHit[]
  context_summary?: string
}
