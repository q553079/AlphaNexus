import { z } from 'zod'
import type { LocalFirstPaths } from '@main/app-shell/paths'
import { getDatabase } from '@main/db/connection'
import { createScreenshotAnnotation, updateScreenshotAnnotation } from '@main/db/repositories/workbench-mutations'
import { loadScreenshotById } from '@main/db/repositories/workbench-queries'
import { appendSuggestionAuditRecord, findSuggestionAuditItem, type SuggestionAuditKind } from '@main/storage/suggestions'
import {
  type AnnotationRecord,
  AnnotationShapeSchema,
} from '@shared/contracts/content'
import {
  ApplySuggestionActionInputSchema,
  SuggestionActionResultSchema,
  type ApplySuggestionActionInput,
} from '@shared/contracts/workbench'

const SuggestionEvidenceSchema = z.object({
  source: z.enum(['knowledge', 'event', 'annotation', 'anchor']),
  ref_id: z.string().min(1),
  excerpt: z.string(),
})

const InternalAnnotationSuggestionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  title: z.string().min(1),
  semantic_type: z.enum([
    'support',
    'resistance',
    'liquidity',
    'fvg',
    'imbalance',
    'entry',
    'invalidation',
    'target',
    'path',
    'context',
  ]),
  shape: z.enum(['rectangle', 'line', 'arrow']),
  geometry: z.object({
    x1: z.number(),
    y1: z.number(),
    x2: z.number(),
    y2: z.number(),
  }),
  reason_summary: z.string(),
  confidence_score: z.number(),
  evidence: z.array(SuggestionEvidenceSchema),
})

const AnnotationSuggestionAuditPayloadSchema = z.object({
  run_id: z.string().min(1),
  input: z.object({
    session_id: z.string().min(1),
    screenshot_id: z.string().min(1).nullable().optional(),
  }).passthrough(),
  suggestions: z.array(InternalAnnotationSuggestionSchema),
}).passthrough()

type InternalAnnotationSuggestion = z.infer<typeof InternalAnnotationSuggestionSchema>
type InternalAnnotationSuggestionShape = InternalAnnotationSuggestion['shape']
type InternalAnnotationSemanticType = InternalAnnotationSuggestion['semantic_type']

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const suggestionKindToAuditKind = (
  kind: ApplySuggestionActionInput['suggestion_kind'],
): SuggestionAuditKind => {
  if (kind === 'anchor-review') {
    return 'anchor-review'
  }
  return kind
}

const statusFromAction = (action: ApplySuggestionActionInput['action']) => {
  if (action === 'discard') {
    return 'discarded' as const
  }
  if (action === 'merge') {
    return 'merged' as const
  }
  return 'kept' as const
}

const annotationColorBySemantic = (semanticType: InternalAnnotationSemanticType) => {
  if (semanticType === 'support') {
    return '#355c5a'
  }
  if (semanticType === 'resistance' || semanticType === 'invalidation') {
    return '#9c3d30'
  }
  if (semanticType === 'path') {
    return '#bc7f4a'
  }
  return '#54706d'
}

const toAnnotationShape = (shape: InternalAnnotationSuggestionShape): z.infer<typeof AnnotationShapeSchema> =>
  shape === 'rectangle' ? 'rectangle' : shape

const truncate = (value: string, maxLength: number) =>
  value.length <= maxLength ? value : `${value.slice(0, maxLength - 3)}...`

const toFormalAnnotationDraft = (
  screenshotId: string,
  suggestion: InternalAnnotationSuggestion,
): Omit<AnnotationRecord, 'id' | 'schema_version' | 'created_at'> => ({
  screenshot_id: screenshotId,
  shape: toAnnotationShape(suggestion.shape),
  label: truncate(suggestion.label, 32),
  title: truncate(suggestion.title, 120),
  semantic_type: suggestion.semantic_type,
  color: annotationColorBySemantic(suggestion.semantic_type),
  x1: suggestion.geometry.x1,
  y1: suggestion.geometry.y1,
  x2: suggestion.geometry.x2,
  y2: suggestion.geometry.y2,
  text: suggestion.title,
  note_md: suggestion.reason_summary,
  add_to_memory: false,
  stroke_width: 2,
  deleted_at: null,
})

const combineDistinctSegments = (...segments: Array<string | null | undefined>) => {
  const values = segments
    .map((segment) => segment?.trim())
    .filter((segment): segment is string => Boolean(segment))

  return [...new Set(values)].join('\n')
}

