import { EventStreamCard } from '@app/components/EventStreamCard'
import { SectionCard } from '@app/components/SectionCard'
import type { EventRecord } from '@shared/contracts/event'

type SessionEventColumnProps = {
  events: EventRecord[]
  selectedEventId: string | null
  onSelectEvent: (event: EventRecord) => void
}

export const SessionEventColumn = ({
  events,
  selectedEventId,
  onSelectEvent,
}: SessionEventColumnProps) => (
  <section className="session-workbench__column session-workbench__column--events">
    <SectionCard title="Session 事件流" subtitle="可持续追加的时间线">
      <div className="event-list session-workbench__event-list">
        {events.map((event) => (
          <EventStreamCard
            event={event}
            key={event.id}
            onClick={() => onSelectEvent(event)}
            selected={selectedEventId === event.id}
          />
        ))}
      </div>
    </SectionCard>
  </section>
)
