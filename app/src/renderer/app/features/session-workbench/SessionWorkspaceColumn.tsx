import { useEffect, useState } from 'react'
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
import { translateTradeSide } from '@app/ui/display-text'
import type { WorkbenchTab } from './session-workbench-types'

const tabLabels: Record<WorkbenchTab, string> = {
  view: '我的看法',
  ai: 'AI 分析',
  plan: '交易计划',
}

const toInputValue = (value: number | null | undefined) =>
  value == null ? '' : String(value)

const parseNumberInput = (value: string) => {
  const next = Number(value)
  return Number.isFinite(next) ? next : null
}

type TradeLifecycleControlsProps = {
  busy: boolean
  currentTrade: TradeRecord | null
  onAddToTrade: (input: {
    trade_id: string
    quantity: number
    price: number
  }) => void
  onCloseTrade: (input: {
    trade_id: string
    exit_price: number
  }) => void
  onOpenTrade: (input: {
    side: 'long' | 'short'
    quantity: number
    entry_price: number
    stop_loss: number
    take_profit: number
    thesis: string
  }) => void
  onReduceTrade: (input: {
    trade_id: string
    quantity: number
    price: number
  }) => void
}

const TradeLifecycleControls = ({
  busy,
  currentTrade,
  onAddToTrade,
  onCloseTrade,
  onOpenTrade,
  onReduceTrade,
}: TradeLifecycleControlsProps) => {
  const [openSide, setOpenSide] = useState<'long' | 'short'>(currentTrade?.side ?? 'long')
  const [openQuantity, setOpenQuantity] = useState(toInputValue(currentTrade?.quantity ?? 1))
  const [openEntryPrice, setOpenEntryPrice] = useState(toInputValue(currentTrade?.entry_price))
  const [openStopLoss, setOpenStopLoss] = useState(toInputValue(currentTrade?.stop_loss))
  const [openTakeProfit, setOpenTakeProfit] = useState(toInputValue(currentTrade?.take_profit))
  const [openThesis, setOpenThesis] = useState(currentTrade?.thesis ?? '')
  const [addQuantity, setAddQuantity] = useState('1')
  const [addPrice, setAddPrice] = useState(toInputValue(currentTrade?.entry_price))
  const [reduceQuantity, setReduceQuantity] = useState('1')
  const [reducePrice, setReducePrice] = useState(toInputValue(currentTrade?.entry_price))
  const [closePrice, setClosePrice] = useState(toInputValue(currentTrade?.take_profit ?? currentTrade?.entry_price))

  useEffect(() => {
    if (currentTrade?.status === 'open') {
      setAddQuantity('1')
      setAddPrice(toInputValue(currentTrade.entry_price))
      setReduceQuantity('1')
      setReducePrice(toInputValue(currentTrade.entry_price))
      setClosePrice(toInputValue(currentTrade.take_profit ?? currentTrade.entry_price))
      return
    }

    setOpenSide(currentTrade?.side ?? 'long')
    setOpenQuantity(toInputValue(currentTrade?.quantity ?? 1))
    setOpenEntryPrice(toInputValue(currentTrade?.entry_price))
    setOpenStopLoss(toInputValue(currentTrade?.stop_loss))
    setOpenTakeProfit(toInputValue(currentTrade?.take_profit))
    setOpenThesis(currentTrade?.thesis ?? '')
  }, [currentTrade?.entry_price, currentTrade?.id, currentTrade?.quantity, currentTrade?.side, currentTrade?.status, currentTrade?.stop_loss, currentTrade?.take_profit, currentTrade?.thesis])

  const openQuantityValue = parseNumberInput(openQuantity)
  const openEntryPriceValue = parseNumberInput(openEntryPrice)
  const openStopLossValue = parseNumberInput(openStopLoss)
  const openTakeProfitValue = parseNumberInput(openTakeProfit)
  const addQuantityValue = parseNumberInput(addQuantity)
  const addPriceValue = parseNumberInput(addPrice)
  const reduceQuantityValue = parseNumberInput(reduceQuantity)
  const reducePriceValue = parseNumberInput(reducePrice)
  const closePriceValue = parseNumberInput(closePrice)
  const activeTrade = currentTrade?.status === 'open' ? currentTrade : null

  const canOpenTrade = !busy
    && openQuantityValue != null
    && openQuantityValue > 0
    && openEntryPriceValue != null
    && openStopLossValue != null
    && openTakeProfitValue != null
    && openThesis.trim().length > 0

  const canAddTrade = activeTrade != null
    && !busy
    && addQuantityValue != null
    && addQuantityValue > 0
    && addPriceValue != null

  const canReduceTrade = activeTrade != null
    && !busy
    && reduceQuantityValue != null
    && reduceQuantityValue > 0
    && reducePriceValue != null
    && activeTrade.quantity - reduceQuantityValue > 0

  const canCloseTrade = activeTrade != null
    && !busy
    && closePriceValue != null

  return (
    <div className="session-workbench__trade-controls">
      {!activeTrade ? (
        <div className="session-workbench__trade-form">
          <div className="form-grid">
            <label className="field">
              <span>方向</span>
              <select
                className="session-workbench__trade-select"
                disabled={busy}
                onChange={(event) => setOpenSide(event.target.value as 'long' | 'short')}
                value={openSide}
              >
                <option value="long">做多</option>
                <option value="short">做空</option>
              </select>
            </label>
            <label className="field">
              <span>数量</span>
              <input
                className="inline-input"
                disabled={busy}
                min="0"
                onChange={(event) => setOpenQuantity(event.target.value)}
                step="any"
                type="number"
                value={openQuantity}
              />
            </label>
            <label className="field">
              <span>入场价</span>
              <input
                className="inline-input"
                disabled={busy}
                onChange={(event) => setOpenEntryPrice(event.target.value)}
                step="any"
                type="number"
                value={openEntryPrice}
              />
            </label>
            <label className="field">
              <span>止损</span>
              <input
                className="inline-input"
                disabled={busy}
                onChange={(event) => setOpenStopLoss(event.target.value)}
                step="any"
                type="number"
                value={openStopLoss}
              />
            </label>
            <label className="field">
              <span>止盈</span>
              <input
                className="inline-input"
                disabled={busy}
                onChange={(event) => setOpenTakeProfit(event.target.value)}
                step="any"
                type="number"
                value={openTakeProfit}
              />
            </label>
            <label className="field field--full">
              <span>Thesis</span>
              <textarea
                className="inline-input session-workbench__trade-thesis"
                disabled={busy}
                onChange={(event) => setOpenThesis(event.target.value)}
                rows={3}
                value={openThesis}
              />
            </label>
          </div>
          <div className="action-row">
            <button
              className="button is-primary"
              disabled={!canOpenTrade}
              onClick={() => {
                if (!canOpenTrade || openQuantityValue == null || openEntryPriceValue == null || openStopLossValue == null || openTakeProfitValue == null) {
                  return
                }
                onOpenTrade({
                  side: openSide,
                  quantity: openQuantityValue,
                  entry_price: openEntryPriceValue,
                  stop_loss: openStopLossValue,
                  take_profit: openTakeProfitValue,
                  thesis: openThesis.trim(),
                })
              }}
              type="button"
            >
              开仓
            </button>
          </div>
          <p className="session-workbench__editor-hint">
            {currentTrade?.status === 'closed'
              ? '当前没有 open trade，下面会基于最新一笔已关闭交易的参数做预填。'
              : '当前没有 open trade，先记录一笔真实开仓，再继续管理动作。'}
          </p>
        </div>
      ) : (
        <div className="session-workbench__trade-panels">
          <article className="session-workbench__trade-panel">
            <h3>加仓</h3>
            <div className="form-grid">
              <label className="field">
                <span>数量</span>
                <input
                  className="inline-input"
                  disabled={busy}
                  min="0"
                  onChange={(event) => setAddQuantity(event.target.value)}
                  step="any"
                  type="number"
                  value={addQuantity}
                />
              </label>
              <label className="field">
                <span>执行价</span>
                <input
                  className="inline-input"
                  disabled={busy}
                  onChange={(event) => setAddPrice(event.target.value)}
                  step="any"
                  type="number"
                  value={addPrice}
                />
              </label>
            </div>
            <button
              className="button is-secondary"
              disabled={!canAddTrade}
              onClick={() => {
                if (!activeTrade || !canAddTrade || addQuantityValue == null || addPriceValue == null) {
                  return
                }
                onAddToTrade({
                  trade_id: activeTrade.id,
                  quantity: addQuantityValue,
                  price: addPriceValue,
                })
              }}
              type="button"
            >
              提交加仓
            </button>
          </article>

          <article className="session-workbench__trade-panel">
            <h3>减仓</h3>
            <div className="form-grid">
              <label className="field">
                <span>数量</span>
                <input
                  className="inline-input"
                  disabled={busy}
                  min="0"
                  onChange={(event) => setReduceQuantity(event.target.value)}
                  step="any"
                  type="number"
                  value={reduceQuantity}
                />
              </label>
              <label className="field">
                <span>执行价</span>
                <input
                  className="inline-input"
                  disabled={busy}
                  onChange={(event) => setReducePrice(event.target.value)}
                  step="any"
                  type="number"
                  value={reducePrice}
                />
              </label>
            </div>
            <button
              className="button is-secondary"
              disabled={!canReduceTrade}
              onClick={() => {
                if (!activeTrade || !canReduceTrade || reduceQuantityValue == null || reducePriceValue == null) {
                  return
                }
                onReduceTrade({
                  trade_id: activeTrade.id,
                  quantity: reduceQuantityValue,
                  price: reducePriceValue,
                })
              }}
              type="button"
            >
              提交减仓
            </button>
          </article>

          <article className="session-workbench__trade-panel">
            <h3>平仓</h3>
            <div className="form-grid">
              <label className="field field--full">
                <span>平仓价</span>
                <input
                  className="inline-input"
                  disabled={busy}
                  onChange={(event) => setClosePrice(event.target.value)}
                  step="any"
                  type="number"
                  value={closePrice}
                />
              </label>
            </div>
            <button
              className="button is-primary"
              disabled={!canCloseTrade}
              onClick={() => {
                if (!activeTrade || !canCloseTrade || closePriceValue == null) {
                  return
                }
                onCloseTrade({
                  trade_id: activeTrade.id,
                  exit_price: closePriceValue,
                })
              }}
              type="button"
            >
              提交平仓
            </button>
          </article>
        </div>
      )}
    </div>
  )
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
  onAddToTrade: (input: {
    trade_id: string
    quantity: number
    price: number
  }) => void
  onCloseTrade: (input: {
    trade_id: string
    exit_price: number
  }) => void
  onDeleteAiRecord: (aiRunId: string) => void
  onDeleteBlock: (block: ContentBlockRecord) => void
  onOpenTrade: (input: {
    side: 'long' | 'short'
    quantity: number
    entry_price: number
    stop_loss: number
    take_profit: number
    thesis: string
  }) => void
  onReduceTrade: (input: {
    trade_id: string
    quantity: number
    price: number
  }) => void
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
  onAddToTrade,
  onCloseTrade,
  onDeleteAiRecord,
  onDeleteBlock,
  onOpenTrade,
  onReduceTrade,
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
}: SessionWorkspaceColumnProps) => {
  const contextTrade = payload.current_context.trade_id
    ? payload.trades.find((trade) => trade.id === payload.current_context.trade_id) ?? null
    : null
  const realtimeContextLabel = contextTrade
    ? `当前上下文：挂载到 ${contextTrade.symbol} ${translateTradeSide(contextTrade.side)} 的 Trade 级笔记。`
    : `当前上下文：挂载到 ${payload.session.id} 的 Session 级笔记。`

  return (
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
              {realtimeContextLabel}
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

    <SectionCard title="交易快照" subtitle="当前交易上下文与最小交易动作">
      {currentTrade ? (
        <TradeSnapshotCard trade={currentTrade} />
      ) : (
        <p className="empty-state">当前没有交易数据。</p>
      )}
      <TradeLifecycleControls
        busy={busy}
        currentTrade={currentTrade}
        onAddToTrade={onAddToTrade}
        onCloseTrade={onCloseTrade}
        onOpenTrade={onOpenTrade}
        onReduceTrade={onReduceTrade}
      />
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
}
