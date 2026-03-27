import type { EventStreamFilterKey } from '@app/ui/display-text'
import type { ScreenshotRecord } from '@shared/contracts/content'
import type { EventRecord } from '@shared/contracts/event'
import type { TradeRecord } from '@shared/contracts/trade'

export type EventClusterKind = 'ai' | 'notes' | 'background'

export type EventStreamItem = {
  event: EventRecord
  trade: TradeRecord | null
  screenshotKind: ScreenshotRecord['kind'] | null
  noteCount: number
  isAiEvent: boolean
  isNoteReviewEvent: boolean
  isStrongSignal: boolean
  signalTone: 'trade' | 'exit' | 'review' | null
  highlighted: boolean
  dimmed: boolean
  clusterKind: EventClusterKind | null
  selected: boolean
}

export type EventStreamBlock =
  | {
    kind: 'event'
    item: EventStreamItem
  }
  | {
    kind: 'cluster'
    id: string
    clusterKind: EventClusterKind
    items: EventStreamItem[]
    title: string
    subtitle: string
    previewTitles: string[]
    signalTone: 'review' | null
  }

export type EventStreamViewModel = {
  blocks: EventStreamBlock[]
  focusedTrade: TradeRecord | null
  focusedTradeId: string | null
  hiddenByCollapseCount: number
  items: EventStreamItem[]
  strongSignalCount: number
  visibleEventCount: number
}

const strongTradeTypes = new Set<EventRecord['event_type']>([
  'trade_open',
  'trade_add',
  'trade_reduce',
  'trade_close',
  'trade_cancel',
])

const noteReviewTypes = new Set<EventRecord['event_type']>([
  'observation',
  'thesis',
  'review',
])

const matchesFilter = (event: EventRecord, filter: EventStreamFilterKey) => {
  if (filter === 'all') {
    return true
  }
  if (filter === 'screenshot') {
    return event.event_type === 'screenshot'
  }
  if (filter === 'ai') {
    return event.event_type === 'ai_summary'
  }
  if (filter === 'trade') {
    return event.trade_id != null || event.event_type.startsWith('trade_')
  }
  return event.event_type === 'review'
}

const buildClusterMeta = (clusterKind: EventClusterKind, items: EventStreamItem[]) => {
  if (clusterKind === 'ai') {
    return {
      title: 'AI Context Stack',
      subtitle: `${items.length} 条 AI 事件已折叠`,
      signalTone: null,
    } as const
  }

  if (clusterKind === 'notes') {
    return {
      title: items.some((item) => item.event.event_type === 'review') ? 'Notes / Review Stack' : 'Notes Stack',
      subtitle: `${items.length} 条 note / review 事件已折叠`,
      signalTone: items.some((item) => item.event.event_type === 'review') ? 'review' : null,
    } as const
  }

  return {
    title: 'Background Trade Stack',
    subtitle: `${items.length} 条非焦点 trade 背景事件已折叠`,
    signalTone: null,
  } as const
}

const flushCluster = (
  blocks: EventStreamBlock[],
  clusterKind: EventClusterKind | null,
  buffered: EventStreamItem[],
) => {
  if (!clusterKind || buffered.length === 0) {
    return
  }

  if (buffered.length === 1) {
    blocks.push({
      kind: 'event',
      item: buffered[0],
    })
    return
  }

  const meta = buildClusterMeta(clusterKind, buffered)
  blocks.push({
    kind: 'cluster',
    id: `${clusterKind}_${buffered[0].event.id}_${buffered[buffered.length - 1].event.id}`,
    clusterKind,
    items: buffered,
    title: meta.title,
    subtitle: meta.subtitle,
    previewTitles: buffered.slice(0, 2).map((item) => item.event.title),
    signalTone: meta.signalTone,
  })
}

