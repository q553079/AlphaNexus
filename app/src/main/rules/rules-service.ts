import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { LocalFirstPaths } from '@main/app-shell/paths'
import { getDatabase } from '@main/db/connection'
import { getTradeDetail } from '@main/domain/workbench-service'
import type { RuleHit, RuleRollupEntry } from '@shared/contracts/evaluation'

type RuleConfig = {
  disabled_rule_ids?: string[]
}

type TradeRuleContext = Awaited<ReturnType<typeof getTradeDetail>>

type RuleDefinition = {
  id: string
  label: string
  severity: RuleHit['severity']
  evaluate: (context: TradeRuleContext) => Pick<RuleHit, 'matched' | 'reason' | 'evidence'>
}

const CONFIRMATION_TERMS = ['确认', '回踩', 'accept', 'reclaim', 'confirm', '守住', '二次']

const getRuleConfigPath = (paths: LocalFirstPaths) => path.join(paths.dataDir, 'rules-engine.json')

const compact = (value: string) => value.replace(/\s+/g, ' ').trim()

const includesAny = (value: string, terms: string[]) => {
  const normalized = value.toLowerCase()
  return terms.some((term) => normalized.includes(term.toLowerCase()))
}

const average = (values: number[]) =>
  values.length > 0 ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null

const loadDisabledRuleIds = async(paths: LocalFirstPaths) => {
  try {
    const raw = await readFile(getRuleConfigPath(paths), 'utf8')
    const parsed = JSON.parse(raw) as RuleConfig
    return new Set((parsed.disabled_rule_ids ?? []).filter((item): item is string => typeof item === 'string'))
  } catch {
    return new Set<string>()
  }
}

const builtInRules: RuleDefinition[] = [
  {
    id: 'respect-stop',
    label: '按计划止损',
    severity: 'warning',
    evaluate: (context) => ({
      matched: context.trade.stop_loss > 0,
      reason: context.trade.stop_loss > 0
        ? 'Trade record 中存在明确 stop_loss。'
        : 'Trade record 缺少明确 stop_loss。',
      evidence: [`stop_loss=${context.trade.stop_loss}`],
    }),
  },
  {
    id: 'define-risk-targets',
    label: '先写清风险与目标',
    severity: 'warning',
    evaluate: (context) => ({
      matched: context.trade.stop_loss > 0 && context.trade.take_profit > 0,
      reason: context.trade.stop_loss > 0 && context.trade.take_profit > 0
        ? 'Stop 与 target 都已结构化记录。'
        : 'Stop 或 target 仍不够完整。',
      evidence: [`stop_loss=${context.trade.stop_loss}`, `take_profit=${context.trade.take_profit}`],
    }),
  },
  {
    id: 'wait-confirmation',
    label: '等待确认后入场',
    severity: 'critical',
    evaluate: (context) => {
      const sources = [
        context.trade.thesis ?? '',
        context.session.my_realtime_view ?? '',
        context.evaluation?.note_md ?? '',
      ]
      const matched = includesAny(sources.join(' '), CONFIRMATION_TERMS)
      return {
        matched,
        reason: matched
          ? '本笔记录中出现了确认/回踩类证据。'
          : '当前记录没有看到明确确认语义，属于高风险缺口。',
        evidence: sources.map(compact).filter(Boolean).slice(0, 2),
      }
    },
  },
  {
    id: 'avoid-overtrade',
    label: '避免过度交易',
    severity: 'info',
    evaluate: (context) => {
      const relatedEvents = context.related_events.length
      return {
        matched: relatedEvents <= 6,
        reason: relatedEvents <= 6
          ? '当前 trade 关联事件数量仍在可控范围。'
          : '当前 trade 关联事件过多，可能存在过度调整或追单。',
        evidence: [`related_events=${relatedEvents}`],
      }
    },
  },
  {
    id: 'document-thesis',
    label: '保留明确 thesis',
    severity: 'info',
    evaluate: (context) => {
      const thesisLength = compact(context.trade.thesis ?? '').length
      return {
        matched: thesisLength >= 12,
        reason: thesisLength >= 12
          ? 'Trade thesis 已形成可复盘的最小表达。'
          : 'Trade thesis 太短，复盘证据不足。',
        evidence: [`thesis_length=${thesisLength}`],
      }
    },
  },
]

