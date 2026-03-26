import { anthropicAdapter } from '@main/ai/adapters/anthropic'
import { customHttpAdapter } from '@main/ai/adapters/custom-http'
import { deepseekAdapter } from '@main/ai/adapters/deepseek'
import { openAiAdapter } from '@main/ai/adapters/openai'

export const aiAdapters = [deepseekAdapter, openAiAdapter, anthropicAdapter, customHttpAdapter]
