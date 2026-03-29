import type { LocalFirstPaths } from '@main/app-shell/paths'
import { getDatabase } from '@main/db/connection'
import { loadTradeDetail, upsertTradeReviewDraftBlock } from '@main/db/repositories/workbench-repository'
import { getPeriodEvaluationRollup } from '@main/evaluation/evaluation-service'
import { getPeriodFeedbackBundle } from '@main/feedback/feedback-service'
import {
  getLatestPeriodReviewAiRecord,
  getPeriodAiQualitySummary,
} from '@main/period/period-ai-quality-service'
import { buildPeriodRollupBundle } from '@main/period/period-rollup-service'
import { getTrainingInsights, getUserProfileSnapshot } from '@main/profile/profile-service'
import { getPeriodRuleRollup } from '@main/rules/rules-service'
import type {
  DisciplineScore,
  FeedbackItem,
  RuleHit,
  TradeEvaluationSummary,
} from '@shared/contracts/evaluation'
import type {
  TradeDetailInsightItem,
  TradeDetailPayload,
  TradeDetailReviewSections,
} from '@shared/contracts/workbench'

const tradeEventLabels = {
  trade_open: '开仓',
  trade_add: '加仓',
  trade_reduce: '减仓',
  trade_close: '平仓',
  trade_cancel: '取消',
} as const

const compactMarkdown = (value: string | null | undefined, fallback = '待补充') => {
  const compact = value?.replace(/\s+/g, ' ').trim()
  return compact && compact.length > 0 ? compact : fallback
}

const excerpt = (value: string | null | undefined) => {
  const compact = compactMarkdown(value, '')
  if (!compact) {
    return '待补充'
  }

  return compact.length > 120 ? `${compact.slice(0, 117)}...` : compact
}

export const buildTradeReviewDraftMarkdown = (detail: TradeDetailPayload) => {
  const originalBlocks = detail.original_plan_blocks.slice(0, 4)
  const latestAi = detail.ai_groups.latest_market_analysis?.analysis_card
    ?? detail.latest_analysis_card
    ?? detail.linked_ai_cards[detail.linked_ai_cards.length - 1]
    ?? null
  const executionLines = detail.execution_events.length > 0
    ? detail.execution_events.map((event) => `- ${tradeEventLabels[event.event_type as keyof typeof tradeEventLabels] ?? event.event_type}: ${event.summary}`)
    : ['- 暂无执行事件。']
  const resultLine = detail.trade.status === 'closed'
    ? `- 当前结果：已平仓，平仓价 ${detail.trade.exit_price ?? '待补充'}，PnL ${detail.trade.pnl_r ?? '待补充'}R。`
    : detail.trade.status === 'canceled'
      ? '- 当前结果：交易线程已取消，不计入正常离场结果。'
      : '- 当前结果：交易尚未闭环，结果待确认。'
  const exitLine = detail.exit_screenshots.length > 0
    ? `- Exit 图：已记录 ${detail.exit_screenshots.length} 张。`
    : '- Exit 图：尚未补齐。'
  const originalRecordLines = originalBlocks.length > 0
    ? originalBlocks.map((block) => `- ${block.title}: ${excerpt(block.content_md)}`)
    : ['- 暂无额外的 trade 原始记录。']

  return [
    '# Exit review draft',
    '',
    '> 这是一份自动生成的复盘草稿，不会覆盖你的原始记录。',
    '',
    '## 计划 vs 实际 vs 结果',
    '',
    '### 原始计划',
    '',
    '#### Trade thesis',
    detail.trade.thesis.trim() || '待补充',
    '',
    '#### Session trade plan',
    detail.session.trade_plan_md.trim() || '待补充',
    '',
    '#### 原始记录',
    ...originalRecordLines,
    '',
    '### AI 当时建议',
    latestAi
      ? `- ${compactMarkdown(latestAi.summary_short)}`
      : '- 当时没有关联 AI 建议。',
    '',
    '### 实际执行',
    ...executionLines,
    resultLine,
    exitLine,
    '',
    '## 偏差',
    '',
    '- 计划与执行之间的主要偏差：待补充',
    '- 哪个判断在盘中发生了变化：待补充',
    '- 哪个风险控制动作做得不够：待补充',
    '',
    '## 下次改进',
    '',
    '- 下次还会保留的动作：待补充',
    '- 下次必须提前规避的问题：待补充',
    '- 需要补充验证的 setup / 管理规则：待补充',
  ].join('\n')
}

