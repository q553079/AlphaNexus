import { useEffect, useState } from 'react'
import { translateAnnotationSemantic } from '@app/ui/display-text'
import type { AnnotationRecord } from '@shared/contracts/content'

type AnnotationMetadataEditorProps = {
  annotation: AnnotationRecord | null
  busy: boolean
  onDelete: (annotationId: string) => void
  onSave: (input: {
    annotation_id: string
    label: string
    title: string
    semantic_type: AnnotationRecord['semantic_type']
    text: string | null
    note_md: string
    add_to_memory: boolean
  }) => void
}

const semanticOptions: Array<NonNullable<AnnotationRecord['semantic_type']>> = [
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
]

export const AnnotationMetadataEditor = ({
  annotation,
  busy,
  onDelete,
  onSave,
}: AnnotationMetadataEditorProps) => {
  const [label, setLabel] = useState('')
  const [title, setTitle] = useState('')
  const [semanticType, setSemanticType] = useState<AnnotationRecord['semantic_type']>(null)
  const [text, setText] = useState('')
  const [noteMd, setNoteMd] = useState('')
  const [addToMemory, setAddToMemory] = useState(false)

  useEffect(() => {
    setLabel(annotation?.label ?? '')
    setTitle(annotation?.title ?? '')
    setSemanticType(annotation?.semantic_type ?? null)
    setText(annotation?.text ?? '')
    setNoteMd(annotation?.note_md ?? '')
    setAddToMemory(annotation?.add_to_memory ?? false)
  }, [annotation])

  if (!annotation) {
    return <p className="empty-state">选择一个正式标注后，可以在这里补充标题、语义、备注和记忆候选状态。</p>
  }

  return (
    <div className="session-workbench__editor">
      <div className="knowledge-shell__grid">
        <label className="field">
          <span>编号</span>
          <input
            className="inline-input"
            disabled={busy}
            onChange={(event) => setLabel(event.target.value)}
            value={label}
          />
        </label>
        <label className="field">
          <span>标题</span>
          <input
            className="inline-input"
            disabled={busy}
            onChange={(event) => setTitle(event.target.value)}
            value={title}
          />
        </label>
      </div>

      <label className="field">
        <span>语义类型</span>
        <select
          className="inline-input"
          disabled={busy}
          onChange={(event) => setSemanticType(event.target.value ? event.target.value as AnnotationRecord['semantic_type'] : null)}
          value={semanticType ?? ''}
        >
          <option value="">未指定</option>
          {semanticOptions.map((option) => (
            <option key={option} value={option}>{translateAnnotationSemantic(option)}</option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>文本</span>
        <input
          className="inline-input"
          disabled={busy}
          onChange={(event) => setText(event.target.value)}
          value={text}
        />
      </label>

      <label className="field">
        <span>备注</span>
        <textarea
          className="inline-input session-workbench__textarea"
          disabled={busy}
          onChange={(event) => setNoteMd(event.target.value)}
          rows={5}
          value={noteMd}
        />
      </label>

      <label className="field field--inline">
        <input
          checked={addToMemory}
          disabled={busy}
          onChange={(event) => setAddToMemory(event.target.checked)}
          type="checkbox"
        />
        <span>升级为记忆候选</span>
      </label>

      <div className="action-row">
        <button
          className="button is-primary"
          disabled={busy || !label.trim() || !title.trim()}
          onClick={() => onSave({
            annotation_id: annotation.id,
            label: label.trim(),
            title: title.trim(),
            semantic_type: semanticType,
            text: text.trim() || null,
            note_md: noteMd,
            add_to_memory: addToMemory,
          })}
          type="button"
        >
          保存标注元数据
        </button>
        <button
          className="button is-ghost"
          disabled={busy}
          onClick={() => onDelete(annotation.id)}
          type="button"
        >
          删除当前标注
        </button>
      </div>
    </div>
  )
}
