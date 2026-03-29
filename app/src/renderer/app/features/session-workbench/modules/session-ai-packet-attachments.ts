import type { CaptureSelection } from '@shared/capture/contracts'
import type { AiAnalysisAttachment } from '@shared/ai/contracts'
import type { AnnotationRecord, ScreenshotRecord } from '@shared/contracts/content'
import type { DraftAnnotation } from '@app/features/annotation/annotation-types'
import { getAnnotationBounds } from '@app/features/annotation/annotation-geometry'
import {
  renderAnnotatedImageDataUrl,
  renderAnnotationLayerDataUrl,
  renderImageDataUrl,
} from '@app/features/annotation/annotation-export'
import type {
  AiPacketAttachmentView,
  AiPacketComposerState,
  AiPacketDispatchRecord,
} from '../session-workbench-types'

type AnnotationLike = DraftAnnotation | AnnotationRecord

type PacketScreenshotRenderInput = {
  mode: AiPacketComposerState['imageRegionMode']
  annotations: AnnotationLike[]
  screenshot: ScreenshotRecord
}

const MAX_PACKET_ATTACHMENTS = 6
const CROP_PADDING_PX = 32

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const resolveSelectionFromAnnotations = (
  screenshot: ScreenshotRecord,
  annotations: AnnotationLike[],
): CaptureSelection | null => {
  if (annotations.length === 0) {
    return null
  }

  const bounds = annotations
    .map((annotation) => getAnnotationBounds(annotation as DraftAnnotation))
    .reduce((current, next) => ({
      x1: Math.min(current.x1, next.x1),
      y1: Math.min(current.y1, next.y1),
      x2: Math.max(current.x2, next.x2),
      y2: Math.max(current.y2, next.y2),
    }))

  const width = screenshot.width
  const height = screenshot.height
  const x1 = clamp(bounds.x1 - CROP_PADDING_PX, 0, width)
  const y1 = clamp(bounds.y1 - CROP_PADDING_PX, 0, height)
  const x2 = clamp(bounds.x2 + CROP_PADDING_PX, 0, width)
  const y2 = clamp(bounds.y2 + CROP_PADDING_PX, 0, height)

  return {
    x: x1 / width,
    y: y1 / height,
    width: Math.max(1, x2 - x1) / width,
    height: Math.max(1, y2 - y1) / height,
  }
}

const resolveScreenshotImageUrl = (screenshot: ScreenshotRecord) =>
  screenshot.raw_asset_url ?? screenshot.asset_url

const compactLabel = (screenshot: ScreenshotRecord) =>
  screenshot.caption?.trim() || screenshot.id

const resolveModeLabel = (mode: AiPacketComposerState['imageRegionMode']) => {
  if (mode === 'selection') {
    return '局部裁切'
  }
  if (mode === 'annotations-only') {
    return '仅标注层'
  }
  if (mode === 'full-with-highlight') {
    return '整图高亮'
  }
  return '整图'
}

const renderPacketScreenshot = async(input: PacketScreenshotRenderInput) => {
  const baseInput = {
    image_url: resolveScreenshotImageUrl(input.screenshot),
    source_width: input.screenshot.width,
    source_height: input.screenshot.height,
  }
  const selection = resolveSelectionFromAnnotations(input.screenshot, input.annotations)

  if (input.mode === 'annotations-only') {
    if (selection) {
      return {
        dataUrl: await renderAnnotationLayerDataUrl({
          source_width: input.screenshot.width,
          source_height: input.screenshot.height,
          selection,
          annotations: input.annotations,
        }),
        resolvedModeLabel: '仅标注层',
        detail: `仅发送标注图层，裁切到当前标注包围盒。`,
      }
    }

    return {
      dataUrl: await renderAnnotationLayerDataUrl({
        source_width: input.screenshot.width,
        source_height: input.screenshot.height,
        annotations: input.annotations,
      }),
      resolvedModeLabel: '仅标注层',
      detail: input.annotations.length > 0
        ? '仅发送标注图层。'
        : '当前没有标注，发送的是空标注图层。',
    }
  }

  if (input.mode === 'selection') {
    if (!selection) {
      return {
        dataUrl: await renderImageDataUrl(baseInput),
        resolvedModeLabel: '整图回退',
        detail: '当前没有可用标注，selection 已回退为整图。',
      }
    }

    return {
      dataUrl: await renderImageDataUrl({
        ...baseInput,
        selection,
      }),
      resolvedModeLabel: '局部裁切',
      detail: '按当前标注包围盒裁切后的局部图像。',
    }
  }

  if (input.mode === 'full-with-highlight') {
    if (input.annotations.length === 0) {
      return {
        dataUrl: await renderImageDataUrl(baseInput),
        resolvedModeLabel: '整图回退',
        detail: '当前没有标注，full-with-highlight 已回退为整图。',
      }
    }

    return {
      dataUrl: await renderAnnotatedImageDataUrl({
        ...baseInput,
        annotations: input.annotations,
      }),
      resolvedModeLabel: '整图高亮',
      detail: `发送整图，并叠加 ${input.annotations.length} 条标注高亮。`,
    }
  }

  return {
    dataUrl: await renderImageDataUrl(baseInput),
    resolvedModeLabel: '整图',
    detail: '发送完整原图。',
  }
}