const sectionBullets = (contentMd: string | null | undefined, heading: string) => {
  if (!contentMd) {
    return []
  }

  const lines = contentMd.split(/\r?\n/)
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`)
  if (start === -1) {
    return []
  }

  const collected: string[] = []
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index].trim()
    if (line.startsWith('## ')) {
      break
    }
    if (line.startsWith('- ')) {
      collected.push(line.slice(2).trim())
    }
  }

  return collected.filter(Boolean)
}

const hasMeaningfulReviewLine = (value: string) =>
  value.trim().length > 0
  && !value.includes('待补充')
  && !value.includes('暂无')

const buildInsightItem = (
  id: string,
  title: string,
  summary: string,
  options?: {
    evidence?: string[]
    tone?: TradeDetailInsightItem['tone']
  },
): TradeDetailInsightItem => ({
  id,
  title,
  summary,
  evidence: options?.evidence ?? [],
  tone: options?.tone ?? 'neutral',
})

const buildDeviationItems = (
  detail: TradeDetailPayload,
  summary: TradeEvaluationSummary | null,
  disciplineScore: DisciplineScore | null,
  feedbackItems: FeedbackItem[],
): TradeDetailInsightItem[] => {
  const draftItems = sectionBullets(detail.review_draft_block?.content_md, '偏差')
    .filter(hasMeaningfulReviewLine)
    .map((line, index) => buildInsightItem(
      `draft_deviation_${index + 1}`,
      `偏差 ${index + 1}`,
      line,
      { tone: 'warning' },
    ))
  if (draftItems.length > 0) {
    return draftItems
  }

  const derivedItems: TradeDetailInsightItem[] = []
  if (summary?.disagreement_summary) {
    derivedItems.push(buildInsightItem(
      'disagreement',
      '计划判断出现分歧',
      summary.disagreement_summary,
      {
        evidence: [
          summary.ai_judgment?.bias ? `AI=${summary.ai_judgment.bias}` : 'AI=未记录',
          summary.human_judgment?.bias ? `Human=${summary.human_judgment.bias}` : 'Human=未记录',
        ],
        tone: 'warning',
      },
    ))
  }

  const weakDimensions = disciplineScore?.dimensions.filter((dimension) => dimension.score_pct < 70) ?? []
  for (const dimension of weakDimensions.slice(0, 2)) {
    derivedItems.push(buildInsightItem(
      `discipline_${dimension.id}`,
      dimension.label,
      dimension.summary,
      {
        evidence: dimension.evidence.slice(0, 3),
        tone: dimension.score_pct < 60 ? 'critical' : 'warning',
      },
    ))
  }

  for (const item of feedbackItems.filter((feedback) => feedback.priority !== 'low').slice(0, 2)) {
    derivedItems.push(buildInsightItem(
      `feedback_${item.id}`,
      item.title,
      item.summary,
      {
        evidence: item.evidence.slice(0, 3),
        tone: item.priority === 'high' ? 'critical' : 'warning',
      },
    ))
  }

  return derivedItems.length > 0
    ? derivedItems.slice(0, 3)
    : [buildInsightItem(
      'deviation_pending',
      '待补偏差分析',
      '当前自动链路还没有足够的偏差证据，建议在 review draft 中补充计划和执行的差异。',
      { tone: 'neutral' },
    )]
}

const buildResultAssessmentItems = (
  detail: TradeDetailPayload,
  summary: TradeEvaluationSummary | null,
  disciplineScore: DisciplineScore | null,
  ruleHits: RuleHit[],
): TradeDetailInsightItem[] => {
  const resultItems: TradeDetailInsightItem[] = []

  if (summary) {
    resultItems.push(buildInsightItem(
      'outcome',
      'Outcome',
      summary.outcome.summary,
      {
        evidence: [
          summary.outcome.pnl_r !== null ? `pnl_r=${summary.outcome.pnl_r}` : 'pnl_r=pending',
          `status=${summary.outcome.status}`,
        ],
        tone: summary.outcome.status !== 'resolved'
          ? 'neutral'
          : (summary.outcome.pnl_r ?? 0) > 0
              ? 'positive'
              : (summary.outcome.pnl_r ?? 0) < 0
                  ? 'warning'
                  : 'neutral',
      },
    ))

    if (summary.human_judgment) {
      resultItems.push(buildInsightItem(
        'human_judgment',
        '我的判断结果',
        summary.human_judgment.reason_summary,
        {
          evidence: [
            summary.human_judgment.bias ? `bias=${summary.human_judgment.bias}` : 'bias=unknown',
            `verdict=${summary.human_judgment.verdict}`,
          ],
          tone: summary.human_judgment.verdict === 'incorrect' ? 'warning' : 'neutral',
        },
      ))
    }

    if (summary.ai_judgment) {
      resultItems.push(buildInsightItem(
        'ai_judgment',
        'AI 建议结果',
        summary.ai_judgment.reason_summary,
        {
          evidence: [
            summary.ai_judgment.bias ? `bias=${summary.ai_judgment.bias}` : 'bias=unknown',
            summary.ai_judgment.confidence_pct !== null ? `confidence=${summary.ai_judgment.confidence_pct}%` : 'confidence=unknown',
          ],
          tone: summary.ai_judgment.verdict === 'incorrect' ? 'warning' : 'neutral',
        },
      ))
    }
  }

  if (detail.evaluation?.note_md) {
    resultItems.push(buildInsightItem(
      'manual_evaluation',
      '人工结果评估',
      compactMarkdown(detail.evaluation.note_md),
      {
        evidence: [`score=${detail.evaluation.score}`],
        tone: 'neutral',
      },
    ))
  }

  if (disciplineScore) {
    resultItems.push(buildInsightItem(
      'discipline',
      '纪律结果',
      disciplineScore.summary,
      {
        evidence: [`overall=${disciplineScore.overall_pct}%`],
        tone: disciplineScore.overall_pct >= 80 ? 'positive' : disciplineScore.overall_pct < 65 ? 'warning' : 'neutral',
      },
    ))
  }

  const highlightedRule = ruleHits.find((hit) => hit.severity === 'critical')
    ?? ruleHits.find((hit) => hit.severity === 'warning')
    ?? null
  if (highlightedRule) {
    resultItems.push(buildInsightItem(
      `rule_${highlightedRule.id}`,
      '规则结果提示',
      highlightedRule.reason,
      {
        evidence: highlightedRule.evidence.slice(0, 3),
        tone: highlightedRule.severity === 'critical' ? 'critical' : 'warning',
      },
    ))
  }

  return resultItems.slice(0, 4)
}

const buildNextImprovementItems = (
  detail: TradeDetailPayload,
  feedbackItems: FeedbackItem[],
  ruleHits: RuleHit[],
): TradeDetailInsightItem[] => {
  const draftItems = sectionBullets(detail.review_draft_block?.content_md, '下次改进')
    .filter(hasMeaningfulReviewLine)
    .map((line, index) => buildInsightItem(
      `draft_next_${index + 1}`,
      `下次改进 ${index + 1}`,
      line,
      { tone: 'positive' },
    ))
  if (draftItems.length > 0) {
    return draftItems
  }

  const feedbackDerived = feedbackItems.map((item) => buildInsightItem(
    `improvement_${item.id}`,
    item.title,
    item.summary,
    {
      evidence: item.evidence.slice(0, 3),
      tone: item.priority === 'high' ? 'critical' : item.priority === 'medium' ? 'warning' : 'positive',
    },
  ))
  if (feedbackDerived.length > 0) {
    return feedbackDerived.slice(0, 3)
  }

  const followRule = ruleHits.find((hit) => !hit.matched) ?? ruleHits.find((hit) => hit.severity !== 'info') ?? null
  if (followRule) {
    return [buildInsightItem(
      `follow_rule_${followRule.id}`,
      '下次先守住规则边界',
      followRule.reason,
      {
        evidence: followRule.evidence.slice(0, 3),
        tone: followRule.severity === 'critical' ? 'critical' : 'warning',
      },
    )]
  }

  return [buildInsightItem(
    'next_pending',
    '待补行动项',
    '当前还没有明确的改进行动项，建议结合本笔 execution 和 review draft 补成下一次可执行规则。',
    { tone: 'neutral' },
  )]
}

export const buildTradeDetailReviewSections = (input: {
  detail: TradeDetailPayload
  evaluation_summary: TradeEvaluationSummary | null
  feedback_items: FeedbackItem[]
  discipline_score: DisciplineScore | null
  rule_hits: RuleHit[]
}): TradeDetailReviewSections => ({
  deviation_analysis: buildDeviationItems(
    input.detail,
    input.evaluation_summary,
    input.discipline_score,
    input.feedback_items,
  ),
  result_assessment: buildResultAssessmentItems(
    input.detail,
    input.evaluation_summary,
    input.discipline_score,
    input.rule_hits,
  ),
  next_improvements: buildNextImprovementItems(
    input.detail,
    input.feedback_items,
    input.rule_hits,
  ),
})

export const ensureTradeReviewDraft = async(paths: LocalFirstPaths, tradeId: string) => {
  const db = await getDatabase(paths)
  const detail = loadTradeDetail(db, tradeId)
  const latestTradeEvent = [...detail.execution_events].pop()
  const reviewOccurredAt = latestTradeEvent?.event_type === 'trade_close' || latestTradeEvent?.event_type === 'trade_cancel'
    ? new Date(new Date(latestTradeEvent.occurred_at).getTime() + 1).toISOString()
    : undefined
  return upsertTradeReviewDraftBlock(db, {
    trade_id: tradeId,
    content_md: buildTradeReviewDraftMarkdown(detail),
    occurred_at: reviewOccurredAt,
  })
}

export const getPeriodReviewInsights = async(paths: LocalFirstPaths, periodId?: string) => {
  const baseBundle = await buildPeriodRollupBundle(paths, {
    period_id: periodId,
    latest_period_review: null,
  })
  const resolvedPeriodId = baseBundle.rollup.period.id
  const [latestPeriodAiReview, evaluation_rollup, ai_quality_summary] = await Promise.all([
    getLatestPeriodReviewAiRecord(paths, resolvedPeriodId),
    getPeriodEvaluationRollup(paths, resolvedPeriodId),
    getPeriodAiQualitySummary(paths, resolvedPeriodId),
  ])
  const period_rollup = {
    ...baseBundle.rollup,
    latest_period_review_ai_run_id: latestPeriodAiReview?.ai_run.id ?? null,
    latest_period_review_generated_at: latestPeriodAiReview?.ai_run.created_at ?? null,
  }
  const trade_metrics = baseBundle.trade_metrics
  const [feedback, rule_rollup] = await Promise.all([
    getPeriodFeedbackBundle(paths, resolvedPeriodId, {
      evaluation_rollup,
      period_rollup,
      trade_metrics,
    }),
    getPeriodRuleRollup(paths, resolvedPeriodId),
  ])
  const [profile_snapshot, training_insights] = await Promise.all([
    getUserProfileSnapshot(paths, resolvedPeriodId, {
      evaluation_rollup,
      feedback_bundle: feedback,
      period_rollup,
      trade_metrics,
    }),
    getTrainingInsights(paths, resolvedPeriodId, {
      evaluation_rollup,
      feedback_bundle: feedback,
      period_rollup,
      trade_metrics,
    }),
  ])

  return {
    period_rollup,
    trade_metrics,
    latest_period_ai_review: latestPeriodAiReview,
    ai_quality_summary,
    evaluation_rollup,
    feedback_items: feedback.feedback_items,
    rule_rollup,
    setup_leaderboard: feedback.setup_leaderboard,
    profile_snapshot,
    training_insights,
  }
}
