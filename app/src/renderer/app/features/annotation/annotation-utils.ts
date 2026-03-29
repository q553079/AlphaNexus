import type { DraftAnnotation, PendingDraftAnnotation } from '@app/features/annotation/annotation-types'
import { encodeBrushGeometry } from '@app/features/annotation/annotation-geometry'

type AnnotationShape = PendingDraftAnnotation['shape']
type AnnotationBounds = {
  x1: number
  y1: number
  x2: number
  y2: number
}

const shapeConfig: Record<AnnotationShape, { prefix: string, color: string }> = {
  rectangle: { prefix: 'B', color: '#355c5a' },
  ellipse: { prefix: 'C', color: '#bc7f4a' },
  line: { prefix: 'L', color: '#5a6988' },
  arrow: { prefix: 'A', color: '#9c3d30' },
  text: { prefix: 'T', color: '#7a5f2a' },
  brush: { prefix: 'P', color: '#246caa' },
  fib_retracement: { prefix: 'F', color: '#8b5cf6' },
}

const countShape = (annotations: PendingDraftAnnotation[], shape: AnnotationShape) =>
  annotations.filter((annotation) => annotation.shape === shape).length

const buildLabel = (shape: AnnotationShape, annotations: PendingDraftAnnotation[]) => {
  const { prefix } = shapeConfig[shape]
  return `${prefix}${countShape(annotations, shape) + 1}`
}

export const toPendingDraftAnnotation = (annotation: DraftAnnotation): PendingDraftAnnotation => ({
  shape: annotation.shape,
  label: annotation.label,
  title: annotation.title,
  semantic_type: annotation.semantic_type,
  color: annotation.color,
  x1: annotation.x1,
  y1: annotation.y1,
  x2: annotation.x2,
  y2: annotation.y2,
  text: annotation.text,
  note_md: annotation.note_md,
  add_to_memory: annotation.add_to_memory,
  stroke_width: annotation.stroke_width,
})

export const toScreenshotDraftAnnotation = (
  screenshotId: string,
  annotation: PendingDraftAnnotation,
): DraftAnnotation => ({
  ...annotation,
  screenshot_id: screenshotId,
})

export const createPendingDraftAnnotation = (
  shape: AnnotationShape,
  annotations: PendingDraftAnnotation[],
  bounds: AnnotationBounds,
  overrides: Partial<PendingDraftAnnotation> = {},
): PendingDraftAnnotation => {
  const { color } = shapeConfig[shape]
  const label = buildLabel(shape, annotations)
  const isLinearShape = shape === 'line' || shape === 'arrow'

  return {
    shape,
    label,
    title: label,
    semantic_type: null,
    color: overrides.color ?? color,
    x1: bounds.x1,
    y1: bounds.y1,
    x2: bounds.x2,
    y2: bounds.y2,
    text: overrides.text ?? (shape === 'text' ? '注释' : shape === 'brush'
      ? encodeBrushGeometry([
        { x: bounds.x1, y: bounds.y1 },
        { x: bounds.x2, y: bounds.y2 },
      ])
      : null),
    note_md: overrides.note_md ?? '',
    add_to_memory: overrides.add_to_memory ?? false,
    stroke_width: overrides.stroke_width ?? (isLinearShape ? 3 : shape === 'brush' ? 4 : 2.6),
  }
}

export const createDraftAnnotation = (
  shape: AnnotationShape,
  screenshotId: string,
  annotations: DraftAnnotation[],
  x: number,
  y: number,
): DraftAnnotation => {
  const pendingAnnotations = annotations.map(toPendingDraftAnnotation)
  const nextPending = createPendingDraftAnnotation(
    shape,
    pendingAnnotations,
    shape === 'text'
      ? { x1: x, y1: y, x2: x + 220, y2: y + 72 }
      : shape === 'line' || shape === 'arrow' || shape === 'brush'
        ? { x1: x, y1: y, x2: x + 180, y2: y - 60 }
        : { x1: x, y1: y, x2: x + 190, y2: y + 110 },
  )

  return toScreenshotDraftAnnotation(screenshotId, nextPending)
}
