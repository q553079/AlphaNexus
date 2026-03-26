import { AnalysisCardView } from '@app/components/AnalysisCardView'
import { SectionCard } from '@app/components/SectionCard'
import { TradeSnapshotCard } from '@app/components/TradeSnapshotCard'
import { ActiveAnchorsPanel } from '@app/features/anchors'
import type { ComposerSuggestion } from '@app/features/composer/types'
import type { MarketAnchorStatus, MarketAnchorView } from '@app/features/anchors'
import { SessionWorkbenchComposerShell } from '@app/features/composer'
import { GroundingHitsPanel } from '@app/features/grounding'
import type { GroundingHitView } from '@app/features/grounding'
import {
  AnchorReviewSuggestionsPanel,
  SimilarCasesPanel,
} from '@app/features/suggestions'
import type { AnchorReviewSuggestionView, SimilarCaseView } from '@app/features/suggestions'
import type { AnalysisCardRecord } from '@shared/contracts/analysis'
import type { ContentBlockRecord } from '@shared/contracts/content'
import type { EvaluationRecord, TradeRecord } from '@shared/contracts/trade'
import type { AiRecordChain, SessionWorkbenchPayload } from '@shared/contracts/workbench'
import type { WorkbenchTab } from './session-workbench-types'

const tabLabels: Record<WorkbenchTab, string> = {
  view: '我的看法',
  ai: 'AI 分析',
  plan: '交易计划',
}

type SessionWorkspaceColumnProps = {
  activeTab: WorkbenchTab
  activeAnchors: MarketAnchorView[]
  analysisCard: AnalysisCardRecord | null
  anchorReviewSuggestions: AnchorReviewSuggestionView[]
  anchors: MarketAnchorView[]
  busy: boolean
  composerSuggestions: ComposerSuggestion[]
  currentTrade: TradeRecord | null
  deletedAiRecords: AiRecordChain[]
  groundingHits: GroundingHitView[]
  latestEvaluation: EvaluationRecord | null
  onDeleteAiRecord: (aiRunId: string) => void
  onDeleteBlock: (block: ContentBlockRecord) => void
  onRestoreBlock: (block: ContentBlockRecord) => void
  onRealtimeDraftChange: (value: string) => void
  onRestoreAiRecord: (aiRunId: string) => void
  onSaveRealtimeView: () => void
  onSetAnchorStatus: (anchorId: string, status: MarketAnchorStatus) => void
  onTabChange: (tab: WorkbenchTab) => void
  payload: SessionWorkbenchPayload
  realtimeDraft: string
  realtimeViewBlock: ContentBlockRecord | null
  similarCases: SimilarCaseView[]
}

