import type { ContentBlockRecord } from '@shared/contracts/content'
import type { EventRecord } from '@shared/contracts/event'
import type { SessionWorkbenchPayload } from '@shared/contracts/workbench'

export type StoryIndexEntry = {
  anchorId: string
  blockId: string
  createdAt: string
  label: string
  summary: string
  title: string
}

const stripMarkdown = (value: string) =>
  value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[*_>#-]/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()

const truncateText = (value: string, maxLength = 72) =>
  value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value

const getCurrentContext = (payload: SessionWorkbenchPayload) => ({
  contextId: payload.current_context.trade_id ?? payload.session.id,
  contextType: payload.current_context.trade_id ? 'trade' : 'session',
} as const)

const getAiSummaryForRun = (payload: SessionWorkbenchPayload, aiRunId: string | null | undefined) => {
  if (!aiRunId) {
    return null
  }

  return payload.analysis_cards.find((card) => card.ai_run_id === aiRunId)?.summary_short?.trim() || null
}

const findLatestAiEvent = (events: EventRecord[], predicate: (event: EventRecord) => boolean) =>
  [...events]
    .filter((event) => event.event_type === 'ai_summary' && event.ai_run_id && predicate(event))
    .sort((left, right) =>
      new Date(left.occurred_at).getTime() - new Date(right.occurred_at).getTime())
    .at(-1) ?? null

const resolveAiSummaryForBlock = (payload: SessionWorkbenchPayload, block: ContentBlockRecord) => {
  if (block.event_id) {
    const event = payload.events.find((item) => item.id === block.event_id) ?? null
    const directSummary = getAiSummaryForRun(payload, event?.ai_run_id)
    if (directSummary) {
      return directSummary
    }

    if (event?.screenshot_id) {
      const screenshotSummary = getAiSummaryForRun(
        payload,
        findLatestAiEvent(payload.events, (item) => item.screenshot_id === event.screenshot_id)?.ai_run_id,
      )
      if (screenshotSummary) {
        return screenshotSummary
      }
    }

    if (event?.trade_id) {
      const tradeSummary = getAiSummaryForRun(
        payload,
        findLatestAiEvent(payload.events, (item) => item.trade_id === event.trade_id)?.ai_run_id,
      )
      if (tradeSummary) {
        return tradeSummary
      }
    }
  }

  if (block.context_type === 'trade') {
    return getAiSummaryForRun(
      payload,
      findLatestAiEvent(payload.events, (event) => event.trade_id === block.context_id)?.ai_run_id,
    )
  }

  return null
}

const buildFallbackSummary = (block: ContentBlockRecord) => {
  const plainText = stripMarkdown(block.content_md)
  if (plainText) {
    return truncateText(plainText)
  }
  return `${block.title} 还没有正文。`
}

export const getNoteBlockAnchorId = (blockId: string) => `story-note-${blockId}`

export const resolveEditableNoteBlocks = (payload: SessionWorkbenchPayload) => {
  const { contextId, contextType } = getCurrentContext(payload)
  const eventTypeById = new Map(payload.events.map((event) => [event.id, event.event_type]))

  const editableBlocks = payload.content_blocks
    .filter((block) => block.block_type === 'markdown')
    .filter((block) => block.title !== 'Realtime view')
    .filter((block) => block.context_type === contextType && block.context_id === contextId)
    .filter((block) => (block.event_id ? eventTypeById.get(block.event_id) !== 'review' : true))
    .sort((left, right) =>
      left.sort_order - right.sort_order || new Date(left.created_at).getTime() - new Date(right.created_at).getTime())

  return {
    activeBlocks: editableBlocks.filter((block) => !block.soft_deleted),
    contextId,
    contextType,
    deletedBlocks: editableBlocks.filter((block) => block.soft_deleted),
  }
}

export const buildStoryIndexEntries = (payload: SessionWorkbenchPayload, blocks: ContentBlockRecord[]): StoryIndexEntry[] =>
  blocks.map((block, index) => ({
    anchorId: getNoteBlockAnchorId(block.id),
    blockId: block.id,
    createdAt: block.created_at,
    label: `事件 ${index + 1}`,
    summary: resolveAiSummaryForBlock(payload, block) ?? buildFallbackSummary(block),
    title: block.title,
  }))
