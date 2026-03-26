import type { PendingSnipCapture } from '@shared/capture/contracts'
import type { SourceView } from '@shared/contracts/current-context'

type ActiveCaptureContext = {
  contract_id: string | null
  period_id: string | null
  session_id: string | null
  trade_id: string | null
  source_view: SourceView
  kind: PendingSnipCapture['kind']
}

let activeCaptureContext: ActiveCaptureContext = {
  contract_id: null,
  period_id: null,
  session_id: null,
  trade_id: null,
  source_view: 'session-workbench',
  kind: 'chart',
}

let pendingSnipCapture: PendingSnipCapture | null = null

export const getActiveCaptureContext = () => activeCaptureContext

export const setActiveCaptureContext = (context: Partial<ActiveCaptureContext>) => {
  activeCaptureContext = {
    contract_id: Object.prototype.hasOwnProperty.call(context, 'contract_id')
      ? context.contract_id ?? null
      : activeCaptureContext.contract_id,
    period_id: Object.prototype.hasOwnProperty.call(context, 'period_id')
      ? context.period_id ?? null
      : activeCaptureContext.period_id,
    session_id: Object.prototype.hasOwnProperty.call(context, 'session_id')
      ? context.session_id ?? null
      : activeCaptureContext.session_id,
    trade_id: Object.prototype.hasOwnProperty.call(context, 'trade_id')
      ? context.trade_id ?? null
      : activeCaptureContext.trade_id,
    source_view: context.source_view ?? activeCaptureContext.source_view,
    kind: context.kind ?? activeCaptureContext.kind,
  }
}

export const clearActiveCaptureSession = () => {
  activeCaptureContext = {
    ...activeCaptureContext,
    contract_id: null,
    period_id: null,
    session_id: null,
    trade_id: null,
  }
}

export const getPendingSnipCapture = () => pendingSnipCapture

export const setPendingSnipCapture = (capture: PendingSnipCapture) => {
  pendingSnipCapture = capture
}

export const clearPendingSnipCapture = () => {
  pendingSnipCapture = null
}