export const SessionWorkspaceColumn = ({
  activeTab,
  activeAnchors,
  analysisCard,
  anchorReviewSuggestions,
  anchors,
  busy,
  composerSuggestions,
  currentTrade,
  deletedAiRecords,
  groundingHits,
  latestEvaluation,
  onDeleteAiRecord,
  onDeleteBlock,
  onRestoreBlock,
  onRealtimeDraftChange,
  onRestoreAiRecord,
  onSaveRealtimeView,
  onSetAnchorStatus,
  onTabChange,
  payload,
  realtimeDraft,
  realtimeViewBlock,
  similarCases,
}: SessionWorkspaceColumnProps) => (
    <section className="session-workbench__column session-workbench__column--workspace">
      <SectionCard title="分析与 AI 工作台" subtitle="我的看法、AI 分析和交易计划">
        <div className="tab-strip session-workbench__tabs">
          {(['view', 'ai', 'plan'] as WorkbenchTab[]).map((tab) => (
            <button
              className={`tab-button ${activeTab === tab ? 'is-active' : ''}`.trim()}
              key={tab}
              type="button"
              onClick={() => onTabChange(tab)}
            >
              {tabLabels[tab]}
            </button>
          ))}
        </div>
        <div className="session-workbench__tab-content">
          {activeTab === 'view' ? (
            <div className="session-workbench__editor">
              <SessionWorkbenchComposerShell
                onRealtimeDraftChange={onRealtimeDraftChange}
                realtimeDraft={realtimeDraft}
                sessionPayload={payload}
                suggestions={composerSuggestions}
              />
              <textarea
                className="inline-input session-workbench__textarea"
                onChange={(event) => onRealtimeDraftChange(event.target.value)}
                placeholder="把你的实时市场看法写在这里。这条笔记会本地保存，并随 Session 一起导出。"
                rows={10}
                value={realtimeDraft}
              />
              <div className="action-row">
                <button
                  className="button is-primary"
                  disabled={busy}
                  onClick={onSaveRealtimeView}
                  type="button"
                >
                  保存我的看法
                </button>
                {realtimeViewBlock && !realtimeViewBlock.soft_deleted ? (
                  <button
                    className="button is-secondary"
                    disabled={busy}
                    onClick={() => onDeleteBlock(realtimeViewBlock)}
                    type="button"
                  >
                    删除当前笔记
                  </button>
                ) : realtimeViewBlock ? (
                  <button
                    className="button is-secondary"
                    disabled={busy}
                    onClick={() => onRestoreBlock(realtimeViewBlock)}
                    type="button"
                  >
                    恢复当前笔记
                  </button>
                ) : null}
              </div>
              <p className="session-workbench__editor-hint">
                当前上下文：挂载到 {payload.session.id} 的 Session 级笔记。
              </p>
              <div className="session-workbench__anchor-context">
                <p className="session-workbench__deleted-label">Active Anchor Context</p>
                {activeAnchors.length > 0 ? (
                  <div className="composer-shell__anchors">
                    {activeAnchors.map((anchor) => (
                      <span className="status-pill" key={anchor.id}>{anchor.title}</span>
                    ))}
                  </div>
                ) : (
                  <p className="workbench-text">暂无 active anchors。</p>
                )}
              </div>
            </div>
          ) : null}
          {activeTab === 'ai' ? (
            analysisCard ? (
              <div className="session-workbench__editor">
                <AnalysisCardView card={analysisCard} />
                <div className="action-row">
                  <button
                    className="button is-secondary"
                    disabled={busy}
                    onClick={() => onDeleteAiRecord(analysisCard.ai_run_id)}
                    type="button"
                  >
                    删除当前 AI 记录
                  </button>
                </div>
              </div>
            ) : (
              <p className="empty-state">AI 分析生成后会显示在这里。</p>
            )
          ) : null}
          {activeTab === 'plan' ? (
            <p className="workbench-text">{payload.panels.trade_plan}</p>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard title="分析总结" subtitle="结构化结论与执行位">
        {analysisCard ? (
          <AnalysisCardView card={analysisCard} />
        ) : (
          <p className="empty-state">还没有 AI 摘要。</p>
        )}
        {deletedAiRecords.length > 0 ? (
          <div className="session-workbench__deleted-group">
            <p className="session-workbench__deleted-label">已删除 AI 记录</p>
            {deletedAiRecords.map((record) => (
              <article className="session-workbench__content-block is-deleted" key={record.ai_run.id}>
                <div className="session-workbench__content-header">
                  <div>
                    <h3>{record.content_block?.title ?? record.analysis_card?.summary_short ?? record.ai_run.model}</h3>
                    <p className="session-workbench__content-meta">{record.ai_run.provider} · {record.ai_run.prompt_kind}</p>
                  </div>
                  <button className="button is-secondary" disabled={busy} onClick={() => onRestoreAiRecord(record.ai_run.id)} type="button">
                    恢复
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title="交易快照" subtitle="当前交易上下文">
        {currentTrade ? (
          <TradeSnapshotCard trade={currentTrade} />
        ) : (
          <p className="empty-state">当前没有交易数据。</p>
        )}
      </SectionCard>

      <SectionCard title="Session 复盘" subtitle="执行评估">
        {latestEvaluation ? (
          <div className="session-workbench__review">
            <p className="session-workbench__review-score">评分 {latestEvaluation.score}</p>
            <p className="workbench-text">{latestEvaluation.note_md}</p>
          </div>
        ) : (
          <p className="empty-state">还没有记录复盘。</p>
        )}
      </SectionCard>

      <SectionCard title="Active Anchors" subtitle="用户确认后进入上下文层的关键区域记忆">
        <ActiveAnchorsPanel
          anchors={anchors}
          busy={busy}
          onSetStatus={onSetAnchorStatus}
        />
      </SectionCard>

      <SectionCard title="Anchor Review Suggestions" subtitle="自动评估仅作建议，最终状态由你决定">
        <AnchorReviewSuggestionsPanel suggestions={anchorReviewSuggestions} />
      </SectionCard>

      <SectionCard title="Grounding Hits" subtitle="当前 AI 分析命中的 approved knowledge">
        <GroundingHitsPanel hits={groundingHits} />
      </SectionCard>

      <SectionCard title="Similar Cases" subtitle="本地召回的相关样本，仅展示少量摘要">
        <SimilarCasesPanel cases={similarCases} />
      </SectionCard>
    </section>
)
