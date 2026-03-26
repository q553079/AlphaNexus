import type { DraftAnnotation } from '@app/features/annotation/annotation-types'
import type { AnnotationInspectorItem, MarketAnchorStatus, MarketAnchorView } from './types'

const toRounded = (value: number) => Math.round(value * 100) / 100

export const buildAnnotationKey = (annotation: DraftAnnotation) =>
  [
    annotation.screenshot_id,
    annotation.label ?? 'annotation',
    toRounded(annotation.x1),
    toRounded(annotation.y1),
    toRounded(annotation.x2),
    toRounded(annotation.y2),
  ].join(':')

const semanticFromShape = (shape: DraftAnnotation['shape']) => {
  if (shape === 'rectangle' || shape === 'ellipse') {
    return 'zone'
  }
  if (shape === 'line') {
    return 'level'
  }
  if (shape === 'arrow') {
    return 'path'
  }
  return 'note'
}

export const toAnnotationInspectorItems = (annotations: DraftAnnotation[]): AnnotationInspectorItem[] =>
  annotations.map((annotation, index) => ({
    key: buildAnnotationKey(annotation),
    label: annotation.label || `A${index + 1}`,
    semantic_type: semanticFromShape(annotation.shape),
    annotation,
  }))

export const adoptAnchor = (
  anchors: MarketAnchorView[],
  item: AnnotationInspectorItem,
  nowIso: string,
): { anchors: MarketAnchorView[]; created: boolean } => {
  const existing = anchors.find((anchor) => anchor.source_annotation_key === item.key)
  if (existing) {
    return {
      anchors: anchors.map((anchor) => anchor.id === existing.id
        ? { ...anchor, status: 'active', updated_at: nowIso }
        : anchor),
      created: false,
    }
  }

  const nextAnchor: MarketAnchorView = {
    id: `anchor_${item.key}`,
    title: `${item.label} Anchor`,
    semantic_type: item.semantic_type,
    status: 'active',
    source_annotation_label: item.label,
    source_annotation_key: item.key,
    created_at: nowIso,
    updated_at: nowIso,
  }
  return {
    anchors: [nextAnchor, ...anchors],
    created: true,
  }
}

export const updateAnchorStatus = (
  anchors: MarketAnchorView[],
  anchorId: string,
  status: MarketAnchorStatus,
  nowIso: string,
) => anchors.map((anchor) => anchor.id === anchorId ? { ...anchor, status, updated_at: nowIso } : anchor)
