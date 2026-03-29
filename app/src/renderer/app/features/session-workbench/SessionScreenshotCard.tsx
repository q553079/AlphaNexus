import { useEffect, useMemo, useState } from 'react'
import type { AiRunExecutionResult, AiAnalysisAttachment } from '@shared/ai/contracts'
import { LazyImage } from '@app/components/LazyImage'
import { AnnotationCanvas } from '@app/features/annotation/AnnotationCanvas'
import type { DraftAnnotation, PendingDraftAnnotation } from '@app/features/annotation/annotation-types'
import { TargetSelector } from '@app/features/context/TargetSelector'
import {
  formatTime,
  translateAnalysisBias,
  translateCaptureKind,
} from '@app/ui/display-text'
import type { AnalysisCardRecord } from '@shared/contracts/analysis'
import type { ContentBlockRecord, ScreenshotRecord } from '@shared/contracts/content'
import type { EventRecord } from '@shared/contracts/event'
import type { CurrentTargetOption, CurrentTargetOptionsPayload } from '@shared/contracts/workbench'
import { SessionImageLightbox } from './SessionImageLightbox'
import { SessionScreenshotAiPanel } from './SessionScreenshotAiPanel'
import type { ScreenshotAiReplyRecord } from './modules/session-screenshot-ai-thread'

type SessionScreenshotCardProps = {
  aiReplies: ScreenshotAiReplyRecord[]
  busy: boolean
  candidateAnnotations: PendingDraftAnnotation[]
  draftAnnotations: DraftAnnotation[]
  index: number
  isSelected: boolean
  noteBlock: ContentBlockRecord | null
  onCreateNoteBlock: (input: {
    event_id: string
    title?: string
    content_md?: string
  }) => Promise<ContentBlockRecord | null>
  onDeleteAiRecord: (aiRunId: string) => void
  onDeleteScreenshot: (screenshotId: string) => void
  onDraftAnnotationsChange: (annotations: DraftAnnotation[]) => void
  onMoveScreenshot: (screenshot: ScreenshotRecord, option: CurrentTargetOption) => void
  onRunAnalysisFollowUpForScreenshot: (input: {
    attachments?: AiAnalysisAttachment[]
    backgroundNoteMd: string
    screenshotId: string
  }) => Promise<AiRunExecutionResult | null>
  onRunAnalysisForScreenshot: (screenshotId: string) => Promise<AiRunExecutionResult | null>
  onSaveAnnotations: () => void
  onSelectScreenshot: (screenshotId: string) => void
  onUpdateNoteBlock: (input: {
    block_id: string
    title: string
    content_md: string
  }) => Promise<ContentBlockRecord | null>
  screenshot: ScreenshotRecord
  screenshotTargetOption: CurrentTargetOption | null
  screenshotTargetPayload: CurrentTargetOptionsPayload | null
  selectedEvent: EventRecord | null
}

type NoteStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

const resolveScreenshotPreviewAsset = (screenshot: ScreenshotRecord) =>
  screenshot.annotated_asset_url ?? screenshot.raw_asset_url ?? screenshot.asset_url

const isDefaultImageNoteTitle = (value: string | null | undefined) =>
  !value || value.trim().length === 0 || value.trim() === '事件图说明'

const resolveCustomImageTitle = (noteBlock: ContentBlockRecord | null) =>
  noteBlock && !isDefaultImageNoteTitle(noteBlock.title) ? noteBlock.title.trim() : ''

