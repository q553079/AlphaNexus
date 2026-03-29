import { useMemo } from 'react'
import { EventStreamCard } from '@app/components/EventStreamCard'
import {
  formatTime,
} from '@app/ui/display-text'
import type { ScreenshotRecord } from '@shared/contracts/content'
import type { EventRecord } from '@shared/contracts/event'
import type { TradeRecord } from '@shared/contracts/trade'
import { buildEventStreamViewModel } from './modules/session-event-stream'
import { SessionEventVirtualList } from './SessionEventVirtualList'

type SessionEventColumnProps = {
  currentTrade: TradeRecord | null
  events: EventRecord[]
  sessionCreatedAt: string
  screenshots: ScreenshotRecord[]
  selectedEventId: string | null
  onOpenTrade: (tradeId: string) => void
  onSelectEvent: (event: EventRecord) => void
  trades: TradeRecord[]
}

export const SessionEventColumn = ({
  currentTrade,
  events,
  sessionCreatedAt,
  screenshots,
  selectedEventId,
  onOpenTrade,
  onSelectEvent,
  trades,
}: SessionEventColumnProps) => {
  const currentFlowTitle = '事件流 1'
  const currentFlowTime = formatTime(sessionCreatedAt)

  const viewModel = useMemo(() => buildEventStreamViewModel({
    activeFilter: 'all',
    collapseAi: false,
    collapseBackground: false,
    collapseNotes: false,
    currentTrade,
    events,
    screenshots,
    selectedEventId,
    tradeFocusId: null,
    trades,
  }), [
    currentTrade,
    events,
    screenshots,
    selectedEventId,
    trades,
  ])

  return (
    <section className="session-workbench__column session-workbench__column--events">
      <div className="session-event-stream session-event-stream--notebook">
        <div className="session-event-stream__titlebar">
          <h2>
            <span>{currentFlowTitle}</span>
            <small>{currentFlowTime}</small>
          </h2>
        </div>
        <div className="session-event-stream__list">
          {viewModel.blocks.length > 0 ? (
            <SessionEventVirtualList
              items={viewModel.blocks.map((block) => ({
                id: block.kind === 'cluster' ? block.id : block.item.event.id,
                data: block,
              }))}
              renderItem={(block) => {
                if (block.kind === 'cluster') {
                  return null
                }

                return (
                  <EventStreamCard
                    directoryLabel={`事件 ${block.item.sequenceNumber}`}
                    dimmed={block.item.dimmed}
                    event={block.item.event}
                    highlighted={block.item.highlighted}
                    key={block.item.event.id}
                    onClick={() => onSelectEvent(block.item.event)}
                    onOpenTrade={block.item.trade ? (() => {
                      const tradeId = block.item.trade.id
                      return () => onOpenTrade(tradeId)
                    })() : undefined}
                    screenshotKind={block.item.screenshotKind}
                    selected={block.item.selected}
                    signalTone={block.item.signalTone}
                    trade={block.item.trade}
                  />
                )
              }}
            />
          ) : <div className="empty-state">当前还没有事件记录。</div>}
        </div>
      </div>
    </section>
  )
}
