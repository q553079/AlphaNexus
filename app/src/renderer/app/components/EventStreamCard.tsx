import type { MouseEvent } from 'react'
import type { ScreenshotRecord } from '@shared/contracts/content'
import type { EventRecord } from '@shared/contracts/event'
import type { TradeRecord } from '@shared/contracts/trade'
import {
  formatTime,
  formatTradeBadgeLabel,
  translateCaptureKind,
  translateEventType,
  translateTradeStatus,
} from '@app/ui/display-text'

type EventStreamCardProps = {
  directoryLabel?: string
  dimmed?: boolean
  event: EventRecord
  highlighted?: boolean
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void
  onFocusTrade?: () => void
  onOpenTrade?: () => void
  screenshotKind?: ScreenshotRecord['kind'] | null
  selected?: boolean
  signalTone?: 'trade' | 'exit' | 'review' | null
  trade: TradeRecord | null
}

const signalLabels = {
  trade: '关键交易',
  exit: '离场图',
  review: '复盘',
} as const

export const EventStreamCard = ({
  directoryLabel,
  dimmed,
  event,
  highlighted,
  onClick,
  onFocusTrade,
  onOpenTrade,
  screenshotKind,
  selected,
  signalTone,
  trade,
}: EventStreamCardProps) => {
  const relationPills = [
    trade ? { key: 'trade', label: formatTradeBadgeLabel(trade), tone: 'trade' } : null,
    event.screenshot_id ? { key: 'screenshot', label: `${translateCaptureKind(screenshotKind ?? 'chart')}截图`, tone: screenshotKind === 'exit' ? 'exit' : 'screenshot' } : null,
    event.ai_run_id ? { key: 'ai', label: '关联 AI', tone: 'ai' } : null,
    event.content_block_ids.length > 0 ? { key: 'notes', label: `笔记 ${event.content_block_ids.length}`, tone: 'notes' } : null,
    event.event_type === 'review' ? { key: 'review', label: '关联复盘', tone: 'review' } : null,
  ].filter(Boolean) as Array<{ key: string, label: string, tone: string }>

  return (
    <article
      className={[
        'event-card',
        selected ? 'is-selected' : '',
        highlighted ? 'is-highlighted' : '',
        dimmed ? 'is-dimmed' : '',
        signalTone ? `is-signal is-signal-${signalTone}` : '',
        trade ? 'has-trade' : '',
      ].filter(Boolean).join(' ')}
    >
      <button
        className="event-card__primary"
        onClick={onClick}
        type="button"
      >
        <div className="event-card__meta">
          <div className="event-card__meta-left">
            <span className={`badge badge-${event.event_type}`}>{translateEventType(event.event_type)}</span>
            {signalTone ? <span className={`event-card__signal-pill is-${signalTone}`}>{signalLabels[signalTone]}</span> : null}
          </div>
          <span>{formatTime(event.occurred_at)}</span>
        </div>
        <strong>{directoryLabel ?? event.title}</strong>
        {directoryLabel ? <p className="event-card__directory-meta">{translateEventType(event.event_type)}</p> : null}
        <p>{event.summary || '这条事件还没有补充摘要。'}</p>
        {relationPills.length > 0 ? (
          <div className="event-card__relations">
            {relationPills.map((pill) => (
              <span className={`event-card__relation is-${pill.tone}`.trim()} key={pill.key}>{pill.label}</span>
            ))}
          </div>
        ) : null}
      </button>

      {trade ? (
        <div className="event-card__footer">
          <div className="event-card__trade-meta">
            <span className={`badge badge-${trade.status}`}>{formatTradeBadgeLabel(trade)}</span>
            <span className="metric-pill">{translateTradeStatus(trade.status)}</span>
          </div>
          <div className="event-card__actions">
            {onFocusTrade ? (
              <button
                className="button is-secondary event-card__trade-link"
                onClick={onFocusTrade}
                type="button"
              >
                聚焦这笔
              </button>
            ) : null}
            {onOpenTrade ? (
              <button
                className="button is-secondary event-card__trade-link"
                onClick={onOpenTrade}
                type="button"
              >
                打开交易详情
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  )
}
