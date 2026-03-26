export type KnowledgeSourceType = 'book' | 'article' | 'course-note' | 'user-note' | 'review-derived'

export type KnowledgeCardStatus = 'draft' | 'approved' | 'archived'

export type KnowledgeReviewAction = 'approve' | 'edit-approve' | 'archive'

export type KnowledgeSourceView = {
  id: string
  source_type: KnowledgeSourceType
  title: string
  author: string | null
  created_at: string
}

export type KnowledgeFragmentView = {
  id: string
  source_id: string
  sequence_no: number
  chapter_label: string | null
  page_from: number | null
  page_to: number | null
  content_md: string
}

export type KnowledgeCardView = {
  id: string
  source_id: string
  fragment_id: string
  card_type: string
  title: string
  summary: string
  content_md: string
  tags: string[]
  status: KnowledgeCardStatus
  updated_at: string
}

export type KnowledgeReviewDashboard = {
  sources: KnowledgeSourceView[]
  fragments: KnowledgeFragmentView[]
  draft_cards: KnowledgeCardView[]
  approved_cards: KnowledgeCardView[]
}

export type IngestKnowledgeSourceInput = {
  source_type: KnowledgeSourceType
  title: string
  author?: string
  content: string
}

export type ReviewKnowledgeCardInput = {
  card_id: string
  action: KnowledgeReviewAction
  edit_payload?: {
    title?: string
    summary?: string
    content_md?: string
    tags?: string[]
  }
}
