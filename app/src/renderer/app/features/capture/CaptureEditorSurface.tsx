import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import type { CaptureSelection } from '@shared/capture/contracts'
import {
  decodeBrushGeometry,
  encodeBrushGeometry,
  getFibRetracementLevels,
  isPointNearAnnotation,
  normalizeAnnotationBounds,
} from '@app/features/annotation/annotation-geometry'
import type { PendingDraftAnnotation } from '@app/features/annotation/annotation-types'
import { createPendingDraftAnnotation } from '@app/features/annotation/annotation-utils'
import { translateAnnotationShape } from '@app/ui/display-text'

const fullSelection: CaptureSelection = {
  x: 0,
  y: 0,
  width: 1,
  height: 1,
}

const drawTools = ['rectangle', 'ellipse', 'line', 'arrow', 'fib_retracement', 'brush', 'text'] as const
const colorPalette = ['#355c5a', '#bc7f4a', '#5a6988', '#9c3d30', '#246caa', '#8b5cf6', '#d4a72c', '#f6f4ee']

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

type GestureState =
  | {
    mode: 'crop'
    start: SourcePoint
    current: SourcePoint
  }
  | {
    mode: 'annotation'
    start: SourcePoint
    current: SourcePoint
    points: SourcePoint[]
  }

type HistoryState = {
  past: PendingDraftAnnotation[][]
  present: PendingDraftAnnotation[]
  future: PendingDraftAnnotation[][]
}

