import { useEffect, useState } from 'react'
import type { ContentBlockRecord } from '@shared/contracts/content'
import type { SessionWorkbenchPayload } from '@shared/contracts/workbench'
import { formatDateTime } from '@app/ui/display-text'
import { SessionWorkbenchNoteCard } from './SessionWorkbenchNoteCard'
import {
  buildStoryIndexEntries,
  getNoteBlockAnchorId,
  resolveEditableNoteBlocks,
} from './modules/session-note-blocks'

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
  const { activeBlocks, contextId, contextType, deletedBlocks } = resolveEditableNoteBlocks(payload)
  const indexEntries = buildStoryIndexEntries(payload, activeBlocks)
  const [dragBlockId, setDragBlockId] = useState<string | null>(null)
  const [pendingScrollBlockId, setPendingScrollBlockId] = useState<string | null>(null)

  useEffect(() => {
    if (!pendingScrollBlockId) {
      return
    }

    const node = document.getElementById(getNoteBlockAnchorId(pendingScrollBlockId))
    if (!node) {
      return
    }

    node.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
    setPendingScrollBlockId(null)
  }, [activeBlocks, pendingScrollBlockId])

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
      context_type: contextType,
      context_id: contextId,
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
              setPendingScrollBlockId(block.id)
            })
          }}
          type="button"
        >
          新建文本块
        </button>
        <button className="button is-secondary" disabled={busy} onClick={() => void onPasteClipboardImage()} type="button">
          粘贴剪贴板图片
        </button>
      </div>

      {indexEntries.length > 0 ? (
        <section className="session-story-index">
          <div className="session-story-index__header">
            <div>
              <strong>事件流索引</strong>
              <p>按当前笔记顺序排列，拖动笔记后这里也会跟着变化。</p>
            </div>
            <span className="status-pill">{indexEntries.length} 条</span>
          </div>
          <div className="session-story-index__list">
            {indexEntries.map((entry) => (
              <button
                className="session-story-index__item"
                key={entry.blockId}
                onClick={() => {
                  const node = document.getElementById(entry.anchorId)
                  if (!node) {
                    return
                  }
                  node.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                  })
                }}
                type="button"
              >
                <span className="session-story-index__dot" />
                <div className="session-story-index__content">
                  <div className="session-story-index__meta">
                    <strong>{entry.label}</strong>
                    <span>{formatDateTime(entry.createdAt)}</span>
                  </div>
                  <h4>{entry.title}</h4>
                  <p>{entry.summary}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {activeBlocks.length > 0 ? (
        <div className="session-note-stack">
          {activeBlocks.map((block, index) => (
            <SessionWorkbenchNoteCard
              block={block}
              busy={busy}
              indexLabel={`事件 ${index + 1}`}
              key={block.id}
              onDeleteBlock={onDeleteBlock}
              onDropOnBlock={handleDropBlock}
              onPasteClipboardImage={onPasteClipboardImage}
              onStartDrag={(blockId) => setDragBlockId(blockId)}
              onUpdateNoteBlock={onUpdateNoteBlock}
              scrollId={getNoteBlockAnchorId(block.id)}
            />
          ))}
        </div>
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
