import type { TradeRecord } from '@shared/contracts/trade'
import { translateTradeSide, translateTradeStatus } from '@app/ui/display-text'

type TradeSnapshotCardProps = {
  trade: TradeRecord
}

export const TradeSnapshotCard = ({ trade }: TradeSnapshotCardProps) => (
  <div className="trade-card">
    <div className="trade-card__header">
      <h3>{trade.symbol} {translateTradeSide(trade.side)}</h3>
      <span className={`badge badge-${trade.status}`}>{translateTradeStatus(trade.status)}</span>
    </div>
    <dl className="key-value-grid">
      <div>
        <dt>入场</dt>
        <dd>{trade.entry_price}</dd>
      </div>
      <div>
        <dt>止损</dt>
        <dd>{trade.stop_loss}</dd>
      </div>
      <div>
        <dt>目标</dt>
        <dd>{trade.take_profit}</dd>
      </div>
      <div>
        <dt>数量</dt>
        <dd>{trade.quantity}</dd>
      </div>
      {trade.exit_price != null ? (
        <div>
          <dt>平仓</dt>
          <dd>{trade.exit_price}</dd>
        </div>
      ) : null}
      {trade.pnl_r != null ? (
        <div>
          <dt>PnL (R)</dt>
          <dd>{trade.pnl_r}</dd>
        </div>
      ) : null}
    </dl>
    <p>{trade.thesis}</p>
  </div>
)