export const buildEventStreamViewModel = (input: {
  activeFilter: EventStreamFilterKey
  collapseAi: boolean
  collapseBackground: boolean
  collapseNotes: boolean
  currentTrade: TradeRecord | null
  events: EventRecord[]
  screenshots: ScreenshotRecord[]
  selectedEventId: string | null
  tradeFocusId: string | null
  trades: TradeRecord[]
}): EventStreamViewModel => {
  const selectedEvent = input.selectedEventId
    ? input.events.find((event) => event.id === input.selectedEventId) ?? null
    : null
  const focusedTradeId = input.tradeFocusId ?? selectedEvent?.trade_id ?? input.currentTrade?.id ?? null
  const focusedTrade = focusedTradeId
    ? input.trades.find((trade) => trade.id === focusedTradeId) ?? null
    : null
  const tradesById = new Map(input.trades.map((trade) => [trade.id, trade]))
  const screenshotsById = new Map(input.screenshots.map((shot) => [shot.id, shot]))

  const filteredEvents = input.events
    .filter((event) => matchesFilter(event, input.activeFilter))
    .filter((event) => (input.tradeFocusId ? event.trade_id === input.tradeFocusId : true))

  const items = filteredEvents.map<EventStreamItem>((event) => {
    const trade = event.trade_id ? tradesById.get(event.trade_id) ?? null : null
    const screenshotKind = event.screenshot_id
      ? screenshotsById.get(event.screenshot_id)?.kind ?? null
      : null
    const isTradeSignal = strongTradeTypes.has(event.event_type)
    const isExitScreenshot = event.event_type === 'screenshot' && screenshotKind === 'exit'
    const isReviewSignal = event.event_type === 'review'
    const isStrongSignal = isTradeSignal || isExitScreenshot || isReviewSignal
    const isAiEvent = event.event_type === 'ai_summary'
    const isNoteReviewEvent = noteReviewTypes.has(event.event_type)
    const highlighted = focusedTradeId != null && event.trade_id === focusedTradeId
    const dimmed = input.tradeFocusId == null
      && focusedTradeId != null
      && event.trade_id != null
      && event.trade_id !== focusedTradeId
      && !isStrongSignal
    const clusterKind = (() => {
      if (event.id === input.selectedEventId) {
        return null
      }
      if (input.collapseAi && isAiEvent) {
        return 'ai'
      }
      if (input.collapseNotes && isNoteReviewEvent && !isTradeSignal && !isExitScreenshot) {
        return 'notes'
      }
      if (input.collapseBackground && dimmed) {
        return 'background'
      }
      return null
    })()

    return {
      event,
      trade,
      screenshotKind,
      noteCount: event.content_block_ids.length,
      isAiEvent,
      isNoteReviewEvent,
      isStrongSignal,
      signalTone: isTradeSignal ? 'trade' : isExitScreenshot ? 'exit' : isReviewSignal ? 'review' : null,
      highlighted,
      dimmed,
      clusterKind,
      selected: event.id === input.selectedEventId,
    }
  })

  const blocks: EventStreamBlock[] = []
  let buffered: EventStreamItem[] = []
  let activeClusterKind: EventClusterKind | null = null

  for (const item of items) {
    if (!item.clusterKind) {
      flushCluster(blocks, activeClusterKind, buffered)
      buffered = []
      activeClusterKind = null
      blocks.push({
        kind: 'event',
        item,
      })
      continue
    }

    if (item.clusterKind !== activeClusterKind) {
      flushCluster(blocks, activeClusterKind, buffered)
      buffered = [item]
      activeClusterKind = item.clusterKind
      continue
    }

    buffered.push(item)
  }

  flushCluster(blocks, activeClusterKind, buffered)

  return {
    blocks,
    focusedTrade,
    focusedTradeId,
    hiddenByCollapseCount: blocks
      .filter((block) => block.kind === 'cluster')
      .reduce((count, block) => count + block.items.length, 0),
    items,
    strongSignalCount: items.filter((item) => item.isStrongSignal).length,
    visibleEventCount: items.length,
  }
}
