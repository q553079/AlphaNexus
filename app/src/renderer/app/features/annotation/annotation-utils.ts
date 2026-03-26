import type { DraftAnnotation } from '@app/features/annotation/annotation-types'

type AnnotationShape = DraftAnnotation['shape']

const shapeConfig: Record<AnnotationShape, { prefix: string, color: string }> = {
  rectangle: { prefix: 'B', color: '#355c5a' },
  ellipse: { prefix: 'C', color: '#bc7f4a' },
  line: { prefix: 'L', color: '#5a6988' },
  arrow: { prefix: 'A', color: '#9c3d30' },
  text: { prefix: 'T', color: '#7a5f2a' },
}

const countShape = (annotations: DraftAnnotation[], shape: AnnotationShape) =>
  annotations.filter((annotation) => annotation.shape === shape).length

export const createDraftAnnotation = (
  shape: AnnotationShape,
  screenshotId: string,
  annotations: DraftAnnotation[],
  x: number,
  y: number,
): DraftAnnotation => {
  const { prefix, color } = shapeConfig[shape]
  const sequence = countShape(annotations, shape) + 1

  if (shape === 'text') {
    return {
      screenshot_id: screenshotId,
      shape,
      label: `${prefix}${sequence}`,
      color,
      x1: x,
      y1: y,
      x2: x + 180,
      y2: y + 44,
      text: 'Shift in order flow',
      stroke_width: 2,
    }
  }

  if (shape === 'line' || shape === 'arrow') {
    return {
      screenshot_id: screenshotId,
      shape,
      label: `${prefix}${sequence}`,
      color,
      x1: x,
      y1: y,
      x2: x + 180,
      y2: y - 60,
      text: null,
      stroke_width: 3,
    }
  }

  return {
    screenshot_id: screenshotId,
    shape,
    label: `${prefix}${sequence}`,
    color,
    x1: x,
    y1: y,
    x2: x + 190,
    y2: y + 110,
    text: null,
    stroke_width: 3,
  }
}