const summarizeMarkdown = (value: string | null | undefined, maxLength = 120) => {
  const text = value
    ?.replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)
    ?.replace(/[#>*`\-]/g, '')
    .trim()

  if (!text) {
    return null
  }

  return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text
}

const joinNoteSections = (current: string, nextSection: string) => {
  const normalizedCurrent = current.trim()
  const normalizedNext = nextSection.trim()
  if (!normalizedNext) {
    return current
  }

  return normalizedCurrent.length > 0
    ? `${normalizedCurrent}\n\n${normalizedNext}`
    : normalizedNext
}

const buildStructuredAiInsert = (input: {
  card: AnalysisCardRecord
  mode: 'summary' | 'full'
}) => {
  const lines = [
    '### AI 整理补充',
    `- 当前判断：${input.card.summary_short.trim()}`,
    `- 偏向：${translateAnalysisBias(input.card.bias)}`,
    `- 关注区间：${input.card.entry_zone.trim() || '未给出'}`,
    `- 止损：${input.card.stop_loss.trim() || '未给出'}`,
    `- 止盈：${input.card.take_profit.trim() || '未给出'}`,
    `- 失效条件：${input.card.invalidation.trim() || '未给出'}`,
  ]

  if (input.mode === 'full' && input.card.supporting_factors.length > 0) {
    lines.push('', '#### 支撑因素')
    for (const factor of input.card.supporting_factors) {
      lines.push(`- ${factor.trim()}`)
    }
  }

  if (input.mode === 'full') {
    const deepAnalysis = input.card.deep_analysis_md.trim()
    if (deepAnalysis) {
      lines.push('', '#### 详细展开', deepAnalysis)
    }
  }

  return lines.join('\n')
}

const buildHeaderDescription = (input: {
  noteBlock: ContentBlockRecord | null
  latestAiReply: ScreenshotAiReplyRecord | null
}) => {
  const manual = summarizeMarkdown(input.noteBlock?.content_md)
  if (manual) {
    return {
      text: manual,
      sourceLabel: '手动说明',
    }
  }

  const ai = summarizeMarkdown(input.latestAiReply?.card.summary_short)
  if (ai) {
    return {
      text: ai,
      sourceLabel: 'AI 自动摘要',
    }
  }

  return {
    text: null,
    sourceLabel: null,
  }
}

const resolveNoteStatusLabel = (status: NoteStatus) => {
  if (status === 'saving') {
    return '保存中'
  }
  if (status === 'saved') {
    return '已保存'
  }
  if (status === 'error') {
    return '保存失败'
  }
  if (status === 'dirty') {
    return '未保存'
  }
  return '图下说明'
}

export const SessionScreenshotCard = ({
  aiReplies,
  busy,
  candidateAnnotations,
  draftAnnotations,
  index,
  isSelected,
  noteBlock,
  onCreateNoteBlock,
  onDeleteAiRecord,
  onDeleteScreenshot,
  onDraftAnnotationsChange,
  onMoveScreenshot,
  onRunAnalysisFollowUpForScreenshot,
  onRunAnalysisForScreenshot,
  onSaveAnnotations,
  onSelectScreenshot,
  onUpdateNoteBlock,
  screenshot,
  screenshotTargetOption,
  screenshotTargetPayload,
  selectedEvent,
}: SessionScreenshotCardProps) => {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [titleDraft, setTitleDraft] = useState(resolveCustomImageTitle(noteBlock))
  const [noteDraft, setNoteDraft] = useState(noteBlock?.content_md ?? '')
  const [noteStatus, setNoteStatus] = useState<NoteStatus>('idle')
  const previewSrc = resolveScreenshotPreviewAsset(screenshot)
  const headerTitle = titleDraft.trim()
  const eventImageLabel = `事件图 ${index + 1}`
  const latestAiReply = aiReplies[aiReplies.length - 1] ?? null
  const headerDescription = useMemo(
    () => buildHeaderDescription({ noteBlock, latestAiReply }),
    [latestAiReply, noteBlock],
  )

  useEffect(() => {
    setTitleDraft(resolveCustomImageTitle(noteBlock))
    setNoteDraft(noteBlock?.content_md ?? '')
    setNoteStatus('idle')
    setDeleteConfirm(false)
  }, [noteBlock?.id, noteBlock?.updated_at, screenshot.id])

  const persistedTitle = resolveCustomImageTitle(noteBlock)
  const isDirty = noteDraft !== (noteBlock?.content_md ?? '') || titleDraft !== persistedTitle
  const noteSourceEventId = selectedEvent?.id ?? screenshot.event_id

  useEffect(() => {
    if (isDirty) {
      setNoteStatus('dirty')
      return
    }
    if (noteStatus === 'dirty') {
      setNoteStatus('idle')
    }
  }, [isDirty, noteStatus])

  const persistNote = async(runAnalysisAfterSave: boolean) => {
    if (!noteSourceEventId) {
      setNoteStatus('error')
      return
    }

    if (!noteBlock && noteDraft.trim().length === 0) {
      setNoteStatus('idle')
      if (runAnalysisAfterSave) {
        await onRunAnalysisForScreenshot(screenshot.id)
      }
      return
    }

    try {
      setNoteStatus('saving')
      if (noteBlock) {
        await onUpdateNoteBlock({
          block_id: noteBlock.id,
          title: titleDraft.trim() || '事件图说明',
          content_md: noteDraft,
        })
      } else {
        await onCreateNoteBlock({
          event_id: noteSourceEventId,
          title: titleDraft.trim() || '事件图说明',
          content_md: noteDraft,
        })
      }

      setNoteStatus('saved')
      if (runAnalysisAfterSave) {
        await onRunAnalysisForScreenshot(screenshot.id)
      }
    } catch {
      setNoteStatus('error')
    }
  }

  const actionHint = headerDescription.sourceLabel
    ? `当前标题说明来自${headerDescription.sourceLabel}。`
    : '这张事件图还没有单独说明。'

  const insertAiIntoNote = (mode: 'summary' | 'full') => {
    if (!latestAiReply) {
      return
    }

    const next = joinNoteSections(noteDraft, buildStructuredAiInsert({
      card: latestAiReply.card,
      mode,
    }))
    setNoteDraft(next)
    setNoteStatus('dirty')
  }

  return (
    <article className={`session-workbench__media-item ${isSelected ? 'is-active' : ''}`.trim()}>
      <div className="session-workbench__media-header">
        <div className="session-workbench__media-heading">
          <p className="session-workbench__media-kicker">
            {eventImageLabel} · {formatTime(screenshot.created_at)}{headerTitle ? ` · ${headerTitle}` : ''}
          </p>
          {headerDescription.text ? (
            <p className="session-workbench__media-description">{headerDescription.text}</p>
          ) : null}
        </div>
        <div className="session-workbench__media-header-side">
          <span className="status-pill">{translateCaptureKind(screenshot.kind)}</span>
          {headerDescription.sourceLabel ? <span className="status-pill">{headerDescription.sourceLabel}</span> : null}
          {isSelected ? <span className="status-pill">当前绘图</span> : null}
        </div>
      </div>

      {isSelected ? (
        <>
          <button
            className="session-workbench__image-button session-workbench__media-preview is-selected"
            onClick={() => onSelectScreenshot(screenshot.id)}
            onDoubleClick={() => setLightboxOpen(true)}
            type="button"
          >
            <LazyImage
              alt={headerTitle}
              aspectRatio={`${screenshot.width} / ${screenshot.height}`}
              src={previewSrc}
            />
          </button>

          <div className="session-workbench__canvas-toolbar">
            {screenshotTargetPayload ? (
              <TargetSelector
                busy={busy}
                emptyMessage="当前没有可用于截图改挂载的目标。"
                label="截图改挂载"
                onSelect={(option) => onMoveScreenshot(screenshot, option)}
                selectedOptionId={screenshotTargetOption?.id ?? null}
                targetPayload={screenshotTargetPayload}
                variant="compact"
              />
            ) : null}
            <div className="action-row session-workbench__canvas-actions">
              <button className="button is-secondary" disabled={busy} onClick={() => setLightboxOpen(true)} type="button">
                全屏编辑
              </button>
              <button
                className="button is-secondary"
                disabled={busy}
                onClick={() => {
                  void onRunAnalysisForScreenshot(screenshot.id)
                }}
                type="button"
              >
                让 AI 参考这张图
              </button>
            </div>
          </div>

          <div className="session-workbench__media-columns">
            <section className="session-workbench__media-note">
              <div className="session-workbench__media-note-header">
                <div>
                  <strong>笔记区</strong>
                  <p>{actionHint}</p>
                </div>
                <span className={`session-workbench__editor-status is-${noteStatus}`.trim()}>
                  {resolveNoteStatusLabel(noteStatus)}
                </span>
              </div>

              {!noteBlock && latestAiReply?.card.summary_short ? (
                <div className="session-workbench__media-ai-seed">
                  <div>
                    <strong>AI 自动说明</strong>
                    <p>{summarizeMarkdown(latestAiReply.card.summary_short, 200)}</p>
                  </div>
                  <button
                    className="button is-secondary"
                    disabled={busy}
                    onClick={() => {
                      setNoteDraft(latestAiReply.card.summary_short)
                      setNoteStatus('dirty')
                    }}
                    type="button"
                  >
                    采纳到笔记
                  </button>
                </div>
              ) : null}

              <input
                className="inline-input session-workbench__media-title-input"
                onChange={(event) => {
                  setTitleDraft(event.target.value)
                  setNoteStatus('dirty')
                }}
                placeholder="事件图标题（可选）"
                value={titleDraft}
              />

              <textarea
                className="inline-input session-workbench__media-note-textarea"
                onChange={(event) => {
                  setNoteDraft(event.target.value)
                  setNoteStatus('dirty')
                }}
                placeholder="在这张事件图下写你的笔记、判断、疑点和后续动作。"
                value={noteDraft}
              />

              <div className="action-row session-workbench__media-note-actions">
                <button
                  className="button is-secondary"
                  disabled={busy || !isDirty || !noteSourceEventId}
                  onClick={() => {
                    void persistNote(false)
                  }}
                  type="button"
                >
                  保存笔记
                </button>
                <button
                  className="button is-primary"
                  disabled={busy || !noteSourceEventId}
                  onClick={() => {
                    void persistNote(true)
                  }}
                  type="button"
                >
                  保存并发给 AI
                </button>
              </div>
            </section>

            <SessionScreenshotAiPanel
              aiReplies={aiReplies}
              busy={busy}
              noteDraft={noteDraft}
              onDeleteAiRecord={onDeleteAiRecord}
              onInsertAiIntoNote={insertAiIntoNote}
              onRunAnalysisForScreenshot={onRunAnalysisForScreenshot}
              onRunAnalysisFollowUpForScreenshot={onRunAnalysisFollowUpForScreenshot}
              screenshot={screenshot}
              titleDraft={titleDraft}
            />
          </div>

          <SessionImageLightbox
            actions={(
              <>
                <button className="button is-primary" disabled={busy} onClick={onSaveAnnotations} type="button">
                  保存标注
                </button>
                {deleteConfirm ? (
                  <>
                    <span className="status-pill">确认删除这张图？</span>
                    <button
                      className="button is-secondary"
                      disabled={busy}
                      onClick={() => setDeleteConfirm(false)}
                      type="button"
                    >
                      取消
                    </button>
                    <button
                      className="button is-danger"
                      disabled={busy}
                      onClick={() => {
                        onDeleteScreenshot(screenshot.id)
                        setDeleteConfirm(false)
                        setLightboxOpen(false)
                      }}
                      type="button"
                    >
                      确认删除
                    </button>
                  </>
                ) : (
                  <button
                    className="button is-secondary"
                    disabled={busy}
                    onClick={() => setDeleteConfirm(true)}
                    type="button"
                  >
                    删除这张图
                  </button>
                )}
              </>
            )}
            editable
            imageAlt={headerTitle}
            imageSrc={previewSrc}
            onClose={() => {
              setDeleteConfirm(false)
              setLightboxOpen(false)
            }}
            open={lightboxOpen}
            title={`${eventImageLabel}${headerTitle ? ` · ${headerTitle}` : ''} · ${formatTime(screenshot.created_at)}`}
          >
            <div className="session-image-lightbox__editor-surface">
              <AnnotationCanvas
                annotations={draftAnnotations}
                candidateAnnotations={candidateAnnotations}
                onChange={onDraftAnnotationsChange}
                screenshot={screenshot}
              />
            </div>
          </SessionImageLightbox>
        </>
      ) : (
        <button
          className="session-workbench__image-button session-workbench__media-preview"
          onClick={() => onSelectScreenshot(screenshot.id)}
          onDoubleClick={() => {
            onSelectScreenshot(screenshot.id)
            setLightboxOpen(true)
          }}
          type="button"
        >
          <LazyImage
            alt={headerTitle}
            aspectRatio="16 / 9"
            src={previewSrc}
          />
        </button>
      )}
    </article>
  )
}
