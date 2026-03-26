import { alphaNexusApi } from '@app/bootstrap/api'
import type { GroundingHitView } from '@app/features/grounding'
import type { MarketAnchorView } from '@app/features/anchors'
import type { SessionWorkbenchPayload } from '@shared/contracts/workbench'
import type { GetActiveMarketAnchorsInput, GetKnowledgeGroundingsInput } from '@shared/contracts/knowledge'
import { toGroundingHitView, toMarketAnchorView } from './session-workbench-mappers'

export const loadSessionWorkbenchAnchors = async(
  sessionPayload: SessionWorkbenchPayload,
): Promise<MarketAnchorView[]> => {
  const input: NonNullable<GetActiveMarketAnchorsInput> = {
    contract_id: sessionPayload.contract.id,
    session_id: sessionPayload.session.id,
    limit: 12,
  }
  const currentTradeId = sessionPayload.current_context.trade_id
  if (currentTradeId) {
    input.trade_id = currentTradeId
  }

  const result = await alphaNexusApi.workbench.getActiveAnchors(input)
  return result.anchors.map(toMarketAnchorView)
}

export const loadSessionWorkbenchGroundings = async(
  sessionPayload: SessionWorkbenchPayload,
  aiRunId?: string | null,
): Promise<GroundingHitView[]> => {
  const input: NonNullable<GetKnowledgeGroundingsInput> = {
    session_id: sessionPayload.session.id,
    limit: 12,
  }
  if (aiRunId) {
    input.ai_run_id = aiRunId
  }

  const result = await alphaNexusApi.workbench.getGroundings(input)
  return result.hits.map(toGroundingHitView)
}
