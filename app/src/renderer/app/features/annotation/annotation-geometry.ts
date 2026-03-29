import type { PendingDraftAnnotation } from '@app/features/annotation/annotation-types'

export type AnnotationPoint = {
  x: number
  y: number
}

const BRUSH_GEOMETRY_PREFIX = '__alpha_brush__:'

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export const normalizeAnnotationBounds = (input: {
  x1: number
  y1: number
  x2: number
  y2: number
}) => ({
  x1: Math.min(input.x1, input.x2),
  y1: Math.min(input.y1, input.y2),
  x2: Math.max(input.x1, input.x2),
  y2: Math.max(input.y1, input.y2),
})

export const encodeBrushGeometry = (points: AnnotationPoint[]) =>
  `${BRUSH_GEOMETRY_PREFIX}${JSON.stringify(points)}`

export const decodeBrushGeometry = (text: string | null | undefined): AnnotationPoint[] => {
  if (!text?.startsWith(BRUSH_GEOMETRY_PREFIX)) {
    return []
  }

  try {
    const parsed = JSON.parse(text.slice(BRUSH_GEOMETRY_PREFIX.length)) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .filter((item): item is AnnotationPoint =>
        typeof item === 'object'
        && item != null
        && typeof (item as AnnotationPoint).x === 'number'
        && typeof (item as AnnotationPoint).y === 'number')
      .map((point) => ({
        x: point.x,
        y: point.y,
      }))
  } catch {
    return []
  }
}

export const getBrushBounds = (points: AnnotationPoint[]) => {
  if (points.length === 0) {
    return null
  }

  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  return {
    x1: Math.min(...xs),
    y1: Math.min(...ys),
    x2: Math.max(...xs),
    y2: Math.max(...ys),
  }
}

export const getAnnotationBounds = (annotation: PendingDraftAnnotation) => {
  if (annotation.shape === 'brush') {
    const brushBounds = getBrushBounds(decodeBrushGeometry(annotation.text))
    return brushBounds ?? normalizeAnnotationBounds(annotation)
  }

  return normalizeAnnotationBounds(annotation)
}

const distanceToSegment = (point: AnnotationPoint, start: AnnotationPoint, end: AnnotationPoint) => {
  const dx = end.x - start.x
  const dy = end.y - start.y
  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y)
  }

  const t = clamp(
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy),
    0,
    1,
  )
  const projection = {
    x: start.x + t * dx,
    y: start.y + t * dy,
  }
  return Math.hypot(point.x - projection.x, point.y - projection.y)
}

export const isPointNearAnnotation = (
  annotation: PendingDraftAnnotation,
  point: AnnotationPoint,
  tolerance = 18,
) => {
  const bounds = getAnnotationBounds(annotation)
  const expanded = {
    x1: bounds.x1 - tolerance,
    y1: bounds.y1 - tolerance,
    x2: bounds.x2 + tolerance,
    y2: bounds.y2 + tolerance,
  }
  const isInsideExpandedBounds = point.x >= expanded.x1
    && point.x <= expanded.x2
    && point.y >= expanded.y1
    && point.y <= expanded.y2

  if (!isInsideExpandedBounds) {
    return false
  }

  if (annotation.shape === 'line' || annotation.shape === 'arrow') {
    return distanceToSegment(point, { x: annotation.x1, y: annotation.y1 }, { x: annotation.x2, y: annotation.y2 }) <= tolerance
  }

  if (annotation.shape === 'brush') {
    const points = decodeBrushGeometry(annotation.text)
    for (let index = 1; index < points.length; index += 1) {
      if (distanceToSegment(point, points[index - 1], points[index]) <= tolerance) {
        return true
      }
    }
    return false
  }

  return true
}

export const getFibRetracementLevels = (startY: number, endY: number) => {
  const delta = endY - startY
  return [
    { ratio: 0, y: startY },
    { ratio: 0.236, y: startY + delta * 0.236 },
    { ratio: 0.382, y: startY + delta * 0.382 },
    { ratio: 0.5, y: startY + delta * 0.5 },
    { ratio: 0.618, y: startY + delta * 0.618 },
    { ratio: 0.786, y: startY + delta * 0.786 },
    { ratio: 1, y: endY },
  ]
}
