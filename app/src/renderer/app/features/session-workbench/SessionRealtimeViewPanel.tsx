import { useEffect, useRef, useState } from 'react'
import { InlineSelectionToolbar } from '@app/components/InlineSelectionToolbar'
import type { ComposerSuggestion } from '@app/features/composer/types'
import { SessionWorkbenchComposerShell } from '@app/features/composer'
import type { MarketAnchorView } from '@app/features/anchors'
import { translateAnalysisBias, translateTradeSide } from '@app/ui/display-text'
import type { AnalysisCardRecord } from '@shared/contracts/analysis'
import type { ContentBlockRecord } from '@shared/contracts/content'
import type { SessionWorkbenchPayload } from '@shared/contracts/workbench'
import { useUndoRedoState } from '@app/hooks/useUndoRedoState'
import { SessionWorkbenchNotesPanel } from './SessionWorkbenchNotesPanel'
import { applySelectionFormatting } from './modules/session-editor-formatting'

type SessionRealtimeViewPanelProps = {
  activeAnchors: MarketAnchorView[]
  analysisCard: AnalysisCardRecord | null
  busy: boolean
  onComposerSuggestionAccept: (suggestion: ComposerSuggestion) => void
  onCreateNoteBlock: (input?: {
    title?: string
    content_md?: string
  }) => Promise<ContentBlockRecord | null>
  onDeleteBlock: (block: ContentBlockRecord) => void
  onPasteClipboardImage: () => Promise<void>
  onPasteClipboardImageAndRunAnalysis: () => Promise<void>
  onRealtimeDraftChange: (value: string) => void
  onReorderNoteBlocks: (input: {
    session_id: string
    context_type: 'session' | 'trade'
    context_id: string
    ordered_block_ids: string[]
  }) => Promise<void>
  onRestoreBlock: (block: ContentBlockRecord) => void
  onRunAnalysis: () => Promise<void>
  onSaveRealtimeView: () => void
  onSaveRealtimeViewAndRunAnalysis: () => Promise<void>
  onUpdateNoteBlock: (input: {
    block_id: string
    title: string
    content_md: string
  }) => Promise<ContentBlockRecord | null>
  payload: SessionWorkbenchPayload
  realtimeDraft: string
  realtimeViewBlock: ContentBlockRecord | null
  selectedScreenshotCaption?: string | null
  suggestions: ComposerSuggestion[]
}

const isMac = navigator.platform.toLowerCase().includes('mac')

const isImagePasteEvent = (event: React.ClipboardEvent<HTMLTextAreaElement>) =>
  Array.from(event.clipboardData.items).some((item) => item.type.startsWith('image/'))

const appendNoteSegment = (existing: string, next: string) => {
  const trimmedExisting = existing.trimEnd()
  const trimmedNext = next.trim()
  if (!trimmedNext) {
    return existing
  }
  if (!trimmedExisting) {
    return trimmedNext
  }
  return `${trimmedExisting}\n\n${trimmedNext}`
}

