import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { safeStorage } from 'electron'
import { z } from 'zod'
import type { LocalFirstPaths } from '@main/app-shell/paths'
import { AiProviderKindSchema } from '@shared/contracts/analysis'

const PersistedProviderConfigSchema = z.object({
  provider: AiProviderKindSchema,
  enabled: z.boolean(),
  model: z.string().min(1),
  base_url: z.string().url().nullable(),
})

const PersistedProviderSecretSchema = z.object({
  provider: AiProviderKindSchema,
  storage: z.enum(['safe-storage', 'local-file']),
  value_b64: z.string().min(1),
  updated_at: z.string().min(1),
})

export type PersistedProviderConfig = z.infer<typeof PersistedProviderConfigSchema>
type PersistedProviderSecret = z.infer<typeof PersistedProviderSecretSchema>
export type ProviderSecretResolution = {
  api_key: string | null
  configured_via: 'none' | 'env' | 'local'
  secret_storage: 'none' | 'env' | 'safe-storage' | 'local-file'
}

const getConfigFilePath = (paths: LocalFirstPaths) => path.join(paths.dataDir, 'ai-provider-configs.json')
const getSecretFilePath = (paths: LocalFirstPaths) => path.join(paths.dataDir, 'ai-provider-secrets.json')

const decodeSecret = (record: PersistedProviderSecret) => {
  const encodedBuffer = Buffer.from(record.value_b64, 'base64')
  if (record.storage === 'safe-storage') {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('系统当前不可用 safeStorage，无法读取已加密的本地 AI key。')
    }
    return safeStorage.decryptString(encodedBuffer)
  }
  return encodedBuffer.toString('utf8')
}

const encodeSecret = (value: string): PersistedProviderSecret['storage'] extends infer _ ? {
  storage: PersistedProviderSecret['storage']
  value_b64: string
} : never => {
  if (safeStorage.isEncryptionAvailable()) {
    return {
      storage: 'safe-storage',
      value_b64: safeStorage.encryptString(value).toString('base64'),
    }
  }

  return {
    storage: 'local-file',
    value_b64: Buffer.from(value, 'utf8').toString('base64'),
  }
}

const readJsonArray = async(pathname: string) => {
  try {
    const content = await readFile(pathname, 'utf8')
    const parsed = JSON.parse(content) as unknown
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export const readPersistedProviderConfigs = async(paths: LocalFirstPaths): Promise<PersistedProviderConfig[]> => {
  const rows = await readJsonArray(getConfigFilePath(paths))
  return rows.map((row) => PersistedProviderConfigSchema.parse(row))
}

export const writePersistedProviderConfigs = async(
  paths: LocalFirstPaths,
  configs: PersistedProviderConfig[],
) => {
  const filePath = getConfigFilePath(paths)
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, JSON.stringify(configs, null, 2), 'utf8')
}

const readPersistedProviderSecrets = async(paths: LocalFirstPaths): Promise<PersistedProviderSecret[]> => {
  const rows = await readJsonArray(getSecretFilePath(paths))
  return rows.map((row) => PersistedProviderSecretSchema.parse(row))
}

const writePersistedProviderSecrets = async(
  paths: LocalFirstPaths,
  secrets: PersistedProviderSecret[],
) => {
  const filePath = getSecretFilePath(paths)
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, JSON.stringify(secrets, null, 2), 'utf8')
}

export const resolveLocalProviderSecret = async(
  paths: LocalFirstPaths,
  provider: PersistedProviderSecret['provider'],
): Promise<ProviderSecretResolution> => {
  const secrets = await readPersistedProviderSecrets(paths)
  const record = secrets.find((item) => item.provider === provider)
  if (!record) {
    return {
      api_key: null,
      configured_via: 'none',
      secret_storage: 'none',
    }
  }

  return {
    api_key: decodeSecret(record),
    configured_via: 'local',
    secret_storage: record.storage,
  }
}

export const persistLocalProviderSecret = async(
  paths: LocalFirstPaths,
  provider: PersistedProviderSecret['provider'],
  apiKey: string,
): Promise<ProviderSecretResolution> => {
  const secrets = await readPersistedProviderSecrets(paths)
  const encoded = encodeSecret(apiKey)
  const nextSecrets = [
    ...secrets.filter((item) => item.provider !== provider),
    PersistedProviderSecretSchema.parse({
      provider,
      storage: encoded.storage,
      value_b64: encoded.value_b64,
      updated_at: new Date().toISOString(),
    }),
  ]
  await writePersistedProviderSecrets(paths, nextSecrets)

  return {
    api_key: apiKey,
    configured_via: 'local',
    secret_storage: encoded.storage,
  }
}
