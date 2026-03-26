import { ComposerSuggestionShell } from './ComposerSuggestionShell'
import type { ComposerSuggestion } from './types'
import { readComposerShellFromSessionPayload } from './workbench-adapter'

type SessionWorkbenchComposerShellProps = {
  sessionPayload: unknown
  suggestions?: ComposerSuggestion[]
  realtimeDraft: string
  onRealtimeDraftChange: (value: string) => void
}

export const SessionWorkbenchComposerShell = ({
  sessionPayload,
  suggestions,
  realtimeDraft,
  onRealtimeDraftChange,
}: SessionWorkbenchComposerShellProps) => {
  const shellData = readComposerShellFromSessionPayload(sessionPayload)

  return (
    <ComposerSuggestionShell
      activeAnchorLabels={shellData.active_anchor_labels}
      approvedKnowledgeHits={shellData.approved_knowledge_hits}
      contextSummary={shellData.context_summary}
      suggestions={suggestions && suggestions.length > 0 ? suggestions : shellData.suggestions}
      textareaValue={realtimeDraft}
      onTextareaChange={onRealtimeDraftChange}
    />
  )
}
