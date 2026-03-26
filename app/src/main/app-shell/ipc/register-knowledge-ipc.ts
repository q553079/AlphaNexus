import { ipcMain } from 'electron'
import { adoptMarketAnchor, buildActiveAnchorRuntimeSummary, getApprovedKnowledgeRuntime, updatePersistedMarketAnchorStatus } from '@main/domain/knowledge-service'
import {
  AdoptMarketAnchorInputSchema,
  GetActiveMarketAnchorsInputSchema,
  GetApprovedKnowledgeRuntimeInputSchema,
  GetKnowledgeGroundingsInputSchema,
  GetKnowledgeReviewDashboardInputSchema,
  IngestKnowledgeSourceInputSchema,
  ReviewKnowledgeCardInputSchema,
  UpdateMarketAnchorStatusInputSchema,
} from '@shared/contracts/knowledge'
import type { AppContext } from './shared'
import {
  ingestReviewedKnowledgeSource,
  resolveKnowledgeGroundings,
  reviewKnowledgeCard,
  toMarketAnchorMutationResult,
  toPublicActiveAnchorsPayload,
  toPublicDashboard,
  toPublicRuntimePayload,
} from './shared'

export const registerKnowledgeIpc = ({ paths }: AppContext) => {
  ipcMain.handle('knowledge:get-review-dashboard', async(_event, input) => {
    const parsed = GetKnowledgeReviewDashboardInputSchema.parse(input)
    return toPublicDashboard(paths, parsed ?? undefined)
  })

  ipcMain.handle('knowledge:ingest-source', async(_event, input) => {
    const parsed = IngestKnowledgeSourceInputSchema.parse(input)
    await ingestReviewedKnowledgeSource(paths, parsed)
    return toPublicDashboard(paths)
  })

  ipcMain.handle('knowledge:review-card', async(_event, input) => {
    const parsed = ReviewKnowledgeCardInputSchema.parse(input)
    await reviewKnowledgeCard(paths, parsed)
    return toPublicDashboard(paths)
  })

  ipcMain.handle('knowledge:get-approved-runtime', async(_event, input) => {
    const parsed = GetApprovedKnowledgeRuntimeInputSchema.parse(input)
    const runtime = await getApprovedKnowledgeRuntime(paths, parsed ? {
      contract_scope: parsed.contract_scope ?? null,
      timeframe_scope: parsed.timeframe_scope ?? null,
      tags: parsed.tags,
      annotation_semantic: parsed.annotation_semantic ?? null,
      trade_state: parsed.trade_state ?? null,
      context_tags: parsed.context_tags,
      limit: parsed.limit,
    } : undefined)
    return toPublicRuntimePayload(runtime)
  })

  ipcMain.handle('knowledge:get-active-anchors', async(_event, input) => {
    const parsed = GetActiveMarketAnchorsInputSchema.parse(input)
    return toPublicActiveAnchorsPayload(await buildActiveAnchorRuntimeSummary(paths, {
      contract_id: parsed?.contract_id ?? null,
      session_id: parsed?.session_id ?? null,
      trade_id: parsed?.trade_id ?? null,
      status: parsed?.status ?? 'active',
      limit: parsed?.limit ?? 12,
    }))
  })

  ipcMain.handle('knowledge:adopt-anchor', async(_event, input) => {
    const parsed = AdoptMarketAnchorInputSchema.parse(input)
    return toMarketAnchorMutationResult(await adoptMarketAnchor(paths, parsed))
  })

  ipcMain.handle('knowledge:update-anchor-status', async(_event, input) => {
    const parsed = UpdateMarketAnchorStatusInputSchema.parse(input)
    return toMarketAnchorMutationResult(await updatePersistedMarketAnchorStatus(paths, parsed))
  })

  ipcMain.handle('knowledge:get-groundings', async(_event, input) => {
    const parsed = GetKnowledgeGroundingsInputSchema.parse(input)
    return resolveKnowledgeGroundings(paths, {
      session_id: parsed?.session_id,
      ai_run_id: parsed?.ai_run_id,
      anchor_id: parsed?.anchor_id,
      limit: parsed?.limit,
    })
  })
}
