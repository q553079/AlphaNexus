import type { ScreenshotRecord } from '@shared/contracts/content'
import type { EventRecord } from '@shared/contracts/event'
import type { SessionWorkbenchPayload } from '@shared/contracts/workbench'
import type { AnalysisTrayState, EventSelectionState } from '../session-workbench-types'

export const createEmptyAnalysisTrayState = (): AnalysisTrayState => ({
  eventIds: [],
  screenshotIds: [],
  primaryEventId: null,
  primaryScreenshotId: null,
  compareScreenshotId: null,
  lastAddedAt: null,
})

const orderEventIds = (events: EventRecord[], eventIds: string[]) => {
  const lookup = new Set(eventIds)
  return events
    .map((event) => event.id)
    .filter((eventId) => lookup.has(eventId))
}

const filterExistingEventIds = (events: EventRecord[], eventIds: string[]) => {
  const validIds = new Set(events.map((event) => event.id))
  const seen = new Set<string>()
  const ordered: string[] = []
  for (const eventId of eventIds) {
    if (!validIds.has(eventId) || seen.has(eventId)) {
      continue
    }
    seen.add(eventId)
    ordered.push(eventId)
  }
  return ordered
}

const orderScreenshotIds = (screenshots: ScreenshotRecord[], screenshotIds: string[]) => {
  const lookup = new Set(screenshotIds)
  return screenshots
    .map((screenshot) => screenshot.id)
    .filter((screenshotId) => lookup.has(screenshotId))
}

const filterExistingScreenshotIds = (screenshots: ScreenshotRecord[], screenshotIds: string[]) => {
  const validIds = new Set(screenshots.map((screenshot) => screenshot.id))
  const seen = new Set<string>()
  const ordered: string[] = []
  for (const screenshotId of screenshotIds) {
    if (!validIds.has(screenshotId) || seen.has(screenshotId)) {
      continue
    }
    seen.add(screenshotId)
    ordered.push(screenshotId)
  }
  return ordered
}

const mergeOrderedIds = <T extends string>(currentIds: T[], nextIds: T[]) => {
  const merged = [...currentIds]
  const seen = new Set(currentIds)
  for (const id of nextIds) {
    if (!seen.has(id)) {
      merged.push(id)
      seen.add(id)
    }
  }
  return merged
}

const pickCompareScreenshotId = (
  screenshotIds: string[],
  primaryScreenshotId: string | null,
  compareScreenshotId: string | null,
) => {
  if (compareScreenshotId && compareScreenshotId !== primaryScreenshotId && screenshotIds.includes(compareScreenshotId)) {
    return compareScreenshotId
  }

  return screenshotIds.find((screenshotId) => screenshotId !== primaryScreenshotId) ?? null
}

export const normalizeAnalysisTrayState = (
  payload: SessionWorkbenchPayload | null,
  currentState: AnalysisTrayState | null,
): AnalysisTrayState => {
  if (!payload || !currentState) {
    return currentState ?? createEmptyAnalysisTrayState()
  }

  const screenshotIds = filterExistingScreenshotIds(payload.screenshots, currentState.screenshotIds)
  const eventIds = filterExistingEventIds(payload.events, currentState.eventIds)
  const primaryScreenshotId = currentState.primaryScreenshotId && screenshotIds.includes(currentState.primaryScreenshotId)
    ? currentState.primaryScreenshotId
    : screenshotIds[0] ?? null
  const primaryEventId = currentState.primaryEventId && eventIds.includes(currentState.primaryEventId)
    ? currentState.primaryEventId
    : eventIds[0] ?? null

  return {
    eventIds,
    screenshotIds,
    primaryEventId,
    primaryScreenshotId,
    compareScreenshotId: pickCompareScreenshotId(screenshotIds, primaryScreenshotId, currentState.compareScreenshotId),
    lastAddedAt: currentState.lastAddedAt,
  }
}

const resolveEventIdsForScreenshotIds = (
  payload: SessionWorkbenchPayload,
  screenshotIds: string[],
) => {
  const eventIds = payload.events
    .filter((event) => event.screenshot_id != null && screenshotIds.includes(event.screenshot_id))
    .map((event) => event.id)
  return orderEventIds(payload.events, eventIds)
}

export const addScreenshotsToAnalysisTray = (
  payload: SessionWorkbenchPayload,
  currentState: AnalysisTrayState | null,
  screenshotIds: string[],
): AnalysisTrayState => {
  const normalizedState = normalizeAnalysisTrayState(payload, currentState)
  const nextScreenshotIds = orderScreenshotIds(
    payload.screenshots,
    mergeOrderedIds(normalizedState.screenshotIds, screenshotIds),
  )
  const nextEventIds = orderEventIds(
    payload.events,
    mergeOrderedIds(normalizedState.eventIds, resolveEventIdsForScreenshotIds(payload, nextScreenshotIds)),
  )
  const primaryScreenshotId = normalizedState.primaryScreenshotId && nextScreenshotIds.includes(normalizedState.primaryScreenshotId)
    ? normalizedState.primaryScreenshotId
    : screenshotIds[0] ?? nextScreenshotIds[0] ?? null

  return {
    eventIds: nextEventIds,
    screenshotIds: nextScreenshotIds,
    primaryEventId: normalizedState.primaryEventId ?? nextEventIds[0] ?? null,
    primaryScreenshotId,
    compareScreenshotId: pickCompareScreenshotId(nextScreenshotIds, primaryScreenshotId, normalizedState.compareScreenshotId),
    lastAddedAt: new Date().toISOString(),
  }
}

