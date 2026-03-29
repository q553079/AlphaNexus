import { useEffect, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { DraftAnnotation } from '@app/features/annotation/annotation-types'
import type { AiAnalysisContextInput, AiRunExecutionResult } from '@shared/ai/contracts'
import type { ScreenshotRecord } from '@shared/contracts/content'
import type { EventRecord } from '@shared/contracts/event'
import type { TradeRecord } from '@shared/contracts/trade'
import type { SessionWorkbenchPayload } from '@shared/contracts/workbench'
import type {
  AiDockState,
  AiDockTab,
  AiPacketComposerState,
  AiPacketDispatchRecord,
  AnalysisTrayState,
} from '../session-workbench-types'
import {
  buildAiAnalysisContextFromComposer,
  buildAiDockContextChips,
  buildAiDockContextChipsFromDispatch,
  buildAiPacketBackgroundDraft,
  createAiPacketComposerState,
  rebuildAiPacketComposerState,
} from '../modules/session-ai-packet'
import {
  buildAiPacketAttachments,
  createAiPacketDispatchRecord,
} from '../modules/session-ai-packet-attachments'

type UseSessionWorkbenchAiPacketInput = {
  analysisTray: AnalysisTrayState
  currentTrade: TradeRecord | null
  draftAnnotations: DraftAnnotation[]
  payload: SessionWorkbenchPayload | null
  realtimeDraft: string
  selectedEventIds: string[]
  selectedEvents: EventRecord[]
  selectedScreenshot: ScreenshotRecord | null
  setMessage: Dispatch<SetStateAction<string | null>>
  handleRunAnalysisWithContext: (input: {
    analysisContext?: AiAnalysisContextInput
    screenshotId: string | null
    successMessagePrefix?: string
  }) => Promise<AiRunExecutionResult | null>
}

const uniqueOrderedComposerBackgrounds = (screenshotIds: string[]) => {
  const seen = new Set<string>()
  const ordered: string[] = []
  for (const screenshotId of screenshotIds) {
    if (!screenshotId || seen.has(screenshotId)) {
      continue
    }
    seen.add(screenshotId)
    ordered.push(screenshotId)
  }
  return ordered
}

export const useSessionWorkbenchAiPacket = ({
  analysisTray,
  currentTrade,
  draftAnnotations,
  payload,
  realtimeDraft,
  selectedEventIds,
  selectedEvents,
  selectedScreenshot,
  setMessage,
  handleRunAnalysisWithContext,
}: UseSessionWorkbenchAiPacketInput) => {
  const [aiComposer, setAiComposerState] = useState<AiPacketComposerState | null>(null)
  const [aiDockState, setAiDockState] = useState<AiDockState>({
    expanded: false,
    size: 'peek',
  })
  const [aiDockTab, setAiDockTabState] = useState<AiDockTab>('summary')
  const [aiDockDraft, setAiDockDraftState] = useState('')
  const [lastAiPacket, setLastAiPacket] = useState<AiPacketDispatchRecord | null>(null)
  const selectedEventIdsKey = selectedEventIds.join('|')
  const selectedEventsKey = selectedEvents.map((event) => event.id).join('|')

  const buildComposerState = (input?: {
    primaryScreenshotId?: string | null
  }) => {
    if (!payload) {
      return null
    }

    const primaryScreenshot = input?.primaryScreenshotId
      ? payload.screenshots.find((screenshot) => screenshot.id === input.primaryScreenshotId) ?? selectedScreenshot
      : selectedScreenshot
    const nextComposer = createAiPacketComposerState({
      analysisTray,
      currentTrade,
      payload,
      realtimeDraft,
      selectedEventIds,
      selectedEvents,
      selectedScreenshot: primaryScreenshot,
    })

    return input?.primaryScreenshotId
      ? rebuildAiPacketComposerState({
        composer: {
          ...nextComposer,
          primaryScreenshotId: input.primaryScreenshotId,
          backgroundScreenshotIds: analysisTray.screenshotIds.filter((screenshotId) => screenshotId !== input.primaryScreenshotId),
        },
        currentTrade,
        payload,
        realtimeDraft,
        selectedEventIds,
        selectedEvents,
      })
      : nextComposer
  }

  useEffect(() => {
    if (!payload?.session.id) {
      setAiComposerState(null)
      setAiDockDraftState('')
      setLastAiPacket(null)
      return
    }

    setAiComposerState((current) => {
      if (!current) {
        return current
      }

      return rebuildAiPacketComposerState({
        composer: current,
        currentTrade,
        payload,
        realtimeDraft,
        selectedEventIds,
        selectedEvents,
      })
    })
  }, [
    analysisTray,
    currentTrade,
    payload,
    realtimeDraft,
    selectedEventIdsKey,
    selectedEventsKey,
  ])

  useEffect(() => {
    setLastAiPacket(null)
    setAiDockDraftState('')
  }, [payload?.session.id])

  const aiDockContextChips = useMemo(() => {
    if (aiComposer) {
      return buildAiDockContextChips({
        composer: aiComposer,
        selectedEventIds,
      })
    }
    if (lastAiPacket) {
      return buildAiDockContextChipsFromDispatch(lastAiPacket)
    }
    return []
  }, [aiComposer, lastAiPacket, selectedEventIdsKey])

  const openAiComposer = (input?: {
    primaryScreenshotId?: string | null
  }) => {
    const nextComposer = buildComposerState(input)
    if (!nextComposer) {
      return
    }
    setAiComposerState({
      ...nextComposer,
      open: true,
    })
  }

  const closeAiComposer = () => {
    setAiComposerState((current) => current ? {
      ...current,
      open: false,
    } : null)
  }

  const setAiComposerBackgroundDraft = (value: string) => {
    setAiComposerState((current) => current ? {
      ...current,
      backgroundDraft: value,
      backgroundDraftDirty: true,
    } : current)
  }

  const setAiComposerBackgroundToggle = (
    key: keyof AiPacketComposerState['backgroundToggles'],
    value: boolean,
  ) => {
    if (!payload || !aiComposer) {
      return
    }

    setAiComposerState((current) => current
      ? rebuildAiPacketComposerState({
        composer: {
          ...current,
          backgroundToggles: {
            ...current.backgroundToggles,
            [key]: value,
          },
          backgroundDraft: current.backgroundDraftDirty
            ? current.backgroundDraft
            : buildAiPacketBackgroundDraft({
              currentTrade,
              payload,
              realtimeDraft,
              selectedEvents,
              toggles: {
                ...current.backgroundToggles,
                [key]: value,
              },
            }),
        },
        currentTrade,
        payload,
        realtimeDraft,
        selectedEventIds,
        selectedEvents,
      })
      : current)
  }

  const setAiComposerImageRegionMode = (mode: AiPacketComposerState['imageRegionMode']) => {
    if (!payload) {
      return
    }

    setAiComposerState((current) => current
      ? rebuildAiPacketComposerState({
        composer: {
          ...current,
          imageRegionMode: mode,
        },
        currentTrade,
        payload,
        realtimeDraft,
        selectedEventIds,
        selectedEvents,
      })
      : current)
  }

  const setAiComposerPrimaryScreenshot = (screenshotId: string) => {
    if (!payload) {
      return
    }

    setAiComposerState((current) => {
      if (!current) {
        return current
      }

      return rebuildAiPacketComposerState({
        composer: {
          ...current,
          primaryScreenshotId: screenshotId,
          backgroundScreenshotIds: uniqueOrderedComposerBackgrounds([
            current.primaryScreenshotId,
            ...current.backgroundScreenshotIds,
          ].filter((id): id is string => Boolean(id) && id !== screenshotId)),
        },
        currentTrade,
        payload,
        realtimeDraft,
        selectedEventIds,
        selectedEvents,
      })
    })
  }

  const removeAiComposerBackgroundScreenshot = (screenshotId: string) => {
    if (!payload) {
      return
    }

    setAiComposerState((current) => {
      if (!current) {
        return current
      }

      return rebuildAiPacketComposerState({
        composer: {
          ...current,
          backgroundScreenshotIds: current.backgroundScreenshotIds.filter((id) => id !== screenshotId),
        },
        currentTrade,
        payload,
        realtimeDraft,
        selectedEventIds,
        selectedEvents,
      })
    })
  }

  const setAiDockExpanded = (expanded: boolean) => {
    setAiDockState((current) => ({
      ...current,
      expanded,
    }))
  }

  const setAiDockSize = (size: AiDockState['size']) => {
    setAiDockState((current) => ({
      ...current,
      size,
      expanded: true,
    }))
  }

  const runPacketAnalysis = async(input: {
    backgroundNoteOverride?: string
    composer: AiPacketComposerState
    dockTab: AiDockTab
    followUpQuestion?: string | null
    successMessagePrefix: string
  }) => {
    if (!payload || !input.composer.primaryScreenshotId) {
      return null
    }

    const { attachments, previews } = await buildAiPacketAttachments({
      composer: input.composer,
      draftAnnotations,
      payloadScreenshots: payload.screenshots,
      selectedScreenshotId: selectedScreenshot?.id ?? null,
    })
    const analysisContext = buildAiAnalysisContextFromComposer({
      composer: input.composer,
      attachments,
      selectedEventIds,
    })
    if (input.backgroundNoteOverride) {
      analysisContext.background_note_md = input.backgroundNoteOverride
    }

    setLastAiPacket(createAiPacketDispatchRecord({
      composer: input.composer,
      followUpQuestion: input.followUpQuestion ?? null,
      previews,
      selectedEventIds,
    }))
    setAiDockState((current) => ({
      ...current,
      expanded: true,
    }))
    setAiDockTabState(input.dockTab)

    return handleRunAnalysisWithContext({
      screenshotId: input.composer.primaryScreenshotId,
      analysisContext,
      successMessagePrefix: input.successMessagePrefix,
    })
  }

  const handleQuickSendToAi = async(screenshotId?: string | null) => {
    const nextComposer = buildComposerState({
      primaryScreenshotId: screenshotId ?? selectedScreenshot?.id ?? analysisTray.primaryScreenshotId ?? null,
    })
    if (!nextComposer?.primaryScreenshotId) {
      setMessage('当前没有可发送给 AI 的主图。')
      return
    }

    setAiComposerState(nextComposer)
    await runPacketAnalysis({
      composer: nextComposer,
      dockTab: 'summary',
      successMessagePrefix: '已快速发送：',
    })
  }

  const handleSendAiComposer = async() => {
    if (!aiComposer?.primaryScreenshotId) {
      setMessage('请先选择主图。')
      return
    }

    await runPacketAnalysis({
      composer: aiComposer,
      dockTab: 'packet',
      successMessagePrefix: '已按编辑包发送：',
    })
    closeAiComposer()
  }

  const handleSendAiDockFollowUp = async() => {
    const question = aiDockDraft.trim()
    const activeComposer = aiComposer ?? buildComposerState()
    if (!question || !activeComposer?.primaryScreenshotId) {
      return
    }

    setAiComposerState(activeComposer)
    await runPacketAnalysis({
      backgroundNoteOverride: [
        activeComposer.backgroundDraft.trim(),
        `继续追问：${question}`,
      ].filter(Boolean).join('\n\n'),
      composer: activeComposer,
      dockTab: 'full',
      followUpQuestion: question,
      successMessagePrefix: '已发送追问：',
    })
    setAiDockDraftState('')
  }

  return {
    aiComposer,
    aiDockContextChips,
    aiDockDraft,
    aiDockState,
    aiDockTab,
    closeAiComposer,
    handleQuickSendToAi,
    handleSendAiComposer,
    handleSendAiDockFollowUp,
    lastAiPacket,
    openAiComposer,
    removeAiComposerBackgroundScreenshot,
    setAiComposerBackgroundDraft,
    setAiComposerBackgroundToggle,
    setAiComposerImageRegionMode,
    setAiComposerPrimaryScreenshot,
    setAiDockDraft: setAiDockDraftState,
    setAiDockExpanded,
    setAiDockSize,
    setAiDockTab: setAiDockTabState,
  }
}
