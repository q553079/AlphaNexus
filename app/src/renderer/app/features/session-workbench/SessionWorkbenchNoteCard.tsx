import { useEffect, useRef, useState } from 'react'
import { InlineSelectionToolbar } from '@app/components/InlineSelectionToolbar'
import { useUndoRedoState } from '@app/hooks/useUndoRedoState'
import type { ContentBlockRecord } from '@shared/contracts/content'
import { applySelectionFormatting } from './modules/session-editor-formatting'

type NoteSaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

type NoteDraftState = {
  content_md: string
  title: string
}

type SessionWorkbenchNoteCardProps = {
  block: ContentBlockRecord
  busy: boolean
  indexLabel: string
  onDeleteBlock: (block: ContentBlockRecord) => void
  onDropOnBlock: (targetBlockId: string) => Promise<void>
  onPasteClipboardImage: () => Promise<void>
  onStartDrag: (blockId: string) => void
  onUpdateNoteBlock: (input: {
    block_id: string
    title: string
    content_md: string
  }) => Promise<ContentBlockRecord | null>
  scrollId: string
}

const autosaveDelayMs = 360

const saveStateLabel: Record<Exclude<NoteSaveState, 'idle'>, string> = {
  dirty: '待保存',
  saving: '本地保存中',
  saved: '本地已同步',
  error: '保存失败',
}

const isImagePasteEvent = (event: React.ClipboardEvent<HTMLTextAreaElement>) =>
  Array.from(event.clipboardData.items).some((item) => item.type.startsWith('image/'))

export const SessionWorkbenchNoteCard = ({
  block,
  busy,
  indexLabel,
  onDeleteBlock,
  onDropOnBlock,
  onPasteClipboardImage,
  onStartDrag,
  onUpdateNoteBlock,
  scrollId,
}: SessionWorkbenchNoteCardProps) => {
  const [saveState, setSaveState] = useState<NoteSaveState>('idle')
  const [selectionRange, setSelectionRange] = useState({ end: 0, start: 0 })
  const contentTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const draftState = useUndoRedoState<NoteDraftState>({
    title: block.title,
    content_md: block.content_md,
  })

  useEffect(() => {
    draftState.reset({
      title: block.title,
      content_md: block.content_md,
    })
    setSelectionRange({ start: 0, end: 0 })
    setSaveState('saved')
  }, [block.content_md, block.id, block.title])

  useEffect(() => {
    const normalizedTitle = draftState.value.title.trim() || '用户笔记'
    const changed = normalizedTitle !== block.title || draftState.value.content_md !== block.content_md
    if (!changed) {
      setSaveState('saved')
      return
    }

    setSaveState('dirty')
    const timer = window.setTimeout(() => {
      setSaveState('saving')
      void onUpdateNoteBlock({
        block_id: block.id,
        title: normalizedTitle,
        content_md: draftState.value.content_md,
      }).then(() => {
        setSaveState('saved')
      }).catch(() => {
        setSaveState('error')
      })
    }, autosaveDelayMs)

    return () => {
      window.clearTimeout(timer)
    }
  }, [block.content_md, block.id, block.title, draftState.value.content_md, draftState.value.title, onUpdateNoteBlock])

  const handleSelectionAction = (action: 'bold' | 'quote' | 'bullet') => {
    const textarea = contentTextareaRef.current
    if (!textarea) {
      return
    }

    const result = applySelectionFormatting(
      draftState.value.content_md,
      textarea.selectionStart,
      textarea.selectionEnd,
      action,
    )
    draftState.setValue({
      ...draftState.value,
      content_md: result.nextValue,
    })
    window.requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(result.nextSelectionStart, result.nextSelectionEnd)
      setSelectionRange({
        start: result.nextSelectionStart,
        end: result.nextSelectionEnd,
      })
    })
  }

  const handleEditorKeyDown = (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const isUndoModifier = navigator.platform.toLowerCase().includes('mac') ? event.metaKey : event.ctrlKey
    if (!isUndoModifier) {
      return
    }

    if (event.key.toLowerCase() === 'z' && !event.shiftKey) {
      event.preventDefault()
      draftState.undo()
      return
    }

    if ((event.key.toLowerCase() === 'z' && event.shiftKey) || event.key.toLowerCase() === 'y') {
      event.preventDefault()
      draftState.redo()
    }
  }

  return (
    <article
      className="session-note-card"
      id={scrollId}
      onDragOver={(event) => event.preventDefault()}
      onDrop={() => {
        void onDropOnBlock(block.id)
      }}
    >
      <header className="session-note-card__header">
        <div className="session-note-card__title-wrap">
          <p className="session-workbench__deleted-label">{indexLabel}</p>
          <input
            className="inline-input session-note-card__title-input"
            disabled={busy}
            onChange={(event) => draftState.setValue({
              ...draftState.value,
              title: event.target.value,
            })}
            onKeyDown={handleEditorKeyDown}
            placeholder="笔记标题"
            value={draftState.value.title}
          />
        </div>
        <div className="action-row session-note-card__actions">
          <button
            className="button is-secondary"
            disabled={busy}
            draggable
            onDragStart={() => onStartDrag(block.id)}
            type="button"
          >
            拖动排序
          </button>
          {saveState !== 'idle' ? (
            <span className={`session-workbench__editor-status is-${saveState}`.trim()}>
              {saveStateLabel[saveState as Exclude<NoteSaveState, 'idle'>]}
            </span>
          ) : null}
        </div>
      </header>

      <div className="session-workbench__selection-editor">
        {selectionRange.end > selectionRange.start ? (
          <InlineSelectionToolbar disabled={busy} onAction={handleSelectionAction} />
        ) : null}
        <textarea
          className="inline-input session-workbench__textarea session-note-card__textarea"
          disabled={busy}
          onChange={(event) => draftState.setValue({
            ...draftState.value,
            content_md: event.target.value,
          })}
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
          placeholder="把这一段事件流的判断、截图解释和执行想法记在这里。"
          ref={contentTextareaRef}
          rows={7}
          value={draftState.value.content_md}
        />
      </div>

      <div className="action-row">
        <button className="button is-secondary" disabled={busy || !draftState.canUndo} onClick={draftState.undo} type="button">
          撤销
        </button>
        <button className="button is-secondary" disabled={busy || !draftState.canRedo} onClick={draftState.redo} type="button">
          重做
        </button>
        <button className="button is-secondary" disabled={busy} onClick={() => void onPasteClipboardImage()} type="button">
          粘贴图片
        </button>
        <button
          className="button is-ghost"
          disabled={busy}
          onClick={() => onDeleteBlock(block)}
          type="button"
        >
          删除
        </button>
      </div>
    </article>
  )
}
