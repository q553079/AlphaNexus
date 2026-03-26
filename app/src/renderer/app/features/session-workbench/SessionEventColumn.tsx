import { useMemo, useState } from 'react'
import { EventStreamCard } from '@app/components/EventStreamCard'
import { SectionCard } from '@app/components/SectionCard'
import { formatTradeBadgeLabel, translateEventStreamFilter } from '@app/ui/display-text'
import type { ScreenshotRecord } from '@shared/contracts/content'
import type { EventRecord } from '@shared/contracts/event'
import type { TradeRecord } from '@shared/contracts/trade'
import type { EventStreamFilterKey } from '@app/ui/display-text'
import { buildEventStreamViewModel, type EventClusterKind } from './modules/session-event-stream'

type SessionEventColumnProps = {
  currentTrade: TradeRecord | null
  events: EventRecord[]
  screenshots: ScreenshotRecord[]
  selectedEventId: string | null
  onOpenTrade: (tradeId: string) => void
  onSelectEvent: (event: EventRecord) => void
  trades: TradeRecord[]
}

const filterOrder: EventStreamFilterKey[] = ['all', 'screenshot', 'ai', 'trade', 'review']

const countForFilter = (events: EventRecord[], filter: EventStreamFilterKey) =>
  events.filter((event) => {
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
  }).length

