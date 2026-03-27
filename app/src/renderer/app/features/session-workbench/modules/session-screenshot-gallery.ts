import type { ScreenshotRecord } from '@shared/contracts/content'
import type { SessionWorkbenchPayload } from '@shared/contracts/workbench'

export type ScreenshotGalleryScope = 'session' | 'trade'

export type ScreenshotGalleryState = {
  compare_pair: {
    setup: ScreenshotRecord | null
    exit: ScreenshotRecord | null
  } | null
  scope: ScreenshotGalleryScope
  scope_label: string
  screenshots: ScreenshotRecord[]
  target_session_id: string | null
  target_trade_id: string | null
}

const byId = <T extends { id: string }>(items: T[]) => new Map(items.map((item) => [item.id, item] as const))

const sortScreenshots = (
  screenshots: ScreenshotRecord[],
  payload: SessionWorkbenchPayload,
) => {
  const eventsById = byId(payload.events)
  return [...screenshots].sort((left, right) => {
    const leftEvent = left.event_id ? eventsById.get(left.event_id) : null
    const rightEvent = right.event_id ? eventsById.get(right.event_id) : null
    const leftOccurredAt = leftEvent?.occurred_at ?? left.created_at
    const rightOccurredAt = rightEvent?.occurred_at ?? right.created_at
    return leftOccurredAt.localeCompare(rightOccurredAt)
      || left.created_at.localeCompare(right.created_at)
      || left.id.localeCompare(right.id)
  })
}

const resolveTradeScopedScreenshots = (
  payload: SessionWorkbenchPayload,
  tradeId: string,
) => {
  const eventTradeByScreenshotId = new Map(
    payload.events
      .filter((event) => event.screenshot_id != null)
      .map((event) => [event.screenshot_id as string, event.trade_id] as const),
  )

  return sortScreenshots(
    payload.screenshots.filter((screenshot) => eventTradeByScreenshotId.get(screenshot.id) === tradeId),
    payload,
  )
}

const resolveSessionScopedScreenshots = (payload: SessionWorkbenchPayload) =>
  sortScreenshots(
    payload.screenshots.filter((screenshot) => {
      const screenshotEvent = screenshot.event_id
        ? payload.events.find((event) => event.id === screenshot.event_id) ?? null
        : null
      return screenshotEvent?.trade_id == null
    }),
    payload,
  )

const pickSetupScreenshot = (screenshots: ScreenshotRecord[]) =>
  screenshots.find((screenshot) => screenshot.kind === 'chart')
  ?? screenshots.find((screenshot) => screenshot.kind !== 'exit')
  ?? screenshots[0]
  ?? null

const pickExitScreenshot = (screenshots: ScreenshotRecord[]) =>
  [...screenshots].reverse().find((screenshot) => screenshot.kind === 'exit')
  ?? null

export const buildScreenshotGalleryState = (input: {
  current_trade_id?: string | null
  payload: SessionWorkbenchPayload | null
  selected_screenshot_id?: string | null
}): ScreenshotGalleryState => {
  const payload = input.payload
  if (!payload) {
    return {
      compare_pair: null,
      scope: 'session',
      scope_label: 'Session 截图',
      screenshots: [],
      target_session_id: null,
      target_trade_id: null,
    }
  }

  const selectedEvent = input.selected_screenshot_id
    ? payload.events.find((event) => event.screenshot_id === input.selected_screenshot_id) ?? null
    : null
  const scopedTradeId = selectedEvent?.trade_id ?? (input.selected_screenshot_id ? null : input.current_trade_id ?? null)
  const tradeScopedScreenshots = scopedTradeId
    ? resolveTradeScopedScreenshots(payload, scopedTradeId)
    : []

  if (scopedTradeId && tradeScopedScreenshots.length > 0) {
    const scopedTrade = payload.trades.find((trade) => trade.id === scopedTradeId) ?? null
    return {
      compare_pair: {
        setup: pickSetupScreenshot(tradeScopedScreenshots),
        exit: pickExitScreenshot(tradeScopedScreenshots),
      },
      scope: 'trade',
      scope_label: scopedTrade ? `${scopedTrade.symbol} ${scopedTrade.side} · Trade 截图` : 'Trade 截图',
      screenshots: tradeScopedScreenshots,
      target_session_id: scopedTrade?.session_id ?? payload.session.id,
      target_trade_id: scopedTradeId,
    }
  }

  const sessionScopedScreenshots = resolveSessionScopedScreenshots(payload)
  return {
    compare_pair: null,
    scope: 'session',
    scope_label: 'Session 截图',
    screenshots: sessionScopedScreenshots,
    target_session_id: payload.session.id,
    target_trade_id: null,
  }
}
