import { useMemo, useState } from 'react'
import { SectionCard } from '@app/components/SectionCard'
import type { DraftAnnotation } from '@app/features/annotation/annotation-types'
import {
  toPendingDraftAnnotation,
  toScreenshotDraftAnnotation,
} from '@app/features/annotation/annotation-utils'
import { CaptureEditorSurface } from '@app/features/capture/CaptureEditorSurface'
import type { ScreenshotRecord } from '@shared/contracts/content'

type AnnotationCanvasProps = {
  screenshot: ScreenshotRecord | null
  annotations: DraftAnnotation[]
  onChange: (annotations: DraftAnnotation[]) => void
}

export const AnnotationCanvas = ({ screenshot, annotations, onChange }: AnnotationCanvasProps) => {
  const [activeAnnotationIndex, setActiveAnnotationIndex] = useState<number | null>(null)
  const pendingAnnotations = useMemo(
    () => annotations.map(toPendingDraftAnnotation),
    [annotations],
  )
  const handleAnnotationsChange = (nextAnnotations: typeof pendingAnnotations) => {
    if (!screenshot) {
      return
    }

    onChange(nextAnnotations.map((annotation) => toScreenshotDraftAnnotation(screenshot.id, annotation)))
  }

  return (
    <SectionCard
      subtitle="直接在图表上拖拽创建矩形、圆形、线段、箭头或文本标注。"
      title="图像 / 内容画布"
    >
      {screenshot ? (
        <CaptureEditorSurface
          activeAnnotationIndex={activeAnnotationIndex}
          annotations={pendingAnnotations}
          imageAlt={screenshot.caption ?? '已选截图'}
          imageUrl={screenshot.asset_url}
          onActiveAnnotationIndexChange={setActiveAnnotationIndex}
          onAnnotationsChange={handleAnnotationsChange}
          selection={null}
          sourceHeight={screenshot.height}
          sourceWidth={screenshot.width}
        />
      ) : (
        <div className="empty-state">选择或导入一张截图后即可开始标注。</div>
      )}
    </SectionCard>
  )
}
