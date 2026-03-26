import type { LocalFirstPaths } from '@main/app-shell/paths'
import { getTrainingInsights } from '@main/profile/profile-service'

export const getTrainingInsightFeed = async(paths: LocalFirstPaths, periodId?: string) =>
  getTrainingInsights(paths, periodId)
