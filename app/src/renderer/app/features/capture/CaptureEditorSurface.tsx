import { useId, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { CaptureSelection } from '@shared/capture/contracts'
import type { PendingDraftAnnotation } from '@app/features/annotation/annotation-types'
import { createPendingDraftAnnotation } from '@app/features/annotation/annotation-utils'
import { translateAnnotationShape } from '@app/ui/display-text'

const fullSelection: CaptureSelection = {
  x: 0,
  y: 0,
  width: 1,
  height: 1,
}

const drawTools = ['rectangle', 'ellipse', 'line', 'arrow', 'text'] as const

type CaptureEditorTool = 'crop' | PendingDraftAnnotation['shape']
type SourcePoint = {
  x: number
  y: number
}

type SelectionBounds = {
  x: number
  y: number
  width: number
  height: number
}

type GestureState = {
  mode: 'crop' | 'annotation'
  start: SourcePoint
  current: SourcePoint
}

type CaptureEditorSurfaceProps = {
  activeAnnotationIndex: number | null
  allowCrop?: boolean
  annotations: PendingDraftAnnotation[]
  disabled?: boolean
  imageAlt: string
  imageUrl: string
  onActiveAnnotationIndexChange: (index: number | null) => void
  onAnnotationsChange: (annotations: PendingDraftAnnotation[]) => void
  onSelectionAnnotationsCleared?: () => void
  onSelectionChange?: (selection: CaptureSelection | null) => void
  selection?: CaptureSelection | null
  sourceHeight: number
  sourceWidth: number
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const toRatioSelection = (
  start: SourcePoint,
  end: SourcePoint,
  sourceWidth: number,
  sourceHeight: number,
): CaptureSelection | null => {
  const x1 = clamp(Math.min(start.x, end.x), 0, sourceWidth)
  const y1 = clamp(Math.min(start.y, end.y), 0, sourceHeight)
  const x2 = clamp(Math.max(start.x, end.x), 0, sourceWidth)
  const y2 = clamp(Math.max(start.y, end.y), 0, sourceHeight)
  const width = x2 - x1
  const height = y2 - y1

  if (width < 24 || height < 24) {
    return null
  }

  return {
    x: x1 / sourceWidth,
    y: y1 / sourceHeight,
    width: width / sourceWidth,
    height: height / sourceHeight,
  }
}

const toSelectionBounds = (
  selection: CaptureSelection,
  sourceWidth: number,
  sourceHeight: number,
): SelectionBounds => ({
  x: selection.x * sourceWidth,
  y: selection.y * sourceHeight,
  width: selection.width * sourceWidth,
  height: selection.height * sourceHeight,
})

const toSourcePoint = (
  event: React.PointerEvent<HTMLDivElement>,
  element: HTMLDivElement | null,
  sourceWidth: number,
  sourceHeight: number,
): SourcePoint | null => {
  if (!element) {
    return null
  }

  const rect = element.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) {
    return null
  }

  return {
    x: clamp(((event.clientX - rect.left) / rect.width) * sourceWidth, 0, sourceWidth),
    y: clamp(((event.clientY - rect.top) / rect.height) * sourceHeight, 0, sourceHeight),
  }
}

const clampToSelection = (point: SourcePoint, bounds: SelectionBounds): SourcePoint => ({
  x: clamp(point.x, bounds.x, bounds.x + bounds.width),
  y: clamp(point.y, bounds.y, bounds.y + bounds.height),
})

const isInsideSelection = (point: SourcePoint, bounds: SelectionBounds) =>
  point.x >= bounds.x
  && point.x <= bounds.x + bounds.width
  && point.y >= bounds.y
  && point.y <= bounds.y + bounds.height

const buildPendingAnnotationFromGesture = (
  tool: PendingDraftAnnotation['shape'],
  annotations: PendingDraftAnnotation[],
  gesture: GestureState,
  bounds: SelectionBounds,
): PendingDraftAnnotation => {
  const start = clampToSelection(gesture.start, bounds)
  const end = clampToSelection(gesture.current, bounds)
  const localStart = {
    x: start.x - bounds.x,
    y: start.y - bounds.y,
  }
  const localEnd = {
    x: end.x - bounds.x,
    y: end.y - bounds.y,
  }

  if (tool === 'line' || tool === 'arrow') {
    return createPendingDraftAnnotation(tool, annotations, {
      x1: localStart.x,
      y1: localStart.y,
      x2: localEnd.x,
      y2: localEnd.y,
    })
  }

  if (tool === 'text') {
    const x1 = clamp(localStart.x, 0, bounds.width - 12)
    const y1 = clamp(localStart.y, 0, bounds.height - 12)

    return createPendingDraftAnnotation(tool, annotations, {
      x1,
      y1,
      x2: clamp(x1 + 220, x1 + 64, bounds.width),
      y2: clamp(y1 + 72, y1 + 40, bounds.height),
    })
  }

  const x1 = Math.min(localStart.x, localEnd.x)
  const y1 = Math.min(localStart.y, localEnd.y)
  const x2 = Math.max(localStart.x, localEnd.x)
  const y2 = Math.max(localStart.y, localEnd.y)

  return createPendingDraftAnnotation(tool, annotations, {
    x1,
    y1,
    x2: Math.max(x2, x1 + 24),
    y2: Math.max(y2, y1 + 24),
  })
}

const renderAnnotation = (
  annotation: PendingDraftAnnotation,
  selectionBounds: SelectionBounds,
  arrowMarkerId: string,
  options?: {
    active?: boolean
    preview?: boolean
  },
) => {
  const x1 = selectionBounds.x + annotation.x1
  const y1 = selectionBounds.y + annotation.y1
  const x2 = selectionBounds.x + annotation.x2
  const y2 = selectionBounds.y + annotation.y2
  const className = [
    'capture-editor__shape',
    options?.active ? 'is-active' : '',
    options?.preview ? 'is-preview' : '',
  ].filter(Boolean).join(' ')

  if (annotation.shape === 'rectangle') {
    return (
      <g className={className} key={`${annotation.label}-${annotation.x1}-${annotation.y1}`}>
        <rect
          fill="transparent"
          height={y2 - y1}
          rx={12}
          stroke={annotation.color}
          strokeWidth={annotation.stroke_width}
          width={x2 - x1}
          x={x1}
          y={y1}
        />
        <text className="capture-editor__label" x={x1 + 10} y={y1 + 22}>{annotation.label}</text>
      </g>
    )
  }

  if (annotation.shape === 'ellipse') {
    return (
      <g className={className} key={`${annotation.label}-${annotation.x1}-${annotation.y1}`}>
        <ellipse
          cx={(x1 + x2) / 2}
          cy={(y1 + y2) / 2}
          fill="transparent"
          rx={(x2 - x1) / 2}
          ry={(y2 - y1) / 2}
          stroke={annotation.color}
          strokeWidth={annotation.stroke_width}
        />
        <text className="capture-editor__label" x={x1 + 10} y={y1 + 22}>{annotation.label}</text>
      </g>
    )
  }

  if (annotation.shape === 'text') {
    return (
      <g className={className} key={`${annotation.label}-${annotation.x1}-${annotation.y1}`}>
        <rect
          fill="rgba(255,255,255,0.88)"
          height={Math.max(y2 - y1, 44)}
          rx={14}
          stroke={annotation.color}
          strokeWidth={1.8}
          width={Math.max(x2 - x1, 100)}
          x={x1}
          y={y1}
        />
        <text className="capture-editor__label" x={x1 + 12} y={y1 + 22}>{annotation.label}</text>
        <text className="capture-editor__text" x={x1 + 12} y={y1 + 42}>{annotation.text ?? '注释'}</text>
      </g>
    )
  }

  return (
    <g className={className} key={`${annotation.label}-${annotation.x1}-${annotation.y1}`}>
      <line
        markerEnd={annotation.shape === 'arrow' ? `url(#${arrowMarkerId})` : undefined}
        stroke={annotation.color}
        strokeLinecap="round"
        strokeWidth={annotation.stroke_width}
        x1={x1}
        x2={x2}
        y1={y1}
        y2={y2}
      />
      <text className="capture-editor__label" x={x1 + 10} y={y1 - 8}>{annotation.label}</text>
    </g>
  )
}

export const CaptureEditorSurface = ({
  activeAnnotationIndex,
  allowCrop = false,
  annotations,
  disabled = false,
  imageAlt,
  imageUrl,
  onActiveAnnotationIndexChange,
  onAnnotationsChange,
  onSelectionAnnotationsCleared,
  onSelectionChange,
  selection,
  sourceHeight,
  sourceWidth,
}: CaptureEditorSurfaceProps) => {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const arrowMarkerId = useId().replace(/:/g, '_')
  const [tool, setTool] = useState<CaptureEditorTool>(allowCrop ? 'crop' : 'rectangle')
  const [gesture, setGesture] = useState<GestureState | null>(null)
  const effectiveSelection = allowCrop ? selection : fullSelection
  const selectionBounds = useMemo(
    () => effectiveSelection ? toSelectionBounds(effectiveSelection, sourceWidth, sourceHeight) : null,
    [effectiveSelection, sourceHeight, sourceWidth],
  )
  const previewSelection = useMemo(
    () =>
      allowCrop && gesture?.mode === 'crop'
        ? toRatioSelection(gesture.start, gesture.current, sourceWidth, sourceHeight)
        : null,
    [allowCrop, gesture, sourceHeight, sourceWidth],
  )
  const previewSelectionBounds = useMemo(
    () => previewSelection ? toSelectionBounds(previewSelection, sourceWidth, sourceHeight) : null,
    [previewSelection, sourceHeight, sourceWidth],
  )
  const previewAnnotation = useMemo(() => {
    if (gesture?.mode !== 'annotation' || tool === 'crop' || !selectionBounds) {
      return null
    }

    return buildPendingAnnotationFromGesture(tool, annotations, gesture, selectionBounds)
  }, [annotations, gesture, selectionBounds, tool])

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) {
      return
    }

    const point = toSourcePoint(event, viewportRef.current, sourceWidth, sourceHeight)
    if (!point) {
      return
    }

    event.currentTarget.setPointerCapture(event.pointerId)
    onActiveAnnotationIndexChange(null)

    if (tool === 'crop') {
      setGesture({
        mode: 'crop',
        start: point,
        current: point,
      })
      return
    }

    if (!selectionBounds || !isInsideSelection(point, selectionBounds)) {
      return
    }

    setGesture({
      mode: 'annotation',
      start: point,
      current: point,
    })
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!gesture) {
      return
    }

    const point = toSourcePoint(event, viewportRef.current, sourceWidth, sourceHeight)
    if (!point) {
      return
    }

    setGesture({
      ...gesture,
      current: point,
    })
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!gesture) {
      return
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    if (gesture.mode === 'crop') {
      const nextSelection = toRatioSelection(gesture.start, gesture.current, sourceWidth, sourceHeight)
      if (nextSelection) {
        if (annotations.length > 0) {
          onAnnotationsChange([])
          onActiveAnnotationIndexChange(null)
          onSelectionAnnotationsCleared?.()
        }

        onSelectionChange?.(nextSelection)
        setTool('rectangle')
      }

      setGesture(null)
      return
    }

    if (previewAnnotation) {
      const nextAnnotations = [...annotations, previewAnnotation]
      onAnnotationsChange(nextAnnotations)
      onActiveAnnotationIndexChange(nextAnnotations.length - 1)
    }

    setGesture(null)
  }

  const handlePointerCancel = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    setGesture(null)
  }

  const activeSelectionBounds = previewSelectionBounds ?? selectionBounds
  const canDrawAnnotations = !allowCrop || Boolean(selection)
  const tools: CaptureEditorTool[] = allowCrop ? ['crop', ...drawTools] : [...drawTools]

  return (
    <div className={`capture-editor ${allowCrop ? 'is-crop-enabled' : 'is-annotation-only'}`.trim()}>
      <div className="capture-editor__toolbar">
        <div className="capture-editor__tool-list">
          {tools.map((item) => (
            <button
              className={`capture-editor__tool ${tool === item ? 'is-active' : ''}`.trim()}
              disabled={disabled || (item !== 'crop' && !canDrawAnnotations)}
              key={item}
              onClick={() => setTool(item)}
              type="button"
            >
              {item === 'crop' ? '框选' : translateAnnotationShape(item)}
            </button>
          ))}
        </div>
        <p className="capture-editor__toolbar-hint">
          {tool === 'crop'
            ? '先拖拽选出本次要保存的画面，再切换到标注工具。'
            : allowCrop
              ? '标注会跟随当前选区一起保存。重新框选会清空当前标注。'
              : '直接在图像上拖拽创建标注。'}
        </p>
      </div>

      <div
        className="capture-editor__viewport"
        onPointerCancel={handlePointerCancel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        ref={viewportRef}
        role="presentation"
        style={{
          '--capture-editor-aspect': `${sourceWidth} / ${sourceHeight}`,
        } as CSSProperties}
      >
        <img
          alt={imageAlt}
          className="capture-editor__image"
          draggable={false}
          src={imageUrl}
        />
        {allowCrop ? <div className="capture-editor__wash" /> : null}

        {activeSelectionBounds && allowCrop ? (
          <div
            className="capture-editor__selection"
            style={{
              left: `${(activeSelectionBounds.x / sourceWidth) * 100}%`,
              top: `${(activeSelectionBounds.y / sourceHeight) * 100}%`,
              width: `${(activeSelectionBounds.width / sourceWidth) * 100}%`,
              height: `${(activeSelectionBounds.height / sourceHeight) * 100}%`,
            }}
          />
        ) : null}

        <svg
          className="capture-editor__overlay"
          preserveAspectRatio="xMidYMid meet"
          viewBox={`0 0 ${sourceWidth} ${sourceHeight}`}
        >
          <defs>
            <marker
              id={arrowMarkerId}
              markerHeight="7"
              markerWidth="7"
              orient="auto-start-reverse"
              refX="4"
              refY="3.5"
              viewBox="0 0 7 7"
            >
              <path d="M0,0 L7,3.5 L0,7 z" fill="#9c3d30" />
            </marker>
          </defs>
          {selectionBounds ? annotations.map((annotation, index) =>
            renderAnnotation(annotation, selectionBounds, arrowMarkerId, {
              active: index === activeAnnotationIndex,
            })) : null}
          {selectionBounds && previewAnnotation
            ? renderAnnotation(previewAnnotation, selectionBounds, arrowMarkerId, { preview: true })
            : null}
        </svg>

        {allowCrop && !selection ? (
          <div className="capture-editor__hint-card">
            <strong>先框选本次截图范围</strong>
            <p>框选完成后会自动切到矩形工具，你可以继续添加矩形、圆形、线段、箭头或文本标注。</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