const buildAttachmentName = (input: {
  role: 'primary' | 'background'
  screenshot: ScreenshotRecord
  index: number
  requestedMode: AiPacketComposerState['imageRegionMode']
}) => `${input.role === 'primary' ? '主图' : `附图 ${input.index}` } · ${compactLabel(input.screenshot)} · ${resolveModeLabel(input.requestedMode)}`

export const buildAiPacketAttachments = async(input: {
  composer: AiPacketComposerState
  draftAnnotations: DraftAnnotation[]
  payloadScreenshots: ScreenshotRecord[]
  selectedScreenshotId: string | null
}) => {
  const screenshotsById = new Map(input.payloadScreenshots.map((screenshot) => [screenshot.id, screenshot] as const))
  const screenshotIds = [
    ...(input.composer.primaryScreenshotId ? [input.composer.primaryScreenshotId] : []),
    ...input.composer.backgroundScreenshotIds,
  ].slice(0, MAX_PACKET_ATTACHMENTS)

  const items = await Promise.all(screenshotIds.map(async(screenshotId, index) => {
    const screenshot = screenshotsById.get(screenshotId)
    if (!screenshot) {
      return null
    }

    const role = index === 0 ? 'primary' as const : 'background' as const
    const annotations = screenshot.id === input.selectedScreenshotId && input.draftAnnotations.length > 0
      ? input.draftAnnotations
      : screenshot.annotations
    const rendered = await renderPacketScreenshot({
      mode: input.composer.imageRegionMode,
      annotations,
      screenshot,
    })
    const name = buildAttachmentName({
      role,
      screenshot,
      index,
      requestedMode: input.composer.imageRegionMode,
    })

    const attachment: AiAnalysisAttachment = {
      id: `packet_${role}_${screenshot.id}`,
      kind: 'image',
      name,
      mime_type: 'image/png',
      size_bytes: null,
      data_url: rendered.dataUrl,
      text_excerpt: rendered.detail,
    }
    const preview: AiPacketAttachmentView = {
      id: attachment.id,
      screenshotId: screenshot.id,
      role,
      name,
      previewDataUrl: rendered.dataUrl,
      requestedMode: input.composer.imageRegionMode,
      resolvedModeLabel: rendered.resolvedModeLabel,
      detail: rendered.detail,
    }

    return {
      attachment,
      preview,
    }
  }))

  const resolvedItems = items.filter((item): item is NonNullable<typeof item> => item != null)
  return {
    attachments: resolvedItems.map((item) => item.attachment),
    previews: resolvedItems.map((item) => item.preview),
  }
}

export const createAiPacketDispatchRecord = (input: {
  composer: AiPacketComposerState
  previews: AiPacketAttachmentView[]
  selectedEventIds: string[]
  followUpQuestion?: string | null
  sentAt?: string
}): AiPacketDispatchRecord => ({
  sentAt: input.sentAt ?? new Date().toISOString(),
  primaryScreenshotId: input.composer.primaryScreenshotId,
  backgroundScreenshotIds: input.composer.backgroundScreenshotIds,
  sourceEventIds: input.selectedEventIds,
  followUpQuestion: input.followUpQuestion ?? null,
  imageRegionMode: input.composer.imageRegionMode,
  backgroundDraft: input.composer.backgroundDraft,
  backgroundToggles: input.composer.backgroundToggles,
  preview: input.composer.preview,
  attachments: input.previews,
})
