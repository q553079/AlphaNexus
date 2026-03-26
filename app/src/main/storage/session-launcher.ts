import type { LocalFirstPaths } from '@main/app-shell/paths'
import { getDatabase } from '@main/db/connection'
import { createSessionRecord } from '@main/db/repositories/session-launcher-mutations'
import { loadLauncherHome } from '@main/db/repositories/session-launcher-queries'
import type { CreateSessionInput } from '@shared/contracts/launcher'

export const fetchLauncherHome = async(paths: LocalFirstPaths) => {
  const db = await getDatabase(paths)
  return loadLauncherHome(db)
}

export const createSessionFromLauncher = async(paths: LocalFirstPaths, input: CreateSessionInput) => {
  const db = await getDatabase(paths)
  return createSessionRecord(db, input)
}
