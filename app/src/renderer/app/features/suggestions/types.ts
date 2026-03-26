export type SuggestionState = 'suggested' | 'kept' | 'merged' | 'discarded'

export type AnnotationSuggestionView = {
  id: string
  source_annotation_key?: string
  label: string
  semantic_type: string
  reason_summary: string
  confidence_pct: number
  state: SuggestionState
}

export type AnchorReviewVerdict = 'still_valid' | 'weakened' | 'invalidated'

export type AnchorReviewSuggestionView = {
  id: string
  anchor_id: string
  anchor_title: string
  verdict: AnchorReviewVerdict
  reason_summary: string
  confidence_pct: number
}

export type SimilarCaseView = {
  id: string
  title: string
  summary: string
  relevance_score: number
  contract_symbol: string
  timeframe_label: string
}
