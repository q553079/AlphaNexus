import { translateAnalysisBias, translateRuleSeverity } from '@app/ui/display-text'
import type { DisciplineScore, RuleHit, TradeEvaluationSummary } from '@shared/contracts/evaluation'

type TradeEvaluationPanelProps = {
  summary: TradeEvaluationSummary | null
  disciplineScore: DisciplineScore | null
  ruleHits: RuleHit[]
}

const verdictLabel: Record<NonNullable<TradeEvaluationSummary['ai_judgment']>['verdict'], string> = {
  correct: '正确',
  'partially-correct': '部分正确',
  incorrect: '错误',
  pending: '待结果',
  insufficient: '样本不足',
}

const outcomeLabel: Record<TradeEvaluationSummary['outcome']['status'], string> = {
  pending: '待结果',
  resolved: '已落地',
  insufficient: '样本不足',
}

const outcomeDirectionLabel: Record<TradeEvaluationSummary['outcome']['outcome_direction'], string> = {
  up: '向上',
  down: '向下',
  range: '震荡',
  unknown: '未知',
}

export const TradeEvaluationPanel = ({
  summary,
  disciplineScore,
  ruleHits,
}: TradeEvaluationPanelProps) => {
  if (!summary) {
    return <div className="empty-state">当前还没有足够的评估数据。</div>
  }

  return (
    <div className="stack">
      <div className="compact-list">
        <article className="compact-list__item">
          <strong>结果回看</strong>
          <p>{summary.outcome.summary}</p>
          <div className="action-row">
            <span className="status-pill">{outcomeLabel[summary.outcome.status]}</span>
            {summary.outcome.pnl_r !== null ? <span className="status-pill">{summary.outcome.pnl_r}R</span> : null}
            <span className="status-pill">{outcomeDirectionLabel[summary.outcome.outcome_direction]}</span>
          </div>
        </article>

        {summary.ai_judgment ? (
          <article className="compact-list__item">
            <strong>AI 判断</strong>
            <p>{summary.ai_judgment.reason_summary}</p>
            <div className="action-row">
              <span className="status-pill">{summary.ai_judgment.bias ? translateAnalysisBias(summary.ai_judgment.bias) : '未知'}</span>
              <span className="status-pill">{verdictLabel[summary.ai_judgment.verdict]}</span>
              {summary.ai_judgment.confidence_pct !== null ? (
                <span className="status-pill">置信度 {summary.ai_judgment.confidence_pct}%</span>
              ) : null}
            </div>
          </article>
        ) : null}

        {summary.human_judgment ? (
          <article className="compact-list__item">
            <strong>人工判断</strong>
            <p>{summary.human_judgment.reason_summary}</p>
            <div className="action-row">
              <span className="status-pill">{summary.human_judgment.bias ? translateAnalysisBias(summary.human_judgment.bias) : '未知'}</span>
              <span className="status-pill">{verdictLabel[summary.human_judgment.verdict]}</span>
            </div>
          </article>
        ) : null}
      </div>

      <div className="key-value-grid">
        <div>
          <dt>计划遵守度</dt>
          <dd>{summary.plan_adherence_pct !== null ? `${summary.plan_adherence_pct}%` : '暂无'}</dd>
        </div>
        <div>
          <dt>分歧说明</dt>
          <dd>{summary.disagreement_summary ?? '无明显分歧'}</dd>
        </div>
      </div>

      <div className="compact-list">
        <article className="compact-list__item">
          <strong>纪律评分</strong>
          <p>{disciplineScore?.summary ?? '当前还没有纪律评分。'}</p>
          {disciplineScore ? (
            <>
              <div className="action-row">
                <span className="status-pill">总分 {disciplineScore.overall_pct}%</span>
              </div>
              <div className="compact-list">
                {disciplineScore.dimensions.map((dimension) => (
                  <div className="compact-list__item" key={dimension.id}>
                    <strong>{dimension.label}</strong>
                    <p>{dimension.summary}</p>
                    <div className="action-row">
                      <span className="status-pill">{dimension.score_pct}%</span>
                      {dimension.evidence.slice(0, 2).map((item) => (
                        <span className="badge" key={item}>{item}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </article>
      </div>

      <div className="compact-list">
        {ruleHits.length > 0 ? ruleHits.map((hit) => (
          <article className="compact-list__item" key={hit.id}>
            <strong>{hit.label}</strong>
            <p>{hit.reason}</p>
            <div className="action-row">
              <span className="status-pill">{translateRuleSeverity(hit.severity)}</span>
              <span className="status-pill">{hit.matched ? '已命中' : '未命中'}</span>
              {hit.evidence.slice(0, 2).map((item) => (
                <span className="badge" key={item}>{item}</span>
              ))}
            </div>
          </article>
        )) : <div className="empty-state">当前没有规则命中记录。</div>}
      </div>
    </div>
  )
}