export const SessionEventColumn = ({
  currentTrade,
  events,
  screenshots,
  selectedEventId,
  onOpenTrade,
  onSelectEvent,
  trades,
}: SessionEventColumnProps) => {
  const [activeFilter, setActiveFilter] = useState<EventStreamFilterKey>('all')
  const [tradeFocusId, setTradeFocusId] = useState<string | null>(null)
  const [collapseAi, setCollapseAi] = useState(true)
  const [collapseNotes, setCollapseNotes] = useState(true)
  const [collapseBackground, setCollapseBackground] = useState(true)

  const effectiveTradeFocusId = tradeFocusId && trades.some((trade) => trade.id === tradeFocusId)
    ? tradeFocusId
    : null

  const viewModel = useMemo(() => buildEventStreamViewModel({
    activeFilter,
    collapseAi,
    collapseBackground,
    collapseNotes,
    currentTrade,
    events,
    screenshots,
    selectedEventId,
    tradeFocusId: effectiveTradeFocusId,
    trades,
  }), [
    activeFilter,
    collapseAi,
    collapseBackground,
    collapseNotes,
    currentTrade,
    effectiveTradeFocusId,
    events,
    screenshots,
    selectedEventId,
    trades,
  ])

  const focusOptions = useMemo(() => {
    const orderedTrades = [...trades]
      .filter((trade) => trade.id !== currentTrade?.id)
      .sort((left, right) => {
      if (left.id === currentTrade?.id) {
        return -1
      }
      if (right.id === currentTrade?.id) {
        return 1
      }
      return new Date(right.opened_at).getTime() - new Date(left.opened_at).getTime()
    })

    return orderedTrades
  }, [currentTrade?.id, trades])

  const toggleCollapse = (clusterKind: EventClusterKind) => {
    if (clusterKind === 'ai') {
      setCollapseAi(false)
      return
    }
    if (clusterKind === 'notes') {
      setCollapseNotes(false)
      return
    }
    setCollapseBackground(false)
  }

  return (
    <section className="session-workbench__column session-workbench__column--events">
      <SectionCard
        title="Session 事件主骨架"
        subtitle="强信号前置，AI / note / 背景事件可折叠，并支持按 trade 聚焦和直达 Trade Thread。"
      >
        <div className="session-event-stream">
          <div className="session-event-stream__overview">
            <article className="session-event-stream__metric-card">
              <span>Visible</span>
              <strong>{viewModel.visibleEventCount}</strong>
            </article>
            <article className="session-event-stream__metric-card is-signal">
              <span>Strong Signals</span>
              <strong>{viewModel.strongSignalCount}</strong>
            </article>
            <article className="session-event-stream__metric-card">
              <span>Collapsed</span>
              <strong>{viewModel.hiddenByCollapseCount}</strong>
            </article>
            <article className="session-event-stream__metric-card is-focus">
              <span>Trade Focus</span>
              <strong>{viewModel.focusedTrade ? formatTradeBadgeLabel(viewModel.focusedTrade) : 'All Trades'}</strong>
            </article>
          </div>

          <div className="session-event-stream__toolbar">
            <div className="session-event-stream__filters">
              {filterOrder.map((filter) => (
                <button
                  className={`session-event-stream__filter ${activeFilter === filter ? 'is-active' : ''}`.trim()}
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  type="button"
                >
                  <span>{translateEventStreamFilter(filter)}</span>
                  <span className="session-event-stream__filter-count">{countForFilter(events, filter)}</span>
                </button>
              ))}
            </div>

            <div className="session-event-stream__focus-strip">
              <button
                className={`session-event-stream__focus-chip ${effectiveTradeFocusId == null ? 'is-active' : ''}`.trim()}
                onClick={() => setTradeFocusId(null)}
                type="button"
              >
                All Trades
              </button>
              {currentTrade ? (
                <button
                  className={`session-event-stream__focus-chip ${effectiveTradeFocusId === currentTrade.id ? 'is-active' : ''}`.trim()}
                  onClick={() => setTradeFocusId(currentTrade.id)}
                  type="button"
                >
                  Current · {formatTradeBadgeLabel(currentTrade)}
                </button>
              ) : null}
              {focusOptions.map((trade) => (
                <button
                  className={`session-event-stream__focus-chip ${effectiveTradeFocusId === trade.id ? 'is-active' : ''}`.trim()}
                  key={trade.id}
                  onClick={() => setTradeFocusId(trade.id)}
                  type="button"
                >
                  {formatTradeBadgeLabel(trade)}
                </button>
              ))}
            </div>

            <div className="session-event-stream__collapse-strip">
              <button
                className={`session-event-stream__collapse-chip ${collapseAi ? 'is-active' : ''}`.trim()}
                onClick={() => setCollapseAi((value) => !value)}
                type="button"
              >
                AI 折叠
              </button>
              <button
                className={`session-event-stream__collapse-chip ${collapseNotes ? 'is-active' : ''}`.trim()}
                onClick={() => setCollapseNotes((value) => !value)}
                type="button"
              >
                Note / Review 折叠
              </button>
              <button
                className={`session-event-stream__collapse-chip ${collapseBackground ? 'is-active' : ''}`.trim()}
                onClick={() => setCollapseBackground((value) => !value)}
                type="button"
              >
                Background 折叠
              </button>
            </div>
          </div>

          <div className="event-list session-workbench__event-list">
            {viewModel.blocks.length > 0 ? viewModel.blocks.map((block) => {
              if (block.kind === 'cluster') {
                return (
                  <button
                    className={[
                      'session-event-stream__cluster',
                      `is-${block.clusterKind}`,
                      block.signalTone ? `has-${block.signalTone}` : '',
                    ].filter(Boolean).join(' ')}
                    key={block.id}
                    onClick={() => toggleCollapse(block.clusterKind)}
                    type="button"
                  >
                    <div className="session-event-stream__cluster-meta">
                      <div>
                        <strong>{block.title}</strong>
                        <p>{block.subtitle}</p>
                      </div>
                      <span className="metric-pill">{block.items.length}</span>
                    </div>
                    <div className="session-event-stream__cluster-preview">
                      {block.previewTitles.map((title) => (
                        <span className="session-event-stream__cluster-pill" key={title}>{title}</span>
                      ))}
                    </div>
                    <span className="session-event-stream__cluster-action">点击展开这一类事件</span>
                  </button>
                )
              }

              return (
                <EventStreamCard
                  dimmed={block.item.dimmed}
                  event={block.item.event}
                  highlighted={block.item.highlighted}
                  key={block.item.event.id}
                  onClick={() => onSelectEvent(block.item.event)}
                  onFocusTrade={block.item.trade ? (() => {
                    const tradeId = block.item.trade.id
                    return () => setTradeFocusId(tradeId)
                  })() : undefined}
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
            }) : <div className="empty-state">当前过滤和 focus 条件下没有事件。</div>}
          </div>
        </div>
      </SectionCard>
    </section>
  )
}
