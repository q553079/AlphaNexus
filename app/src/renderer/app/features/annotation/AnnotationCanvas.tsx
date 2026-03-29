import { useMemo, useState } from 'react'
import type { DraftAnnotation, PendingDraftAnnotation } from '@app/features/annotation/annotation-types'
import {
  toPendingDraftAnnotation,
  toScreenshotDraftAnnotation,
} from '@app/features/annotation/annotation-utils'
import { CaptureEditorSurface } from '@app/features/capture/CaptureEditorSurface'
import type { ScreenshotRecord } from '@shared/contracts/content'

type AnnotationCanvasProps = {
  screenshot: ScreenshotRecord | null
  annotations: DraftAnnotation[]
  candidateAnnotations?: PendingDraftAnnotation[]
  onChange: (annotations: DraftAnnotation[]) => void
}

export const AnnotationCanvas = ({
  screenshot,
  annotations,
  candidateAnnotations = [],
  onChange,
}: AnnotationCanvasProps) => {
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
    <div className="annotation-canvas">
      {screenshot ? (
        <CaptureEditorSurface
          activeAnnotationIndex={activeAnnotationIndex}
          annotations={pendingAnnotations}
          candidateAnnotations={candidateAnnotations}
          imageAlt={screenshot.caption ?? '已选截图'}
          imageUrl={screenshot.raw_asset_url}
          onActiveAnnotationIndexChange={setActiveAnnotationIndex}
          onAnnotationsChange={handleAnnotationsChange}
          revisionKey={`${screenshot.id}:${screenshot.updated_at}:${screenshot.annotations.length}`}
          selection={null}
          sourceHeight={screenshot.height}
          sourceWidth={screenshot.width}
        />
      ) : (
        <div className="empty-state">选择或导入一张截图后即可开始标注。</div>
      )}
    </div>
  )
}
