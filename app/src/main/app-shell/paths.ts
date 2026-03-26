import type { App as ElectronApp } from 'electron'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import type { AppEnvironment } from '@main/app-shell/env'

export type LocalFirstPaths = {
  rootDir: string
  dataDir: string
  vaultDir: string
  screenshotsDir: string
  exportsDir: string
  databaseFile: string
}

const ensureDir = async(directory: string) => {
  await mkdir(directory, { recursive: true })
}

export const resolveLocalFirstPaths = (electronApp: ElectronApp, env: AppEnvironment): LocalFirstPaths => {
  const appRoot = process.env.APP_ROOT ?? process.cwd()
  const devRoot = path.resolve(appRoot, '..')
  const packagedRoot = path.join(electronApp.getPath('userData'), 'local-first')
  const rootDir = electronApp.isPackaged ? packagedRoot : devRoot
  const dataDir = env.dataDir ?? path.join(rootDir, 'data')
  const vaultDir = env.vaultDir ?? path.join(rootDir, 'vault')

  return {
    rootDir,
    dataDir,
    vaultDir,
    screenshotsDir: path.join(vaultDir, 'screenshots'),
    exportsDir: path.join(vaultDir, 'exports'),
    databaseFile: path.join(dataDir, 'alpha-nexus.sqlite'),
  }
}

export const ensureLocalFirstPaths = async(paths: LocalFirstPaths) => {
  await Promise.all([
    ensureDir(paths.dataDir),
    ensureDir(paths.vaultDir),
    ensureDir(paths.screenshotsDir),
    ensureDir(paths.exportsDir),
  ])
}
