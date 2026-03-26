import type { EventRecord } from '@shared/contracts/event'
import { formatDateTime, translateEventType } from '@app/ui/display-text'

type TradeExecutionTimelineProps = {
  events: EventRecord[]
}

export const TradeExecutionTimeline = ({ events }: TradeExecutionTimelineProps) => {
  if (events.length === 0) {
    return <div className="empty-state">当前还没有执行事件。</div>
  }

  return (
    <div className="trade-execution-timeline">
      {events.map((event, index) => (
        <article className="trade-execution-timeline__item" key={event.id}>
          <div className="trade-execution-timeline__rail">
            <span className="trade-execution-timeline__step">{index + 1}</span>
          </div>
          <div className="trade-execution-timeline__content">
            <div className="trade-execution-timeline__meta">
              <span className={`badge badge-${event.event_type}`}>{translateEventType(event.event_type)}</span>
              <span className="metric-pill">{formatDateTime(event.occurred_at)}</span>
              {event.screenshot_id ? <span className="status-pill">linked screenshot</span> : null}
              {event.content_block_ids.length > 0 ? <span className="status-pill">{event.content_block_ids.length} note</span> : null}
            </div>
            <h3>{event.title}</h3>
            <p>{event.summary}</p>
          </div>
        </article>
      ))}
    </div>
  )
}
