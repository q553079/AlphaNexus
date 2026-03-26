import type { LocalFirstPaths } from '@main/app-shell/paths'
import { createSessionFromLauncher, fetchLauncherHome } from '@main/storage/session-launcher'
import { CreateSessionInputSchema, CreateSessionResultSchema, LauncherHomePayloadSchema } from '@shared/contracts/launcher'

export const getLauncherHome = async(paths: LocalFirstPaths) =>
  LauncherHomePayloadSchema.parse(await fetchLauncherHome(paths))

export const createLauncherSession = async(paths: LocalFirstPaths, rawInput: unknown) => {
  const input = CreateSessionInputSchema.parse(rawInput)
  const session = await createSessionFromLauncher(paths, input)
  return CreateSessionResultSchema.parse({ session })
}
