import type { LocalFirstPaths } from '@main/app-shell/paths'
import { getPeriodEvaluationRollup } from '@main/evaluation/evaluation-service'
import { getPeriodFeedbackBundle } from '@main/feedback/feedback-service'
import type { RankingExplanationPayload, TrainingInsight, UserProfile } from '@shared/contracts/evaluation'

export const getUserProfileSnapshot = async(paths: LocalFirstPaths, periodId?: string): Promise<UserProfile> => {
  const [rollup, feedback] = await Promise.all([
    getPeriodEvaluationRollup(paths, periodId),
    getPeriodFeedbackBundle(paths, periodId),
  ])

  const strongestSetup = feedback.setup_leaderboard[0]
  const weakestPattern = rollup.error_patterns[0]

  return {
    strengths: strongestSetup ? [{
      id: 'profile_strength_setup',
      label: `强项 setup: ${strongestSetup.label}`,
      count: strongestSetup.sample_count,
      summary: `样本 ${strongestSetup.sample_count}，avg R ${strongestSetup.avg_r ?? 'pending'}。`,
    }] : [],
    weaknesses: weakestPattern ? [weakestPattern] : [],
    execution_style: [{
      id: 'profile_execution_style',
      label: '执行风格',
      count: rollup.evaluated_count,
      summary: rollup.ai_vs_human[0]?.human_value_pct !== null
        ? `当前更偏结构化执行，人工方向命中率 ${rollup.ai_vs_human[0]?.human_value_pct}%。`
        : '样本仍少，执行风格先按中性处理。',
    }],
    ai_collaboration: [{
      id: 'profile_ai_collab',
      label: 'AI 协同倾向',
      count: rollup.ai_vs_human[0]?.sample_count ?? 0,
      summary: rollup.ai_vs_human[0]?.ai_value_pct !== null
        ? `AI 方向命中率 ${rollup.ai_vs_human[0]?.ai_value_pct}%，当前建议继续保留 AI 作为辅助层。`
        : 'AI 协同样本不足。',
    }],
  }
}

export const getTrainingInsights = async(paths: LocalFirstPaths, periodId?: string): Promise<TrainingInsight[]> => {
  const [rollup, feedback] = await Promise.all([
    getPeriodEvaluationRollup(paths, periodId),
    getPeriodFeedbackBundle(paths, periodId),
  ])

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
