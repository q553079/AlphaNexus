import type { AiAnalysisAttachment } from '@shared/ai/contracts'
import type { AnalysisCardRecord, AiRunRecord } from '@shared/contracts/analysis'
import type { ScreenshotRecord } from '@shared/contracts/content'
import type { EventRecord } from '@shared/contracts/event'
import { translateAnalysisBias } from '@app/ui/display-text'

export type ScreenshotAiReplyRecord = {
  aiEvent: EventRecord
  aiRun: AiRunRecord | null
  card: AnalysisCardRecord
}

export type ScreenshotAiThreadAttachment = {
  id: string
  kind: AiAnalysisAttachment['kind']
  name: string
  mime_type: string | null
  size_bytes: number | null
  preview_url: string | null
  text_excerpt: string | null
  is_primary_screenshot: boolean
}

export type ScreenshotAiThreadTurn = {
  key: string
  occurred_at: string
  user_text: string
  user_attachments: ScreenshotAiThreadAttachment[]
  ai_reply: ScreenshotAiReplyRecord
}

type PersistedAttachmentMeta = Omit<AiAnalysisAttachment, 'data_url'>

const USER_QUESTION_START = '[ALPHA_NEXUS_USER_QUESTION]'
const USER_QUESTION_END = '[/ALPHA_NEXUS_USER_QUESTION]'
const ATTACHMENTS_START = '[ALPHA_NEXUS_ATTACHMENTS]'
const ATTACHMENTS_END = '[/ALPHA_NEXUS_ATTACHMENTS]'
const BACKGROUND_NOTE_START = 'Background note:\n'
const BACKGROUND_NOTE_END = '\n\nUser realtime view:'

const clip = (value: string, maxLength: number) => {
  const compact = value.replace(/\s+/g, ' ').trim()
  if (compact.length <= maxLength) {
    return compact
  }
  return `${compact.slice(0, maxLength - 3).trim()}...`
}

const extractBetween = (value: string, startMarker: string, endMarker: string) => {
  const start = value.indexOf(startMarker)
  if (start === -1) {
    return null
  }

  const bodyStart = start + startMarker.length
  const end = value.indexOf(endMarker, bodyStart)
  if (end === -1) {
    return null
  }

  return value.slice(bodyStart, end).trim()
}

const extractBackgroundNote = (promptPreview: string) => {
  const start = promptPreview.indexOf(BACKGROUND_NOTE_START)
  if (start === -1) {
    return ''
  }

  const bodyStart = start + BACKGROUND_NOTE_START.length
  const end = promptPreview.indexOf(BACKGROUND_NOTE_END, bodyStart)
  const body = end === -1 ? promptPreview.slice(bodyStart) : promptPreview.slice(bodyStart, end)
  return body.trim()
}

const parsePersistedAttachments = (promptPreview: string): PersistedAttachmentMeta[] => {
  const payload = extractBetween(promptPreview, ATTACHMENTS_START, ATTACHMENTS_END)
  if (!payload) {
    return []
  }

  try {
    const parsed = JSON.parse(payload) as PersistedAttachmentMeta[]
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.filter((item) =>
      item
      && (item.kind === 'image' || item.kind === 'document')
      && typeof item.name === 'string'
      && item.name.trim().length > 0)
      .map((item, index) => ({
        id: typeof item.id === 'string' && item.id.trim().length > 0 ? item.id : `persisted_attachment_${index}`,
        kind: item.kind,
        name: item.name.trim(),
        mime_type: item.mime_type ?? null,
        size_bytes: item.size_bytes ?? null,
        text_excerpt: item.text_excerpt ? clip(item.text_excerpt, 240) : null,
      }))
  } catch {
    return []
  }
}

const parseUserQuestion = (promptPreview: string) => {
  const explicit = extractBetween(promptPreview, USER_QUESTION_START, USER_QUESTION_END)
  if (explicit) {
    return explicit
  }

  const backgroundNote = extractBackgroundNote(promptPreview)
  if (!backgroundNote) {
    return ''
  }

  const followUpMarker = '这次继续追问：'
  const followUpIndex = backgroundNote.lastIndexOf(followUpMarker)
  if (followUpIndex === -1) {
    return ''
  }

  return backgroundNote.slice(followUpIndex + followUpMarker.length).trim()
}

const buildPrimaryScreenshotAttachment = (screenshot: ScreenshotRecord): ScreenshotAiThreadAttachment => ({
  id: `screenshot:${screenshot.id}`,
  kind: 'image',
  name: screenshot.caption ?? `事件图 ${screenshot.id}`,
  mime_type: null,
  size_bytes: null,
  preview_url: screenshot.annotated_asset_url ?? screenshot.raw_asset_url ?? screenshot.asset_url,
  text_excerpt: null,
  is_primary_screenshot: true,
})

const toThreadAttachment = (
  attachment: PersistedAttachmentMeta | AiAnalysisAttachment,
): ScreenshotAiThreadAttachment => ({
  id: attachment.id,
  kind: attachment.kind,
  name: attachment.name,
  mime_type: attachment.mime_type ?? null,
  size_bytes: attachment.size_bytes ?? null,
  preview_url: 'data_url' in attachment ? attachment.data_url ?? null : null,
  text_excerpt: attachment.text_excerpt ? clip(attachment.text_excerpt, 240) : null,
  is_primary_screenshot: false,
})

