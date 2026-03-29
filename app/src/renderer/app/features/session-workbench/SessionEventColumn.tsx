import { useMemo, useState } from 'react'
import { EventStreamCard } from '@app/components/EventStreamCard'
import { formatTime } from '@app/ui/display-text'
import type { ScreenshotRecord } from '@shared/contracts/content'
import type { EventRecord } from '@shared/contracts/event'
import type { TradeRecord } from '@shared/contracts/trade'
import type { ReviewCaseRecord } from '@shared/contracts/workbench'
import { buildEventStreamViewModel, type EventStreamBlock } from './modules/session-event-stream'
import { SessionEventVirtualList } from './SessionEventVirtualList'
import type { EventSelectionState } from './session-workbench-types'

type SessionEventColumnProps = {
  activeReviewCaseId: string | null
  busy?: boolean
  currentTrade: TradeRecord | null
  eventSelection: EventSelectionState
  events: EventRecord[]
  onAddSelectionToAnalysisTray: () => void
  onClearSelection: () => void
  onOpenReviewCase: (reviewCaseId: string) => void
  onOpenTrade: (tradeId: string) => void
  onSaveSelectionAsReviewCase: () => void
  onSelectEvent: (event: EventRecord, options?: {
    shiftKey?: boolean
  }) => void
  onTogglePinnedEvent: (event: EventRecord) => void
  reviewCases: ReviewCaseRecord[]
  sessionCreatedAt: string
  screenshots: ScreenshotRecord[]
  selectedEventIds: string[]
  trades: TradeRecord[]
}

type EventRailMode = 'events' | 'session'

type SessionStageGroup = {
  key: string
  title: string
  subtitle: string
  blocks: EventStreamBlock[]
}

const resolveStageMeta = (block: EventStreamBlock): Omit<SessionStageGroup, 'blocks'> => {
  const targetEvent = block.kind === 'cluster'
    ? block.items[block.items.length - 1]?.event ?? null
    : block.item.event
  if (!targetEvent) {
    return {
      key: 'observing',
      title: '观察段',
      subtitle: '截图、观察和前置上下文',
    }
  }

  if (
    targetEvent.event_type === 'review'
    || targetEvent.event_type === 'ai_summary'
  ) {
    return {
      key: 'review',
      title: '复盘段',
      subtitle: 'AI、复盘和总结事件',
    }
  }

  if (targetEvent.trade_id || targetEvent.event_type.startsWith('trade_')) {
    return {
      key: 'execution',
      title: '执行段',
      subtitle: '交易动作和持仓管理',
    }
  }

  return {
    key: 'observing',
    title: '观察段',
    subtitle: '截图、观察和前置上下文',
  }
}

const groupBlocksBySessionStage = (blocks: EventStreamBlock[]) => {
  const groups: SessionStageGroup[] = []

  for (const block of blocks) {
    const stage = resolveStageMeta(block)
    const existing = groups[groups.length - 1]
    if (existing?.key === stage.key) {
      existing.blocks.push(block)
      continue
    }

    groups.push({
      ...stage,
      blocks: [block],
    })
  }

  return groups
}

const renderClusterBlock = (block: Extract<EventStreamBlock, { kind: 'cluster' }>) => (
  <article className="session-event-stream__cluster" key={block.id}>
    <div>
      <strong>{block.title}</strong>
      <p>{block.subtitle}</p>
    </div>
    {block.previewTitles.length > 0 ? (
      <div className="session-event-stream__cluster-previews">
        {block.previewTitles.map((title) => <span className="status-pill" key={title}>{title}</span>)}
      </div>
    ) : null}
  </article>
)

