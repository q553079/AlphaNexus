import type { SessionWorkbenchPayload } from '@shared/contracts/workbench'
import {
  translateCurrentTargetLabel,
  translateTargetOptionSubtitle,
  translateTradeSide,
  translateTradeStatus,
} from '@app/ui/display-text'

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
        周期 {translateTargetOptionSubtitle(payload.period.label)}
      </span>
      <span className="session-workbench__context-pill" role="listitem">
        当前挂载 {targetTrade
          ? `${targetTrade.symbol} ${translateTradeSide(targetTrade.side)} · ${translateTradeStatus(targetTrade.status)}`
          : translateCurrentTargetLabel(currentTarget)}
      </span>
    </div>
  )
}
