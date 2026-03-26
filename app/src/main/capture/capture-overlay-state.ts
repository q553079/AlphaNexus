import type { PendingSnipCapture } from '@shared/capture/contracts'

type ActiveCaptureContext = {
  session_id: string | null
  kind: PendingSnipCapture['kind']
}

let activeCaptureContext: ActiveCaptureContext = {
  session_id: null,
  kind: 'chart',
}

let pendingSnipCapture: PendingSnipCapture | null = null

export const getActiveCaptureContext = () => activeCaptureContext

export const setActiveCaptureContext = (context: Partial<ActiveCaptureContext>) => {
  activeCaptureContext = {
    session_id: Object.prototype.hasOwnProperty.call(context, 'session_id')
      ? context.session_id ?? null
      : activeCaptureContext.session_id,
    kind: context.kind ?? activeCaptureContext.kind,
  }
}

export const clearActiveCaptureSession = () => {
  activeCaptureContext = {
    ...activeCaptureContext,
    session_id: null,
  }
}

export const getPendingSnipCapture = () => pendingSnipCapture

export const setPendingSnipCapture = (capture: PendingSnipCapture) => {
  pendingSnipCapture = capture
}

export const clearPendingSnipCapture = () => {
  pendingSnipCapture = null
}
