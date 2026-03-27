import { useEffect, useState } from 'react'
import type { ContentBlockRecord } from '@shared/contracts/content'
import type { SessionWorkbenchPayload } from '@shared/contracts/workbench'

type NoteSaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

type SessionWorkbenchNotesPanelProps = {
  busy: boolean
  onCreateNoteBlock: (input?: {
    title?: string
    content_md?: string
  }) => Promise<ContentBlockRecord | null>
  onDeleteBlock: (block: ContentBlockRecord) => void
  onRestoreBlock: (block: ContentBlockRecord) => void
  onUpdateNoteBlock: (input: {
    block_id: string
    title: string
    content_md: string
  }) => Promise<ContentBlockRecord | null>
  payload: SessionWorkbenchPayload
}

const autosaveDelayMs = 360

const saveStateLabel: Record<NoteSaveState, string> = {
  idle: '当前没有选中笔记块。',
  dirty: '检测到改动，准备自动保存。',
  saving: '正在自动保存到本地库。',
  saved: '已自动保存。',
  error: '自动保存失败，请继续编辑后重试。',
}

export const SessionWorkbenchNotesPanel = ({
  busy,
  onCreateNoteBlock,
  onDeleteBlock,
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
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
  const activeBlocks = editableBlocks.filter((block) => !block.soft_deleted)
  const deletedBlocks = editableBlocks.filter((block) => block.soft_deleted)
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [titleDraft, setTitleDraft] = useState('')
  const [contentDraft, setContentDraft] = useState('')
  const [saveState, setSaveState] = useState<NoteSaveState>('idle')

  const selectedBlock = activeBlocks.find((block) => block.id === selectedBlockId) ?? activeBlocks[0] ?? null

  useEffect(() => {
    setSelectedBlockId((current) =>
      current && activeBlocks.some((block) => block.id === current)
        ? current
        : activeBlocks[0]?.id ?? null)
  }, [activeBlocks])

  useEffect(() => {
    if (!selectedBlock) {
      setTitleDraft('')
      setContentDraft('')
      setSaveState(activeBlocks.length === 0 ? 'idle' : 'saved')
      return
    }

    setTitleDraft(selectedBlock.title)
    setContentDraft(selectedBlock.content_md)
    setSaveState('saved')
  }, [activeBlocks.length, selectedBlock?.content_md, selectedBlock?.id, selectedBlock?.title])

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
              setTitleDraft(block.title)
              setContentDraft(block.content_md)
              setSaveState('saved')
            })
          }}
          type="button"
        >
          新建文本块
        </button>
        <span className="session-workbench__editor-hint">{saveStateLabel[saveState]}</span>
      </div>

      {activeBlocks.length > 0 ? (
        <>
          <div className="session-workbench__focus-strip">
            {activeBlocks.map((block) => (
              <button
                className={`session-event-stream__focus-chip ${selectedBlock?.id === block.id ? 'is-active' : ''}`.trim()}
                key={block.id}
                onClick={() => setSelectedBlockId(block.id)}
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
                  onChange={(event) => setTitleDraft(event.target.value)}
                  placeholder="笔记标题"
                  value={titleDraft}
                />
              </label>
              <label className="field">
                <span>内容</span>
                <textarea
                  className="inline-input session-workbench__textarea"
                  disabled={busy}
                  onChange={(event) => setContentDraft(event.target.value)}
                  placeholder="把当前截图、判断或执行观点单独记成一个可追溯的文本块。"
                  rows={8}
                  value={contentDraft}
                />
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
