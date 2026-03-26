import { startTransition, useEffect, useState } from 'react'
import {
  canUseKnowledgeApi,
  fetchKnowledgeReviewDashboard,
  ingestKnowledgeSource,
  reviewKnowledgeCard,
} from './api-adapter'
import type {
  IngestKnowledgeSourceInput,
  KnowledgeReviewDashboard,
  ReviewKnowledgeCardInput,
} from './types'

const createEmptyDashboard = (): KnowledgeReviewDashboard => ({
  sources: [],
  fragments: [],
  draft_cards: [],
  approved_cards: [],
})

export type KnowledgeReviewShellState = {
  apiAvailable: boolean
  busy: boolean
  dashboard: KnowledgeReviewDashboard
  errorMessage: string | null
  infoMessage: string | null
  ingestSource: (input: IngestKnowledgeSourceInput) => Promise<void>
  refresh: () => Promise<void>
  reviewCard: (input: ReviewKnowledgeCardInput) => Promise<void>
}

export const useKnowledgeReviewShell = (): KnowledgeReviewShellState => {
  const [dashboard, setDashboard] = useState<KnowledgeReviewDashboard>(createEmptyDashboard())
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)
  const apiAvailable = canUseKnowledgeApi()

  const refresh = async() => {
    if (!apiAvailable) {
      setInfoMessage('Knowledge API 尚未接入。当前页面展示 UI 壳。')
      setDashboard(createEmptyDashboard())
      return
    }

    try {
      setBusy(true)
      setErrorMessage(null)
      const payload = await fetchKnowledgeReviewDashboard()
      setDashboard(payload)
      setInfoMessage(null)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '加载 Knowledge Review 失败。')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    startTransition(() => {
      void refresh()
    })
  }, [])

  const handleIngest = async(input: IngestKnowledgeSourceInput) => {
    if (!apiAvailable) {
      setInfoMessage('Knowledge API 尚未接入。')
      return
    }

    try {
      setBusy(true)
      setErrorMessage(null)
      const payload = await ingestKnowledgeSource(input)
      setDashboard(payload)
      setInfoMessage(`已导入资料：${input.title}`)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '导入失败。')
    } finally {
      setBusy(false)
    }
  }

  const handleReviewCard = async(input: ReviewKnowledgeCardInput) => {
    if (!apiAvailable) {
      setInfoMessage('Knowledge API 尚未接入。')
      return
    }

    try {
      setBusy(true)
      setErrorMessage(null)
      const payload = await reviewKnowledgeCard(input)
      setDashboard(payload)
      setInfoMessage(`已执行审核动作：${input.action}`)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '审核失败。')
    } finally {
      setBusy(false)
    }
  }

  return {
    apiAvailable,
    busy,
    dashboard,
    errorMessage,
    infoMessage,
    ingestSource: handleIngest,
    refresh,
    reviewCard: handleReviewCard,
  }
}
