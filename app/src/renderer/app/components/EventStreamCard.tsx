import type { EventRecord } from '@shared/contracts/event'
import { formatTime, translateEventType } from '@app/ui/display-text'

type EventStreamCardProps = {
  event: EventRecord
  selected?: boolean
  onClick?: () => void
}

export const EventStreamCard = ({ event, selected, onClick }: EventStreamCardProps) => (
  <button
    className={`event-card ${selected ? 'is-selected' : ''}`.trim()}
    onClick={onClick}
    type="button"
  >
    <div className="event-card__meta">
      <span className={`badge badge-${event.event_type}`}>{translateEventType(event.event_type)}</span>
      <span>{formatTime(event.occurred_at)}</span>
    </div>
    <strong>{event.title}</strong>
    <p>{event.summary}</p>
  </button>
)
