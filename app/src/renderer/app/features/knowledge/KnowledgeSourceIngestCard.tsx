import { useState } from 'react'
import type { IngestKnowledgeSourceInput, KnowledgeSourceType } from './types'

type KnowledgeSourceIngestCardProps = {
  busy: boolean
  onSubmit: (input: IngestKnowledgeSourceInput) => Promise<void>
}

const sourceTypeOptions: Array<{ label: string, value: KnowledgeSourceType }> = [
  { label: '书籍', value: 'book' },
  { label: '文章', value: 'article' },
  { label: '课程笔记', value: 'course-note' },
  { label: '用户笔记', value: 'user-note' },
  { label: '复盘沉淀', value: 'review-derived' },
]

const defaultContent = [
  '# 示例资料片段',
  '',
  '- setup: 回踩关键支撑并快速收回',
  '- invalidation: 跌破支撑后反抽失败',
  '- risk-rule: 单次风险不超过账户 1%',
].join('\n')

export const KnowledgeSourceIngestCard = ({ busy, onSubmit }: KnowledgeSourceIngestCardProps) => {
  const [sourceType, setSourceType] = useState<KnowledgeSourceType>('article')
  const [title, setTitle] = useState('盘中规则摘录')
  const [author, setAuthor] = useState('')
  const [content, setContent] = useState(defaultContent)

  const handleSubmit = async() => {
    await onSubmit({
      source_type: sourceType,
      title: title.trim(),
      author: author.trim() || undefined,
      content,
    })
  }

  return (
    <div className="knowledge-shell__card">
      <div className="knowledge-shell__grid">
        <label className="field">
          <span>Source Type</span>
          <select
            className="inline-input"
            disabled={busy}
            onChange={(event) => setSourceType(event.target.value as KnowledgeSourceType)}
            value={sourceType}
          >
            {sourceTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Title</span>
          <input
            className="inline-input"
            disabled={busy}
            onChange={(event) => setTitle(event.target.value)}
            value={title}
          />
        </label>
      </div>
      <label className="field">
        <span>Author (optional)</span>
        <input
          className="inline-input"
          disabled={busy}
          onChange={(event) => setAuthor(event.target.value)}
          placeholder="例如：Mark Douglas"
          value={author}
        />
      </label>
      <label className="field">
        <span>Raw Content</span>
        <textarea
          className="inline-input knowledge-shell__textarea"
          disabled={busy}
          onChange={(event) => setContent(event.target.value)}
          rows={8}
          value={content}
        />
      </label>
      <div className="action-row">
        <button
          className="button is-primary"
          disabled={busy || !title.trim() || !content.trim()}
          onClick={() => {
            void handleSubmit()
          }}
          type="button"
        >
          导入并生成 Draft Cards
        </button>
      </div>
    </div>
  )
}