type CaptureEditorSurfaceProps = {
  activeAnnotationIndex: number | null
  allowCrop?: boolean
  annotations: PendingDraftAnnotation[]
  candidateAnnotations?: PendingDraftAnnotation[]
  disabled?: boolean
  imageAlt: string
  imageUrl: string
  onActiveAnnotationIndexChange: (index: number | null) => void
  onAnnotationsChange: (annotations: PendingDraftAnnotation[]) => void
  onSelectionAnnotationsCleared?: () => void
  onSelectionChange?: (selection: CaptureSelection | null) => void
  revisionKey?: string
  selection?: CaptureSelection | null
  sourceHeight: number
  sourceWidth: number
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const cloneAnnotations = (annotations: PendingDraftAnnotation[]) =>
  annotations.map((annotation) => ({ ...annotation }))

const snapshotAnnotations = (annotations: PendingDraftAnnotation[]) =>
  JSON.stringify(annotations.map((annotation) => ({
    shape: annotation.shape,
    label: annotation.label,
    title: annotation.title,
    color: annotation.color,
    x1: annotation.x1,
    y1: annotation.y1,
    x2: annotation.x2,
    y2: annotation.y2,
    text: annotation.text,
    note_md: annotation.note_md,
    add_to_memory: annotation.add_to_memory,
    stroke_width: annotation.stroke_width,
  })))

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
  event: ReactPointerEvent<HTMLDivElement>,
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

const distanceBetween = (left: SourcePoint, right: SourcePoint) => Math.hypot(left.x - right.x, left.y - right.y)

const findHitAnnotationIndex = (
  annotations: PendingDraftAnnotation[],
  point: SourcePoint,
  bounds: SelectionBounds,
) => {
  const localPoint = {
    x: point.x - bounds.x,
    y: point.y - bounds.y,
  }

  for (let index = annotations.length - 1; index >= 0; index -= 1) {
    if (isPointNearAnnotation(annotations[index], localPoint)) {
      return index
    }
  }

  return null
}

const buildPendingAnnotationFromGesture = (
  tool: PendingDraftAnnotation['shape'],
  annotations: PendingDraftAnnotation[],
  gesture: Extract<GestureState, { mode: 'annotation' }>,
  bounds: SelectionBounds,
  color: string,
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

  if (tool === 'brush') {
    const localPoints = gesture.points
      .map((point) => clampToSelection(point, bounds))
      .map((point) => ({
        x: point.x - bounds.x,
        y: point.y - bounds.y,
      }))

    const brushBounds = normalizeAnnotationBounds({
      x1: Math.min(...localPoints.map((point) => point.x)),
      y1: Math.min(...localPoints.map((point) => point.y)),
      x2: Math.max(...localPoints.map((point) => point.x)),
      y2: Math.max(...localPoints.map((point) => point.y)),
    })

    return createPendingDraftAnnotation(tool, annotations, brushBounds, {
      color,
      stroke_width: 4,
      text: encodeBrushGeometry(localPoints),
    })
  }

  if (tool === 'line' || tool === 'arrow') {
    return createPendingDraftAnnotation(tool, annotations, {
      x1: localStart.x,
      y1: localStart.y,
      x2: localEnd.x,
      y2: localEnd.y,
    }, {
      color,
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
    }, {
      color,
    })
  }

  const normalized = normalizeAnnotationBounds({
    x1: localStart.x,
    y1: localStart.y,
    x2: localEnd.x,
    y2: localEnd.y,
  })

  return createPendingDraftAnnotation(tool, annotations, {
    x1: normalized.x1,
    y1: normalized.y1,
    x2: Math.max(normalized.x2, normalized.x1 + 24),
    y2: Math.max(normalized.y2, normalized.y1 + 24),
  }, {
    color,
  })
}

const renderArrowHead = (
  color: string,
  strokeWidth: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) => {
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const headLength = 14
  return (
    <>
      <line
        stroke={color}
        strokeLinecap="round"
        strokeWidth={strokeWidth}
        x1={x2}
        x2={x2 - headLength * Math.cos(angle - Math.PI / 6)}
        y1={y2}
        y2={y2 - headLength * Math.sin(angle - Math.PI / 6)}
      />
      <line
        stroke={color}
        strokeLinecap="round"
        strokeWidth={strokeWidth}
        x1={x2}
        x2={x2 - headLength * Math.cos(angle + Math.PI / 6)}
        y1={y2}
        y2={y2 - headLength * Math.sin(angle + Math.PI / 6)}
      />
    </>
  )
}

const renderAnnotation = (
  annotation: PendingDraftAnnotation,
  selectionBounds: SelectionBounds,
  options?: {
    active?: boolean
    candidate?: boolean
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
    options?.candidate ? 'is-candidate' : '',
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

  if (annotation.shape === 'fib_retracement') {
    const bounds = normalizeAnnotationBounds({ x1, y1, x2, y2 })
    const levels = getFibRetracementLevels(bounds.y1, bounds.y2)
    return (
      <g className={className} key={`${annotation.label}-${annotation.x1}-${annotation.y1}`}>
        <rect
          fill="transparent"
          height={bounds.y2 - bounds.y1}
          stroke={annotation.color}
          strokeDasharray="8 8"
          strokeOpacity="0.28"
          strokeWidth={1.3}
          width={bounds.x2 - bounds.x1}
          x={bounds.x1}
          y={bounds.y1}
        />
        {levels.map((level, index) => (
          <g key={`${annotation.label}-fib-${level.ratio}`}>
            <line
              opacity={index === 0 || index === levels.length - 1 ? 0.94 : 0.72}
              stroke={annotation.color}
              strokeWidth={annotation.stroke_width}
              x1={bounds.x1}
              x2={bounds.x2}
              y1={level.y}
              y2={level.y}
            />
            <text className="capture-editor__fib-label" x={bounds.x2 + 10} y={level.y + 4}>
              {Math.round(level.ratio * 100)}%
            </text>
          </g>
        ))}
        <text className="capture-editor__label" x={bounds.x1 + 10} y={bounds.y1 - 8}>{annotation.label}</text>
      </g>
    )
  }

  if (annotation.shape === 'brush') {
    const points = decodeBrushGeometry(annotation.text)
    return (
      <g className={className} key={`${annotation.label}-${annotation.x1}-${annotation.y1}`}>
        <polyline
          fill="none"
          points={points.map((point) => `${selectionBounds.x + point.x},${selectionBounds.y + point.y}`).join(' ')}
          stroke={annotation.color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={annotation.stroke_width}
        />
        <text className="capture-editor__label" x={x1 + 10} y={y1 - 8}>{annotation.label}</text>
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

  if (annotation.shape === 'arrow') {
    return (
      <g className={className} key={`${annotation.label}-${annotation.x1}-${annotation.y1}`}>
        <line
          stroke={annotation.color}
          strokeLinecap="round"
          strokeWidth={annotation.stroke_width}
          x1={x1}
          x2={x2}
          y1={y1}
          y2={y2}
        />
        {renderArrowHead(annotation.color, annotation.stroke_width, x1, y1, x2, y2)}
        <text className="capture-editor__label" x={x1 + 10} y={y1 - 8}>{annotation.label}</text>
      </g>
    )
  }

  return (
    <g className={className} key={`${annotation.label}-${annotation.x1}-${annotation.y1}`}>
      <line
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

const defaultColorForTool = (tool: CaptureEditorTool) => {
  if (tool === 'crop') {
    return colorPalette[0]
  }

  return createPendingDraftAnnotation(tool, [], { x1: 0, y1: 0, x2: 24, y2: 24 }).color
}

const nextHistoryState = (
  history: HistoryState,
  annotations: PendingDraftAnnotation[],
) => {
  if (snapshotAnnotations(history.present) === snapshotAnnotations(annotations)) {
    return history
  }

  return {
    past: [...history.past, cloneAnnotations(history.present)].slice(-80),
    present: cloneAnnotations(annotations),
    future: [],
  }
}

export const CaptureEditorSurface = ({
  activeAnnotationIndex,
  allowCrop = false,
  annotations,
  candidateAnnotations = [],
  disabled = false,
  imageAlt,
  imageUrl,
  onActiveAnnotationIndexChange,
  onAnnotationsChange,
  onSelectionAnnotationsCleared,
  onSelectionChange,
  revisionKey,
  selection,
  sourceHeight,
  sourceWidth,
}: CaptureEditorSurfaceProps) => {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [tool, setTool] = useState<CaptureEditorTool>(allowCrop ? 'crop' : 'rectangle')
  const [gesture, setGesture] = useState<GestureState | null>(null)
  const [zoomPercent, setZoomPercent] = useState(100)
  const [selectedColor, setSelectedColor] = useState(defaultColorForTool(allowCrop ? 'crop' : 'rectangle'))
  const [history, setHistory] = useState<HistoryState>(() => ({
    past: [],
    present: cloneAnnotations(annotations),
    future: [],
  }))

  const effectiveSelection = allowCrop ? selection : fullSelection
  const selectionBounds = useMemo(
    () => effectiveSelection ? toSelectionBounds(effectiveSelection, sourceWidth, sourceHeight) : null,
    [effectiveSelection, sourceHeight, sourceWidth],
  )
  const workingAnnotations = history.present
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

    return buildPendingAnnotationFromGesture(tool, workingAnnotations, gesture, selectionBounds, selectedColor)
  }, [gesture, selectionBounds, selectedColor, tool, workingAnnotations])
  const activeAnnotation = activeAnnotationIndex != null ? workingAnnotations[activeAnnotationIndex] ?? null : null
  const canUndo = history.past.length > 0
  const canRedo = history.future.length > 0
  const canDeleteSelection = activeAnnotationIndex != null
  const canDrawAnnotations = !allowCrop || Boolean(selection)
  const tools: CaptureEditorTool[] = allowCrop ? ['crop', ...drawTools] : [...drawTools]
  const canZoomOut = zoomPercent > 60
  const canZoomIn = zoomPercent < 260
  const effectiveRevisionKey = revisionKey ?? `${imageUrl}:${sourceWidth}x${sourceHeight}`

  useEffect(() => {
    setHistory({
      past: [],
      present: cloneAnnotations(annotations),
      future: [],
    })
    onActiveAnnotationIndexChange(null)
    setGesture(null)
  }, [effectiveRevisionKey, onActiveAnnotationIndexChange])

  useEffect(() => {
    if (activeAnnotation?.color) {
      setSelectedColor(activeAnnotation.color)
      return
    }

    setSelectedColor((current) => current || defaultColorForTool(tool))
  }, [activeAnnotation?.color, tool])

  const commitAnnotations = (nextAnnotations: PendingDraftAnnotation[], nextActiveIndex: number | null) => {
    setHistory((current) => nextHistoryState(current, nextAnnotations))
    onAnnotationsChange(nextAnnotations)
    onActiveAnnotationIndexChange(nextActiveIndex)
  }

  const updateZoom = (delta: number) => {
    setZoomPercent((current) => clamp(current + delta, 60, 260))
  }

  const handleUndo = () => {
    setHistory((current) => {
      const previous = current.past.at(-1)
      if (!previous) {
        return current
      }

      const nextState = {
        past: current.past.slice(0, -1),
        present: cloneAnnotations(previous),
        future: [cloneAnnotations(current.present), ...current.future],
      }
      onAnnotationsChange(nextState.present)
      onActiveAnnotationIndexChange(null)
      return nextState
    })
  }

  const handleRedo = () => {
    setHistory((current) => {
      const [next, ...remaining] = current.future
      if (!next) {
        return current
      }

      const nextState = {
        past: [...current.past, cloneAnnotations(current.present)].slice(-80),
        present: cloneAnnotations(next),
        future: remaining,
      }
      onAnnotationsChange(nextState.present)
      onActiveAnnotationIndexChange(null)
      return nextState
    })
  }

  const handleDeleteSelected = () => {
    if (activeAnnotationIndex == null) {
      return
    }

    const nextAnnotations = workingAnnotations.filter((_, index) => index !== activeAnnotationIndex)
    commitAnnotations(nextAnnotations, null)
  }

  const handleColorSelect = (color: string) => {
    setSelectedColor(color)
    if (activeAnnotationIndex == null) {
      return
    }

    const nextAnnotations = workingAnnotations.map((annotation, index) =>
      index === activeAnnotationIndex
        ? { ...annotation, color }
        : annotation)
    commitAnnotations(nextAnnotations, activeAnnotationIndex)
  }

  const handleTextChange = (value: string) => {
    if (!activeAnnotation || activeAnnotation.shape !== 'text' || activeAnnotationIndex == null) {
      return
    }

    const nextAnnotations = workingAnnotations.map((annotation, index) =>
      index === activeAnnotationIndex
        ? { ...annotation, text: value }
        : annotation)
    commitAnnotations(nextAnnotations, activeAnnotationIndex)
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) {
      return
    }

    const point = toSourcePoint(event, viewportRef.current, sourceWidth, sourceHeight)
    if (!point) {
      return
    }

    event.currentTarget.setPointerCapture(event.pointerId)

    if (tool === 'crop') {
      onActiveAnnotationIndexChange(null)
      setGesture({
        mode: 'crop',
        start: point,
        current: point,
      })
      return
    }

    if (!selectionBounds || !isInsideSelection(point, selectionBounds)) {
      onActiveAnnotationIndexChange(null)
      return
    }

    const hitAnnotationIndex = findHitAnnotationIndex(workingAnnotations, point, selectionBounds)
    if (hitAnnotationIndex != null) {
      onActiveAnnotationIndexChange(hitAnnotationIndex)
      return
    }

    onActiveAnnotationIndexChange(null)
    setGesture({
      mode: 'annotation',
      start: point,
      current: point,
      points: [point],
    })
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!gesture) {
      return
    }

    const point = toSourcePoint(event, viewportRef.current, sourceWidth, sourceHeight)
    if (!point) {
      return
    }

    if (gesture.mode === 'annotation' && tool === 'brush') {
      const lastPoint = gesture.points.at(-1)
      setGesture({
        ...gesture,
        current: point,
        points: lastPoint && distanceBetween(lastPoint, point) < 4
          ? gesture.points
          : [...gesture.points, point],
      })
      return
    }

    setGesture({
      ...gesture,
      current: point,
    })
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!gesture) {
      return
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    if (gesture.mode === 'crop') {
      const nextSelection = toRatioSelection(gesture.start, gesture.current, sourceWidth, sourceHeight)
      if (nextSelection) {
        if (workingAnnotations.length > 0) {
          commitAnnotations([], null)
          onSelectionAnnotationsCleared?.()
        }

        onSelectionChange?.(nextSelection)
        setTool('rectangle')
      }

      setGesture(null)
      return
    }

    if (previewAnnotation) {
      const nextAnnotations = [...workingAnnotations, previewAnnotation]
      commitAnnotations(nextAnnotations, nextAnnotations.length - 1)
    }

    setGesture(null)
  }

  const handlePointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    setGesture(null)
  }

  const activeSelectionBounds = previewSelectionBounds ?? selectionBounds

  return (
    <div className={`capture-editor ${allowCrop ? 'is-crop-enabled' : 'is-annotation-only'}`.trim()}>
      <div className="capture-editor__toolbar">
        <div className="capture-editor__toolbar-row">
          <div className="capture-editor__tool-list">
            {tools.map((item) => (
              <button
                className={`capture-editor__tool ${tool === item ? 'is-active' : ''}`.trim()}
                disabled={disabled || (item !== 'crop' && !canDrawAnnotations)}
                key={item}
                onClick={() => {
                  setTool(item)
                  if (item !== 'crop' && activeAnnotation?.shape !== item) {
                    onActiveAnnotationIndexChange(null)
                  }
                }}
                type="button"
              >
                {item === 'crop' ? '框选' : translateAnnotationShape(item)}
              </button>
            ))}
          </div>
          <div className="capture-editor__toolbar-cluster">
            <button className="capture-editor__tool" disabled={!canUndo} onClick={handleUndo} type="button">撤回</button>
            <button className="capture-editor__tool" disabled={!canRedo} onClick={handleRedo} type="button">反撤回</button>
            <button className="capture-editor__tool" disabled={!canDeleteSelection} onClick={handleDeleteSelected} type="button">
              删除所选标注
            </button>
            <div className="capture-editor__zoom-controls">
              <button className="capture-editor__tool" disabled={!canZoomOut} onClick={() => updateZoom(-25)} type="button">缩小</button>
              <button className="capture-editor__tool" onClick={() => setZoomPercent(100)} type="button">适应</button>
              <span className="status-pill">{zoomPercent}%</span>
              <button className="capture-editor__tool" disabled={!canZoomIn} onClick={() => updateZoom(25)} type="button">放大</button>
            </div>
          </div>
        </div>

        <div className="capture-editor__toolbar-row capture-editor__toolbar-row--secondary">
          <div className="capture-editor__swatches" role="group" aria-label="标注颜色">
            {colorPalette.map((color) => (
              <button
                aria-label={`切换为 ${color}`}
                className={`capture-editor__swatch ${selectedColor === color ? 'is-active' : ''}`.trim()}
                key={color}
                onClick={() => handleColorSelect(color)}
                style={{ '--capture-swatch': color } as CSSProperties}
                type="button"
              />
            ))}
          </div>

          {activeAnnotation?.shape === 'text' ? (
            <label className="capture-editor__text-edit">
              <span>当前文本</span>
              <input
                className="inline-input"
                onChange={(event) => handleTextChange(event.target.value)}
                type="text"
                value={activeAnnotation.text ?? ''}
              />
            </label>
          ) : (
            <div className="capture-editor__selection-meta">
              {activeAnnotation ? (
                <>
                  <span className="status-pill">{activeAnnotation.label}</span>
                  <span className="status-pill">{translateAnnotationShape(activeAnnotation.shape)}</span>
                  <span className="status-pill">颜色 {activeAnnotation.color}</span>
                </>
              ) : (
                <span className="status-pill">点现有标注可改颜色、删掉或继续编辑</span>
              )}
            </div>
          )}
        </div>

        <p className="capture-editor__toolbar-hint">
          {tool === 'crop'
            ? '先拖拽框出本次要保存的画面，再切回标注工具。'
            : allowCrop
              ? '双击图片进入这里后再画。颜色、撤回、删除都在这层里完成。'
              : '直接在全屏图上画；画笔、斐波那契、线段、箭头和文本都在这里完成。'}
        </p>
      </div>

      <div
        className="capture-editor__stage"
        onWheel={(event) => {
          if (!event.ctrlKey && !event.metaKey) {
            return
          }
          event.preventDefault()
          updateZoom(event.deltaY > 0 ? -25 : 25)
        }}
      >
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
            width: `${zoomPercent}%`,
            minWidth: zoomPercent > 100 ? `${zoomPercent}%` : '100%',
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
            {selectionBounds ? candidateAnnotations.map((annotation) =>
              renderAnnotation(annotation, selectionBounds, {
                candidate: true,
              })) : null}
            {selectionBounds ? workingAnnotations.map((annotation, index) =>
              renderAnnotation(annotation, selectionBounds, {
                active: index === activeAnnotationIndex,
              })) : null}
            {selectionBounds && previewAnnotation
              ? renderAnnotation(previewAnnotation, selectionBounds, { preview: true })
              : null}
          </svg>

          {allowCrop && !selection ? (
            <div className="capture-editor__hint-card">
              <strong>先框选本次截图范围</strong>
              <p>框选完成后会自动切到矩形工具，你可以继续添加矩形、圆形、线段、箭头、斐波那契、画笔或文本标注。</p>
            </div>
          ) : null}
          {!allowCrop && candidateAnnotations.length > 0 ? (
            <div className="capture-editor__hint-card is-inline">
              <strong>AI 候选已经叠在图上</strong>
              <p>你只需要决定保留、合并还是丢弃，不用再对着长列表看一遍。</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
