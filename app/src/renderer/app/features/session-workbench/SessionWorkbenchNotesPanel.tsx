import { useEffect, useRef, useState } from 'react'
import { InlineSelectionToolbar } from '@app/components/InlineSelectionToolbar'
import { useUndoRedoState } from '@app/hooks/useUndoRedoState'
import type { ContentBlockRecord } from '@shared/contracts/content'
import type { SessionWorkbenchPayload } from '@shared/contracts/workbench'
import { applySelectionFormatting } from './modules/session-editor-formatting'

type NoteSaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

type NoteDraftState = {
  content_md: string
  title: string
}

type SessionWorkbenchNotesPanelProps = {
  busy: boolean
  onCreateNoteBlock: (input?: {
    title?: string
    content_md?: string
  }) => Promise<ContentBlockRecord | null>
  onDeleteBlock: (block: ContentBlockRecord) => void
  onPasteClipboardImage: () => Promise<void>
  onReorderBlocks: (input: {
    session_id: string
    context_type: 'session' | 'trade'
    context_id: string
    ordered_block_ids: string[]
  }) => Promise<void>
  onRestoreBlock: (block: ContentBlockRecord) => void
  onUpdateNoteBlock: (input: {
    block_id: string
    title: string
    content_md: string
  }) => Promise<ContentBlockRecord | null>
  payload: SessionWorkbenchPayload
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

export const SessionWorkbenchNotesPanel = ({
  busy,
  onCreateNoteBlock,
  onDeleteBlock,
  onPasteClipboardImage,
  onReorderBlocks,
  onRestoreBlock,
  onUpdateNoteBlock,
  payload,
}: SessionWorkbenchNotesPanelProps) => {
  const currentContextType = payload.current_context.trade_id ? 'trade' : 'session'
  const currentContextId = payload.current_context.trade_id ?? payload.session.id
  const eventTypeById = new Map(payload.events.map((event) => [event.id, event.event_type]))
  const editableBlocks = payload.content_blocks
    .filter((block) => block.block_type === 'markdown')
    .filter((block) => block.title !== 'Realtime view')
    .filter((block) => block.context_type === currentContextType && block.context_id === currentContextId)
    .filter((block) => (block.event_id ? eventTypeById.get(block.event_id) !== 'review' : true))
    .sort((left, right) => left.sort_order - right.sort_order || new Date(left.created_at).getTime() - new Date(right.created_at).getTime())
  const activeBlocks = editableBlocks.filter((block) => !block.soft_deleted)
  const deletedBlocks = editableBlocks.filter((block) => block.soft_deleted)
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<NoteSaveState>('idle')
  const [dragBlockId, setDragBlockId] = useState<string | null>(null)
  const [selectionRange, setSelectionRange] = useState({ end: 0, start: 0 })
  const contentTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const draftState = useUndoRedoState<NoteDraftState>({
    title: '',
    content_md: '',
  })

  const selectedBlock = activeBlocks.find((block) => block.id === selectedBlockId) ?? activeBlocks[0] ?? null
  const titleDraft = draftState.value.title
  const contentDraft = draftState.value.content_md

  useEffect(() => {
    setSelectedBlockId((current) =>
      current && activeBlocks.some((block) => block.id === current)
        ? current
        : activeBlocks[0]?.id ?? null)
  }, [activeBlocks])

  useEffect(() => {
    if (!selectedBlock) {
      draftState.reset({
        title: '',
        content_md: '',
      })
      setSaveState(activeBlocks.length === 0 ? 'idle' : 'saved')
      return
    }

    draftState.reset({
      title: selectedBlock.title,
      content_md: selectedBlock.content_md,
    })
    setSelectionRange({ start: 0, end: 0 })
    setSaveState('saved')
  }, [activeBlocks.length, draftState, selectedBlock?.content_md, selectedBlock?.id, selectedBlock?.title])

  useEffect(() => {
    if (!selectedBlock) {
      return
    }

    const normalizedTitle = titleDraft.trim() || '用户笔记'
    const changed = normalizedTitle !== selectedBlock.title || contentDraft !== selectedBlock.content_md
    if (!changed) {
      setSaveState('saved')
      return
    }

    setSaveState('dirty')
    const timer = window.setTimeout(() => {
      setSaveState('saving')
      void onUpdateNoteBlock({
        block_id: selectedBlock.id,
        title: normalizedTitle,
        content_md: contentDraft,
      }).then(() => {
        setSaveState('saved')
      }).catch(() => {
        setSaveState('error')
      })
    }, autosaveDelayMs)

    return () => {
      window.clearTimeout(timer)
    }
  }, [contentDraft, onUpdateNoteBlock, selectedBlock, titleDraft])

  const handleSelectionAction = (action: 'bold' | 'quote' | 'bullet') => {
    const textarea = contentTextareaRef.current
    if (!textarea) {
      return
    }

    const { selectionStart, selectionEnd } = textarea
    const result = applySelectionFormatting(contentDraft, selectionStart, selectionEnd, action)
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

  const handleDropBlock = async(targetBlockId: string) => {
    if (!dragBlockId || dragBlockId === targetBlockId) {
      setDragBlockId(null)
      return
    }

    const orderedIds = activeBlocks.map((block) => block.id)
    const fromIndex = orderedIds.indexOf(dragBlockId)
    const toIndex = orderedIds.indexOf(targetBlockId)
    if (fromIndex === -1 || toIndex === -1) {
      setDragBlockId(null)
      return
    }

    const nextOrderedIds = [...orderedIds]
    const [draggedId] = nextOrderedIds.splice(fromIndex, 1)
    nextOrderedIds.splice(toIndex, 0, draggedId)
    setDragBlockId(null)
    await onReorderBlocks({
      session_id: payload.session.id,
      context_type: currentContextType,
      context_id: currentContextId,
      ordered_block_ids: nextOrderedIds,
    })
  }

  return (
    <div className="session-workbench__notes-panel">
      <div className="action-row">
        <button
          className="button is-secondary"
          disabled={busy}
          onClick={() => {
            void onCreateNoteBlock({
              title: '用户笔记',
              content_md: '',
            }).then((block) => {
              if (!block) {
                return
              }
              setSelectedBlockId(block.id)
            })
          }}
          type="button"
        >
          新建文本块
        </button>
        <button className="button is-secondary" disabled={busy || !draftState.canUndo} onClick={draftState.undo} type="button">
          撤销
        </button>
        <button className="button is-secondary" disabled={busy || !draftState.canRedo} onClick={draftState.redo} type="button">
          重做
        </button>
        <button className="button is-secondary" disabled={busy} onClick={() => void onPasteClipboardImage()} type="button">
          粘贴剪贴板图片
        </button>
        {saveState !== 'idle' ? (
          <span className={`session-workbench__editor-status is-${saveState}`.trim()}>
            {saveStateLabel[saveState as Exclude<NoteSaveState, 'idle'>]}
          </span>
        ) : null}
      </div>

      {activeBlocks.length > 0 ? (
        <>
          <div className="session-workbench__focus-strip">
            {activeBlocks.map((block) => (
              <button
                className={`session-event-stream__focus-chip ${selectedBlock?.id === block.id ? 'is-active' : ''}`.trim()}
                draggable
                key={block.id}
                onClick={() => setSelectedBlockId(block.id)}
                onDragOver={(event) => event.preventDefault()}
                onDragStart={() => setDragBlockId(block.id)}
                onDrop={() => {
                  void handleDropBlock(block.id)
                }}
                type="button"
              >
                {block.title}
              </button>
            ))}
          </div>

          {selectedBlock ? (
            <div className="session-workbench__editor">
              <label className="field">
                <span>标题</span>
                <input
                  className="inline-input"
                  disabled={busy}
                  onChange={(event) => draftState.setValue({
                    ...draftState.value,
                    title: event.target.value,
                  })}
                  onKeyDown={handleEditorKeyDown}
                  placeholder="笔记标题"
                  value={titleDraft}
                />
              </label>
              <label className="field">
                <span>内容</span>
                <div className="session-workbench__selection-editor">
                  {selectionRange.end > selectionRange.start ? (
                    <InlineSelectionToolbar disabled={busy} onAction={handleSelectionAction} />
                  ) : null}
                  <textarea
                    className="inline-input session-workbench__textarea"
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
                    placeholder="把当前截图、判断或执行观点单独记成一个可追溯的文本块。"
                    ref={contentTextareaRef}
                    rows={8}
                    value={contentDraft}
                  />
                </div>
              </label>
              <div className="action-row">
                <button
                  className="button is-secondary"
                  disabled={busy}
                  onClick={() => onDeleteBlock(selectedBlock)}
                  type="button"
                >
                  删除当前文本块
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <p className="empty-state">当前挂载目标下还没有独立文本块。点击上方按钮即可创建，并自动保存到本地库。</p>
      )}

      {deletedBlocks.length > 0 ? (
        <div className="session-workbench__deleted-group">
          <p className="session-workbench__deleted-label">已删除文本块</p>
          {deletedBlocks.map((block) => (
            <article className="session-workbench__content-block is-deleted" key={block.id}>
              <div className="session-workbench__content-header">
                <div>
                  <h3>{block.title}</h3>
                  <p className="session-workbench__content-meta">软删除，可恢复</p>
                </div>
                <button className="button is-secondary" disabled={busy} onClick={() => onRestoreBlock(block)} type="button">
                  恢复
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  )
}