export const SessionEventColumn = ({
  activeReviewCaseId,
  busy = false,
  currentTrade,
  eventSelection,
  events,
  onAddSelectionToAnalysisTray,
  onClearSelection,
  onOpenReviewCase,
  onOpenTrade,
  onSaveSelectionAsReviewCase,
  onSelectEvent,
  onTogglePinnedEvent,
  reviewCases,
  sessionCreatedAt,
  screenshots,
  selectedEventIds,
  trades,
}: SessionEventColumnProps) => {
  const [railMode, setRailMode] = useState<EventRailMode>('events')
  const currentFlowTitle = railMode === 'events' ? '统一时间流' : 'Session 阶段流'
  const currentFlowTime = formatTime(sessionCreatedAt)
  const selectedEventIdSet = useMemo(() => new Set(selectedEventIds), [selectedEventIds])
  const pinnedEventIdSet = useMemo(() => new Set(eventSelection.pinnedEventIds), [eventSelection.pinnedEventIds])
  const hasSelectionActions = selectedEventIds.length > 1 || eventSelection.mode === 'pinned'

  const viewModel = useMemo(() => buildEventStreamViewModel({
    activeFilter: 'all',
    collapseAi: false,
    collapseBackground: false,
    collapseNotes: false,
    currentTrade,
    events,
    screenshots,
    selectedEventId: eventSelection.primaryEventId,
    tradeFocusId: null,
    trades,
  }), [
    currentTrade,
    eventSelection.primaryEventId,
    events,
    screenshots,
    trades,
  ])

  const groupedBlocks = useMemo(
    () => railMode === 'events'
      ? [{
        key: 'timeline',
        title: '统一时间流',
        subtitle: '按真实时间顺序浏览整个 session',
        blocks: viewModel.blocks,
      }]
      : groupBlocksBySessionStage(viewModel.blocks),
    [railMode, viewModel.blocks],
  )

  return (
    <section className="session-workbench__column session-workbench__column--events">
      <div className="session-event-stream session-event-stream--notebook">
        <div className="session-event-stream__titlebar">
          <div>
            <h2>
              <span>{currentFlowTitle}</span>
              <small>{currentFlowTime}</small>
            </h2>
            <p className="session-event-stream__subtitle">
              {railMode === 'events'
                ? '所有事件共用一条时间流。'
                : '同一条流按观察 / 执行 / 复盘阶段分组显示。'}
            </p>
          </div>
          <div className="session-event-stream__mode-switch">
            {(['events', 'session'] as const).map((mode) => (
              <button
                className={`button ${railMode === mode ? 'is-primary' : 'is-secondary'}`.trim()}
                disabled={busy}
                key={mode}
                onClick={() => setRailMode(mode)}
                type="button"
              >
                {mode === 'events' ? 'Events' : 'Session'}
              </button>
            ))}
          </div>
        </div>

        {hasSelectionActions ? (
          <div className="session-event-stream__selection-toolbar">
            <div>
              <strong>{eventSelection.mode === 'pinned' ? 'Pinned 选择' : '连续区间选择'}</strong>
              <p>已选 {selectedEventIds.length} 条事件，可加入分析托盘或保存为 Case。</p>
            </div>
            <div className="action-row">
              <button className="button is-secondary" disabled={busy} onClick={onAddSelectionToAnalysisTray} type="button">
                加入 AI 托盘
              </button>
              <button className="button is-primary" disabled={busy} onClick={onSaveSelectionAsReviewCase} type="button">
                保存为 Case
              </button>
              <button className="button is-secondary" disabled={busy} onClick={onClearSelection} type="button">
                取消选择
              </button>
            </div>
          </div>
        ) : null}

        <div className="session-event-stream__list">
          {groupedBlocks.length > 0 ? groupedBlocks.map((group) => (
            <section className="session-event-stream__stage" key={group.key}>
              {railMode === 'session' ? (
                <header className="session-event-stream__stage-header">
                  <strong>{group.title}</strong>
                  <p>{group.subtitle}</p>
                </header>
              ) : null}

              <SessionEventVirtualList
                items={group.blocks.map((block) => ({
                  id: block.kind === 'cluster' ? block.id : block.item.event.id,
                  data: block,
                }))}
                renderItem={(block) => {
                  if (block.kind === 'cluster') {
                    return renderClusterBlock(block)
                  }

                  const isPinned = pinnedEventIdSet.has(block.item.event.id)
                  return (
                    <div className="session-event-stream__item-shell" key={block.item.event.id}>
                      <EventStreamCard
                        directoryLabel={`事件 ${block.item.sequenceNumber}`}
                        dimmed={block.item.dimmed}
                        event={block.item.event}
                        highlighted={block.item.highlighted}
                        onClick={(event) => onSelectEvent(block.item.event, {
                          shiftKey: event.shiftKey,
                        })}
                        onOpenTrade={block.item.trade ? (() => {
                          const tradeId = block.item.trade.id
                          return () => onOpenTrade(tradeId)
                        })() : undefined}
                        screenshotKind={block.item.screenshotKind}
                        selected={selectedEventIdSet.has(block.item.event.id)}
                        signalTone={block.item.signalTone}
                        trade={block.item.trade}
                      />
                      <button
                        className={`button is-secondary session-event-stream__pin ${isPinned ? 'is-active' : ''}`.trim()}
                        disabled={busy}
                        onClick={(event) => {
                          event.stopPropagation()
                          onTogglePinnedEvent(block.item.event)
                        }}
                        type="button"
                      >
                        {isPinned ? 'Unpin' : 'Pin'}
                      </button>
                    </div>
                  )
                }}
              />
            </section>
          )) : <div className="empty-state">当前还没有事件记录。</div>}
        </div>

        <div className="session-event-stream__cases">
          <div className="session-event-stream__cases-header">
            <strong>Saved Cases</strong>
            <span className="status-pill">{reviewCases.length}</span>
          </div>
          {reviewCases.length > 0 ? (
            reviewCases.map((reviewCase) => (
              <button
                className={`session-event-stream__case-item ${activeReviewCaseId === reviewCase.id ? 'is-active' : ''}`.trim()}
                key={reviewCase.id}
                onClick={() => onOpenReviewCase(reviewCase.id)}
                type="button"
              >
                <div>
                  <strong>{reviewCase.title}</strong>
                  <p>{reviewCase.selection_mode} · 事件 {reviewCase.event_ids.length} · 图 {reviewCase.screenshot_ids.length}</p>
                </div>
                <span>{formatTime(reviewCase.updated_at)}</span>
              </button>
            ))
          ) : (
            <div className="empty-state">当前 session 还没有保存的 Case。</div>
          )}
        </div>
      </div>
    </section>
  )
}
