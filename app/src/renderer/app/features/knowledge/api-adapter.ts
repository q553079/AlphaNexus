import type {
  IngestKnowledgeSourceInput,
  KnowledgeReviewDashboard,
  ReviewKnowledgeCardInput,
} from './types'

type KnowledgeApiShape = {
  getReviewDashboard?: () => Promise<KnowledgeReviewDashboard>
  ingestSource?: (input: IngestKnowledgeSourceInput) => Promise<KnowledgeReviewDashboard>
  reviewCard?: (input: ReviewKnowledgeCardInput) => Promise<KnowledgeReviewDashboard>
}

const getKnowledgeApi = (): KnowledgeApiShape | null => {
  const candidate = (window as Window & { alphaNexus?: { knowledge?: KnowledgeApiShape } }).alphaNexus
  return candidate?.knowledge ?? null
}

export const canUseKnowledgeApi = () => {
  const api = getKnowledgeApi()
  return Boolean(api?.getReviewDashboard && api?.ingestSource && api?.reviewCard)
}

export const fetchKnowledgeReviewDashboard = async() => {
  const api = getKnowledgeApi()
  if (!api?.getReviewDashboard) {
    throw new Error('Knowledge API is not available.')
  }

  return api.getReviewDashboard()
}

export const ingestKnowledgeSource = async(input: IngestKnowledgeSourceInput) => {
  const api = getKnowledgeApi()
  if (!api?.ingestSource) {
    throw new Error('Knowledge API is not available.')
  }

  return api.ingestSource(input)
}

export const reviewKnowledgeCard = async(input: ReviewKnowledgeCardInput) => {
  const api = getKnowledgeApi()
  if (!api?.reviewCard) {
    throw new Error('Knowledge API is not available.')
  }

  return api.reviewCard(input)
}
