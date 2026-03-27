import { ComposerSuggestionShell } from './ComposerSuggestionShell'
import type { ComposerSuggestion } from './types'
import { readComposerShellFromSessionPayload } from './workbench-adapter'

type SessionWorkbenchComposerShellProps = {
  sessionPayload: unknown
  suggestions: ComposerSuggestion[]
  realtimeDraft: string
  onSuggestionAccept: (suggestion: ComposerSuggestion) => void
  onRealtimeDraftChange: (value: string) => void
}

export const SessionWorkbenchComposerShell = ({
  sessionPayload,
  suggestions,
  realtimeDraft,
  onSuggestionAccept,
  onRealtimeDraftChange,
}: SessionWorkbenchComposerShellProps) => {
  const shellData = readComposerShellFromSessionPayload(sessionPayload)

  return (
    <ComposerSuggestionShell
      activeAnchorLabels={shellData.active_anchor_labels}
      approvedKnowledgeHits={shellData.approved_knowledge_hits}
      contextSummary={shellData.context_summary}
      onSuggestionAccept={onSuggestionAccept}
      suggestions={suggestions}
      textareaValue={realtimeDraft}
      onTextareaChange={onRealtimeDraftChange}
    />
  )
}
