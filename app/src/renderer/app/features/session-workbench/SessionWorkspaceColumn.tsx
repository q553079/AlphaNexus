import { useEffect, useMemo, useState } from 'react'
import { AnalysisCardView } from '@app/components/AnalysisCardView'
import { SectionCard } from '@app/components/SectionCard'
import { TradeSnapshotCard } from '@app/components/TradeSnapshotCard'
import { AiComparisonPanel } from '@app/features/session-workbench/AiComparisonPanel'
import { ActiveAnchorsPanel } from '@app/features/anchors'
import type { ComposerSuggestion } from '@app/features/composer/types'
import type { MarketAnchorStatus, MarketAnchorView } from '@app/features/anchors'
import { GroundingHitsPanel } from '@app/features/grounding'
import type { GroundingHitView } from '@app/features/grounding'
import {
  AnchorReviewSuggestionsPanel,
  SimilarCasesPanel,
} from '@app/features/suggestions'
import type { AnchorReviewSuggestionView, SimilarCaseView } from '@app/features/suggestions'
import type { AnalysisCardRecord } from '@shared/contracts/analysis'
import type { ContentBlockRecord, ScreenshotRecord } from '@shared/contracts/content'
import type { EvaluationRecord, TradeRecord } from '@shared/contracts/trade'
import type { AiRecordChain, SessionWorkbenchPayload } from '@shared/contracts/workbench'
import { buildAiComparisonViewModel } from './modules/session-ai-compare'
import { SessionRealtimeViewPanel } from './SessionRealtimeViewPanel'

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
  onCancelTrade: (input: {
    trade_id: string
    reason_md?: string
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
  onCancelTrade,
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
  const [cancelReason, setCancelReason] = useState('')

  useEffect(() => {
    if (currentTrade?.status === 'open') {
      setAddQuantity('1')
      setAddPrice(toInputValue(currentTrade.entry_price))
      setReduceQuantity('1')
      setReducePrice(toInputValue(currentTrade.entry_price))
      setClosePrice(toInputValue(currentTrade.take_profit ?? currentTrade.entry_price))
      setCancelReason('')
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
  const canCancelTrade = activeTrade != null && !busy

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
            <div className="form-grid" style={{ marginTop: 12 }}>
              <label className="field field--full">
                <span>取消原因</span>
                <textarea
                  className="inline-input session-workbench__trade-thesis"
                  disabled={busy}
                  onChange={(event) => setCancelReason(event.target.value)}
                  placeholder="仅用于误建线程、setup 失效等取消场景。不会覆盖原始 trade facts。"
                  rows={3}
                  value={cancelReason}
                />
              </label>
            </div>
            <button
              className="button is-ghost"
              disabled={!canCancelTrade}
              onClick={() => {
                if (!activeTrade || !canCancelTrade) {
                  return
                }
                onCancelTrade({
                  trade_id: activeTrade.id,
                  reason_md: cancelReason.trim() || undefined,
                })
              }}
              type="button"
            >
              取消当前 Trade
            </button>
          </article>
        </div>
      )}
    </div>
  )
}

type SessionWorkspaceColumnProps = {
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
  onCancelTrade: (input: {
    trade_id: string
    reason_md?: string
  }) => void
  onDeleteAiRecord: (aiRunId: string) => void
  onDeleteBlock: (block: ContentBlockRecord) => void
  onComposerSuggestionAccept: (suggestion: ComposerSuggestion) => void
  onCreateNoteBlock: (input?: {
    title?: string
    content_md?: string
  }) => Promise<ContentBlockRecord | null>
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
  onPasteClipboardImage: () => void
  onPasteClipboardImageAndRunAnalysis: () => void
  onReorderNoteBlocks: (input: {
    session_id: string
    context_type: 'session' | 'trade'
    context_id: string
    ordered_block_ids: string[]
  }) => void
  onRestoreBlock: (block: ContentBlockRecord) => void
  onRealtimeDraftChange: (value: string) => void
  onRestoreAiRecord: (aiRunId: string) => void
  onRunAnalysis: () => void
  onRunAnalysisAcrossProviders: () => void
  onSaveRealtimeView: () => void
  onSaveRealtimeViewAndRunAnalysis: () => void
  onSetAnchorStatus: (anchorId: string, status: MarketAnchorStatus) => void
  payload: SessionWorkbenchPayload
  realtimeDraft: string
  realtimeViewBlock: ContentBlockRecord | null
  selectedScreenshot: ScreenshotRecord | null
  similarCases: SimilarCaseView[]
  onUpdateNoteBlock: (input: {
    block_id: string
    title: string
    content_md: string
  }) => Promise<ContentBlockRecord | null>
}

export const SessionWorkspaceColumn = ({
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
  onCancelTrade,
  onDeleteAiRecord,
  onDeleteBlock,
  onComposerSuggestionAccept,
  onCreateNoteBlock,
  onOpenTrade,
  onPasteClipboardImage,
  onPasteClipboardImageAndRunAnalysis,
  onReorderNoteBlocks,
  onReduceTrade,
  onRestoreBlock,
  onRealtimeDraftChange,
  onRestoreAiRecord,
  onRunAnalysis,
  onRunAnalysisAcrossProviders,
  onSaveRealtimeView,
  onSaveRealtimeViewAndRunAnalysis,
  onSetAnchorStatus,
  payload,
  realtimeDraft,
  realtimeViewBlock,
  selectedScreenshot,
  similarCases,
  onUpdateNoteBlock,
}: SessionWorkspaceColumnProps) => {
  const analysisRun = analysisCard
    ? payload.ai_runs.find((run) => run.id === analysisCard.ai_run_id) ?? null
    : null
  const aiComparison = useMemo(() => buildAiComparisonViewModel(payload, {
    screenshot_id: selectedScreenshot?.id ?? null,
    trade_id: payload.current_context.trade_id ?? null,
  }), [payload, selectedScreenshot?.id])

  return (
    <section className="session-workbench__column session-workbench__column--workspace">
      <SectionCard
        className="session-workbench__page-section"
        title="页面笔记"
        subtitle="顺着这一页写，AI 只在旁边给参考。"
      >
        <SessionRealtimeViewPanel
          activeAnchors={activeAnchors}
          analysisCard={analysisCard}
          busy={busy}
          onComposerSuggestionAccept={onComposerSuggestionAccept}
          onCreateNoteBlock={onCreateNoteBlock}
          onDeleteBlock={onDeleteBlock}
          onPasteClipboardImage={async() => {
            onPasteClipboardImage()
          }}
          onPasteClipboardImageAndRunAnalysis={async() => {
            onPasteClipboardImageAndRunAnalysis()
          }}
          onRealtimeDraftChange={onRealtimeDraftChange}
          onReorderNoteBlocks={async(input) => {
            onReorderNoteBlocks(input)
          }}
          onRestoreBlock={onRestoreBlock}
          onRunAnalysis={async() => {
            onRunAnalysis()
          }}
          onSaveRealtimeView={onSaveRealtimeView}
          onSaveRealtimeViewAndRunAnalysis={async() => {
            onSaveRealtimeViewAndRunAnalysis()
          }}
          onUpdateNoteBlock={onUpdateNoteBlock}
          payload={payload}
          realtimeDraft={realtimeDraft}
          realtimeViewBlock={realtimeViewBlock}
          selectedScreenshotCaption={selectedScreenshot?.caption ?? null}
          suggestions={composerSuggestions}
        />
      </SectionCard>

      {analysisCard || deletedAiRecords.length > 0 ? (
        <SectionCard
          className="session-workbench__page-section"
          title="完整 AI 回复"
          subtitle="默认收起，需要时再展开。"
        >
          <div className="session-workbench__editor">
            {analysisCard ? (
              <details className="session-workbench__support-drawer" open={false}>
                <summary className="session-workbench__support-summary">
                  <div>
                    <strong>查看这次 AI 完整回复</strong>
                    <p>{analysisCard.summary_short}</p>
                  </div>
                  <span className="status-pill">按需展开</span>
                </summary>
                <div className="session-workbench__support-stack">
                  <AnalysisCardView aiRun={analysisRun} card={analysisCard} />
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
              </details>
            ) : null}
            {deletedAiRecords.length > 0 ? (
              <details className="session-workbench__support-drawer">
                <summary className="session-workbench__support-summary">
                  <div>
                    <strong>已删除的 AI 记录</strong>
                    <p>保留恢复入口，不放到主舞台。</p>
                  </div>
                  <span className="status-pill">{deletedAiRecords.length}</span>
                </summary>
                <div className="session-workbench__support-stack">
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
              </details>
            ) : null}
            <details className="session-workbench__support-drawer">
              <summary className="session-workbench__support-summary">
                <div>
                  <strong>更多 AI 对照</strong>
                  <p>需要时再展开，不让对照视图常驻占位。</p>
                </div>
                <span className="status-pill">按需展开</span>
              </summary>
              <div className="session-workbench__support-stack">
                <AiComparisonPanel
                  busy={busy}
                  onRunCompare={() => {
                    onRunAnalysisAcrossProviders()
                  }}
                  viewModel={aiComparison}
                />
              </div>
            </details>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard
        className="session-workbench__page-section"
        title="交易块"
        subtitle="只放最小交易动作。"
      >
      {currentTrade ? (
        <TradeSnapshotCard trade={currentTrade} />
      ) : (
        <p className="empty-state">当前没有交易数据。</p>
      )}
      <TradeLifecycleControls
        busy={busy}
        currentTrade={currentTrade}
        onAddToTrade={onAddToTrade}
        onCancelTrade={onCancelTrade}
        onCloseTrade={onCloseTrade}
        onOpenTrade={onOpenTrade}
        onReduceTrade={onReduceTrade}
      />
      </SectionCard>

      <details className="session-workbench__support-drawer">
        <summary className="session-workbench__support-summary">
          <div>
            <strong>补充上下文与复核</strong>
            <p>锚点、知识、相似案例和复盘都放这里，需要时再展开。</p>
          </div>
          <span className="status-pill">按需展开</span>
        </summary>
        <div className="session-workbench__support-stack">
          <section className="session-workbench__support-section">
            <h3>复盘</h3>
            {latestEvaluation ? (
              <div className="session-workbench__review">
                <p className="session-workbench__review-score">评分 {latestEvaluation.score}</p>
                <p className="workbench-text">{latestEvaluation.note_md}</p>
              </div>
            ) : (
              <p className="empty-state">还没有记录复盘。</p>
            )}
          </section>

          <section className="session-workbench__support-section">
            <h3>锚点</h3>
            <ActiveAnchorsPanel
              anchors={anchors}
              busy={busy}
              onSetStatus={onSetAnchorStatus}
            />
          </section>

          <section className="session-workbench__support-section">
            <h3>锚点复核建议</h3>
            <AnchorReviewSuggestionsPanel suggestions={anchorReviewSuggestions} />
          </section>

          <section className="session-workbench__support-section">
            <h3>命中的知识</h3>
            <GroundingHitsPanel hits={groundingHits} />
          </section>

          <section className="session-workbench__support-section">
            <h3>相似案例</h3>
            <SimilarCasesPanel cases={similarCases} />
          </section>
        </div>
      </details>
    </section>
  )
}
