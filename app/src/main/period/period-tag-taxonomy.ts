import type { PeriodTagCategory, PeriodTagSource, PeriodTradeTag } from '@shared/contracts/period-review'
import type { SessionRecord } from '@shared/contracts/session'
import type { TradeRecord } from '@shared/contracts/trade'

type PeriodTagInput = {
  session: SessionRecord
  trade: TradeRecord
  evaluation_note_md: string | null
  evaluation_score: number | null
  ai_supporting_factors: string[]
}

type KeywordDefinition = {
  label: string
  terms: string[]
}

const mistakeKeywords: KeywordDefinition[] = [
  { label: '无确认入场', terms: ['确认不足', '无确认', '没有确认', '先手', 'confirm'] },
  { label: '追单', terms: ['追单', '追高', '追空', 'chase', 'fomo'] },
  { label: '提前离场', terms: ['提前离场', '过早离场', 'early exit'] },
  { label: '止损执行问题', terms: ['止损', 'risk', 'stop'] },
]

const emotionKeywords: KeywordDefinition[] = [
  { label: '冲动', terms: ['冲动', '急', 'revenge', 'fomo'] },
  { label: '犹豫', terms: ['犹豫', '迟疑', 'hesitation'] },
  { label: '焦虑', terms: ['焦虑', 'anxious', 'fear', '害怕'] },
]

const contextKeywords: KeywordDefinition[] = [
  { label: '趋势延续', terms: ['trend', '趋势', 'continuation', '延续'] },
  { label: '震荡环境', terms: ['range', '震荡', 'balance'] },
  { label: 'VWAP 相关', terms: ['vwap'] },
  { label: '开盘驱动', terms: ['opening drive', '开盘驱动'] },
]

const normalize = (value: string) => value.replace(/\s+/g, ' ').trim()

const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '')

const includesAny = (value: string, terms: string[]) => {
  const normalized = value.toLowerCase()
  return terms.some((term) => normalized.includes(term.toLowerCase()))
}

const buildTag = (
  category: PeriodTagCategory,
  source: PeriodTagSource,
  label: string,
  evidence: string,
): PeriodTradeTag => ({
  id: `${category}:${source}:${slugify(label)}`,
  label,
  category,
  source,
  evidence,
})

const appendUniqueTag = (target: PeriodTradeTag[], nextTag: PeriodTradeTag) => {
  if (target.some((item) => item.id === nextTag.id)) {
    return
  }
  target.push(nextTag)
}

const appendKeywordMatches = (
  target: PeriodTradeTag[],
  text: string,
  category: PeriodTagCategory,
  source: PeriodTagSource,
  definitions: KeywordDefinition[],
  evidencePrefix: string,
) => {
  for (const definition of definitions) {
    if (!includesAny(text, definition.terms)) {
      continue
    }
    appendUniqueTag(target, buildTag(category, source, definition.label, `${evidencePrefix}: ${definition.label}`))
  }
}

const appendSessionTags = (target: PeriodTradeTag[], session: SessionRecord) => {
  session.tags.forEach((tag, index) => {
    const trimmed = normalize(tag)
    if (!trimmed) {
      return
    }

    const explicit = trimmed.match(/^(setup|context|mistake|emotion)\s*:\s*(.+)$/i)
    if (explicit) {
      appendUniqueTag(target, buildTag(
        explicit[1].toLowerCase() as PeriodTagCategory,
        'user',
        normalize(explicit[2]),
        `session tag: ${trimmed}`,
      ))
      return
    }

    appendUniqueTag(target, buildTag(
      index === 0 ? 'setup' : 'context',
      'user',
      trimmed,
      `session tag: ${trimmed}`,
    ))
  })
}

export const buildPeriodTradeTags = (input: PeriodTagInput): PeriodTradeTag[] => {
  const tags: PeriodTradeTag[] = []
  appendSessionTags(tags, input.session)

  const evidenceText = [
    input.trade.thesis,
    input.evaluation_note_md ?? '',
    ...input.ai_supporting_factors,
  ].map(normalize).filter(Boolean).join('\n')

  appendKeywordMatches(tags, evidenceText, 'context', 'system', contextKeywords, 'heuristic context')
  appendKeywordMatches(tags, evidenceText, 'mistake', 'system', mistakeKeywords, 'heuristic mistake')
  appendKeywordMatches(tags, evidenceText, 'emotion', 'system', emotionKeywords, 'heuristic emotion')

  if ((input.evaluation_score ?? 100) < 70) {
    appendUniqueTag(tags, buildTag(
      'mistake',
      'system',
      '计划偏离',
      `evaluation score ${input.evaluation_score}`,
    ))
  }

  input.ai_supporting_factors.slice(0, 2).forEach((factor) => {
    const trimmed = normalize(factor)
    if (!trimmed) {
      return
    }
    appendUniqueTag(tags, buildTag('context', 'ai', trimmed, `ai supporting factor: ${trimmed}`))
  })

  return tags
}
