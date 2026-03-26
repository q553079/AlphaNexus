import type { Dispatch, SetStateAction } from 'react'
import { alphaNexusApi } from '@app/bootstrap/api'
import type { ContentBlockRecord } from '@shared/contracts/content'
import type {
  CurrentTargetOption,
  CurrentTargetOptionsPayload,
  SessionWorkbenchPayload,
} from '@shared/contracts/workbench'

type SessionWorkbenchTargetActionDeps = {
  payload: SessionWorkbenchPayload | null
  refreshSession: (nextSessionId?: string) => Promise<SessionWorkbenchPayload | null>
  setBusy: Dispatch<SetStateAction<boolean>>
  setMessage: Dispatch<SetStateAction<string | null>>
}

export const loadSessionWorkbenchMoveTargetOptions = async(sessionId: string): Promise<CurrentTargetOptionsPayload> =>
  alphaNexusApi.workbench.listTargetOptions({
    session_id: sessionId,
    include_period_targets: true,
  })

export const createSessionWorkbenchTargetActions = ({
  payload,
  refreshSession,
  setBusy,
  setMessage,
}: SessionWorkbenchTargetActionDeps) => {
  const handleSetCurrentTarget = async(option: CurrentTargetOption) => {
    if (!payload) {
      return
    }

    try {
      setBusy(true)
      await alphaNexusApi.workbench.setCurrentContext({
        session_id: payload.session.id,
        contract_id: payload.contract.id,
        period_id: payload.period.id,
        trade_id: option.target_kind === 'trade' ? option.trade_id ?? null : null,
        source_view: 'session-workbench',
        capture_kind: payload.current_context.capture_kind,
      })
      await refreshSession(payload.session.id)
      setMessage(option.target_kind === 'trade'
        ? `已切换到 ${option.label}。`
        : '已切换到当前 Session 目标。')
    } catch (error) {
      setMessage(error instanceof Error ? `切换目标失败：${error.message}` : '切换当前目标失败。')
    } finally {
      setBusy(false)
    }
  }

  const handleMoveContentBlock = async(block: ContentBlockRecord, option: CurrentTargetOption) => {
    if (!payload) {
      return
    }

    try {
      setBusy(true)
      await alphaNexusApi.workbench.moveContentBlock({
        block_id: block.id,
        target_kind: option.target_kind,
        session_id: option.session_id,
        period_id: option.target_kind === 'period' ? option.period_id : undefined,
        trade_id: option.target_kind === 'trade' ? option.trade_id ?? null : null,
      })
      await refreshSession(payload.session.id)
      setMessage(`已将内容块“${block.title}”改挂载到 ${option.label}。`)
    } catch (error) {
      setMessage(error instanceof Error ? `改挂载失败：${error.message}` : '改挂载内容块失败。')
    } finally {
      setBusy(false)
    }
  }

  return {
    handleMoveContentBlock,
    handleSetCurrentTarget,
  }
}
