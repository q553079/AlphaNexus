import type { LocalFirstPaths } from '@main/app-shell/paths'
import { getDatabase } from '@main/db/connection'
import { applyMigrations } from '@main/db/migrations'
import { seedReferenceContracts } from '@main/db/repositories/session-launcher-seed'

export const initializeStorage = async(paths: LocalFirstPaths) => {
  const db = await getDatabase(paths)
  applyMigrations(db)
  seedReferenceContracts(db)

  return { ok: true as const }
}

export { getDatabase }
