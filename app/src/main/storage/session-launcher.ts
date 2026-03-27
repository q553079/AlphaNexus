import type { LocalFirstPaths } from '@main/app-shell/paths'
import { getDatabase } from '@main/db/connection'
import { activateSessionRecord, createSessionRecord } from '@main/db/repositories/session-launcher-mutations'
import { loadLauncherHome } from '@main/db/repositories/session-launcher-queries'
import { getCurrentContext, upsertCurrentContext } from '@main/db/repositories/workbench-repository'
import type { CreateSessionInput } from '@shared/contracts/launcher'

export const fetchLauncherHome = async(paths: LocalFirstPaths) => {
  const db = await getDatabase(paths)
  return loadLauncherHome(db)
}

export const createSessionFromLauncher = async(paths: LocalFirstPaths, input: CreateSessionInput) => {
  const db = await getDatabase(paths)
  const session = createSessionRecord(db, input)
  upsertCurrentContext(db, {
    session_id: session.id,
    trade_id: null,
    source_view: 'session-workbench',
    capture_kind: 'chart',
  })
  return session
}

export const continueSessionFromLauncher = async(paths: LocalFirstPaths, sessionId: string) => {
  const db = await getDatabase(paths)
  const session = activateSessionRecord(db, sessionId)
  const currentContext = getCurrentContext(db, {
    session_id: session.id,
    source_view: 'session-workbench',
  })
  upsertCurrentContext(db, {
    session_id: session.id,
    trade_id: currentContext.trade_id,
    source_view: currentContext.source_view,
    capture_kind: currentContext.capture_kind,
  })
  return session
}
