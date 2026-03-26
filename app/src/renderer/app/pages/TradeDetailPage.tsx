import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { alphaNexusApi } from '@app/bootstrap/api'
import { AnalysisCardView } from '@app/components/AnalysisCardView'
import { PageHeading } from '@app/components/PageHeading'
import { SectionCard } from '@app/components/SectionCard'
import { TradeSnapshotCard } from '@app/components/TradeSnapshotCard'
import { TradeEvaluationPanel } from '@app/features/evaluation/TradeEvaluationPanel'
import { FeedbackList } from '@app/features/review/FeedbackList'
import { translateTradeSide } from '@app/ui/display-text'
import type { TradeDetailPayload } from '@shared/contracts/workbench'

export const TradeDetailPage = () => {
  const { tradeId } = useParams()
  const [payload, setPayload] = useState<TradeDetailPayload | null>(null)

  useEffect(() => {
    void alphaNexusApi.workbench.getTradeDetail(tradeId ? { trade_id: tradeId } : undefined).then(setPayload)
  }, [tradeId])

  return payload ? (
    <div className="stack">
      <PageHeading
        eyebrow="交易"
        summary="聚焦单笔交易，查看它的事件上下文、关联 AI 分析和执行评估。"
        title={`${payload.trade.symbol} ${translateTradeSide(payload.trade.side)}`}
      />

      <div className="two-column">
        <SectionCard title="交易快照">
          <TradeSnapshotCard trade={payload.trade} />
        </SectionCard>

        <SectionCard title="AI vs Human 评估" subtitle="Outcome、纪律分和规则命中保持可审计。">
          <TradeEvaluationPanel
            disciplineScore={payload.discipline_score}
            ruleHits={payload.rule_hits}
            summary={payload.evaluation_summary}
          />
        </SectionCard>
      </div>

      <div className="two-column">
        <SectionCard title="相关事件">
          <div className="compact-list">
            {payload.related_events.map((event) => (
              <div className="compact-list__item" key={event.id}>
                <strong>{event.title}</strong>
                <p>{event.summary}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="AI 上下文">
          {payload.analysis_cards[payload.analysis_cards.length - 1]
            ? <AnalysisCardView card={payload.analysis_cards[payload.analysis_cards.length - 1]} />
            : <div className="empty-state">还没有记录 AI 上下文。</div>}
        </SectionCard>
      </div>

      <div className="two-column">
        <SectionCard title="自动反馈建议" subtitle="反馈只基于结构化评估证据，不自动改写你的原始记录。">
          <FeedbackList emptyMessage="当前没有自动反馈建议。" items={payload.feedback_items} />
        </SectionCard>

        <SectionCard title="人工评估记录">
          <div className="compact-list__item">
            <strong>{payload.evaluation?.score ?? '暂无'} / 100</strong>
            <p>{payload.evaluation?.note_md ?? '还没有记录人工评估。'}</p>
          </div>
        </SectionCard>
      </div>
    </div>
  ) : <div className="empty-state">正在加载交易详情...</div>
}
