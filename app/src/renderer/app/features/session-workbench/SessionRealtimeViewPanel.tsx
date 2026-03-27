import { useEffect, useRef, useState } from 'react'
import { InlineSelectionToolbar } from '@app/components/InlineSelectionToolbar'
import type { ComposerSuggestion } from '@app/features/composer/types'
import { SessionWorkbenchComposerShell } from '@app/features/composer'
import type { MarketAnchorView } from '@app/features/anchors'
import { translateTradeSide } from '@app/ui/display-text'
import type { ContentBlockRecord } from '@shared/contracts/content'
import type { SessionWorkbenchPayload } from '@shared/contracts/workbench'
import { useUndoRedoState } from '@app/hooks/useUndoRedoState'
import { SessionWorkbenchNotesPanel } from './SessionWorkbenchNotesPanel'
import { applySelectionFormatting } from './modules/session-editor-formatting'

type SessionRealtimeViewPanelProps = {
  activeAnchors: MarketAnchorView[]
  busy: boolean
  onComposerSuggestionAccept: (suggestion: ComposerSuggestion) => void
  onCreateNoteBlock: (input?: {
    title?: string
    content_md?: string
  }) => Promise<ContentBlockRecord | null>
  onDeleteBlock: (block: ContentBlockRecord) => void
  onPasteClipboardImage: () => Promise<void>
  onRealtimeDraftChange: (value: string) => void
  onReorderNoteBlocks: (input: {
    session_id: string
    context_type: 'session' | 'trade'
    context_id: string
    ordered_block_ids: string[]
  }) => Promise<void>
  onRestoreBlock: (block: ContentBlockRecord) => void
  onSaveRealtimeView: () => void
  onUpdateNoteBlock: (input: {
    block_id: string
    title: string
    content_md: string
  }) => Promise<ContentBlockRecord | null>
  payload: SessionWorkbenchPayload
  realtimeDraft: string
  realtimeViewBlock: ContentBlockRecord | null
  suggestions: ComposerSuggestion[]
}

const isMac = navigator.platform.toLowerCase().includes('mac')

const isImagePasteEvent = (event: React.ClipboardEvent<HTMLTextAreaElement>) =>
  Array.from(event.clipboardData.items).some((item) => item.type.startsWith('image/'))

export const SessionRealtimeViewPanel = ({
  activeAnchors,
  busy,
  onComposerSuggestionAccept,
  onCreateNoteBlock,
  onDeleteBlock,
  onPasteClipboardImage,
  onRealtimeDraftChange,
  onReorderNoteBlocks,
  onRestoreBlock,
  onSaveRealtimeView,
  onUpdateNoteBlock,
  payload,
  realtimeDraft,
  realtimeViewBlock,
  suggestions,
}: SessionRealtimeViewPanelProps) => {
  const [selectionRange, setSelectionRange] = useState({ end: 0, start: 0 })
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const history = useUndoRedoState(realtimeDraft)
  const contextTrade = payload.current_context.trade_id
    ? payload.trades.find((trade) => trade.id === payload.current_context.trade_id) ?? null
    : null
  const realtimeContextLabel = contextTrade
    ? `当前上下文：挂载到 ${contextTrade.symbol} ${translateTradeSide(contextTrade.side)} 的 Trade 级笔记。`
    : `当前上下文：挂载到 ${payload.session.id} 的 Session 级笔记。`

  useEffect(() => {
    if (realtimeDraft !== history.value) {
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

  return (
    <div className="session-workbench__editor">
      <SessionWorkbenchComposerShell
        onSuggestionAccept={onComposerSuggestionAccept}
        onRealtimeDraftChange={onRealtimeDraftChange}
        realtimeDraft={realtimeDraft}
        sessionPayload={payload}
        suggestions={suggestions}
      />
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
            void onPasteClipboardImage()
          }}
          onSelect={(event) => {
            setSelectionRange({
              start: event.currentTarget.selectionStart,
              end: event.currentTarget.selectionEnd,
            })
          }}
          placeholder="把你的实时市场看法写在这里。这条笔记会本地保存，并随 Session 一起导出。"
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
