import { z } from 'zod'

const EnvironmentSchema = z.object({
  dataDir: z.string().trim().optional(),
  vaultDir: z.string().trim().optional(),
  deepseekApiKey: z.string().trim().optional(),
  openAiApiKey: z.string().trim().optional(),
  anthropicApiKey: z.string().trim().optional(),
  customAiApiKey: z.string().trim().optional(),
  customAiApiBaseUrl: z.string().trim().optional(),
})

export type AppEnvironment = z.infer<typeof EnvironmentSchema>

export const resolveEnvironment = (): AppEnvironment => EnvironmentSchema.parse({
  dataDir: process.env.ALPHA_NEXUS_DATA_DIR,
  vaultDir: process.env.ALPHA_NEXUS_VAULT_DIR,
  deepseekApiKey: process.env.DEEPSEEK_API_KEY,
  openAiApiKey: process.env.OPENAI_API_KEY,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  customAiApiKey: process.env.CUSTOM_AI_API_KEY,
  customAiApiBaseUrl: process.env.CUSTOM_AI_API_BASE_URL,
})
