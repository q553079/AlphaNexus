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
  pending: 'pending',
  resolved: 'resolved',
  insufficient: 'insufficient',
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
          <strong>Outcome</strong>
          <p>{summary.outcome.summary}</p>
          <div className="action-row">
            <span className="status-pill">{outcomeLabel[summary.outcome.status]}</span>
            {summary.outcome.pnl_r !== null ? <span className="status-pill">{summary.outcome.pnl_r}R</span> : null}
            <span className="status-pill">{summary.outcome.outcome_direction}</span>
          </div>
        </article>

        {summary.ai_judgment ? (
          <article className="compact-list__item">
            <strong>AI Judgment</strong>
            <p>{summary.ai_judgment.reason_summary}</p>
            <div className="action-row">
              <span className="status-pill">{summary.ai_judgment.bias ?? 'unknown'}</span>
              <span className="status-pill">{verdictLabel[summary.ai_judgment.verdict]}</span>
              {summary.ai_judgment.confidence_pct !== null ? (
                <span className="status-pill">conf {summary.ai_judgment.confidence_pct}%</span>
              ) : null}
            </div>
          </article>
        ) : null}

        {summary.human_judgment ? (
          <article className="compact-list__item">
            <strong>Human Judgment</strong>
            <p>{summary.human_judgment.reason_summary}</p>
            <div className="action-row">
              <span className="status-pill">{summary.human_judgment.bias ?? 'unknown'}</span>
              <span className="status-pill">{verdictLabel[summary.human_judgment.verdict]}</span>
            </div>
          </article>
        ) : null}
      </div>

      <div className="key-value-grid">
        <div>
          <dt>Plan Adherence</dt>
          <dd>{summary.plan_adherence_pct !== null ? `${summary.plan_adherence_pct}%` : '暂无'}</dd>
        </div>
        <div>
          <dt>Disagreement</dt>
          <dd>{summary.disagreement_summary ?? '无明显分歧'}</dd>
        </div>
      </div>

      <div className="compact-list">
        <article className="compact-list__item">
          <strong>Discipline Score</strong>
          <p>{disciplineScore?.summary ?? '当前还没有纪律评分。'}</p>
          {disciplineScore ? (
            <>
              <div className="action-row">
                <span className="status-pill">overall {disciplineScore.overall_pct}%</span>
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
              <span className="status-pill">{hit.severity}</span>
              <span className="status-pill">{hit.matched ? 'matched' : 'not matched'}</span>
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
