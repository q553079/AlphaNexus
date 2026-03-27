import type { Dispatch, SetStateAction } from 'react'
import { alphaNexusApi } from '@app/bootstrap/api'
import type {
  AddToTradeInput,
  CancelTradeInput,
  CloseTradeInput,
  OpenTradeInput,
  ReduceTradeInput,
  SessionWorkbenchPayload,
} from '@shared/contracts/workbench'

type SessionWorkbenchTradeActionDeps = {
  payload: SessionWorkbenchPayload | null
  refreshSession: (nextSessionId?: string) => Promise<SessionWorkbenchPayload | null>
  setBusy: Dispatch<SetStateAction<boolean>>
  setMessage: Dispatch<SetStateAction<string | null>>
  setSelectedEventId: Dispatch<SetStateAction<string | null>>
}

export const createSessionWorkbenchTradeActions = ({
  payload,
  refreshSession,
  setBusy,
  setMessage,
  setSelectedEventId,
}: SessionWorkbenchTradeActionDeps) => {
  const handleOpenTrade = async(input: Omit<OpenTradeInput, 'session_id'>) => {
    if (!payload) {
      return
    }

    try {
      setBusy(true)
      const result = await alphaNexusApi.workbench.openTrade({
        session_id: payload.session.id,
        ...input,
      })
      await refreshSession(payload.session.id)
      setSelectedEventId(result.event.id)
      setMessage(`已开仓：${result.trade.symbol} ${result.trade.side} x${result.trade.quantity}。`)
    } catch (error) {
      setMessage(error instanceof Error ? `开仓失败：${error.message}` : '开仓失败。')
    } finally {
      setBusy(false)
    }
  }

  const handleAddToTrade = async(input: AddToTradeInput) => {
    if (!payload) {
      return
    }

    try {
      setBusy(true)
      const result = await alphaNexusApi.workbench.addToTrade(input)
      await refreshSession(payload.session.id)
      setSelectedEventId(result.event.id)
      setMessage(`已加仓，当前数量 ${result.trade.quantity}。`)
    } catch (error) {
      setMessage(error instanceof Error ? `加仓失败：${error.message}` : '加仓失败。')
    } finally {
      setBusy(false)
    }
  }

  const handleReduceTrade = async(input: ReduceTradeInput) => {
    if (!payload) {
      return
    }

    try {
      setBusy(true)
      const result = await alphaNexusApi.workbench.reduceTrade(input)
      await refreshSession(payload.session.id)
      setSelectedEventId(result.event.id)
      setMessage(`已减仓，剩余数量 ${result.trade.quantity}。`)
    } catch (error) {
      setMessage(error instanceof Error ? `减仓失败：${error.message}` : '减仓失败。')
    } finally {
      setBusy(false)
    }
  }

  const handleCloseTrade = async(input: CloseTradeInput) => {
    if (!payload) {
      return
    }

    try {
      setBusy(true)
      const result = await alphaNexusApi.workbench.closeTrade(input)
      await refreshSession(payload.session.id)
      setSelectedEventId(result.event.id)
      setMessage(`已平仓，结果 ${result.trade.pnl_r ?? 0}R。`)
    } catch (error) {
      setMessage(error instanceof Error ? `平仓失败：${error.message}` : '平仓失败。')
    } finally {
      setBusy(false)
    }
  }

  const handleCancelTrade = async(input: CancelTradeInput) => {
    if (!payload) {
      return
    }

    try {
      setBusy(true)
      const result = await alphaNexusApi.workbench.cancelTrade(input)
      await refreshSession(payload.session.id)
      setSelectedEventId(result.event.id)
      setMessage('已取消当前交易线程，不计入正常离场结果。')
    } catch (error) {
      setMessage(error instanceof Error ? `取消失败：${error.message}` : '取消交易失败。')
    } finally {
      setBusy(false)
    }
  }

  return {
    handleAddToTrade,
    handleCancelTrade,
    handleCloseTrade,
    handleOpenTrade,
    handleReduceTrade,
  }
}
