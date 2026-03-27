import type { TradeDetailAiRecord } from '@shared/contracts/workbench'
import { formatDateTime } from '@app/ui/display-text'

type TradeReviewAiPanelProps = {
  busy: boolean
  records: TradeDetailAiRecord[]
  onRun: () => void
}

export const TradeReviewAiPanel = ({
  busy,
  records,
  onRun,
}: TradeReviewAiPanelProps) => (
  <div className="trade-review-draft">
    <div className="trade-review-draft__intro">
      <span className="badge badge-ai_summary">交易级 AI 复盘</span>
      <p>这条链路只写分析层，不覆盖 trade facts、执行事件和人工复盘原文。</p>
    </div>

    <div className="action-row">
      <button className="button is-primary" disabled={busy} onClick={onRun} type="button">
        运行交易复盘 AI
      </button>
    </div>

    {records.length === 0 ? (
      <div className="empty-state">当前还没有交易级 AI 复盘记录。</div>
    ) : (
      <div className="trade-review-draft__list">
        {records.slice().reverse().map((record) => (
          <article className="trade-review-draft__item is-draft" key={record.ai_run.id}>
            <div className="trade-review-draft__meta">
              <strong>{record.analysis_card?.summary_short ?? record.trade_review_structured?.summary_short ?? record.ai_run.model}</strong>
              <span className="metric-pill">{record.ai_run.provider} · {formatDateTime(record.ai_run.created_at)}</span>
            </div>
            {record.trade_review_structured ? (
              <div className="trade-insight-board">
                <article className="trade-insight-board__item is-positive">
                  <strong>做得好的地方</strong>
                  <p>{record.trade_review_structured.what_went_well.join('；')}</p>
                </article>
                <article className="trade-insight-board__item is-warning">
                  <strong>出错点</strong>
                  <p>{record.trade_review_structured.mistakes.join('；')}</p>
                </article>
                <article className="trade-insight-board__item is-neutral">
                  <strong>下次改进</strong>
                  <p>{record.trade_review_structured.next_improvements.join('；')}</p>
                </article>
              </div>
            ) : null}
            <div className="trade-review-draft__body workbench-text">
              {record.content_block?.content_md ?? record.analysis_card?.deep_analysis_md ?? record.ai_run.raw_response_text}
            </div>
            <details>
              <summary>查看 AI 审计</summary>
              <pre>{record.ai_run.structured_response_json}</pre>
              <pre>{record.ai_run.raw_response_text}</pre>
            </details>
          </article>
        ))}
      </div>
    )}
  </div>
)
