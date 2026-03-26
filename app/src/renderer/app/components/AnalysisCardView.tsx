import type { AnalysisCardRecord } from '@shared/contracts/analysis'
import { translateAnalysisBias } from '@app/ui/display-text'

type AnalysisCardViewProps = {
  card: AnalysisCardRecord
}

export const AnalysisCardView = ({ card }: AnalysisCardViewProps) => (
  <div className="analysis-card">
    <div className="analysis-card__row">
      <span className="metric-pill">{translateAnalysisBias(card.bias)}</span>
      <span className="metric-pill">置信度 {card.confidence_pct}%</span>
      <span className="metric-pill">反转概率 {card.reversal_probability_pct}%</span>
    </div>
    <p>{card.summary_short}</p>
    <dl className="key-value-grid">
      <div>
        <dt>入场区间</dt>
        <dd>{card.entry_zone}</dd>
      </div>
      <div>
        <dt>止损</dt>
        <dd>{card.stop_loss}</dd>
      </div>
      <div>
        <dt>止盈目标</dt>
        <dd>{card.take_profit}</dd>
      </div>
      <div>
        <dt>失效条件</dt>
        <dd>{card.invalidation}</dd>
      </div>
    </dl>
  </div>
)
