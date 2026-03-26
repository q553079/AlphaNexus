import type { SessionWorkbenchPayload } from '@shared/contracts/workbench'
import { formatDateTime } from '@app/ui/display-text'

type SessionWorkbenchHeaderProps = {
  payload: SessionWorkbenchPayload
  onExport: () => void
  onRunAnalysis: () => void
}

export const SessionWorkbenchHeader = ({
  payload,
  onExport,
  onRunAnalysis,
}: SessionWorkbenchHeaderProps) => (
  <header className="session-workbench__header">
    <div>
      <p className="eyebrow">{payload.contract.symbol}</p>
      <h2>{payload.session.title}</h2>
      <p className="session-workbench__context">{payload.session.context_focus}</p>
      <p className="session-workbench__context-meta">
        Session {payload.session.id} · {formatDateTime(payload.session.created_at)}
      </p>
    </div>
    <div className="session-workbench__actions">
      <button className="button is-secondary" onClick={onRunAnalysis} type="button">运行 AI 分析</button>
      <button className="button is-secondary" onClick={onExport} type="button">导出 Markdown</button>
    </div>
  </header>
)
