import type { AiAnalysisContextInput } from '@shared/ai/contracts'
import type { ScreenshotRecord } from '@shared/contracts/content'
import type { EventRecord } from '@shared/contracts/event'
import type { TradeRecord } from '@shared/contracts/trade'
import type { SessionWorkbenchPayload } from '@shared/contracts/workbench'
import type {
  AiPacketBackgroundToggles,
  AiPacketDispatchRecord,
  AiPacketComposerState,
  AiPacketPreview,
  AnalysisTrayState,
} from '../session-workbench-types'

export const resolveAiPacketImageRegionLabel = (mode: AiPacketComposerState['imageRegionMode']) => {
  if (mode === 'selection') {
    return '局部'
  }
  if (mode === 'annotations-only') {
    return '标注层'
  }
  if (mode === 'full-with-highlight') {
    return '整图高亮'
  }
  return '整图'
}

export const createDefaultAiPacketBackgroundToggles = (): AiPacketBackgroundToggles => ({
  includeCurrentNote: true,
  includeEventRangeSummary: true,
  includeTradeFacts: true,
  includeSessionSummary: false,
  includePriorAi: false,
})

const uniqueOrdered = (values: Array<string | null | undefined>) => {
  const seen = new Set<string>()
  const ordered: string[] = []
  for (const value of values) {
    const normalized = value?.trim()
    if (!normalized || seen.has(normalized)) {
      continue
    }
    seen.add(normalized)
    ordered.push(normalized)
  }
  return ordered
}

const compactText = (value: string | null | undefined, maxLength = 420) => {
  const compact = value?.replace(/\s+/g, ' ').trim() ?? ''
  if (!compact) {
    return ''
  }
  return compact.length > maxLength ? `${compact.slice(0, maxLength - 3).trim()}...` : compact
}

const formatTradeFacts = (trade: TradeRecord | null) => {
  if (!trade) {
    return ''
  }

  return [
    `- 合约：${trade.symbol}`,
    `- 方向：${trade.side}`,
    `- 状态：${trade.status}`,
    `- 数量：${trade.quantity}`,
    `- 入场：${trade.entry_price}`,
    `- 止损：${trade.stop_loss}`,
    `- 止盈：${trade.take_profit}`,
    trade.exit_price != null ? `- 离场：${trade.exit_price}` : null,
  ].filter(Boolean).join('\n')
}

export const buildAiPacketBackgroundDraft = (input: {
  currentTrade: TradeRecord | null
  payload: SessionWorkbenchPayload
  realtimeDraft: string
  selectedEvents: EventRecord[]
  toggles: AiPacketBackgroundToggles
}) => {
  const sections: string[] = []

  if (input.toggles.includeCurrentNote) {
    const currentNote = compactText(input.realtimeDraft || input.payload.panels.my_realtime_view, 1200)
    sections.push('当前笔记：')
    sections.push(currentNote || '当前没有额外笔记。')
  }

  if (input.toggles.includeEventRangeSummary) {
    const selectedEvents = input.selectedEvents.slice(0, 8)
    sections.push('事件区间摘要：')
    sections.push(selectedEvents.length > 0
      ? selectedEvents.map((event, index) =>
        `${index + 1}. ${event.title} | ${compactText(event.summary || event.title, 180)}`).join('\n')
      : '当前没有额外选中的事件区间。')
  }

  if (input.toggles.includeTradeFacts) {
    sections.push('Trade facts：')
    sections.push(formatTradeFacts(input.currentTrade) || '当前没有激活的 trade facts。')
  }

  if (input.toggles.includeSessionSummary) {
    sections.push('Session 摘要：')
    sections.push([
      `- 标题：${input.payload.session.title}`,
      `- 偏向：${input.payload.session.market_bias}`,
      `- 焦点：${compactText(input.payload.session.context_focus, 220) || '未填写'}`,
      input.payload.session.tags.length > 0 ? `- Tags：${input.payload.session.tags.join(', ')}` : '- Tags：无',
    ].join('\n'))
  }

  if (input.toggles.includePriorAi) {
    const priorSummaries = input.payload.analysis_cards.slice(-3).map((card, index) =>
      `${index + 1}. ${compactText(card.summary_short, 180)}`)
    sections.push('历史 AI 摘要：')
    sections.push(priorSummaries.length > 0 ? priorSummaries.join('\n') : '当前没有历史 AI 摘要。')
  }

  return sections.join('\n\n').trim().slice(0, 3600)
}

