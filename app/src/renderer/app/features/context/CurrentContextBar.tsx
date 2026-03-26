import type { SessionWorkbenchPayload } from '@shared/contracts/workbench'
import {
  translateCaptureKind,
  translateTradeSide,
  translateTradeStatus,
} from '@app/ui/display-text'

const sourceViewLabels: Record<SessionWorkbenchPayload['current_context']['source_view'], string> = {
  launcher: 'Launcher',
  'session-workbench': 'Session Workbench',
  'trade-detail': 'Trade Detail',
  'period-review': 'Period Review',
  'capture-overlay': 'Capture Overlay',
}

type CurrentContextBarProps = {
  payload: SessionWorkbenchPayload
}

export const CurrentContextBar = ({ payload }: CurrentContextBarProps) => {
  const currentTarget = payload.target_option_groups.current[0]
    ?? payload.target_options.find((option) => option.is_current)
    ?? null
  const targetTrade = currentTarget?.target_kind === 'trade' && currentTarget.trade_id
    ? payload.trades.find((trade) => trade.id === currentTarget.trade_id) ?? null
    : null

  return (
    <div className="session-workbench__context-bar" role="list" aria-label="Current context">
      <span className="session-workbench__context-pill" role="listitem">
        合约 {payload.contract.symbol}
      </span>
      <span className="session-workbench__context-pill" role="listitem">
        周期 {payload.period.label}
      </span>
      <span className="session-workbench__context-pill" role="listitem">
        Session {payload.session.title}
      </span>
      <span className="session-workbench__context-pill" role="listitem">
        目标 {targetTrade ? `${targetTrade.symbol} ${translateTradeSide(targetTrade.side)} · ${translateTradeStatus(targetTrade.status)}` : currentTarget?.label ?? 'Session'}
      </span>
      <span className="session-workbench__context-pill" role="listitem">
        Capture {translateCaptureKind(payload.current_context.capture_kind)}
      </span>
      <span className="session-workbench__context-pill" role="listitem">
        视图 {sourceViewLabels[payload.current_context.source_view]}
      </span>
    </div>
  )
}
