import type { DraftAnnotation } from '@app/features/annotation/annotation-types'

export type MarketAnchorStatus = 'active' | 'invalidated' | 'archived'

export type MarketAnchorView = {
  id: string
  title: string
  semantic_type: string | null
  status: MarketAnchorStatus
  source_annotation_id?: string | null
  source_annotation_label: string
  source_annotation_key: string
  thesis_md?: string
  invalidation_rule_md?: string
  created_at?: string
  updated_at?: string
}

export type AnnotationInspectorItem = {
  key: string
  label: string
  semantic_type: string
  annotation: DraftAnnotation
}
