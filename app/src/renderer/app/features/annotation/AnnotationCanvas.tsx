import { useMemo, useState } from 'react'
import { SectionCard } from '@app/components/SectionCard'
import { createDraftAnnotation } from '@app/features/annotation/annotation-utils'
import { translateAnnotationShape } from '@app/ui/display-text'
import type { DraftAnnotation } from '@app/features/annotation/annotation-types'
import type { ScreenshotRecord } from '@shared/contracts/content'

const tools = ['rectangle', 'ellipse', 'line', 'arrow', 'text'] as const

type AnnotationCanvasProps = {
  screenshot: ScreenshotRecord | null
  annotations: DraftAnnotation[]
  onChange: (annotations: DraftAnnotation[]) => void
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export const AnnotationCanvas = ({ screenshot, annotations, onChange }: AnnotationCanvasProps) => {
  const [tool, setTool] = useState<(typeof tools)[number]>('rectangle')

  const viewBox = useMemo(() => {
    if (!screenshot) {
      return '0 0 1600 900'
    }

    return `0 0 ${screenshot.width} ${screenshot.height}`
  }, [screenshot])

  const handleSurfaceClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!screenshot) {
      return
    }

    const rect = event.currentTarget.getBoundingClientRect()
    const x = clamp(((event.clientX - rect.left) / rect.width) * screenshot.width, 24, screenshot.width - 220)
    const y = clamp(((event.clientY - rect.top) / rect.height) * screenshot.height, 24, screenshot.height - 120)
    const next = createDraftAnnotation(tool, screenshot.id, annotations, x, y)
    onChange([...annotations, next])
  }

  return (
    <SectionCard
      actions={(
        <div className="tab-strip">
          {tools.map((item) => (
            <button
              key={item}
              className={`tab-button ${tool === item ? 'is-active' : ''}`.trim()}
              onClick={() => setTool(item)}
              type="button"
            >
              {translateAnnotationShape(item)}
            </button>
          ))}
          <button
            className="tab-button"
            onClick={() => onChange([])}
            type="button"
          >
            清空
          </button>
        </div>
      )}
      subtitle="点击图表即可落一个带自动编号的新标注。"
      title="图像 / 内容画布"
    >
      {screenshot ? (
        <div
          className="annotation-surface"
          onClick={handleSurfaceClick}
          onKeyDown={() => undefined}
          role="presentation"
        >
          <img
            alt={screenshot.caption ?? '已选截图'}
            className="annotation-surface__image"
            src={screenshot.asset_url}
          />
          <svg
            className="annotation-surface__overlay"
            preserveAspectRatio="xMidYMid meet"
            viewBox={viewBox}
          >
            <defs>
              <marker
                id="arrow-head"
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
            {annotations.map((annotation) => {
              if (annotation.shape === 'rectangle') {
                return (
                  <g key={annotation.label}>
                    <rect
                      fill="transparent"
                      height={annotation.y2 - annotation.y1}
                      stroke={annotation.color}
                      strokeWidth={annotation.stroke_width}
                      width={annotation.x2 - annotation.x1}
                      x={annotation.x1}
                      y={annotation.y1}
                    />
                    <text className="annotation-label" x={annotation.x1 + 8} y={annotation.y1 + 18}>{annotation.label}</text>
                  </g>
                )
              }

              if (annotation.shape === 'ellipse') {
                return (
                  <g key={annotation.label}>
                    <ellipse
                      cx={(annotation.x1 + annotation.x2) / 2}
                      cy={(annotation.y1 + annotation.y2) / 2}
                      fill="transparent"
                      rx={(annotation.x2 - annotation.x1) / 2}
                      ry={(annotation.y2 - annotation.y1) / 2}
                      stroke={annotation.color}
                      strokeWidth={annotation.stroke_width}
                    />
                    <text className="annotation-label" x={annotation.x1 + 8} y={annotation.y1 + 18}>{annotation.label}</text>
                  </g>
                )
              }

              if (annotation.shape === 'text') {
                return (
                  <g key={annotation.label}>
                    <rect
                      fill="rgba(255,255,255,0.82)"
                      height={44}
                      rx={12}
                      stroke={annotation.color}
                      strokeWidth={1.6}
                      width={annotation.x2 - annotation.x1}
                      x={annotation.x1}
                      y={annotation.y1}
                    />
                    <text className="annotation-label" x={annotation.x1 + 12} y={annotation.y1 + 18}>{annotation.label}</text>
                    <text className="annotation-text" x={annotation.x1 + 12} y={annotation.y1 + 34}>{annotation.text ?? '注释'}</text>
                  </g>
                )
              }

              return (
                <g key={annotation.label}>
                  <line
                    markerEnd={annotation.shape === 'arrow' ? 'url(#arrow-head)' : undefined}
                    stroke={annotation.color}
                    strokeLinecap="round"
                    strokeWidth={annotation.stroke_width}
                    x1={annotation.x1}
                    x2={annotation.x2}
                    y1={annotation.y1}
                    y2={annotation.y2}
                  />
                  <text className="annotation-label" x={annotation.x1 + 8} y={annotation.y1 - 8}>{annotation.label}</text>
                </g>
              )
            })}
          </svg>
        </div>
      ) : (
        <div className="empty-state">选择或导入一张截图后即可开始标注。</div>
      )}
    </SectionCard>
  )
}
