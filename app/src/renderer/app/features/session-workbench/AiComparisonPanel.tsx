import { translateAnalysisBias } from '@app/ui/display-text'
import type { AiComparisonViewModel } from './modules/session-ai-compare'

type AiComparisonPanelProps = {
  busy: boolean
  onRunCompare: () => void
  viewModel: AiComparisonViewModel
}

export const AiComparisonPanel = ({
  busy,
  onRunCompare,
  viewModel,
}: AiComparisonPanelProps) => (
  <div className="session-workbench__ai-compare">
    <div className="action-row">
      <button className="button is-secondary" disabled={busy} onClick={onRunCompare} type="button">
        运行多 Provider 对照
      </button>
      <span className="session-workbench__editor-hint">只写分析层，不覆盖事件与 trade facts。</span>
    </div>

    {viewModel.records.length > 0 ? (
      <div className="session-workbench__ai-compare-grid">
        {viewModel.records.map((record) => (
          <article className="session-workbench__content-block" key={record.ai_run.id}>
            <div className="session-workbench__content-header">
              <div>
                <h3>{record.ai_run.provider}</h3>
                <p className="session-workbench__content-meta">{record.ai_run.model}</p>
              </div>
              <span className="metric-pill">{translateAnalysisBias(record.analysis_card.bias)}</span>
            </div>
            <p className="workbench-text">{record.analysis_card.summary_short}</p>
            <div className="action-row">
              <span className="status-pill">置信度 {record.analysis_card.confidence_pct}%</span>
              <span className="status-pill">入场 {record.analysis_card.entry_zone}</span>
            </div>
          </article>
        ))}
      </div>
    ) : (
      <p className="empty-state">当前还没有可对照的多 provider 分析记录。</p>
    )}

    {viewModel.consensus_points.length > 0 ? (
      <div className="session-workbench__ai-compare-section">
        <p className="session-workbench__deleted-label">共识</p>
        <ul className="session-workbench__ai-compare-list">
          {viewModel.consensus_points.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    ) : null}

    {viewModel.divergence_points.length > 0 ? (
      <div className="session-workbench__ai-compare-section">
        <p className="session-workbench__deleted-label">分歧</p>
        <ul className="session-workbench__ai-compare-list">
          {viewModel.divergence_points.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    ) : null}
  </div>
)
