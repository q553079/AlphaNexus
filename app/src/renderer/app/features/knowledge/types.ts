import type {
  IngestKnowledgeSourceInput as SharedIngestKnowledgeSourceInput,
  KnowledgeCardPatch,
  KnowledgeCardRecord,
  KnowledgeFragmentRecord,
  KnowledgeReviewDashboardPayload,
  KnowledgeSourceRecord,
  ReviewKnowledgeCardInput as SharedReviewKnowledgeCardInput,
} from '@shared/contracts/knowledge'

export type KnowledgeCardView = KnowledgeCardRecord
export type KnowledgeCardStatus = KnowledgeCardView['status']
export type KnowledgeReviewDashboard = KnowledgeReviewDashboardPayload
export type KnowledgeSourceView = KnowledgeSourceRecord
export type KnowledgeSourceType = SharedIngestKnowledgeSourceInput['source_type']
export type KnowledgeFragmentView = KnowledgeFragmentRecord
export type IngestKnowledgeSourceInput = SharedIngestKnowledgeSourceInput
export type ReviewKnowledgeCardInput = Omit<SharedReviewKnowledgeCardInput, 'reviewed_by'> & {
  reviewed_by?: string
}
export type KnowledgeReviewAction = ReviewKnowledgeCardInput['action']
export type {
  KnowledgeCardPatch,
}
