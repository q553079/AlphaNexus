import type { LocalFirstPaths } from '@main/app-shell/paths'
import { getPeriodEvaluationRollup } from '@main/evaluation/evaluation-service'
import { getPeriodFeedbackBundle } from '@main/feedback/feedback-service'
import { getTrainingInsights, getUserProfileSnapshot } from '@main/profile/profile-service'
import { getPeriodRuleRollup } from '@main/rules/rules-service'

export const getPeriodReviewInsights = async(paths: LocalFirstPaths, periodId?: string) => {
  const [evaluation_rollup, feedback, rule_rollup, profile_snapshot, training_insights] = await Promise.all([
    getPeriodEvaluationRollup(paths, periodId),
    getPeriodFeedbackBundle(paths, periodId),
    getPeriodRuleRollup(paths, periodId),
    getUserProfileSnapshot(paths, periodId),
    getTrainingInsights(paths, periodId),
  ])

  return {
    evaluation_rollup,
    feedback_items: feedback.feedback_items,
    rule_rollup,
    setup_leaderboard: feedback.setup_leaderboard,
    profile_snapshot,
    training_insights,
  }
}
