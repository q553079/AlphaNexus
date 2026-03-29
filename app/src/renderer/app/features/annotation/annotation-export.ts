import type { CaptureSelection } from '@shared/capture/contracts'
import type { DraftAnnotation, PendingDraftAnnotation } from '@app/features/annotation/annotation-types'
import {
  decodeBrushGeometry,
  getFibRetracementLevels,
  normalizeAnnotationBounds,
} from '@app/features/annotation/annotation-geometry'

type AnnotationLike = PendingDraftAnnotation | DraftAnnotation

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const toCropRect = (
  selection: CaptureSelection | undefined,
  sourceWidth: number,
  sourceHeight: number,
) => {
  if (!selection) {
    return {
      x: 0,
      y: 0,
      width: sourceWidth,
      height: sourceHeight,
    }
  }

  const x = Math.floor(clamp(selection.x, 0, 1) * sourceWidth)
  const y = Math.floor(clamp(selection.y, 0, 1) * sourceHeight)
  const right = Math.ceil(clamp(selection.x + selection.width, 0, 1) * sourceWidth)
  const bottom = Math.ceil(clamp(selection.y + selection.height, 0, 1) * sourceHeight)

  return {
    x: Math.min(x, sourceWidth - 1),
    y: Math.min(y, sourceHeight - 1),
    width: Math.max(1, Math.min(right - x, sourceWidth - x)),
    height: Math.max(1, Math.min(bottom - y, sourceHeight - y)),
  }
}

const loadImageElement = (imageUrl: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('加载标注导出所需图像失败。'))
    image.src = imageUrl
  })

const drawLabel = (
  context: CanvasRenderingContext2D,
  annotation: AnnotationLike,
  x: number,
  y: number,
) => {
  context.save()
  context.font = '600 18px sans-serif'
  context.fillStyle = annotation.color
  context.fillText(annotation.label, x, y)
  context.restore()
}

const drawAnnotation = (
  context: CanvasRenderingContext2D,
  annotation: AnnotationLike,
) => {
  const x1 = annotation.x1
  const y1 = annotation.y1
  const x2 = annotation.x2
  const y2 = annotation.y2

  context.save()
  context.strokeStyle = annotation.color
  context.lineWidth = annotation.stroke_width
  context.lineCap = 'round'
  context.lineJoin = 'round'

  if (annotation.shape === 'rectangle') {
    context.strokeRect(x1, y1, x2 - x1, y2 - y1)
    drawLabel(context, annotation, x1 + 10, y1 + 24)
    context.restore()
    return
  }

  if (annotation.shape === 'ellipse') {
    context.beginPath()
    context.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2, 0, 0, Math.PI * 2)
    context.stroke()
    drawLabel(context, annotation, x1 + 10, y1 + 24)
    context.restore()
    return
  }

  if (annotation.shape === 'fib_retracement') {
    const bounds = normalizeAnnotationBounds(annotation)
    const levels = getFibRetracementLevels(bounds.y1, bounds.y2)
    context.save()
    context.font = '500 14px sans-serif'
    context.fillStyle = annotation.color
    context.strokeStyle = annotation.color
    context.lineWidth = Math.max(annotation.stroke_width, 1.8)
    levels.forEach((level, index) => {
      context.globalAlpha = index === 0 || index === levels.length - 1 ? 0.9 : 0.68
      context.beginPath()
      context.moveTo(bounds.x1, level.y)
      context.lineTo(bounds.x2, level.y)
      context.stroke()
      context.fillText(`${Math.round(level.ratio * 100)}%`, bounds.x2 + 10, level.y + 4)
    })
    context.restore()
    drawLabel(context, annotation, bounds.x1 + 10, bounds.y1 - 8)
    context.restore()
    return
  }

  if (annotation.shape === 'line' || annotation.shape === 'arrow') {
    context.beginPath()
    context.moveTo(x1, y1)
    context.lineTo(x2, y2)
    context.stroke()

    if (annotation.shape === 'arrow') {
      const angle = Math.atan2(y2 - y1, x2 - x1)
      const headLength = 14
      context.beginPath()
      context.moveTo(x2, y2)
      context.lineTo(
        x2 - headLength * Math.cos(angle - Math.PI / 6),
        y2 - headLength * Math.sin(angle - Math.PI / 6),
      )
      context.moveTo(x2, y2)
      context.lineTo(
        x2 - headLength * Math.cos(angle + Math.PI / 6),
        y2 - headLength * Math.sin(angle + Math.PI / 6),
      )
      context.stroke()
    }

    drawLabel(context, annotation, x1 + 10, y1 - 8)
    context.restore()
    return
  }

  if (annotation.shape === 'brush') {
    const points = decodeBrushGeometry(annotation.text)
    if (points.length >= 2) {
      context.beginPath()
      context.moveTo(points[0].x, points[0].y)
      for (let index = 1; index < points.length; index += 1) {
        context.lineTo(points[index].x, points[index].y)
      }
      context.stroke()
    }
    drawLabel(context, annotation, annotation.x1 + 10, annotation.y1 - 8)
    context.restore()
    return
  }

  const boxWidth = Math.max(x2 - x1, 120)
  const boxHeight = Math.max(y2 - y1, 60)
  context.fillStyle = 'rgba(255, 255, 255, 0.9)'
  context.strokeRect(x1, y1, boxWidth, boxHeight)
  context.fillRect(x1, y1, boxWidth, boxHeight)
  context.strokeRect(x1, y1, boxWidth, boxHeight)
  drawLabel(context, annotation, x1 + 12, y1 + 22)
  context.save()
  context.font = '16px sans-serif'
  context.fillStyle = '#1f2328'
  context.fillText(annotation.text ?? '注释', x1 + 12, y1 + 44)
  context.restore()
  context.restore()
}

export const renderAnnotatedImageDataUrl = async(input: {
  image_url: string
  source_width: number
  source_height: number
  selection?: CaptureSelection
  annotations: AnnotationLike[]
}) => {
  const image = await loadImageElement(input.image_url)
  const cropRect = toCropRect(input.selection, input.source_width, input.source_height)
  const canvas = document.createElement('canvas')
  canvas.width = cropRect.width
  canvas.height = cropRect.height
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('浏览器当前无法创建标注导出画布。')
  }

  context.drawImage(
    image,
    cropRect.x,
    cropRect.y,
    cropRect.width,
    cropRect.height,
    0,
    0,
    cropRect.width,
    cropRect.height,
  )

  for (const annotation of input.annotations) {
    drawAnnotation(context, annotation)
  }

  return canvas.toDataURL('image/png')
}

export const serializeAnnotationDocument = (input: {
  screenshot_id?: string | null
  source_width: number
  source_height: number
  selection?: CaptureSelection
  annotations: AnnotationLike[]
}) => JSON.stringify({
  schema_version: 1,
  screenshot_id: input.screenshot_id ?? null,
  source_width: input.source_width,
  source_height: input.source_height,
  selection: input.selection ?? null,
  annotations: input.annotations.map((annotation) => ({
    shape: annotation.shape,
    label: annotation.label,
    title: annotation.title,
    semantic_type: annotation.semantic_type ?? null,
    color: annotation.color,
    x1: annotation.x1,
    y1: annotation.y1,
    x2: annotation.x2,
    y2: annotation.y2,
    text: annotation.text ?? null,
    note_md: annotation.note_md,
    add_to_memory: annotation.add_to_memory,
    stroke_width: annotation.stroke_width,
  })),
}, null, 2)
