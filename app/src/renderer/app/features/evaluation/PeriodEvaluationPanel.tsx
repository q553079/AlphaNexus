import type { PeriodEvaluationRollup } from '@shared/contracts/evaluation'

type PeriodEvaluationPanelProps = {
  rollup: PeriodEvaluationRollup
}

export const PeriodEvaluationPanel = ({ rollup }: PeriodEvaluationPanelProps) => (
  <div className="stack">
    <div className="key-value-grid">
      <div>
        <dt>Evaluated</dt>
        <dd>{rollup.evaluated_count}</dd>
      </div>
      <div>
        <dt>Pending</dt>
        <dd>{rollup.pending_count}</dd>
      </div>
    </div>

    <div className="compact-list">
      {rollup.calibration_buckets.map((bucket) => (
        <article className="compact-list__item" key={bucket.id}>
          <strong>Calibration {bucket.label}</strong>
          <div className="key-value-grid">
            <div>
              <dt>Samples</dt>
              <dd>{bucket.sample_count}</dd>
            </div>
            <div>
              <dt>Resolved</dt>
              <dd>{bucket.resolved_count}</dd>
            </div>
            <div>
              <dt>Hit Rate</dt>
              <dd>{bucket.hit_rate_pct !== null ? `${bucket.hit_rate_pct}%` : '暂无'}</dd>
            </div>
            <div>
              <dt>Gap</dt>
              <dd>{bucket.calibration_gap_pct !== null ? `${bucket.calibration_gap_pct}%` : '暂无'}</dd>
            </div>
          </div>
          <div className="action-row">
            <span className="status-pill">{bucket.status}</span>
            <span className="status-pill">avg conf {bucket.avg_confidence_pct}%</span>
          </div>
        </article>
      ))}
    </div>

    <div className="compact-list">
      {rollup.ai_vs_human.map((metric) => (
        <article className="compact-list__item" key={metric.id}>
          <strong>{metric.label}</strong>
          <div className="key-value-grid">
            <div>
              <dt>AI</dt>
              <dd>{metric.ai_value_pct !== null ? `${metric.ai_value_pct}%` : '暂无'}</dd>
            </div>
            <div>
              <dt>Human</dt>
              <dd>{metric.human_value_pct !== null ? `${metric.human_value_pct}%` : '暂无'}</dd>
            </div>
            <div>
              <dt>Delta</dt>
              <dd>{metric.delta_pct !== null ? `${metric.delta_pct}%` : '暂无'}</dd>
            </div>
            <div>
              <dt>Samples</dt>
              <dd>{metric.sample_count}</dd>
            </div>
          </div>
        </article>
      ))}
    </div>

    <div className="two-column">
      <div className="compact-list">
        {rollup.error_patterns.length > 0 ? rollup.error_patterns.map((pattern) => (
          <article className="compact-list__item" key={pattern.id}>
            <strong>{pattern.label}</strong>
            <p>{pattern.summary}</p>
            <div className="action-row">
              <span className="status-pill">count {pattern.count}</span>
            </div>
          </article>
        )) : <div className="empty-state">当前没有明显错误模式。</div>}
      </div>

      <div className="compact-list">
        {rollup.effective_knowledge.length > 0 ? rollup.effective_knowledge.map((item) => (
          <article className="compact-list__item" key={item.card_id}>
            <strong>{item.title}</strong>
            <div className="action-row">
              <span className="status-pill">hits {item.hit_count}</span>
              <span className="status-pill">quality {item.quality_score_pct}%</span>
            </div>
          </article>
        )) : <div className="empty-state">当前没有可回灌的 knowledge 命中。</div>}
      </div>
    </div>
  </div>
)