export const SessionRealtimeViewPanel = ({
  activeAnchors,
  analysisCard,
  busy,
  onComposerSuggestionAccept,
  onCreateNoteBlock,
  onDeleteBlock,
  onPasteClipboardImage,
  onPasteClipboardImageAndRunAnalysis,
  onRealtimeDraftChange,
  onReorderNoteBlocks,
  onRestoreBlock,
  onRunAnalysis,
  onSaveRealtimeView,
  onSaveRealtimeViewAndRunAnalysis,
  onUpdateNoteBlock,
  payload,
  realtimeDraft,
  realtimeViewBlock,
  selectedScreenshotCaption = null,
  suggestions,
}: SessionRealtimeViewPanelProps) => {
  const [selectionRange, setSelectionRange] = useState({ end: 0, start: 0 })
  const [autoReferenceOnPaste, setAutoReferenceOnPaste] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const history = useUndoRedoState(realtimeDraft)
  const syncContextKeyRef = useRef<string | null>(null)
  const contextTrade = payload.current_context.trade_id
    ? payload.trades.find((trade) => trade.id === payload.current_context.trade_id) ?? null
    : null
  const realtimeContextLabel = contextTrade
    ? `当前挂载：${contextTrade.symbol} ${translateTradeSide(contextTrade.side)}`
    : '当前挂载：工作过程'
  const persistedDraft = realtimeViewBlock?.content_md ?? ''
  const draftNeedsSave = history.value !== persistedDraft
  const askJarvisLabel = draftNeedsSave ? '保存并让 AI 参考' : '让 AI 参考这一页'

  useEffect(() => {
    const nextContextKey = `${payload.session.id}:${payload.current_context.trade_id ?? 'session'}`
    const shouldResetHistory = syncContextKeyRef.current !== nextContextKey
    syncContextKeyRef.current = nextContextKey
    if (shouldResetHistory && realtimeDraft !== history.value) {
      history.reset(realtimeDraft)
    }
  }, [history, payload.current_context.trade_id, payload.session.id, realtimeDraft])

  useEffect(() => {
    if (history.value !== realtimeDraft) {
      onRealtimeDraftChange(history.value)
    }
  }, [history.value, onRealtimeDraftChange, realtimeDraft])

  const handleEditorKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const modifierPressed = isMac ? event.metaKey : event.ctrlKey
    if (!modifierPressed) {
      return
    }

    if (event.key.toLowerCase() === 'z' && !event.shiftKey) {
      event.preventDefault()
      history.undo()
      return
    }

    if ((event.key.toLowerCase() === 'z' && event.shiftKey) || event.key.toLowerCase() === 'y') {
      event.preventDefault()
      history.redo()
    }
  }

  const handleSelectionAction = (action: 'bold' | 'quote' | 'bullet') => {
    const textarea = textareaRef.current
    if (!textarea) {
      return
    }

    const result = applySelectionFormatting(history.value, textarea.selectionStart, textarea.selectionEnd, action)
    history.setValue(result.nextValue)
    window.requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(result.nextSelectionStart, result.nextSelectionEnd)
      setSelectionRange({
        start: result.nextSelectionStart,
        end: result.nextSelectionEnd,
      })
    })
  }

  const handleAskJarvis = () => {
    if (draftNeedsSave) {
      void onSaveRealtimeViewAndRunAnalysis()
      return
    }
    void onRunAnalysis()
  }

  return (
    <div className="session-workbench__editor">
      <SessionWorkbenchComposerShell
        onSuggestionAccept={onComposerSuggestionAccept}
        onRealtimeDraftChange={history.setValue}
        realtimeDraft={history.value}
        sessionPayload={payload}
        suggestions={suggestions}
      />
      <div className="composer-shell__anchors">
        {selectedScreenshotCaption ? <span className="status-pill">当前图：{selectedScreenshotCaption}</span> : null}
        <span className="status-pill">{realtimeContextLabel}</span>
      </div>
      <section className="session-workbench__jarvis">
        <div className="session-workbench__jarvis-header">
          <div>
            <h3>AI 旁注</h3>
            <p>它会参考当前图、当前文字和当前挂载，不会直接改你的正文。</p>
          </div>
          {analysisCard ? (
            <span className="status-pill">
              最近参考：{translateAnalysisBias(analysisCard.bias)} · {analysisCard.confidence_pct}%
            </span>
          ) : (
            <span className="status-pill">还没有本页 AI 参考</span>
          )}
        </div>
        <div className="action-row">
          <button className="button is-secondary" disabled={busy} onClick={handleAskJarvis} type="button">
            {askJarvisLabel}
          </button>
          <button
            className="button is-secondary"
            disabled={busy}
            onClick={() => void onPasteClipboardImageAndRunAnalysis()}
            type="button"
          >
            贴图并参考
          </button>
          <label className="session-workbench__jarvis-toggle">
            <input
              checked={autoReferenceOnPaste}
              disabled={busy}
              onChange={(event) => setAutoReferenceOnPaste(event.target.checked)}
              type="checkbox"
            />
            <span>贴图后自动参考</span>
          </label>
        </div>
        {analysisCard ? (
          <div className="session-workbench__jarvis-note">
            <p>{analysisCard.summary_short}</p>
            <div className="session-workbench__jarvis-pills">
              <span className="status-pill">入场：{analysisCard.entry_zone}</span>
              <span className="status-pill">止损：{analysisCard.stop_loss}</span>
              <span className="status-pill">止盈：{analysisCard.take_profit}</span>
            </div>
            <div className="action-row">
              <button
                className="button is-secondary"
                disabled={busy}
                onClick={() => history.setValue(appendNoteSegment(history.value, analysisCard.summary_short))}
                type="button"
              >
                纳入当前笔记
              </button>
            </div>
          </div>
        ) : null}
      </section>
      <div className="session-workbench__selection-editor">
        {selectionRange.end > selectionRange.start ? (
          <InlineSelectionToolbar disabled={busy} onAction={handleSelectionAction} />
        ) : null}
        <textarea
          className="inline-input session-workbench__textarea"
          onChange={(event) => history.setValue(event.target.value)}
          onKeyDown={handleEditorKeyDown}
          onPaste={(event) => {
            if (!isImagePasteEvent(event)) {
              return
            }
            event.preventDefault()
            void (autoReferenceOnPaste ? onPasteClipboardImageAndRunAnalysis() : onPasteClipboardImage())
          }}
          onSelect={(event) => {
            setSelectionRange({
              start: event.currentTarget.selectionStart,
              end: event.currentTarget.selectionEnd,
            })
          }}
          placeholder="把你对这段事件流的判断写在这里。可以继续补充，也可以接着 AI 的回复往下写。"
          ref={textareaRef}
          rows={10}
          value={history.value}
        />
      </div>
      <div className="action-row">
        <button className="button is-secondary" disabled={busy || !history.canUndo} onClick={history.undo} type="button">
          撤销
        </button>
        <button className="button is-secondary" disabled={busy || !history.canRedo} onClick={history.redo} type="button">
          重做
        </button>
        <button className="button is-secondary" disabled={busy} onClick={() => void onPasteClipboardImage()} type="button">
          粘贴剪贴板图片
        </button>
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
      {activeAnchors.length > 0 ? (
        <details className="session-workbench__anchor-context">
          <summary className="session-workbench__support-summary">
            <div>
              <strong>当前锚点</strong>
              <p>只在需要时展开，不占正文位置。</p>
            </div>
            <span className="status-pill">{activeAnchors.length}</span>
          </summary>
          <div className="composer-shell__anchors">
            {activeAnchors.map((anchor) => (
              <span className="status-pill" key={anchor.id}>{anchor.title}</span>
            ))}
          </div>
        </details>
      ) : null}
      <SessionWorkbenchNotesPanel
        busy={busy}
        onCreateNoteBlock={onCreateNoteBlock}
        onDeleteBlock={onDeleteBlock}
        onPasteClipboardImage={onPasteClipboardImage}
        onReorderBlocks={onReorderNoteBlocks}
        onRestoreBlock={onRestoreBlock}
        onUpdateNoteBlock={onUpdateNoteBlock}
        payload={payload}
      />
    </div>
  )
}
