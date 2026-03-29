import { useEffect, useMemo, useRef, useState } from 'react'
import type { AiRunExecutionResult, AiAnalysisAttachment } from '@shared/ai/contracts'
import type { ScreenshotRecord } from '@shared/contracts/content'
import {
  formatTime,
  translateAnalysisBias,
} from '@app/ui/display-text'
import {
  buildFollowUpContext,
  buildScreenshotAiThread,
  formatAttachmentSize,
  isTextLikeAttachment,
  type ScreenshotAiReplyRecord,
} from './modules/session-screenshot-ai-thread'

type SessionScreenshotAiPanelProps = {
  aiReplies: ScreenshotAiReplyRecord[]
  busy: boolean
  noteDraft: string
  onDeleteAiRecord: (aiRunId: string) => void
  onInsertAiIntoNote: (mode: 'summary' | 'full') => void
  onRunAnalysisForScreenshot: (screenshotId: string) => Promise<AiRunExecutionResult | null>
  onRunAnalysisFollowUpForScreenshot: (input: {
    attachments?: AiAnalysisAttachment[]
    backgroundNoteMd: string
    screenshotId: string
  }) => Promise<AiRunExecutionResult | null>
  screenshot: ScreenshotRecord
  titleDraft: string
}

const buildAttachmentId = () =>
  `attach_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }
      reject(new Error(`无法读取文件 ${file.name}。`))
    }
    reader.onerror = () => reject(reader.error ?? new Error(`无法读取文件 ${file.name}。`))
    reader.readAsDataURL(file)
  })

const toAttachment = async(file: File): Promise<AiAnalysisAttachment> => {
  const isImage = file.type.startsWith('image/')
  const textExcerpt = isTextLikeAttachment(file)
    ? (await file.text()).replace(/\s+/g, ' ').trim().slice(0, 2000) || null
    : null

  return {
    id: buildAttachmentId(),
    kind: isImage ? 'image' : 'document',
    name: file.name,
    mime_type: file.type || null,
    size_bytes: file.size,
    data_url: isImage ? await readFileAsDataUrl(file) : undefined,
    text_excerpt: textExcerpt,
  }
}

export const SessionScreenshotAiPanel = ({
  aiReplies,
  busy,
  noteDraft,
  onDeleteAiRecord,
  onInsertAiIntoNote,
  onRunAnalysisForScreenshot,
  onRunAnalysisFollowUpForScreenshot,
  screenshot,
  titleDraft,
}: SessionScreenshotAiPanelProps) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [aiViewMode, setAiViewMode] = useState<'summary' | 'full'>('summary')
  const [followUpDraft, setFollowUpDraft] = useState('')
  const [followUpAttachments, setFollowUpAttachments] = useState<AiAnalysisAttachment[]>([])
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const [attachmentCacheByAiRunId, setAttachmentCacheByAiRunId] = useState<Record<string, AiAnalysisAttachment[]>>({})
  const [pendingTurn, setPendingTurn] = useState<{
    attachments: AiAnalysisAttachment[]
    userText: string
  } | null>(null)

  const latestReply = aiReplies[aiReplies.length - 1] ?? null
  const turns = useMemo(() => buildScreenshotAiThread({
    screenshot,
    aiReplies,
    attachmentCacheByAiRunId,
  }), [aiReplies, attachmentCacheByAiRunId, screenshot])

  useEffect(() => {
    setAiViewMode('summary')
    setFollowUpDraft('')
    setFollowUpAttachments([])
    setAttachmentError(null)
    setAttachmentCacheByAiRunId({})
    setPendingTurn(null)
  }, [screenshot.id])

  const appendFiles = async(files: File[]) => {
    if (files.length === 0) {
      return
    }

    const remaining = Math.max(0, 6 - followUpAttachments.length)
    if (remaining <= 0) {
      setAttachmentError('最多只能附带 6 个附件。')
      return
    }

    try {
      setAttachmentError(null)
      const next = await Promise.all(files.slice(0, remaining).map((file) => toAttachment(file)))
      setFollowUpAttachments((current) => [...current, ...next].slice(0, 6))
    } catch (error) {
      setAttachmentError(error instanceof Error ? error.message : '读取附件失败。')
    }
  }

  const handleFollowUp = async() => {
    if (!latestReply || !followUpDraft.trim()) {
      return
    }

    const sentAttachments = followUpAttachments.slice()
    const sentQuestion = followUpDraft.trim()
    setPendingTurn({
      userText: sentQuestion,
      attachments: sentAttachments,
    })

    const result = await onRunAnalysisFollowUpForScreenshot({
      screenshotId: screenshot.id,
      attachments: sentAttachments,
      backgroundNoteMd: buildFollowUpContext({
        aiReply: latestReply,
        followUpQuestion: sentQuestion,
        noteDraft,
        titleDraft,
        attachments: sentAttachments,
      }),
    })

    if (result?.ai_run.id && sentAttachments.length > 0) {
      setAttachmentCacheByAiRunId((current) => ({
        ...current,
        [result.ai_run.id]: sentAttachments,
      }))
    }

    setPendingTurn(null)
    if (result) {
      setFollowUpDraft('')
      setFollowUpAttachments([])
    }
  }

  const handleInitialRun = async() => {
    const initialQuestion = noteDraft.trim()
      ? '请参考这张图，并结合当前图下笔记分析当前盘面。'
      : '请参考这张图，分析当前盘面。'
    setPendingTurn({
      userText: initialQuestion,
      attachments: [],
    })
    await onRunAnalysisForScreenshot(screenshot.id)
    setPendingTurn(null)
  }

  return (
    <section className="session-workbench__media-ai-panel">
      <div className="session-workbench__media-note-header">
        <div>
          <strong>AI 区</strong>
          <p>{latestReply ? '现在会把每次问题和 AI 回复都追加到同一条截图线程里。' : 'AI 会围绕这张图和左侧笔记给你回复。'}</p>
        </div>
        {latestReply ? (
          <div className="session-workbench__media-ai-meta">
            <span className="status-pill">{translateAnalysisBias(latestReply.card.bias)}</span>
            <span className="status-pill">置信度 {latestReply.card.confidence_pct}%</span>
          </div>
        ) : null}
      </div>

      {turns.length > 0 || pendingTurn ? (
        <div className="session-workbench__ai-thread">
          {turns.map((turn) => {
            const bubbleText = aiViewMode === 'summary'
              ? (turn.ai_reply.card.summary_short.trim() || turn.ai_reply.card.deep_analysis_md.trim())
              : (turn.ai_reply.card.deep_analysis_md.trim() || turn.ai_reply.card.summary_short.trim())

            return (
              <div className="session-workbench__ai-turn" key={turn.key}>
                <article className="session-workbench__chat-bubble is-user">
                  <div className="session-workbench__chat-meta">
                    <strong>你</strong>
                    <span>{formatTime(turn.occurred_at)}</span>
                  </div>
                  <div className="session-workbench__chat-text">{turn.user_text}</div>
                  {turn.user_attachments.length > 0 ? (
                    <div className="session-workbench__chat-attachments">
                      {turn.user_attachments.map((attachment) => (
                        <div className="session-workbench__chat-attachment" key={attachment.id}>
                          {attachment.preview_url ? (
                            <img alt={attachment.name} className="session-workbench__chat-attachment-thumb" src={attachment.preview_url} />
                          ) : (
                            <div className="session-workbench__chat-attachment-icon">DOC</div>
                          )}
                          <div className="session-workbench__chat-attachment-meta">
                            <strong>{attachment.name}</strong>
                            <span>
                              {attachment.is_primary_screenshot ? '当前事件图' : attachment.mime_type ?? attachment.kind}
                              {formatAttachmentSize(attachment.size_bytes) ? ` · ${formatAttachmentSize(attachment.size_bytes)}` : ''}
                            </span>
                            {attachment.text_excerpt ? <p>{attachment.text_excerpt}</p> : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>

                <article className="session-workbench__chat-bubble is-ai">
                  <div className="session-workbench__chat-meta">
                    <strong>{turn.ai_reply.aiRun?.provider ?? 'AI'}</strong>
                    <span>{formatTime(turn.occurred_at)}</span>
                  </div>
                  <div className="session-workbench__chat-pills">
                    <span className="status-pill">{translateAnalysisBias(turn.ai_reply.card.bias)}</span>
                    <span className="status-pill">置信度 {turn.ai_reply.card.confidence_pct}%</span>
                  </div>
                  <div className="session-workbench__chat-text">{bubbleText || '这条 AI 回复还没有可展示的正文。'}</div>
                  <div className="action-row session-workbench__chat-actions">
                    {turn.ai_reply.aiRun?.id ? (
                      <button
                        className="button is-secondary"
                        disabled={busy}
                        onClick={() => onDeleteAiRecord(turn.ai_reply.aiRun!.id)}
                        type="button"
                      >
                        删除这条回复
                      </button>
                    ) : null}
                  </div>
                </article>
              </div>
            )
          })}

          {pendingTurn ? (
            <div className="session-workbench__ai-turn">
              <article className="session-workbench__chat-bubble is-user is-pending">
                <div className="session-workbench__chat-meta">
                  <strong>你</strong>
                  <span>发送中</span>
                </div>
                <div className="session-workbench__chat-text">{pendingTurn.userText}</div>
                <div className="session-workbench__chat-attachments">
                  {[{
                    id: `pending:${screenshot.id}`,
                    kind: 'image' as const,
                    name: screenshot.caption ?? `事件图 ${screenshot.id}`,
                    mime_type: null,
                    size_bytes: null,
                    preview_url: screenshot.annotated_asset_url ?? screenshot.raw_asset_url ?? screenshot.asset_url,
                    text_excerpt: null,
                    is_primary_screenshot: true,
                  }, ...pendingTurn.attachments.map((attachment) => ({
                    id: attachment.id,
                    kind: attachment.kind,
                    name: attachment.name,
                    mime_type: attachment.mime_type ?? null,
                    size_bytes: attachment.size_bytes ?? null,
                    preview_url: attachment.data_url ?? null,
                    text_excerpt: attachment.text_excerpt ?? null,
                    is_primary_screenshot: false,
                  }))].map((attachment) => (
                    <div className="session-workbench__chat-attachment" key={attachment.id}>
                      {attachment.preview_url ? (
                        <img alt={attachment.name} className="session-workbench__chat-attachment-thumb" src={attachment.preview_url} />
                      ) : (
                        <div className="session-workbench__chat-attachment-icon">DOC</div>
                      )}
                      <div className="session-workbench__chat-attachment-meta">
                        <strong>{attachment.name}</strong>
                        <span>{attachment.is_primary_screenshot ? '当前事件图' : attachment.mime_type ?? attachment.kind}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="session-workbench__chat-bubble is-ai is-pending">
                <div className="session-workbench__chat-meta">
                  <strong>AI</strong>
                  <span>思考中</span>
                </div>
                <div className="session-workbench__chat-text">正在生成回复...</div>
              </article>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="session-workbench__media-ai-empty">
          <p>这张图还没有 AI 回复。你可以先在左侧写笔记，再让 AI 参考这张图。</p>
        </div>
      )}

      {latestReply ? (
        <>
          <div className="session-workbench__media-ai-toggle">
            <button
              className={`button ${aiViewMode === 'summary' ? 'is-primary' : 'is-secondary'}`.trim()}
              disabled={busy}
              onClick={() => setAiViewMode('summary')}
              type="button"
            >
              摘要
            </button>
            <button
              className={`button ${aiViewMode === 'full' ? 'is-primary' : 'is-secondary'}`.trim()}
              disabled={busy}
              onClick={() => setAiViewMode('full')}
              type="button"
            >
              完整版
            </button>
          </div>

          <div className="session-workbench__media-follow-up">
            <div className="session-workbench__media-follow-up-header">
              <label className="session-workbench__media-follow-up-label" htmlFor={`follow-up-${screenshot.id}`}>
                继续追问
              </label>
              <div className="action-row">
                <button
                  className="button is-secondary"
                  disabled={busy}
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                >
                  上传图片/文档
                </button>
                <span className="status-pill">Ctrl+V 粘贴图片</span>
              </div>
            </div>
            <textarea
              className="inline-input session-workbench__media-follow-up-input"
              id={`follow-up-${screenshot.id}`}
              onChange={(event) => setFollowUpDraft(event.target.value)}
              onPaste={(event) => {
                const imageFiles = Array.from(event.clipboardData?.items ?? [])
                  .filter((item) => item.kind === 'file')
                  .map((item) => item.getAsFile())
                  .filter((item): item is File => item != null && item.type.startsWith('image/'))
                if (imageFiles.length === 0) {
                  return
                }
                event.preventDefault()
                void appendFiles(imageFiles)
              }}
              placeholder="继续问这张图，比如：B1-B3 哪一段支撑最容易失效？如果跌破，要重点看哪里？"
              value={followUpDraft}
            />
            <input
              accept="image/*,.txt,.md,.markdown,.json,.csv,.tsv,.log,.pdf,.doc,.docx"
              hidden
              multiple
              onChange={(event) => {
                const files = Array.from(event.target.files ?? [])
                event.currentTarget.value = ''
                void appendFiles(files)
              }}
              ref={fileInputRef}
              type="file"
            />
            {attachmentError ? <div className="status-inline">{attachmentError}</div> : null}
            <div className="session-workbench__composer-attachments">
              <div className="session-workbench__composer-attachment">
                <img
                  alt={screenshot.caption ?? `事件图 ${screenshot.id}`}
                  className="session-workbench__composer-attachment-thumb"
                  src={screenshot.annotated_asset_url ?? screenshot.raw_asset_url ?? screenshot.asset_url}
                />
                <div className="session-workbench__composer-attachment-meta">
                  <strong>{screenshot.caption ?? `事件图 ${screenshot.id}`}</strong>
                  <span>当前事件图 · 默认一起发给 AI</span>
                </div>
              </div>
              {followUpAttachments.length > 0 ? (
                followUpAttachments.map((attachment) => (
                  <div className="session-workbench__composer-attachment" key={attachment.id}>
                    {attachment.data_url ? (
                      <img alt={attachment.name} className="session-workbench__composer-attachment-thumb" src={attachment.data_url} />
                    ) : (
                      <div className="session-workbench__composer-attachment-icon">DOC</div>
                    )}
                    <div className="session-workbench__composer-attachment-meta">
                      <strong>{attachment.name}</strong>
                      <span>
                        {attachment.mime_type ?? attachment.kind}
                        {formatAttachmentSize(attachment.size_bytes) ? ` · ${formatAttachmentSize(attachment.size_bytes)}` : ''}
                      </span>
                      {attachment.text_excerpt ? <p>{attachment.text_excerpt}</p> : null}
                    </div>
                    <button
                      className="button is-secondary"
                      disabled={busy}
                      onClick={() => {
                        setFollowUpAttachments((current) => current.filter((item) => item.id !== attachment.id))
                      }}
                      type="button"
                    >
                      移除
                    </button>
                  </div>
                ))
              ) : null}
            </div>
          </div>

          <div className="action-row session-workbench__media-note-actions">
            <button
              className="button is-secondary"
              disabled={busy || !latestReply.card.summary_short.trim()}
              onClick={() => onInsertAiIntoNote('summary')}
              type="button"
            >
              摘要整理后插入
            </button>
            <button
              className="button is-secondary"
              disabled={busy || !latestReply.card.deep_analysis_md.trim()}
              onClick={() => onInsertAiIntoNote('full')}
              type="button"
            >
              全文整理后插入
            </button>
            <button
              className="button is-primary"
              disabled={busy || !followUpDraft.trim()}
              onClick={() => {
                void handleFollowUp()
              }}
              type="button"
            >
              继续追问
            </button>
            <button
              className="button is-secondary"
              disabled={busy}
              onClick={() => {
                void handleInitialRun()
              }}
              type="button"
            >
              重新参考这张图
            </button>
          </div>
        </>
      ) : (
        <button
          className="button is-secondary"
          disabled={busy}
          onClick={() => {
            void handleInitialRun()
          }}
          type="button"
        >
          让 AI 参考这张图
        </button>
      )}
    </section>
  )
}
