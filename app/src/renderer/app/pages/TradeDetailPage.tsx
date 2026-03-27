import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { alphaNexusApi } from '@app/bootstrap/api'
import { AnalysisCardView } from '@app/components/AnalysisCardView'
import { PageHeading } from '@app/components/PageHeading'
import { SectionCard } from '@app/components/SectionCard'
import { TradeSnapshotCard } from '@app/components/TradeSnapshotCard'
import { ContentBlockTargetManager } from '@app/features/context/ContentBlockTargetManager'
import { FeedbackList } from '@app/features/review/FeedbackList'
import { pickPreferredAnalysisProvider } from '@app/features/session-workbench/modules/session-workbench-mappers'
import { TradeExecutionTimeline } from '@app/features/trade/TradeExecutionTimeline'
import { TradeInsightBoard } from '@app/features/trade/TradeInsightBoard'
import { TradeReviewAiPanel } from '@app/features/trade/TradeReviewAiPanel'
import { TradeReviewDraftPanel } from '@app/features/trade/TradeReviewDraftPanel'
import { TradeThreadMediaStrip } from '@app/features/trade/TradeThreadMediaStrip'
import {
  formatDateTime,
  translateTradeSide,
  translateTradeStatus,
} from '@app/ui/display-text'
import type { CurrentTargetOptionsPayload, TradeDetailPayload } from '@shared/contracts/workbench'

const buildTradeHeading = (payload: TradeDetailPayload) => {
  const rLabel = payload.trade.pnl_r != null ? ` | ${payload.trade.pnl_r}R` : ''
  return `Trade Thread · ${payload.trade.symbol} ${translateTradeSide(payload.trade.side)} | ${translateTradeStatus(payload.trade.status)}${rLabel}`
}

