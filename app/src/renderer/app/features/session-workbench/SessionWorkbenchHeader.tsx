import type { CurrentTargetOption, SessionWorkbenchPayload } from '@shared/contracts/workbench'
import { CurrentContextBar } from '@app/features/context/CurrentContextBar'
import { TargetSelector } from '@app/features/context/TargetSelector'
import { formatDateTime } from '@app/ui/display-text'

type SessionWorkbenchHeaderProps = {
  busy: boolean
  payload: SessionWorkbenchPayload
  onExport: () => void
  onRunAnalysis: () => void
  onSelectTarget: (option: CurrentTargetOption) => void
}

export const SessionWorkbenchHeader = ({
  busy,
  payload,
  onExport,
  onRunAnalysis,
  onSelectTarget,
}: SessionWorkbenchHeaderProps) => (
  <header className="session-workbench__header">
    <div className="session-workbench__header-main">
      <p className="eyebrow">{payload.contract.symbol}</p>
      <h2>{payload.session.title}</h2>
      <p className="session-workbench__context">{payload.session.context_focus}</p>
      <p className="session-workbench__context-meta">
        Session {payload.session.id} · {formatDateTime(payload.session.created_at)}
      </p>
      <CurrentContextBar payload={payload} />
    </div>
    <div className="session-workbench__header-side">
      <TargetSelector
        busy={busy}
        onSelect={onSelectTarget}
        selectedOptionId={payload.target_option_groups.current[0]?.id ?? payload.target_options.find((option) => option.is_current)?.id ?? null}
        targetPayload={{
          current_context: payload.current_context,
          options: payload.target_options,
          groups: payload.target_option_groups,
        }}
      />
      <div className="session-workbench__actions">
        <button className="button is-secondary" disabled={busy} onClick={onRunAnalysis} type="button">运行 AI 分析</button>
        <button className="button is-secondary" disabled={busy} onClick={onExport} type="button">导出 Markdown</button>
      </div>
    </div>
  </header>
)
