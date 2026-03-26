import { alphaNexusApi } from '@app/bootstrap/api'
import type { ComposerSuggestion } from '@app/features/composer/types'
import type { AnnotationSuggestionView, AnchorReviewSuggestionView, SimilarCaseView } from '@app/features/suggestions'
import type { SessionWorkbenchPayload } from '@shared/contracts/workbench'
import {
  toAnnotationSuggestionView,
  toAnchorReviewSuggestionView,
  toComposerSuggestionView,
  toSimilarCaseView,
} from './session-workbench-mappers'

export type SessionWorkbenchSuggestionViews = {
  annotationSuggestions: AnnotationSuggestionView[]
  anchorReviewSuggestions: AnchorReviewSuggestionView[]
  similarCases: SimilarCaseView[]
  composerSuggestions: ComposerSuggestion[]
}

export const loadSessionWorkbenchSuggestions = async(
  sessionPayload: SessionWorkbenchPayload,
  options?: {
    draftText?: string
    screenshotId?: string | null
    anchorId?: string | null
  },
): Promise<SessionWorkbenchSuggestionViews> => {
  const timeframeLabel = sessionPayload.context_memory.active_anchors[0]?.timeframe_scope ?? 'session'
  const [annotationResult, anchorReviewResult, similarCaseResult, composerResult] = await Promise.all([
    options?.screenshotId
      ? alphaNexusApi.workbench.runAnnotationSuggestions({
        session_id: sessionPayload.session.id,
        screenshot_id: options.screenshotId,
        limit: 6,
      })
      : Promise.resolve({ suggestions: [] }),
    alphaNexusApi.workbench.getAnchorReviewSuggestions({
      session_id: sessionPayload.session.id,
      limit: 6,
    }),
    alphaNexusApi.workbench.getSimilarCases({
      session_id: sessionPayload.session.id,
      contract_id: sessionPayload.contract.id,
      timeframe_scope: timeframeLabel,
      semantic_tags: sessionPayload.session.tags,
      trade_context: options?.draftText || sessionPayload.panels.my_realtime_view,
      limit: 5,
    }),
    alphaNexusApi.workbench.getComposerSuggestions({
      session_id: sessionPayload.session.id,
      draft_text: options?.draftText,
      anchor_id: options?.anchorId ?? null,
      limit: 6,
    }),
  ])

  return {
    annotationSuggestions: annotationResult.suggestions.map(toAnnotationSuggestionView),
    anchorReviewSuggestions: anchorReviewResult.suggestions.map(toAnchorReviewSuggestionView),
    similarCases: similarCaseResult.cases.map((item) => toSimilarCaseView(item, sessionPayload.contract.symbol, timeframeLabel)),
    composerSuggestions: composerResult.suggestions.map(toComposerSuggestionView),
  }
}