const buildRuleHit = (rule: RuleDefinition, context: TradeRuleContext): RuleHit => {
  const result = rule.evaluate(context)
  return {
    id: `rule_hit_${context.trade.id}_${rule.id}`,
    rule_id: rule.id,
    label: rule.label,
    severity: rule.severity,
    matched: result.matched,
    reason: result.reason,
    evidence: result.evidence,
  }
}

const listActiveRules = async(paths: LocalFirstPaths) => {
  const disabledRuleIds = await loadDisabledRuleIds(paths)
  return builtInRules.filter((rule) => !disabledRuleIds.has(rule.id))
}

export const getTradeRuleHits = async(paths: LocalFirstPaths, tradeId: string): Promise<RuleHit[]> => {
  const [detail, activeRules] = await Promise.all([
    getTradeDetail(paths, { trade_id: tradeId }),
    listActiveRules(paths),
  ])

  return activeRules.map((rule) => buildRuleHit(rule, detail))
}

export const getPeriodRuleRollup = async(paths: LocalFirstPaths, periodId?: string): Promise<RuleRollupEntry[]> => {
  const db = await getDatabase(paths)
  const tradeRows = db.prepare(`
    SELECT t.id
    FROM trades t
    INNER JOIN sessions s ON s.id = t.session_id
    WHERE t.deleted_at IS NULL
      AND s.deleted_at IS NULL
      AND (? IS NULL OR s.period_id = ?)
    ORDER BY t.opened_at ASC
  `).all(periodId ?? null, periodId ?? null) as Array<{ id: string }>

  const activeRules = await listActiveRules(paths)
  if (tradeRows.length === 0 || activeRules.length === 0) {
    return []
  }

  const allTradeHits = await Promise.all(tradeRows.map((row) => getTradeRuleHits(paths, row.id)))
  return activeRules.map((rule) => {
    const hits = allTradeHits.map((items) => items.find((item) => item.rule_id === rule.id)).filter((item): item is RuleHit => item !== undefined)
    const matchCount = hits.filter((item) => item.matched).length
    const totalCount = hits.length
    const matchRate = totalCount > 0 ? Math.round((matchCount / totalCount) * 100) : null
    const summary = matchRate === null
      ? '当前没有足够样本。'
      : matchRate >= 70
        ? '当前周期对这条规则执行相对稳定。'
        : matchRate >= 50
          ? '这条规则执行有波动，建议继续观察。'
          : '这条规则执行偏弱，建议优先复核。'

    return {
      id: `rule_rollup_${rule.id}`,
      rule_id: rule.id,
      label: rule.label,
      severity: rule.severity,
      match_count: matchCount,
      total_count: totalCount,
      match_rate_pct: matchRate,
      summary,
      evidence: [
        `matched=${matchCount}/${totalCount}`,
        ...hits.flatMap((hit) => hit.evidence).slice(0, 3),
      ],
    }
  })
    .sort((left, right) => {
      const leftRate = left.match_rate_pct ?? -1
      const rightRate = right.match_rate_pct ?? -1
      if (leftRate === rightRate) {
        return right.total_count - left.total_count
      }
      return leftRate - rightRate
    })
}

export const getRuleDisciplineAverage = async(paths: LocalFirstPaths, periodId?: string) => {
  const rollup = await getPeriodRuleRollup(paths, periodId)
  const values = rollup.map((item) => item.match_rate_pct).filter((item): item is number => item !== null)
  return average(values)
}
