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
  const [contractScope, setContractScope] = useState('*')
  const [timeframeScope, setTimeframeScope] = useState('*')
  const [tagsText, setTagsText] = useState('opening-drive, reclaim')
  const [importMode, setImportMode] = useState<IngestKnowledgeSourceInput['import_mode']>('manual')
  const [filePath, setFilePath] = useState('')
  const [content, setContent] = useState(defaultContent)

  const hasContent = content.trim().length > 0
  const hasFilePath = filePath.trim().length > 0
  const parsedTags = tagsText
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)

  const handleSubmit = async() => {
    await onSubmit({
      source_type: sourceType,
      title: title.trim(),
      author: author.trim() || undefined,
      contract_scope: contractScope.trim() || '*',
      timeframe_scope: timeframeScope.trim() || '*',
      tags: parsedTags,
      import_mode: importMode,
      file_path: hasFilePath ? filePath.trim() : undefined,
      content: content.trim(),
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
      <div className="knowledge-shell__grid">
        <label className="field">
          <span>Contract Scope</span>
          <input
            className="inline-input"
            disabled={busy}
            onChange={(event) => setContractScope(event.target.value)}
            placeholder="例如：NQ / ES / *"
            value={contractScope}
          />
        </label>
        <label className="field">
          <span>Timeframe Scope</span>
          <input
            className="inline-input"
            disabled={busy}
            onChange={(event) => setTimeframeScope(event.target.value)}
            placeholder="例如：1m / 5m / *"
            value={timeframeScope}
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
      <div className="knowledge-shell__grid">
        <label className="field">
          <span>Tags</span>
          <input
            className="inline-input"
            disabled={busy}
            onChange={(event) => setTagsText(event.target.value)}
            placeholder="用逗号分隔，例如 opening-drive, reclaim"
            value={tagsText}
          />
        </label>
        <label className="field">
          <span>Import Mode</span>
          <select
            className="inline-input"
            disabled={busy}
            onChange={(event) => setImportMode(event.target.value as IngestKnowledgeSourceInput['import_mode'])}
            value={importMode}
          >
            <option value="manual">manual</option>
            <option value="gemini">gemini</option>
          </select>
        </label>
      </div>
      <label className="field">
        <span>File Path (optional)</span>
        <input
          className="inline-input"
          disabled={busy}
          onChange={(event) => setFilePath(event.target.value)}
          placeholder="例如：D:\\docs\\playbook.md"
          value={filePath}
        />
      </label>
      <label className="field">
        <span>Raw Content</span>
        <textarea
          className="inline-input knowledge-shell__textarea"
          disabled={busy}
          onChange={(event) => setContent(event.target.value)}
          placeholder="可直接粘贴资料内容；如果填写了 File Path，这里可以留空。"
          rows={8}
          value={content}
        />
      </label>
      <div className="action-row">
        <button
          className="button is-primary"
          disabled={busy || !title.trim() || (!hasContent && !hasFilePath)}
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
