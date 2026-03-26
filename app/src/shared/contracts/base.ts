import { z } from 'zod'

export const SchemaVersionSchema = z.literal(1)
export const IsoDateTimeSchema = z.string().datetime({ offset: true })
export const EntityIdSchema = z.string().min(1)

export const AuditFieldsSchema = z.object({
  id: EntityIdSchema,
  schema_version: SchemaVersionSchema,
  created_at: IsoDateTimeSchema,
  updated_at: IsoDateTimeSchema.optional(),
  deleted_at: IsoDateTimeSchema.nullable().optional(),
})

export type AuditFields = z.infer<typeof AuditFieldsSchema>
