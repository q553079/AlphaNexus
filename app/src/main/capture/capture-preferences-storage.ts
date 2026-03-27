import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { LocalFirstPaths } from '@main/app-shell/paths'
import {
  CapturePreferencesSchema,
  SaveCapturePreferencesInputSchema,
  type CapturePreferences,
} from '@shared/capture/contracts'

export const DEFAULT_CAPTURE_PREFERENCES: CapturePreferences = CapturePreferencesSchema.parse({
  schema_version: 1,
  snip_accelerator: 'CommandOrControl+Shift+4',
  display_strategy: 'cursor-display',
})

const getCapturePreferencesPath = (paths: LocalFirstPaths) =>
  path.join(paths.dataDir, 'capture-preferences.json')

export const readCapturePreferences = async(paths: LocalFirstPaths): Promise<CapturePreferences> => {
  try {
    const content = await readFile(getCapturePreferencesPath(paths), 'utf8')
    return CapturePreferencesSchema.parse(JSON.parse(content))
  } catch {
    return DEFAULT_CAPTURE_PREFERENCES
  }
}

export const writeCapturePreferences = async(
  paths: LocalFirstPaths,
  rawInput: unknown,
): Promise<CapturePreferences> => {
  const input = SaveCapturePreferencesInputSchema.parse(rawInput)
  const nextPreferences = CapturePreferencesSchema.parse({
    ...DEFAULT_CAPTURE_PREFERENCES,
    ...input,
  })
  const filePath = getCapturePreferencesPath(paths)
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, JSON.stringify(nextPreferences, null, 2), 'utf8')
  return nextPreferences
}