export const TradeDetailPage = () => {
  const { tradeId } = useParams()
  const [payload, setPayload] = useState<TradeDetailPayload | null>(null)
  const [targetOptions, setTargetOptions] = useState<CurrentTargetOptionsPayload | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const loadDetail = async(nextTradeId?: string) => {
    const nextPayload = await alphaNexusApi.workbench.getTradeDetail(nextTradeId ? { trade_id: nextTradeId } : undefined)
    setPayload(nextPayload)
    const nextTargets = await alphaNexusApi.workbench.listTargetOptions({
      session_id: nextPayload.session.id,
      include_period_targets: true,
    })
    setTargetOptions(nextTargets)
    return nextPayload
  }

  useEffect(() => {
    void loadDetail(tradeId).catch(() => {
      setTargetOptions(null)
    })
  }, [tradeId])

  const handleMoveContentBlock = async(
    block: TradeDetailPayload['content_blocks'][number],
    option: NonNullable<CurrentTargetOptionsPayload>['options'][number],
  ) => {
    if (!payload) {
      return
    }

    try {
      setBusy(true)
      await alphaNexusApi.workbench.moveContentBlock({
        block_id: block.id,
        target_kind: option.target_kind,
        session_id: option.session_id,
        period_id: option.target_kind === 'period' ? option.period_id : undefined,
        trade_id: option.target_kind === 'trade' ? option.trade_id ?? null : null,
      })
      await loadDetail(payload.trade.id)
      setMessage(`已将内容块“${block.title}”改挂载到 ${option.label}。`)
    } catch (error) {
      setMessage(error instanceof Error ? `改挂载失败：${error.message}` : '改挂载内容块失败。')
    } finally {
      setBusy(false)
    }
  }

  const handleRunTradeReview = async() => {
    if (!payload) {
      return
    }

    try {
      setBusy(true)
      const providers = await alphaNexusApi.ai.listProviders()
      const preferredProvider = pickPreferredAnalysisProvider(providers)
      if (!preferredProvider) {
        throw new Error('当前没有已启用且已配置完成的 AI provider。')
      }

      const result = await alphaNexusApi.ai.runAnalysis({
        session_id: payload.session.id,
        trade_id: payload.trade.id,
        screenshot_id: payload.exit_screenshot?.id ?? payload.setup_screenshot?.id ?? null,
        provider: preferredProvider.provider,
        prompt_kind: 'trade-review',
      })
      await loadDetail(payload.trade.id)
      setMessage(`${preferredProvider.label} 交易复盘已完成：${result.analysis_card.summary_short}`)
    } catch (error) {
      setMessage(error instanceof Error ? `交易复盘失败：${error.message}` : '交易复盘失败。')
    } finally {
      setBusy(false)
    }
  }

  return payload ? (
    <div className="trade-detail stack">
      <PageHeading
        eyebrow="交易线程"
        summary={`Session: ${payload.session.title} · 开始 ${formatDateTime(payload.trade.opened_at)}${payload.trade.closed_at ? ` · 结束 ${formatDateTime(payload.trade.closed_at)}` : ''}`}
        title={buildTradeHeading(payload)}
      />
      {message ? <div className="status-inline">{message}</div> : null}

      <div className="trade-detail__overview">
        <SectionCard title="交易快照" subtitle="单笔交易的核心状态和风险边界。">
          <TradeSnapshotCard trade={payload.trade} />
        </SectionCard>
        <SectionCard title="线程概览" subtitle="围绕这笔 trade 的图、AI、执行和复盘分区。">
          <div className="trade-detail__metric-grid">
            <article className="trade-detail__metric-card">
              <span>Setup</span>
              <strong>{payload.setup_screenshots.length}</strong>
            </article>
            <article className="trade-detail__metric-card">
              <span>Manage</span>
              <strong>{payload.manage_screenshots.length}</strong>
            </article>
            <article className="trade-detail__metric-card">
              <span>Exit</span>
              <strong>{payload.exit_screenshots.length}</strong>
            </article>
            <article className="trade-detail__metric-card">
              <span>AI</span>
              <strong>{payload.linked_ai_cards.length}</strong>
            </article>
            <article className="trade-detail__metric-card">
              <span>AI Review</span>
              <strong>{payload.ai_groups.trade_review.length}</strong>
            </article>
            <article className="trade-detail__metric-card">
              <span>Execution</span>
              <strong>{payload.execution_events.length}</strong>
            </article>
            <article className="trade-detail__metric-card">
              <span>Review</span>
              <strong>{payload.review_blocks.length}</strong>
            </article>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Setup | Manage | Exit" subtitle="按交易线程而不是按日志列表查看这笔交易的图像证据。">
        <TradeThreadMediaStrip
          exitScreenshot={payload.exit_screenshot}
          exitScreenshots={payload.exit_screenshots}
          manageScreenshots={payload.manage_screenshots}
          setupScreenshot={payload.setup_screenshot}
          setupScreenshots={payload.setup_screenshots}
        />
      </SectionCard>

      <div className="trade-detail__grid trade-detail__grid--three">
        <SectionCard title="我的原始计划" subtitle="保留当时计划和原始记录，不与事后复盘混写。">
          <div className="trade-detail__column">
            <article className="trade-detail__text-panel">
              <span className="trade-detail__label">Trade Thesis</span>
              <div className="workbench-text">{payload.trade.thesis || '还没有写 trade thesis。'}</div>
            </article>
            <article className="trade-detail__text-panel">
              <span className="trade-detail__label">Session Trade Plan</span>
              <div className="workbench-text">{payload.session.trade_plan_md || '还没有记录 session trade plan。'}</div>
            </article>
            <div className="trade-detail__block-list">
              {payload.original_plan_blocks.length > 0 ? payload.original_plan_blocks.map((block) => (
                <article className="trade-detail__block-item" key={block.id}>
                  <strong>{block.title}</strong>
                  <div className="workbench-text">{block.content_md}</div>
                  <ContentBlockTargetManager
                    block={block}
                    busy={busy}
                    onMove={handleMoveContentBlock}
                    targetPayload={targetOptions}
                  />
                </article>
              )) : <div className="empty-state">当前没有额外的原始计划块。</div>}
            </div>
          </div>
        </SectionCard>

        <SectionCard title="AI 当时建议" subtitle="明确区分盘中 AI 建议，不让它覆盖你的原始计划。">
          <div className="trade-detail__column">
            {payload.latest_analysis_card
              ? <AnalysisCardView card={payload.latest_analysis_card} />
              : <div className="empty-state">还没有记录 AI 上下文。</div>}
            {payload.linked_ai_cards.length > 1 ? (
              <div className="trade-detail__block-list">
                {payload.linked_ai_cards.slice(0, -1).reverse().map((card) => (
                  <article className="trade-detail__block-item" key={card.id}>
                    <strong>{card.summary_short}</strong>
                    <div className="workbench-text">{card.deep_analysis_md}</div>
                  </article>
                ))}
              </div>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard title="实际执行" subtitle="按 trade lifecycle 展开 open / add / reduce / close 的真实执行轨迹。">
          <TradeExecutionTimeline events={payload.execution_events} />
        </SectionCard>
      </div>

      <div className="trade-detail__grid trade-detail__grid--three">
        <SectionCard title="偏差分析" subtitle="优先展示计划和执行之间的差异，而不是事后重写历史。">
          <TradeInsightBoard
            emptyMessage="当前还没有偏差分析。"
            items={payload.review_sections.deviation_analysis}
          />
        </SectionCard>

        <SectionCard title="结果评估" subtitle="复用 evaluation / discipline / rules 输出，汇成单笔 trade 的结果视图。">
          <TradeInsightBoard
            emptyMessage="当前还没有结果评估。"
            items={payload.review_sections.result_assessment}
          />
        </SectionCard>

        <SectionCard title="下次改进" subtitle="把反馈和复盘草稿转成下一次可执行的改进行动。">
          <TradeInsightBoard
            emptyMessage="当前还没有下一次改进建议。"
            items={payload.review_sections.next_improvements}
          />
        </SectionCard>
      </div>

      <div className="trade-detail__grid trade-detail__grid--two">
        <SectionCard title="交易级 AI 复盘" subtitle="把 setup / exit / 计划 / 执行 / 结果送入同一笔 Trade 的 AI 复盘链路。">
          <TradeReviewAiPanel
            busy={busy}
            onRun={() => void handleRunTradeReview()}
            records={payload.ai_groups.trade_review}
          />
        </SectionCard>

        <SectionCard title="我的原始复盘 / Draft" subtitle="保留 review blocks 原文，和上面的结构化结论并列而不覆盖。">
          <TradeReviewDraftPanel
            blocks={payload.review_blocks}
            draftBlock={payload.review_draft_block}
          />
        </SectionCard>
      </div>

      <SectionCard title="自动反馈建议" subtitle="反馈只基于结构化证据，不自动篡改你的盘中记录。">
        <FeedbackList emptyMessage="当前没有自动反馈建议。" items={payload.feedback_items} />
      </SectionCard>
    </div>
  ) : <div className="empty-state">正在加载交易详情...</div>
}
