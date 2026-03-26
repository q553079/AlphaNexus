import type { LocalFirstPaths } from '@main/app-shell/paths'
import { getPeriodEvaluationRollup } from '@main/evaluation/evaluation-service'
import { getPeriodFeedbackBundle } from '@main/feedback/feedback-service'
import type { RankingExplanationPayload, TrainingInsight, UserProfile } from '@shared/contracts/evaluation'

const formatPct = (value: number | null | undefined) => value === null || value === undefined ? '待补充' : `${value}%`

const formatR = (value: number | null | undefined) => value === null || value === undefined ? '待补充' : `${value}R`

export const getUserProfileSnapshot = async(paths: LocalFirstPaths, periodId?: string): Promise<UserProfile> => {
  const [rollup, feedback] = await Promise.all([
    getPeriodEvaluationRollup(paths, periodId),
    getPeriodFeedbackBundle(paths, periodId),
  ])

  const strongestSetup = feedback.setup_leaderboard[0]
  const weakestPatterns = rollup.error_patterns.slice(0, 2)
  const effectiveKnowledge = rollup.effective_knowledge[0]
  const directionMetric = rollup.ai_vs_human[0]

  return {
    strengths: [
      ...(strongestSetup ? [{
        id: 'profile_strength_setup',
        label: `强项 setup: ${strongestSetup.label}`,
        count: strongestSetup.sample_count,
        summary: `样本 ${strongestSetup.sample_count}，胜率 ${formatPct(strongestSetup.win_rate_pct)}，avg R ${formatR(strongestSetup.avg_r)}。`,
      }] : []),
      ...(effectiveKnowledge ? [{
        id: 'profile_strength_knowledge',
        label: `高复用知识卡: ${effectiveKnowledge.title}`,
        count: effectiveKnowledge.hit_count,
        summary: `本周期命中 ${effectiveKnowledge.hit_count} 次，质量分 ${effectiveKnowledge.quality_score_pct}%。`,
      }] : []),
    ].slice(0, 2),
    weaknesses: weakestPatterns.length > 0
      ? weakestPatterns
      : rollup.pending_count > 0
        ? [{
          id: 'profile_weakness_pending',
          label: '待闭环样本偏多',
          count: rollup.pending_count,
          summary: `当前仍有 ${rollup.pending_count} 笔样本未闭环或未验证，容易让周期画像失真。`,
        }]
        : [],
    execution_style: [
      {
        id: 'profile_execution_style',
        label: '执行风格',
        count: rollup.evaluated_count,
        summary: directionMetric?.human_value_pct !== null
          ? `当前更偏结构化执行，人工方向命中率 ${formatPct(directionMetric?.human_value_pct)}。`
          : '样本仍少，执行风格先按中性处理。',
      },
      ...(strongestSetup ? [{
        id: 'profile_execution_setup_repeat',
        label: '重复利用有效 setup',
        count: strongestSetup.sample_count,
        summary: `当前最常重复的 setup 是 ${strongestSetup.label}，说明执行更依赖可识别模板而不是临场拍脑袋。`,
      }] : []),
    ].slice(0, 2),
    ai_collaboration: [
      {
        id: 'profile_ai_collab',
        label: 'AI 协同倾向',
        count: directionMetric?.sample_count ?? 0,
        summary: directionMetric?.ai_value_pct !== null
          ? `AI 方向命中率 ${formatPct(directionMetric.ai_value_pct)}，人工 ${formatPct(directionMetric.human_value_pct)}。`
          : 'AI 协同样本不足。',
      },
      ...(effectiveKnowledge ? [{
        id: 'profile_ai_collab_grounding',
        label: '知识 grounding 使用',
        count: effectiveKnowledge.hit_count,
        summary: `高命中的知识卡是 ${effectiveKnowledge.title}，说明 AI 协同时开始出现可追溯 grounding 证据。`,
      }] : []),
    ].slice(0, 2),
  }
}

export const getTrainingInsights = async(paths: LocalFirstPaths, periodId?: string): Promise<TrainingInsight[]> => {
  const [rollup, feedback] = await Promise.all([
    getPeriodEvaluationRollup(paths, periodId),
    getPeriodFeedbackBundle(paths, periodId),
  ])

  const strongestSetup = feedback.setup_leaderboard[0] ?? null
  const strongestKnowledge = rollup.effective_knowledge[0] ?? null

  const insights: TrainingInsight[] = feedback.feedback_items.slice(0, 3).map((item, index) => ({
    id: `training_insight_${index + 1}`,
    title: item.title,
    summary: item.summary,
    priority: item.priority,
    evidence: item.evidence,
  }))

  if (rollup.calibration_buckets.some((bucket) => bucket.calibration_gap_pct !== null && Math.abs(bucket.calibration_gap_pct) > 15)) {
    insights.unshift({
      id: 'training_calibration',
      title: '校准 AI 置信度',
      summary: '部分 confidence bucket 与真实命中率偏差较大，下一轮优先校准高置信度输出。',
      priority: 'high',
      evidence: rollup.calibration_buckets
        .filter((bucket) => bucket.calibration_gap_pct !== null)
        .map((bucket) => `${bucket.label}: gap=${bucket.calibration_gap_pct}`),
    })
  }

  if (rollup.pending_count > 0) {
    insights.unshift({
      id: 'training_pending_review',
      title: '先补齐待闭环样本',
      summary: `当前还有 ${rollup.pending_count} 笔 trade 尚未闭环或未验证，先把结果链补齐，再做周期结论会更稳。`,
      priority: rollup.pending_count >= 3 ? 'high' : 'medium',
      evidence: [`pending_count=${rollup.pending_count}`],
    })
  }

  if (strongestSetup && (strongestSetup.avg_r ?? 0) > 0) {
    insights.push({
      id: 'training_repeat_strongest_setup',
      title: `重复演练 ${strongestSetup.label}`,
      summary: `当前最值得复用的 setup 是 ${strongestSetup.label}，建议继续把触发、失效和管理动作收紧成固定 checklist。`,
      priority: 'low',
      evidence: [
        `sample_count=${strongestSetup.sample_count}`,
        `avg_r=${formatR(strongestSetup.avg_r)}`,
      ],
    })
  }

  if (strongestKnowledge) {
    insights.push({
      id: 'training_review_effective_knowledge',
      title: `复盘知识卡 ${strongestKnowledge.title}`,
      summary: `这张知识卡在本周期命中次数最高，适合拿来对照哪些 trade 真正做到了 grounding。`,
      priority: 'low',
      evidence: [
        `hit_count=${strongestKnowledge.hit_count}`,
        `quality_score=${strongestKnowledge.quality_score_pct}%`,
      ],
    })
  }

  return insights.slice(0, 5)
}

export const getRankingExplanations = async(paths: LocalFirstPaths, _sessionId?: string): Promise<RankingExplanationPayload> => {
  const training = await getTrainingInsights(paths)
  return {
    explanations: [
      {
        id: 'ranking_composer',
        target_id: 'composer-default',
        target_kind: 'composer',
        reason_summary: 'Composer suggestions 优先按当前上下文相关度与结构化模板价值排序。',
        factors: ['当前 session tags', 'approved knowledge 命中', '风险控制优先'],
      },
      {
        id: 'ranking_feedback',
        target_id: training[0]?.id ?? 'feedback-default',
        target_kind: 'feedback',
        reason_summary: '反馈建议优先展示高优先级、证据最集中的条目。',
        factors: training[0]?.evidence.slice(0, 3) ?? ['evaluation summary'],
      },
    ],
  }
}
