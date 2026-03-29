import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { LocalFirstPaths } from '@main/app-shell/paths'
import {
  CaptureAiContextPreferencesSchema,
  type CaptureAiContextPreferences,
} from '@shared/capture/contracts'

export const DEFAULT_CAPTURE_AI_CONTEXT_PREFERENCES: CaptureAiContextPreferences =
  CaptureAiContextPreferencesSchema.parse({
    schema_version: 1,
    analysis_session_id: null,
    analysis_contract_id: null,
    analysis_contract_symbol: '',
    analysis_role: 'event',
    background_layer: 'macro',
  })

const getCaptureAiContextPreferencesPath = (paths: LocalFirstPaths) =>
  path.join(paths.dataDir, 'capture-ai-context-preferences.json')

export const readCaptureAiContextPreferences = async(
  paths: LocalFirstPaths,
): Promise<CaptureAiContextPreferences> => {
  try {
    const content = await readFile(getCaptureAiContextPreferencesPath(paths), 'utf8')
    return CaptureAiContextPreferencesSchema.parse(JSON.parse(content))
  } catch {
    return DEFAULT_CAPTURE_AI_CONTEXT_PREFERENCES
  }
}

export const writeCaptureAiContextPreferences = async(
  paths: LocalFirstPaths,
  input: Partial<CaptureAiContextPreferences>,
): Promise<CaptureAiContextPreferences> => {
  const nextPreferences = CaptureAiContextPreferencesSchema.parse({
    ...DEFAULT_CAPTURE_AI_CONTEXT_PREFERENCES,
    ...input,
  })
  const filePath = getCaptureAiContextPreferencesPath(paths)
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, JSON.stringify(nextPreferences, null, 2), 'utf8')
  return nextPreferences
}