const geometryOverlapScore = (
  left: { x1: number, y1: number, x2: number, y2: number },
  right: { x1: number, y1: number, x2: number, y2: number },
) => {
  const leftMinX = Math.min(left.x1, left.x2)
  const leftMaxX = Math.max(left.x1, left.x2)
  const leftMinY = Math.min(left.y1, left.y2)
  const leftMaxY = Math.max(left.y1, left.y2)
  const rightMinX = Math.min(right.x1, right.x2)
  const rightMaxX = Math.max(right.x1, right.x2)
  const rightMinY = Math.min(right.y1, right.y2)
  const rightMaxY = Math.max(right.y1, right.y2)

  const overlapWidth = Math.max(0, Math.min(leftMaxX, rightMaxX) - Math.max(leftMinX, rightMinX))
  const overlapHeight = Math.max(0, Math.min(leftMaxY, rightMaxY) - Math.max(leftMinY, rightMinY))
  if (overlapWidth === 0 || overlapHeight === 0) {
    return 0
  }

  const overlapArea = overlapWidth * overlapHeight
  const leftArea = Math.max(1, (leftMaxX - leftMinX) * (leftMaxY - leftMinY))
  const rightArea = Math.max(1, (rightMaxX - rightMinX) * (rightMaxY - rightMinY))
  return overlapArea / Math.max(leftArea, rightArea)
}

const geometryCenterDistance = (
  left: { x1: number, y1: number, x2: number, y2: number },
  right: { x1: number, y1: number, x2: number, y2: number },
) => {
  const leftCenterX = (left.x1 + left.x2) / 2
  const leftCenterY = (left.y1 + left.y2) / 2
  const rightCenterX = (right.x1 + right.x2) / 2
  const rightCenterY = (right.y1 + right.y2) / 2
  return Math.hypot(leftCenterX - rightCenterX, leftCenterY - rightCenterY)
}

const resolveMergeTarget = (
  annotations: AnnotationRecord[],
  suggestion: InternalAnnotationSuggestion,
  requestedTargetId?: string | null,
) => {
  if (requestedTargetId) {
    return annotations.find((annotation) => annotation.id === requestedTargetId) ?? null
  }

  const evidenceTargetId = suggestion.evidence.find((item) => item.source === 'annotation')?.ref_id
  if (evidenceTargetId) {
    const evidenceTarget = annotations.find((annotation) => annotation.id === evidenceTargetId)
    if (evidenceTarget) {
      return evidenceTarget
    }
  }

  const ranked = annotations
    .map((annotation) => ({
      annotation,
      overlap: geometryOverlapScore(annotation, suggestion.geometry),
      distance: geometryCenterDistance(annotation, suggestion.geometry),
    }))
    .sort((left, right) => {
      if (right.overlap !== left.overlap) {
        return right.overlap - left.overlap
      }
      return left.distance - right.distance
    })

  return ranked[0]?.annotation ?? null
}

const mergeAnnotation = (
  target: AnnotationRecord,
  suggestion: InternalAnnotationSuggestion,
): Pick<AnnotationRecord, 'id' | 'screenshot_id' | 'shape' | 'label' | 'title' | 'semantic_type' | 'color' | 'x1' | 'y1' | 'x2' | 'y2' | 'text' | 'note_md' | 'add_to_memory' | 'stroke_width'> => ({
  id: target.id,
  screenshot_id: target.screenshot_id,
  shape: target.shape,
  label: target.label.includes(suggestion.title)
    ? target.label
    : truncate(`${target.label} / ${suggestion.title}`, 64),
  title: target.title.includes(suggestion.title)
    ? target.title
    : truncate(`${target.title} / ${suggestion.title}`, 120),
  semantic_type: target.semantic_type ?? suggestion.semantic_type,
  color: target.color,
  x1: target.x1,
  y1: target.y1,
  x2: target.x2,
  y2: target.y2,
  text: combineDistinctSegments(target.text, suggestion.title),
  note_md: combineDistinctSegments(target.note_md, suggestion.reason_summary),
  add_to_memory: target.add_to_memory,
  stroke_width: target.stroke_width,
})

const resolveSuggestionAuditSnapshot = async(
  paths: LocalFirstPaths,
  kind: SuggestionAuditKind,
  suggestionId: string,
) => {
  const auditHit = await findSuggestionAuditItem(paths, {
    kind,
    suggestion_id: suggestionId,
  })
  if (!auditHit) {
    return null
  }

  return {
    audit: auditHit.record,
    suggestion_snapshot: auditHit.item,
    source_run_id: isRecord(auditHit.record.payload) && typeof auditHit.record.payload.run_id === 'string'
      ? auditHit.record.payload.run_id
      : null,
  }
}

const resolveAnnotationSuggestionFromAudit = async(
  paths: LocalFirstPaths,
  suggestionId: string,
) => {
  const auditHit = await findSuggestionAuditItem(paths, {
    kind: 'annotation',
    suggestion_id: suggestionId,
  })
  if (!auditHit) {
    throw new Error(`未找到 annotation suggestion ${suggestionId} 的本地审计记录。`)
  }

  const payload = AnnotationSuggestionAuditPayloadSchema.parse(auditHit.record.payload)
  const suggestion = payload.suggestions.find((item) => item.id === suggestionId)
  if (!suggestion) {
    throw new Error(`annotation suggestion ${suggestionId} 的审计快照不完整。`)
  }

  const screenshotId = payload.input.screenshot_id
  if (!screenshotId) {
    throw new Error(`annotation suggestion ${suggestionId} 缺少 screenshot_id，无法落正式 annotation。`)
  }

  return {
    audit: auditHit.record,
    payload,
    suggestion,
    screenshot_id: screenshotId,
  }
}

