import type { CurrentTargetOption, SessionWorkbenchPayload } from '@shared/contracts/workbench'
import { TargetSelector } from '@app/features/context/TargetSelector'
import {
  translateSessionDisplayTitle,
} from '@app/ui/display-text'

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
      <p className="session-workbench__header-kicker">{payload.contract.symbol} · 工作过程</p>
      <h2>{translateSessionDisplayTitle(payload.session.title)}</h2>
    </div>
    <div className="session-workbench__header-side">
      <TargetSelector
        busy={busy}
        label="当前挂载"
        onSelect={onSelectTarget}
        selectedOptionId={payload.target_option_groups.current[0]?.id ?? payload.target_options.find((option) => option.is_current)?.id ?? null}
        targetPayload={{
          current_context: payload.current_context,
          options: payload.target_options,
          groups: payload.target_option_groups,
        }}
        variant="compact"
      />
      <div className="session-workbench__actions">
        <button className="button is-secondary" disabled={busy} onClick={onRunAnalysis} type="button">运行 AI 分析</button>
        <button className="button is-secondary" disabled={busy} onClick={onExport} type="button">导出 Markdown</button>
      </div>
    </div>
  </header>
)
