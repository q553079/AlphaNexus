import { translateCalibrationStatus } from '@app/ui/display-text'
import type { PeriodEvaluationRollup } from '@shared/contracts/evaluation'

type PeriodEvaluationPanelProps = {
  rollup: PeriodEvaluationRollup
}

export const PeriodEvaluationPanel = ({ rollup }: PeriodEvaluationPanelProps) => (
  <div className="stack">
    <div className="key-value-grid">
      <div>
        <dt>已评估</dt>
        <dd>{rollup.evaluated_count}</dd>
      </div>
      <div>
        <dt>待评估</dt>
        <dd>{rollup.pending_count}</dd>
      </div>
    </div>

    <div className="compact-list">
      {rollup.calibration_buckets.map((bucket) => (
        <article className="compact-list__item" key={bucket.id}>
          <strong>校准区间 {bucket.label}</strong>
          <div className="key-value-grid">
            <div>
              <dt>样本数</dt>
              <dd>{bucket.sample_count}</dd>
            </div>
            <div>
              <dt>已落地</dt>
              <dd>{bucket.resolved_count}</dd>
            </div>
            <div>
              <dt>命中率</dt>
              <dd>{bucket.hit_rate_pct !== null ? `${bucket.hit_rate_pct}%` : '暂无'}</dd>
            </div>
            <div>
              <dt>偏差</dt>
              <dd>{bucket.calibration_gap_pct !== null ? `${bucket.calibration_gap_pct}%` : '暂无'}</dd>
            </div>
          </div>
          <div className="action-row">
            <span className="status-pill">{translateCalibrationStatus(bucket.status)}</span>
            <span className="status-pill">平均置信度 {bucket.avg_confidence_pct}%</span>
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
              <dt>人工</dt>
              <dd>{metric.human_value_pct !== null ? `${metric.human_value_pct}%` : '暂无'}</dd>
            </div>
            <div>
              <dt>差值</dt>
              <dd>{metric.delta_pct !== null ? `${metric.delta_pct}%` : '暂无'}</dd>
            </div>
            <div>
              <dt>样本数</dt>
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
              <span className="status-pill">次数 {pattern.count}</span>
            </div>
          </article>
        )) : <div className="empty-state">当前没有明显错误模式。</div>}
      </div>

      <div className="compact-list">
        {rollup.effective_knowledge.length > 0 ? rollup.effective_knowledge.map((item) => (
          <article className="compact-list__item" key={item.card_id}>
            <strong>{item.title}</strong>
            <div className="action-row">
              <span className="status-pill">命中 {item.hit_count}</span>
              <span className="status-pill">质量 {item.quality_score_pct}%</span>
            </div>
          </article>
        )) : <div className="empty-state">当前没有可回灌的知识卡命中。</div>}
      </div>
    </div>
  </div>
)