export const serializeQuestionForPrompt = (question: string) => [
  USER_QUESTION_START,
  question.trim(),
  USER_QUESTION_END,
].join('\n')

export const serializeAttachmentsForPrompt = (attachments: AiAnalysisAttachment[]) => {
  if (attachments.length === 0) {
    return ''
  }

  const persisted = attachments.map((attachment) => ({
    id: attachment.id,
    kind: attachment.kind,
    name: attachment.name,
    mime_type: attachment.mime_type ?? null,
    size_bytes: attachment.size_bytes ?? null,
    text_excerpt: attachment.text_excerpt ? clip(attachment.text_excerpt, 240) : null,
  }))

  return [
    ATTACHMENTS_START,
    JSON.stringify(persisted),
    ATTACHMENTS_END,
  ].join('\n')
}

export const buildFollowUpContext = (input: {
  aiReply: {
    aiRun: AiRunRecord | null
    card: AnalysisCardRecord
  }
  followUpQuestion: string
  noteDraft: string
  titleDraft: string
  attachments: AiAnalysisAttachment[]
}) => {
  const followUpQuestion = input.followUpQuestion.trim().slice(0, 1200)
  const noteDraft = input.noteDraft.trim().slice(0, 1000)
  const sections = [
    '你正在延续同一张事件图的分析。',
    `当前事件图标题：${input.titleDraft.trim() || '未命名事件图'}`,
    `上一轮 AI 提供方：${input.aiReply.aiRun?.provider ?? 'AI'}`,
    '上一轮 AI 结构化结论：',
    `- 当前判断：${input.aiReply.card.summary_short.trim()}`,
    `- 偏向：${translateAnalysisBias(input.aiReply.card.bias)}`,
    `- 关注区间：${input.aiReply.card.entry_zone.trim() || '未给出'}`,
    `- 止损：${input.aiReply.card.stop_loss.trim() || '未给出'}`,
    `- 止盈：${input.aiReply.card.take_profit.trim() || '未给出'}`,
    `- 失效条件：${input.aiReply.card.invalidation.trim() || '未给出'}`,
  ]

  if (noteDraft) {
    sections.push('', '当前人工笔记：', noteDraft)
  }

  if (input.attachments.length > 0) {
    sections.push('', '继续追问附件：')
    input.attachments.forEach((attachment, index) => {
      sections.push(
        `- 附件 ${index + 1}: ${attachment.name} | ${attachment.kind} | ${attachment.mime_type ?? 'unknown'} | ${attachment.size_bytes ?? 0} bytes`,
      )
      if (attachment.text_excerpt?.trim()) {
        sections.push(`  文本摘录：${clip(attachment.text_excerpt, 220)}`)
      }
    })
  }

  sections.push('', '这次继续追问：', followUpQuestion)
  sections.push('', serializeQuestionForPrompt(followUpQuestion))
  const attachmentMeta = serializeAttachmentsForPrompt(input.attachments)
  if (attachmentMeta) {
    sections.push('', attachmentMeta)
  }
  return sections.join('\n').slice(0, 3900)
}

export const buildScreenshotAiThread = (input: {
  screenshot: ScreenshotRecord
  aiReplies: ScreenshotAiReplyRecord[]
  attachmentCacheByAiRunId?: Record<string, AiAnalysisAttachment[]>
}) => input.aiReplies.map((reply) => {
  const aiRunId = reply.aiRun?.id ?? reply.aiEvent.ai_run_id ?? reply.aiEvent.id
  const cached = aiRunId && input.attachmentCacheByAiRunId?.[aiRunId]
    ? input.attachmentCacheByAiRunId[aiRunId].map(toThreadAttachment)
    : parsePersistedAttachments(reply.aiRun?.prompt_preview ?? '').map(toThreadAttachment)
  const userText = parseUserQuestion(reply.aiRun?.prompt_preview ?? '')
    || '请参考这张图，分析当前盘面。'

  return {
    key: `turn:${aiRunId}`,
    occurred_at: reply.aiEvent.occurred_at,
    user_text: userText,
    user_attachments: [buildPrimaryScreenshotAttachment(input.screenshot), ...cached],
    ai_reply: reply,
  }
})

export const formatAttachmentSize = (sizeBytes: number | null) => {
  if (sizeBytes == null || !Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return null
  }

  if (sizeBytes < 1024) {
    return `${sizeBytes} B`
  }
  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(sizeBytes < 10 * 1024 ? 1 : 0)} KB`
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
}

export const isTextLikeAttachment = (file: File) => {
  const lowerName = file.name.toLowerCase()
  return file.type.startsWith('text/')
    || lowerName.endsWith('.txt')
    || lowerName.endsWith('.md')
    || lowerName.endsWith('.markdown')
    || lowerName.endsWith('.json')
    || lowerName.endsWith('.csv')
    || lowerName.endsWith('.tsv')
    || lowerName.endsWith('.log')
}