export const buildAiPacketPreview = (input: {
  backgroundScreenshotIds: string[]
  imageRegionMode: AiPacketComposerState['imageRegionMode']
  selectedEventIds: string[]
  toggles: AiPacketBackgroundToggles
  primaryScreenshotId: string | null
}): AiPacketPreview => {
  const includedItems = [
    input.primaryScreenshotId ? '主图' : null,
    input.backgroundScreenshotIds.length > 0 ? `${input.backgroundScreenshotIds.length} 张附图` : null,
    `图像模式：${resolveAiPacketImageRegionLabel(input.imageRegionMode)}`,
    input.toggles.includeCurrentNote ? '当前笔记' : null,
    input.toggles.includeEventRangeSummary ? '事件摘要' : null,
    input.toggles.includeTradeFacts ? 'Trade facts' : null,
    input.toggles.includeSessionSummary ? 'Session 摘要' : null,
    input.toggles.includePriorAi ? '历史 AI' : null,
  ].filter((item): item is string => item != null)
  const omittedItems = [
    input.toggles.includeCurrentNote ? null : '当前笔记',
    input.toggles.includeEventRangeSummary ? null : '事件摘要',
    input.toggles.includeTradeFacts ? null : 'Trade facts',
    input.toggles.includeSessionSummary ? null : 'Session 摘要',
    input.toggles.includePriorAi ? null : '历史 AI',
  ].filter((item): item is string => item != null)

  return {
    primaryScreenshotCount: input.primaryScreenshotId ? 1 : 0,
    backgroundScreenshotCount: input.backgroundScreenshotIds.length,
    eventCount: input.selectedEventIds.length,
    includedItems,
    omittedItems,
    summary: uniqueOrdered([
      input.primaryScreenshotId ? '1 张主图' : '0 张主图',
      input.backgroundScreenshotIds.length > 0 ? `${input.backgroundScreenshotIds.length} 张附图` : null,
      resolveAiPacketImageRegionLabel(input.imageRegionMode),
      input.toggles.includeCurrentNote ? '当前笔记' : null,
      input.toggles.includeEventRangeSummary ? '事件摘要' : null,
      input.toggles.includeTradeFacts ? 'Trade facts' : null,
      input.toggles.includeSessionSummary ? 'Session 摘要' : null,
      input.toggles.includePriorAi ? null : '不包含历史 AI',
    ]).join('、'),
  }
}

export const createAiPacketComposerState = (input: {
  analysisTray: AnalysisTrayState
  currentTrade: TradeRecord | null
  payload: SessionWorkbenchPayload
  realtimeDraft: string
  selectedEventIds: string[]
  selectedEvents: EventRecord[]
  selectedScreenshot: ScreenshotRecord | null
}): AiPacketComposerState => {
  const primaryScreenshotId = input.selectedScreenshot?.id
    ?? input.analysisTray.primaryScreenshotId
    ?? input.analysisTray.screenshotIds[0]
    ?? null
  const backgroundScreenshotIds = uniqueOrdered(
    input.analysisTray.screenshotIds.filter((screenshotId) => screenshotId !== primaryScreenshotId),
  )
  const backgroundToggles = createDefaultAiPacketBackgroundToggles()
  return {
    open: false,
    primaryScreenshotId,
    backgroundScreenshotIds,
    imageRegionMode: 'full',
    focusAnnotationIds: [],
    backgroundToggles,
    backgroundDraft: buildAiPacketBackgroundDraft({
      currentTrade: input.currentTrade,
      payload: input.payload,
      realtimeDraft: input.realtimeDraft,
      selectedEvents: input.selectedEvents,
      toggles: backgroundToggles,
    }),
    backgroundDraftDirty: false,
    preview: buildAiPacketPreview({
      primaryScreenshotId,
      backgroundScreenshotIds,
      imageRegionMode: 'full',
      selectedEventIds: input.selectedEventIds,
      toggles: backgroundToggles,
    }),
  }
}

