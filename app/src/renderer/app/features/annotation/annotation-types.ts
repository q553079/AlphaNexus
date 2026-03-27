import type { PendingSnipAnnotationInput, SaveScreenshotAnnotationsInput } from '@shared/capture/contracts'

export type DraftAnnotation = SaveScreenshotAnnotationsInput['annotations'][number] & {
  screenshot_id: string
}
export type PendingDraftAnnotation = PendingSnipAnnotationInput
