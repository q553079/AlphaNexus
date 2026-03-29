import type { EventRecord } from '@shared/contracts/event'
import type { ReviewCaseRecord, SaveReviewCaseInput, SessionWorkbenchPayload } from '@shared/contracts/workbench'
import type { AnalysisTrayState, EventSelectionState } from '../session-workbench-types'
import { createEmptyAnalysisTrayState, normalizeAnalysisTrayState } from './session-analysis-tray'
import { clearEventSelectionState, normalizeEventSelectionState } from './session-workbench-selection'

const uniqueOrdered = (values: Array<string | null | undefined>) => {
  const seen = new Set<string>()
  const ordered: string[] = []
  for (const value of values) {
    const normalized = value?.trim()
    if (!normalized || seen.has(normalized)) {
      continue
    }
    seen.add(normalized)
    ordered.push(normalized)
  }
  return ordered
}

const compactText = (value: string | null | undefined, maxLength = 160) => {
  const compact = value?.replace(/\s+/g, ' ').trim() ?? ''
  if (!compact) {
    return ''
  }
  return compact.length > maxLength ? `${compact.slice(0, maxLength - 3).trim()}...` : compact
}

const fallbackEventSelectionState = (reviewCase: ReviewCaseRecord): EventSelectionState => ({
  mode: reviewCase.selection_mode,
  primaryEventId: reviewCase.event_ids.at(-1) ?? reviewCase.event_ids[0] ?? null,
  selectedEventIds: reviewCase.event_ids,
  rangeAnchorId: reviewCase.event_ids[0] ?? null,
  pinnedEventIds: reviewCase.selection_mode === 'pinned' ? reviewCase.event_ids : [],
})

const fallbackAnalysisTrayState = (reviewCase: ReviewCaseRecord): AnalysisTrayState => ({
  ...createEmptyAnalysisTrayState(),
  eventIds: reviewCase.event_ids,
  screenshotIds: reviewCase.screenshot_ids,
  primaryEventId: reviewCase.event_ids.at(-1) ?? reviewCase.event_ids[0] ?? null,
  primaryScreenshotId: reviewCase.screenshot_ids[0] ?? null,
  compareScreenshotId: reviewCase.screenshot_ids[1] ?? null,
})

export const buildReviewCaseTitleSuggestion = (input: {
  payload: SessionWorkbenchPayload
  selectedEvents: EventRecord[]
  selectionMode: ReviewCaseRecord['selection_mode']
}) => {
  const firstEvent = input.selectedEvents[0] ?? null
  const lastEvent = input.selectedEvents.at(-1) ?? null
  const anchorTitle = firstEvent?.title ?? input.payload.session.title
  if (!firstEvent || !lastEvent || firstEvent.id === lastEvent.id) {
    return `${input.selectionMode === 'pinned' ? 'Pinned' : 'Range'} · ${anchorTitle}`
  }

  return `${input.selectionMode === 'pinned' ? 'Pinned' : 'Range'} · ${anchorTitle} -> ${lastEvent.title}`
}

export const buildReviewCaseSummary = (selectedEvents: EventRecord[]) => {
  if (selectedEvents.length === 0) {
    return ''
  }

  return selectedEvents
    .slice(0, 8)
    .map((event, index) => `1. ${event.title}`.replace('1.', `${index + 1}.`))
    .map((line, index) => {
      const event = selectedEvents[index]
      const summary = compactText(event?.summary || event?.title, 220)
      return `${line}\n${event?.occurred_at ?? ''}${summary ? `\n${summary}` : ''}`.trim()
    })
    .join('\n\n')
}

export const buildSaveReviewCaseInput = (input: {
  analysisTray: AnalysisTrayState
  payload: SessionWorkbenchPayload
  selectedEvents: EventRecord[]
  selectionState: EventSelectionState
  selectedScreenshotId: string | null
  title: string
}): SaveReviewCaseInput => {
  const eventIds = input.selectedEvents.map((event) => event.id)
  const screenshotIds = uniqueOrdered([
    input.analysisTray.primaryScreenshotId,
    input.selectedScreenshotId,
    ...input.analysisTray.screenshotIds,
    ...input.selectedEvents.map((event) => event.screenshot_id),
  ])
  const primaryScreenshotId = input.analysisTray.primaryScreenshotId
    ?? input.selectedScreenshotId
    ?? screenshotIds[0]
    ?? null

  return {
    source_session_id: input.payload.session.id,
    title: input.title.trim(),
    summary_md: buildReviewCaseSummary(input.selectedEvents),
    ai_summary_md: '',
    selection_mode: input.selectionState.mode,
    event_ids: eventIds,
    screenshot_ids: screenshotIds,
    time_range_start: input.selectedEvents[0]?.occurred_at ?? null,
    time_range_end: input.selectedEvents.at(-1)?.occurred_at ?? null,
    snapshot: {
      event_selection: {
        mode: input.selectionState.mode,
        primary_event_id: input.selectionState.primaryEventId,
        selected_event_ids: input.selectionState.selectedEventIds,
        range_anchor_id: input.selectionState.rangeAnchorId,
        pinned_event_ids: input.selectionState.pinnedEventIds,
      },
      analysis_tray: {
        event_ids: uniqueOrdered([
          input.analysisTray.primaryEventId,
          ...input.analysisTray.eventIds,
          ...eventIds,
        ]),
        screenshot_ids: screenshotIds,
        primary_event_id: input.analysisTray.primaryEventId ?? input.selectionState.primaryEventId,
        primary_screenshot_id: primaryScreenshotId,
        compare_screenshot_id: input.analysisTray.compareScreenshotId,
      },
    },
  }
}

export const restoreWorkbenchStateFromReviewCase = (input: {
  payload: SessionWorkbenchPayload
  reviewCase: ReviewCaseRecord
}) => {
  const { payload, reviewCase } = input
  const rawSelection = reviewCase.snapshot
    ? {
      mode: reviewCase.snapshot.event_selection.mode,
      primaryEventId: reviewCase.snapshot.event_selection.primary_event_id,
      selectedEventIds: reviewCase.snapshot.event_selection.selected_event_ids,
      rangeAnchorId: reviewCase.snapshot.event_selection.range_anchor_id,
      pinnedEventIds: reviewCase.snapshot.event_selection.pinned_event_ids,
    }
    : fallbackEventSelectionState(reviewCase)
  const rawTray = reviewCase.snapshot
    ? {
      eventIds: reviewCase.snapshot.analysis_tray.event_ids,
      screenshotIds: reviewCase.snapshot.analysis_tray.screenshot_ids,
      primaryEventId: reviewCase.snapshot.analysis_tray.primary_event_id,
      primaryScreenshotId: reviewCase.snapshot.analysis_tray.primary_screenshot_id,
      compareScreenshotId: reviewCase.snapshot.analysis_tray.compare_screenshot_id,
      lastAddedAt: reviewCase.updated_at,
    }
    : fallbackAnalysisTrayState(reviewCase)

  const eventSelection = normalizeEventSelectionState(payload.events, rawSelection, {
    preferFirstEvent: false,
  })
  const analysisTray = normalizeAnalysisTrayState(payload, rawTray)
  const selectedScreenshotId = analysisTray.primaryScreenshotId
    ?? payload.events.find((event) => event.id === eventSelection.primaryEventId)?.screenshot_id
    ?? reviewCase.screenshot_ids[0]
    ?? null

  return {
    analysisTray,
    eventSelection: eventSelection.selectedEventIds.length > 0 ? eventSelection : clearEventSelectionState(),
    selectedScreenshotId,
  }
}