export const applySuggestionAction = async(
  paths: LocalFirstPaths,
  rawInput: unknown,
) => {
  const input = ApplySuggestionActionInputSchema.parse(rawInput)
  const auditKind = suggestionKindToAuditKind(input.suggestion_kind)
  const status = statusFromAction(input.action)

  if (input.suggestion_kind !== 'annotation') {
    const snapshot = await resolveSuggestionAuditSnapshot(paths, auditKind, input.suggestion_id)
    const actionAudit = await appendSuggestionAuditRecord(paths, {
      kind: auditKind,
      audit_type: 'action',
      session_id: snapshot?.audit.session_id ?? null,
      payload: {
        suggestion_id: input.suggestion_id,
        suggestion_kind: input.suggestion_kind,
        action: input.action,
        status,
        applied_effect: 'audit-only',
        source_audit_id: snapshot?.audit.id ?? null,
        source_run_id: snapshot?.source_run_id ?? null,
        suggestion_snapshot: snapshot?.suggestion_snapshot ?? null,
      },
    })

    return SuggestionActionResultSchema.parse({
      ok: true,
      suggestion_id: input.suggestion_id,
      suggestion_kind: input.suggestion_kind,
      action: input.action,
      status,
      applied_effect: 'audit-only',
      audit_id: actionAudit.id,
      screenshot_id: null,
      annotation_id: null,
      target_annotation_id: input.target_annotation_id ?? null,
    })
  }

  const resolved = await resolveAnnotationSuggestionFromAudit(paths, input.suggestion_id)
  const baseAuditPayload = {
    source_audit_id: resolved.audit.id,
    source_run_id: resolved.payload.run_id,
    suggestion_snapshot: resolved.suggestion,
  }

  if (input.action === 'discard') {
    const actionAudit = await appendSuggestionAuditRecord(paths, {
      kind: 'annotation',
      audit_type: 'action',
      session_id: resolved.audit.session_id,
      payload: {
        ...baseAuditPayload,
        suggestion_id: input.suggestion_id,
        suggestion_kind: input.suggestion_kind,
        action: input.action,
        status,
        applied_effect: 'audit-only',
        screenshot_id: resolved.screenshot_id,
      },
    })

    return SuggestionActionResultSchema.parse({
      ok: true,
      suggestion_id: input.suggestion_id,
      suggestion_kind: input.suggestion_kind,
      action: input.action,
      status,
      applied_effect: 'audit-only',
      audit_id: actionAudit.id,
      screenshot_id: resolved.screenshot_id,
      annotation_id: null,
      target_annotation_id: null,
    })
  }

  const db = await getDatabase(paths)
  const screenshot = loadScreenshotById(db, resolved.screenshot_id)
  let annotationId: string
  let targetAnnotationId: string | null = null
  let appliedEffect: 'created-annotation' | 'merged-annotation' = 'created-annotation'

  if (input.action === 'merge') {
    const target = resolveMergeTarget(screenshot.annotations, resolved.suggestion, input.target_annotation_id ?? null)
    if (target) {
      const merged = mergeAnnotation(target, resolved.suggestion)
      updateScreenshotAnnotation(db, merged)
      annotationId = target.id
      targetAnnotationId = target.id
      appliedEffect = 'merged-annotation'
    } else {
      annotationId = createScreenshotAnnotation(db, toFormalAnnotationDraft(resolved.screenshot_id, resolved.suggestion))
    }
  } else {
    annotationId = createScreenshotAnnotation(db, toFormalAnnotationDraft(resolved.screenshot_id, resolved.suggestion))
  }

  const actionAudit = await appendSuggestionAuditRecord(paths, {
    kind: 'annotation',
    audit_type: 'action',
    session_id: resolved.audit.session_id,
    payload: {
      ...baseAuditPayload,
      suggestion_id: input.suggestion_id,
      suggestion_kind: input.suggestion_kind,
      action: input.action,
      status,
      applied_effect: appliedEffect,
      screenshot_id: resolved.screenshot_id,
      annotation_id: annotationId,
      target_annotation_id: targetAnnotationId,
    },
  })

  return SuggestionActionResultSchema.parse({
    ok: true,
    suggestion_id: input.suggestion_id,
    suggestion_kind: input.suggestion_kind,
    action: input.action,
    status,
    applied_effect: appliedEffect,
    audit_id: actionAudit.id,
    screenshot_id: resolved.screenshot_id,
    annotation_id: annotationId,
    target_annotation_id: targetAnnotationId,
  })
}
