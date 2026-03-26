import { z } from 'zod'
import { AnnotationSchema } from '@shared/contracts/content'
import { SessionWorkbenchPayloadSchema } from '@shared/contracts/workbench'

export const WorkbenchDatasetSchema = SessionWorkbenchPayloadSchema.extend({
  annotations: z.array(AnnotationSchema),
})

export type WorkbenchDataset = z.infer<typeof WorkbenchDatasetSchema>
