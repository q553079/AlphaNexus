import type { LocalFirstPaths } from '@main/app-shell/paths'
import { getDatabase } from '@main/db/connection'
import {
  completeKnowledgeImportJob,
  createKnowledgeImportJob,
  createKnowledgeSource,
  failKnowledgeImportJob,
  getKnowledgeCardById,
  insertDraftKnowledgeCards,
  insertKnowledgeGroundings,
  insertKnowledgeFragments,
  listApprovedKnowledgeCards,
  listDraftKnowledgeCards,
  listKnowledgeGroundingsByAiRun,
  listKnowledgeFragmentsBySource,
  listKnowledgeImportJobs,
  listKnowledgeSources,
  listRecentAnchorGroundings,
  markKnowledgeImportJobProcessing,
  reviewKnowledgeCard,
  type ApprovedCardFilters,
  type ReviewKnowledgeCardInput,
} from '@main/db/repositories/knowledge-repository'
import type { KnowledgeCardRecord, KnowledgeGroundingRecord } from '@main/knowledge/pipeline'

export const insertKnowledgeSource = async(
  paths: LocalFirstPaths,
  input: Parameters<typeof createKnowledgeSource>[1],
) => {
  const db = await getDatabase(paths)
  return createKnowledgeSource(db, input)
}

export const insertKnowledgeImportJob = async(
  paths: LocalFirstPaths,
  input: Parameters<typeof createKnowledgeImportJob>[1],
) => {
  const db = await getDatabase(paths)
  return createKnowledgeImportJob(db, input)
}

export const markKnowledgeImportJobCompleted = async(
  paths: LocalFirstPaths,
  input: Parameters<typeof completeKnowledgeImportJob>[1],
) => {
  const db = await getDatabase(paths)
  completeKnowledgeImportJob(db, input)
}

export const markKnowledgeImportJobInProgress = async(
  paths: LocalFirstPaths,
  input: Parameters<typeof markKnowledgeImportJobProcessing>[1],
) => {
  const db = await getDatabase(paths)
  markKnowledgeImportJobProcessing(db, input)
}

export const markKnowledgeImportJobFailed = async(
  paths: LocalFirstPaths,
  input: Parameters<typeof failKnowledgeImportJob>[1],
) => {
  const db = await getDatabase(paths)
  failKnowledgeImportJob(db, input)
}

export const insertKnowledgeFragmentsBatch = async(
  paths: LocalFirstPaths,
  input: Parameters<typeof insertKnowledgeFragments>[1],
) => {
  const db = await getDatabase(paths)
  return insertKnowledgeFragments(db, input)
}

export const insertKnowledgeDraftCardsBatch = async(
  paths: LocalFirstPaths,
  input: Parameters<typeof insertDraftKnowledgeCards>[1],
) => {
  const db = await getDatabase(paths)
  return insertDraftKnowledgeCards(db, input)
}

export const insertKnowledgeGroundingsBatch = async(
  paths: LocalFirstPaths,
  input: Parameters<typeof insertKnowledgeGroundings>[1],
) => {
  const db = await getDatabase(paths)
  return insertKnowledgeGroundings(db, input)
}

export const listKnowledgeDraftCards = async(paths: LocalFirstPaths, limit?: number) => {
  const db = await getDatabase(paths)
  return listDraftKnowledgeCards(db, limit)
}

export const updateKnowledgeCardReview = async(paths: LocalFirstPaths, input: ReviewKnowledgeCardInput): Promise<KnowledgeCardRecord> => {
  const db = await getDatabase(paths)
  return reviewKnowledgeCard(db, input)
}

export const listKnowledgeApprovedCards = async(paths: LocalFirstPaths, filters?: ApprovedCardFilters) => {
  const db = await getDatabase(paths)
  return listApprovedKnowledgeCards(db, filters)
}

export const listKnowledgeGroundingsForAiRun = async(paths: LocalFirstPaths, aiRunId: string): Promise<KnowledgeGroundingRecord[]> => {
  const db = await getDatabase(paths)
  return listKnowledgeGroundingsByAiRun(db, aiRunId)
}

export const listKnowledgeAnchorGroundings = async(paths: LocalFirstPaths, limit?: number): Promise<KnowledgeGroundingRecord[]> => {
  const db = await getDatabase(paths)
  return listRecentAnchorGroundings(db, limit)
}

export const loadKnowledgeCard = async(paths: LocalFirstPaths, cardId: string) => {
  const db = await getDatabase(paths)
  return getKnowledgeCardById(db, cardId)
}

export const listKnowledgeAllSources = async(paths: LocalFirstPaths) => {
  const db = await getDatabase(paths)
  return listKnowledgeSources(db)
}

export const listKnowledgeAllImportJobs = async(paths: LocalFirstPaths) => {
  const db = await getDatabase(paths)
  return listKnowledgeImportJobs(db)
}

export const listKnowledgeFragmentsForSource = async(paths: LocalFirstPaths, sourceId: string) => {
  const db = await getDatabase(paths)
  return listKnowledgeFragmentsBySource(db, sourceId)
}
