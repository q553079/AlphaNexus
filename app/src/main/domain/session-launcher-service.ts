import type { LocalFirstPaths } from '@main/app-shell/paths'
import {
  continueSessionFromLauncher,
  createSessionFromLauncher,
  fetchLauncherHome,
} from '@main/storage/session-launcher'
import {
  ContinueSessionInputSchema,
  ContinueSessionResultSchema,
  CreateSessionInputSchema,
  CreateSessionResultSchema,
  LauncherHomePayloadSchema,
} from '@shared/contracts/launcher'

export const getLauncherHome = async(paths: LocalFirstPaths) =>
  LauncherHomePayloadSchema.parse(await fetchLauncherHome(paths))

export const createLauncherSession = async(paths: LocalFirstPaths, rawInput: unknown) => {
  const input = CreateSessionInputSchema.parse(rawInput)
  const session = await createSessionFromLauncher(paths, input)
  return CreateSessionResultSchema.parse({ session })
}

export const continueLauncherSession = async(paths: LocalFirstPaths, rawInput: unknown) => {
  const input = ContinueSessionInputSchema.parse(rawInput)
  const session = await continueSessionFromLauncher(paths, input.session_id)
  return ContinueSessionResultSchema.parse({ session })
}
