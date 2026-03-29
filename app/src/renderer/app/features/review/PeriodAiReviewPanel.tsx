import type { PeriodReviewPayload } from '@shared/contracts/workbench'

type PeriodAiReviewPanelProps = {
  aiReview: PeriodReviewPayload['latest_period_ai_review']
  aiQuality: PeriodReviewPayload['ai_quality_summary']
  busy: boolean
  onGenerate: () => void
}

const formatPct = (value: number | null | undefined) => value === null || value === undefined ? '待补充' : `${value}%`
const promptKindLabel: Record<'market-analysis' | 'trade-review' | 'period-review', string> = {
  'market-analysis': '市场分析',
  'trade-review': '交易复盘',
  'period-review': '周期复盘',
}

export const PeriodAiReviewPanel = ({
  aiReview,
  aiQuality,
  busy,
  onGenerate,
}: PeriodAiReviewPanelProps) => (
  <div className="stack">
    <div className="action-row">
      <button className="button is-secondary" disabled={busy} onClick={onGenerate} type="button">
        生成 AI 周/月复盘
      </button>
      <span className="status-pill">结构化成功率 {formatPct(aiQuality.success_rate_pct)}</span>
      <span className="status-pill">失败 {aiQuality.structured_failure_count}</span>
    </div>

    {aiReview?.structured ? (
      <div className="compact-list">
        <article className="compact-list__item">
          <strong>摘要</strong>
          <p>{aiReview.structured.summary_short}</p>
        </article>
        <article className="compact-list__item">
          <strong>行动项</strong>
          <ul className="period-review-list">
            {aiReview.structured.action_items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
        <article className="compact-list__item">
          <strong>重复模式</strong>
          <ul className="period-review-list">
            {aiReview.structured.recurring_patterns.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </div>
    ) : (
      <div className="empty-state">当前周期还没有结构化 AI 周/月复盘。点击上方按钮会把真实周期聚合结果发给当前首选模型提供方。</div>
    )}

    <div className="compact-list">
      {aiQuality.providers.map((provider) => (
        <article className="compact-list__item" key={provider.provider}>
          <strong>{provider.provider}</strong>
          <div className="action-row">
            <span className="status-pill">运行次数 {provider.total_runs}</span>
            <span className="status-pill">成功率 {formatPct(provider.success_rate_pct)}</span>
            <span className="status-pill">失败 {provider.structured_failure_count}</span>
          </div>
          {provider.last_failure_reason ? <p>{provider.last_failure_reason}</p> : null}
        </article>
      ))}
      {aiQuality.recent_failures.slice(0, 3).map((failure) => (
        <article className="compact-list__item" key={failure.ai_run_id}>
          <strong>{failure.provider} {promptKindLabel[failure.prompt_kind]}</strong>
          <p>{failure.reason}</p>
        </article>
      ))}
    </div>
  </div>
)
