export type WorkbenchTab = 'view' | 'ai' | 'plan'

export type EventSelectionMode = 'single' | 'range' | 'pinned'

export type AiPacketImageRegionMode = 'full' | 'selection' | 'annotations-only' | 'full-with-highlight'

export type AiPacketBackgroundToggles = {
  includeCurrentNote: boolean
  includeEventRangeSummary: boolean
  includeTradeFacts: boolean
  includeSessionSummary: boolean
  includePriorAi: boolean
}

export type AiPacketPreview = {
  primaryScreenshotCount: number
  backgroundScreenshotCount: number
  eventCount: number
  includedItems: string[]
  omittedItems: string[]
  summary: string
}

export type AiPacketAttachmentView = {
  id: string
  screenshotId: string
  role: 'primary' | 'background'
  name: string
  previewDataUrl: string | null
  requestedMode: AiPacketImageRegionMode
  resolvedModeLabel: string
  detail: string
}

export type EventSelectionState = {
  mode: EventSelectionMode
  primaryEventId: string | null
  selectedEventIds: string[]
  rangeAnchorId: string | null
  pinnedEventIds: string[]
}

export type AnalysisTrayState = {
  eventIds: string[]
  screenshotIds: string[]
  primaryEventId: string | null
  primaryScreenshotId: string | null
  compareScreenshotId: string | null
  lastAddedAt: string | null
}

export type AiDockSize = 'peek' | 'medium' | 'large'

export type AiDockState = {
  expanded: boolean
  size: AiDockSize
}

export type ScreenshotStageViewMode = 'single' | 'compare' | 'board'

export type AiDockTab = 'summary' | 'full' | 'packet'

export type AiPacketComposerState = {
  open: boolean
  primaryScreenshotId: string | null
  backgroundScreenshotIds: string[]
  imageRegionMode: AiPacketImageRegionMode
  focusAnnotationIds: string[]
  backgroundToggles: AiPacketBackgroundToggles
  backgroundDraft: string
  backgroundDraftDirty: boolean
  preview: AiPacketPreview
}

export type AiPacketDispatchRecord = {
  sentAt: string
  primaryScreenshotId: string | null
  backgroundScreenshotIds: string[]
  sourceEventIds: string[]
  followUpQuestion: string | null
  imageRegionMode: AiPacketImageRegionMode
  backgroundDraft: string
  backgroundToggles: AiPacketBackgroundToggles
  preview: AiPacketPreview
  attachments: AiPacketAttachmentView[]
}
