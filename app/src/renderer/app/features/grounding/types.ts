export type GroundingHitView = {
  id?: string
  card_id: string
  title: string
  summary: string
  card_type?: string
  relevance_score?: number
  match_reasons?: string[]
  ai_run_id?: string | null
  annotation_id?: string | null
  anchor_id?: string | null
}
