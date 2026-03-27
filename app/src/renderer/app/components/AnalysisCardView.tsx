import type { AnalysisCardRecord, AiRunRecord } from '@shared/contracts/analysis'
import { translateAnalysisBias } from '@app/ui/display-text'

type AnalysisCardViewProps = {
  card: AnalysisCardRecord
  aiRun?: AiRunRecord | null
}

const safeStructuredPreview = (value: string) => {
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

export const AnalysisCardView = ({ card, aiRun = null }: AnalysisCardViewProps) => (
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
    {card.supporting_factors.length > 0 ? (
      <div className="analysis-card__details">
        <strong>支撑因素</strong>
        <ul>
          {card.supporting_factors.map((factor) => (
            <li key={factor}>{factor}</li>
          ))}
        </ul>
      </div>
    ) : null}
    {card.deep_analysis_md.trim() ? (
      <div className="analysis-card__details">
        <strong>深度分析</strong>
        <pre>{card.deep_analysis_md}</pre>
      </div>
    ) : null}
    {aiRun ? (
      <div className="analysis-card__details">
        <strong>AI 审计</strong>
        <p>{aiRun.provider} · {aiRun.model} · {aiRun.prompt_kind}</p>
        <pre>{aiRun.prompt_preview}</pre>
        <pre>{safeStructuredPreview(aiRun.structured_response_json)}</pre>
        <pre>{aiRun.raw_response_text}</pre>
      </div>
    ) : null}
  </div>
)
