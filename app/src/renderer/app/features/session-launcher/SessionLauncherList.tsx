import { Link } from 'react-router-dom'
import { translateSessionStatus } from '@app/ui/display-text'
import type { LauncherSessionSummary } from '@shared/contracts/launcher'

type SessionLauncherListProps = {
  emptyMessage: string
  sessions: LauncherSessionSummary[]
}

const sessionDateFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export const SessionLauncherList = ({ emptyMessage, sessions }: SessionLauncherListProps) => (
  sessions.length > 0 ? (
    <div className="compact-list">
      {sessions.map((session) => (
        <Link className="compact-list__item" key={session.id} to={`/sessions/${session.id}`}>
          <div className="action-row">
            <strong>{session.title}</strong>
            <span className={`badge badge-${session.status}`.trim()}>{translateSessionStatus(session.status)}</span>
          </div>
          <p>
            {session.contract_symbol} · {sessionDateFormatter.format(new Date(session.started_at))}
          </p>
          <p>
            {session.event_count} 个事件 · {session.trade_count} 笔交易
          </p>
        </Link>
      ))}
    </div>
  ) : (
    <div className="empty-state">{emptyMessage}</div>
  )
)
