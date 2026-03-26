import type { LocalFirstPaths } from '@main/app-shell/paths'
import { getDatabase } from '@main/db/connection'
import { applyMigrations } from '@main/db/migrations'
import { seedMockData } from '@main/db/repositories/workbench-repository'

export const initializeStorage = async(paths: LocalFirstPaths) => {
  const db = await getDatabase(paths)
  applyMigrations(db)

  const row = db.prepare('SELECT COUNT(*) AS count FROM sessions').get() as { count: number }
  if (row.count === 0) {
    seedMockData(db)
  }

  return { ok: true as const }
}

export { getDatabase }
