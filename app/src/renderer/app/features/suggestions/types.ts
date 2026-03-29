export type SuggestionState = 'suggested' | 'kept' | 'merged' | 'discarded'

export type AnnotationSuggestionView = {
  id: string
  source_annotation_key?: string
  label: string
  title?: string
  semantic_type: string
  shape:
    | 'rectangle'
    | 'ellipse'
    | 'line'
    | 'arrow'
    | 'text'
    | 'brush'
    | 'fib_retracement'
  color: string
  x1: number
  y1: number
  x2: number
  y2: number
  text?: string | null
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
