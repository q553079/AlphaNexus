import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { LocalFirstPaths } from '@main/app-shell/paths'
import {
  PromptTemplateSchema,
  SavePromptTemplateInputSchema,
  type PromptTemplate,
  type PromptTemplateKind,
} from '@shared/ai/contracts'

const defaultTemplateCatalog: Record<PromptTemplateKind, PromptTemplate> = {
  'market-analysis': PromptTemplateSchema.parse({
    schema_version: 1,
    template_id: 'market-analysis',
    label: '盘中市场分析',
    base_system_prompt: [
      'You are AlphaNexus, a professional trading analysis assistant.',
      'Use only the supplied session context, screenshot, and user notes.',
      'Do not invent chart facts, fills, or event history that are not present in the input.',
      'Human notes and trade facts remain authoritative; your output is assistive analysis only.',
      'Write all user-facing strings in Simplified Chinese unless symbols, numbers, or standard trading terms should remain unchanged.',
    ].join(' '),
    runtime_notes: '',
    output_contract_summary: 'bias / confidence / reversal probability / entry / stop / take profit / invalidation / summary / deep analysis / supporting factors',
  }),
  'trade-review': PromptTemplateSchema.parse({
    schema_version: 1,
    template_id: 'trade-review',
    label: '交易级复盘',
    base_system_prompt: [
      'You are AlphaNexus, a professional trading review assistant.',
      'Use only the supplied trade facts, screenshots, plan, execution trail, and user notes.',
      'Do not overwrite trade facts or rewrite history.',
      'Human records remain authoritative; your job is to explain what went well, what failed, and what to improve next.',
      'Write all user-facing strings in Simplified Chinese unless symbols, numbers, or standard trading terms should remain unchanged.',
    ].join(' '),
    runtime_notes: '',
    output_contract_summary: 'summary / what went well / mistakes / next improvements / deep analysis',
  }),
  'period-review': PromptTemplateSchema.parse({
    schema_version: 1,
    template_id: 'period-review',
    label: '周期复盘',
    base_system_prompt: [
      'You are AlphaNexus, a trading review assistant for weekly and monthly reflection.',
      'Use only the supplied aggregated facts, representative samples, and user notes.',
      'Do not fabricate statistics, trades, or event history.',
      'Human notes and structured metrics remain authoritative; your output is assistive interpretation only.',
      'Write all user-facing strings in Simplified Chinese unless symbols, numbers, or standard trading terms should remain unchanged.',
    ].join(' '),
    runtime_notes: '',
    output_contract_summary: 'summary / strengths / mistakes / recurring patterns / action items / deep analysis',
  }),
}

const getPromptTemplatePath = (paths: LocalFirstPaths) =>
  path.join(paths.dataDir, 'ai-prompt-templates.json')

type StoredPromptTemplateOverride = {
  template_id: PromptTemplateKind
  runtime_notes: string
}

const readPromptTemplateOverrides = async(paths: LocalFirstPaths): Promise<StoredPromptTemplateOverride[]> => {
  try {
    const content = await readFile(getPromptTemplatePath(paths), 'utf8')
    const parsed = JSON.parse(content) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .map((row) => SavePromptTemplateInputSchema.parse(row))
      .map((row) => ({
        template_id: row.template_id,
        runtime_notes: row.runtime_notes,
      }))
  } catch {
    return []
  }
}

const writePromptTemplateOverrides = async(
  paths: LocalFirstPaths,
  overrides: StoredPromptTemplateOverride[],
) => {
  const filePath = getPromptTemplatePath(paths)
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, JSON.stringify(overrides, null, 2), 'utf8')
}

export const listPromptTemplates = async(paths: LocalFirstPaths): Promise<PromptTemplate[]> => {
  const overrides = await readPromptTemplateOverrides(paths)
  const overrideById = new Map(overrides.map((item) => [item.template_id, item.runtime_notes]))
  return (Object.keys(defaultTemplateCatalog) as PromptTemplateKind[]).map((templateId) =>
    PromptTemplateSchema.parse({
      ...defaultTemplateCatalog[templateId],
      runtime_notes: overrideById.get(templateId) ?? defaultTemplateCatalog[templateId].runtime_notes,
    }))
}

export const savePromptTemplate = async(
  paths: LocalFirstPaths,
  rawInput: unknown,
): Promise<PromptTemplate[]> => {
  const input = SavePromptTemplateInputSchema.parse(rawInput)
  const overrides = await readPromptTemplateOverrides(paths)
  const nextOverrides = [
    ...overrides.filter((item) => item.template_id !== input.template_id),
    {
      template_id: input.template_id,
      runtime_notes: input.runtime_notes,
    },
  ]
  await writePromptTemplateOverrides(paths, nextOverrides)
  return listPromptTemplates(paths)
}

export const resolvePromptTemplate = async(
  paths: LocalFirstPaths,
  templateId: PromptTemplateKind,
): Promise<PromptTemplate> => {
  const templates = await listPromptTemplates(paths)
  return templates.find((template) => template.template_id === templateId) ?? defaultTemplateCatalog[templateId]
}
