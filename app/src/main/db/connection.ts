import Database from 'better-sqlite3'
import { ensureLocalFirstPaths, type LocalFirstPaths } from '@main/app-shell/paths'

let database: Database.Database | null = null
let databaseFile: string | null = null

export const getDatabase = async(paths: LocalFirstPaths) => {
  await ensureLocalFirstPaths(paths)

  if (!database || databaseFile !== paths.databaseFile) {
    database = new Database(paths.databaseFile)
    databaseFile = paths.databaseFile
    database.pragma('journal_mode = WAL')
    database.pragma('foreign_keys = ON')
  }

  return database
}
