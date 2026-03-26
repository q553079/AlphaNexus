import type { PendingSnipAnnotationInput, SaveScreenshotAnnotationsInput } from '@shared/capture/contracts'

export type DraftAnnotation = SaveScreenshotAnnotationsInput['annotations'][number]
export type PendingDraftAnnotation = PendingSnipAnnotationInput
