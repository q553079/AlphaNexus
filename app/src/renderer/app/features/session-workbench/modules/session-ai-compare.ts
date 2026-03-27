import type { AnalysisCardRecord, AiRunRecord } from '@shared/contracts/analysis'
import type { EventRecord } from '@shared/contracts/event'
import type { SessionWorkbenchPayload } from '@shared/contracts/workbench'

export type AiComparisonRecord = {
  ai_run: AiRunRecord
  analysis_card: AnalysisCardRecord
  event: EventRecord
}

export type AiComparisonViewModel = {
  consensus_points: string[]
  divergence_points: string[]
  records: AiComparisonRecord[]
}

const normalize = (value: string) => value.trim().toLowerCase()

const buildSupportingFactorConsensus = (records: AiComparisonRecord[]) => {
  if (records.length < 2) {
    return []
  }

  const [first, ...rest] = records
  const shared = first.analysis_card.supporting_factors.filter((factor) =>
    rest.every((record) =>
      record.analysis_card.supporting_factors.some((candidate) => normalize(candidate) === normalize(factor))))

  return shared.slice(0, 3).map((factor) => `共同支撑：${factor}`)
}

export const buildAiComparisonViewModel = (
  payload: SessionWorkbenchPayload,
  input: {
    screenshot_id?: string | null
    trade_id?: string | null
  },
): AiComparisonViewModel => {
  const eventByAiRunId = new Map(
    payload.events
      .filter((event) => event.ai_run_id)
      .map((event) => [event.ai_run_id as string, event]),
  )

  const records = payload.ai_runs
    .map((aiRun) => {
      const analysisCard = payload.analysis_cards.find((card) => card.ai_run_id === aiRun.id)
      const event = eventByAiRunId.get(aiRun.id)
      if (!analysisCard || !event || aiRun.prompt_kind !== 'market-analysis') {
        return null
      }

      if (input.screenshot_id && event.screenshot_id !== input.screenshot_id) {
        return null
      }

      if (input.trade_id && event.trade_id !== input.trade_id) {
        return null
      }

      return {
        ai_run: aiRun,
        analysis_card: analysisCard,
        event,
      }
    })
    .filter((record): record is AiComparisonRecord => record != null)
    .sort((left, right) => new Date(right.ai_run.created_at).getTime() - new Date(left.ai_run.created_at).getTime())

  const latestByProvider = new Map<string, AiComparisonRecord>()
  records.forEach((record) => {
    if (!latestByProvider.has(record.ai_run.provider)) {
      latestByProvider.set(record.ai_run.provider, record)
    }
  })

  const latestRecords = [...latestByProvider.values()]
    .sort((left, right) => left.ai_run.provider.localeCompare(right.ai_run.provider))
  const consensusPoints: string[] = []
  const divergencePoints: string[] = []

  const uniqueBiases = [...new Set(latestRecords.map((record) => record.analysis_card.bias))]
  if (uniqueBiases.length === 1 && latestRecords.length > 1) {
    consensusPoints.push(`共同偏向：${uniqueBiases[0]}`)
  } else if (uniqueBiases.length > 1) {
    divergencePoints.push(`偏向分歧：${uniqueBiases.join(' / ')}`)
  }

  const entryZones = [...new Set(latestRecords.map((record) => record.analysis_card.entry_zone))]
  if (entryZones.length === 1 && latestRecords.length > 1) {
    consensusPoints.push(`共同入场区：${entryZones[0]}`)
  } else if (entryZones.length > 1) {
    divergencePoints.push('入场区判断不一致，需要人工二次核对。')
  }

  const confidenceValues = latestRecords.map((record) => record.analysis_card.confidence_pct)
  if (confidenceValues.length > 1) {
    const confidenceSpread = Math.max(...confidenceValues) - Math.min(...confidenceValues)
    if (confidenceSpread >= 20) {
      divergencePoints.push(`置信度跨度 ${confidenceSpread}% ，说明模型把握差异较大。`)
    }
  }

  consensusPoints.push(...buildSupportingFactorConsensus(latestRecords))

  return {
    consensus_points: consensusPoints,
    divergence_points: divergencePoints,
    records: latestRecords,
  }
}