export const addSelectionToAnalysisTray = (
  payload: SessionWorkbenchPayload,
  currentState: AnalysisTrayState | null,
  selectionState: EventSelectionState,
): AnalysisTrayState => {
  const selectedEventIds = orderEventIds(payload.events, selectionState.selectedEventIds)
  const selectedScreenshotIds = orderScreenshotIds(
    payload.screenshots,
    payload.events
      .filter((event) => selectedEventIds.includes(event.id) && event.screenshot_id != null)
      .map((event) => event.screenshot_id as string),
  )

  const mergedState = addScreenshotsToAnalysisTray(payload, currentState, selectedScreenshotIds)
  const nextEventIds = orderEventIds(
    payload.events,
    mergeOrderedIds(mergedState.eventIds, selectedEventIds),
  )

  return {
    ...mergedState,
    eventIds: nextEventIds,
    primaryEventId: selectionState.primaryEventId && nextEventIds.includes(selectionState.primaryEventId)
      ? selectionState.primaryEventId
      : mergedState.primaryEventId,
  }
}

export const removeScreenshotFromAnalysisTray = (
  payload: SessionWorkbenchPayload,
  currentState: AnalysisTrayState | null,
  screenshotId: string,
): AnalysisTrayState => {
  const normalizedState = normalizeAnalysisTrayState(payload, currentState)
  const screenshotIds = normalizedState.screenshotIds.filter((id) => id !== screenshotId)
  const eventIds = normalizedState.eventIds.filter((eventId) => {
    const event = payload.events.find((item) => item.id === eventId) ?? null
    return event?.screenshot_id !== screenshotId
  })
  const primaryScreenshotId = normalizedState.primaryScreenshotId === screenshotId
    ? screenshotIds[0] ?? null
    : normalizedState.primaryScreenshotId

  return {
    eventIds,
    screenshotIds,
    primaryEventId: normalizedState.primaryEventId && eventIds.includes(normalizedState.primaryEventId)
      ? normalizedState.primaryEventId
      : eventIds[0] ?? null,
    primaryScreenshotId,
    compareScreenshotId: pickCompareScreenshotId(screenshotIds, primaryScreenshotId, normalizedState.compareScreenshotId),
    lastAddedAt: normalizedState.lastAddedAt,
  }
}

export const setPrimaryAnalysisTrayScreenshot = (
  payload: SessionWorkbenchPayload,
  currentState: AnalysisTrayState | null,
  screenshotId: string,
): AnalysisTrayState => {
  const normalizedState = addScreenshotsToAnalysisTray(payload, currentState, [screenshotId])
  const nextPrimaryEventId = payload.events.find((event) => event.screenshot_id === screenshotId)?.id ?? normalizedState.primaryEventId

  return {
    ...normalizedState,
    primaryEventId: nextPrimaryEventId,
    primaryScreenshotId: screenshotId,
    compareScreenshotId: pickCompareScreenshotId(normalizedState.screenshotIds, screenshotId, normalizedState.compareScreenshotId),
  }
}

export const setCompareAnalysisTrayScreenshot = (
  payload: SessionWorkbenchPayload,
  currentState: AnalysisTrayState | null,
  screenshotId: string | null,
): AnalysisTrayState => {
  const normalizedState = normalizeAnalysisTrayState(payload, currentState)
  return {
    ...normalizedState,
    compareScreenshotId: screenshotId
      ? pickCompareScreenshotId(normalizedState.screenshotIds, normalizedState.primaryScreenshotId, screenshotId)
      : null,
  }
}

export const resolveAnalysisTrayScreenshots = (
  payload: SessionWorkbenchPayload | null,
  trayState: AnalysisTrayState,
) => {
  if (!payload) {
    return {
      compareScreenshot: null,
      primaryScreenshot: null,
      screenshots: [],
    }
  }

  const screenshots = filterExistingScreenshotIds(payload.screenshots, trayState.screenshotIds)
    .map((screenshotId) => payload.screenshots.find((screenshot) => screenshot.id === screenshotId) ?? null)
    .filter((screenshot): screenshot is ScreenshotRecord => screenshot != null)
  const primaryScreenshot = trayState.primaryScreenshotId
    ? screenshots.find((screenshot) => screenshot.id === trayState.primaryScreenshotId) ?? null
    : null
  const compareScreenshot = trayState.compareScreenshotId
    ? screenshots.find((screenshot) => screenshot.id === trayState.compareScreenshotId) ?? null
    : null

  return {
    compareScreenshot,
    primaryScreenshot,
    screenshots,
  }
}

const moveItem = <T extends string>(items: T[], itemId: T, direction: 'backward' | 'forward') => {
  const currentIndex = items.indexOf(itemId)
  if (currentIndex === -1) {
    return items
  }

  const targetIndex = direction === 'backward'
    ? Math.max(0, currentIndex - 1)
    : Math.min(items.length - 1, currentIndex + 1)
  if (currentIndex === targetIndex) {
    return items
  }

  const nextItems = [...items]
  const [item] = nextItems.splice(currentIndex, 1)
  nextItems.splice(targetIndex, 0, item)
  return nextItems
}

export const moveAnalysisTrayScreenshot = (
  payload: SessionWorkbenchPayload,
  currentState: AnalysisTrayState | null,
  screenshotId: string,
  direction: 'backward' | 'forward',
): AnalysisTrayState => {
  const normalizedState = normalizeAnalysisTrayState(payload, currentState)
  const screenshotIds = moveItem(normalizedState.screenshotIds, screenshotId, direction)

  return {
    ...normalizedState,
    screenshotIds,
  }
}