export const rebuildAiPacketComposerState = (input: {
  composer: AiPacketComposerState
  currentTrade: TradeRecord | null
  payload: SessionWorkbenchPayload
  realtimeDraft: string
  selectedEventIds: string[]
  selectedEvents: EventRecord[]
}): AiPacketComposerState => {
  const preview = buildAiPacketPreview({
    primaryScreenshotId: input.composer.primaryScreenshotId,
    backgroundScreenshotIds: input.composer.backgroundScreenshotIds,
    imageRegionMode: input.composer.imageRegionMode,
    selectedEventIds: input.selectedEventIds,
    toggles: input.composer.backgroundToggles,
  })
  const backgroundDraft = input.composer.backgroundDraftDirty
    ? input.composer.backgroundDraft
    : buildAiPacketBackgroundDraft({
      currentTrade: input.currentTrade,
      payload: input.payload,
      realtimeDraft: input.realtimeDraft,
      selectedEvents: input.selectedEvents,
      toggles: input.composer.backgroundToggles,
    })

  return {
    ...input.composer,
    backgroundDraft,
    preview,
  }
}

export const buildAiAnalysisContextFromComposer = (input: {
  composer: AiPacketComposerState
  attachments?: AiAnalysisContextInput['attachments']
  selectedEventIds: string[]
}): AiAnalysisContextInput => ({
  background_screenshot_ids: input.composer.backgroundScreenshotIds,
  source_event_ids: input.selectedEventIds,
  image_region_mode: input.composer.imageRegionMode,
  focus_annotation_ids: input.composer.focusAnnotationIds,
  background_toggles: input.composer.backgroundToggles,
  packet_preview: input.composer.preview,
  background_note_md: input.composer.backgroundDraft,
  attachments: input.attachments ?? [],
})

export const buildAiDockContextChips = (input: {
  composer: AiPacketComposerState
  selectedEventIds: string[]
}) => uniqueOrdered([
  input.composer.primaryScreenshotId ? '主图' : null,
  input.composer.backgroundScreenshotIds.length > 0 ? `附图 ${input.composer.backgroundScreenshotIds.length}` : null,
  input.selectedEventIds.length > 0 ? `区间 ${input.selectedEventIds.length}` : null,
  resolveAiPacketImageRegionLabel(input.composer.imageRegionMode),
  ...input.composer.preview.includedItems.filter((item) =>
    item === '当前笔记'
    || item === '事件摘要'
    || item === 'Trade facts'
    || item === 'Session 摘要'
    || item === '历史 AI'),
])

export const buildAiDockContextChipsFromDispatch = (packet: AiPacketDispatchRecord) => uniqueOrdered([
  packet.primaryScreenshotId ? '主图' : null,
  packet.backgroundScreenshotIds.length > 0 ? `附图 ${packet.backgroundScreenshotIds.length}` : null,
  packet.sourceEventIds.length > 0 ? `区间 ${packet.sourceEventIds.length}` : null,
  resolveAiPacketImageRegionLabel(packet.imageRegionMode),
  ...packet.preview.includedItems.filter((item) =>
    item === '当前笔记'
    || item === '事件摘要'
    || item === 'Trade facts'
    || item === 'Session 摘要'
    || item === '历史 AI'),
])
