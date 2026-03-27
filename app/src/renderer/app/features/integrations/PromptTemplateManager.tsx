import { useEffect, useState } from 'react'
import { alphaNexusApi } from '@app/bootstrap/api'
import type { PromptTemplate } from '@shared/ai/contracts'

export const PromptTemplateManager = () => {
  const [templates, setTemplates] = useState<PromptTemplate[]>([])
  const [savingId, setSavingId] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    void alphaNexusApi.ai.listPromptTemplates().then(setTemplates)
  }, [])

  return (
    <div className="compact-list">
      {status ? <div className="status-inline">{status}</div> : null}
      {templates.map((template) => (
        <PromptTemplateCard
          key={template.template_id}
          onSave={async(runtimeNotes) => {
            setSavingId(template.template_id)
            setStatus(`正在保存 ${template.label}...`)
            try {
              const nextTemplates = await alphaNexusApi.ai.savePromptTemplate({
                template_id: template.template_id,
                runtime_notes: runtimeNotes,
              })
              setTemplates(nextTemplates)
              setStatus(`已保存 ${template.label}`)
            } catch {
              setStatus(`无法保存 ${template.label}`)
            } finally {
              setSavingId(null)
            }
          }}
          saving={savingId === template.template_id}
          template={template}
        />
      ))}
    </div>
  )
}

const PromptTemplateCard = (props: {
  onSave: (runtimeNotes: string) => Promise<void>
  saving: boolean
  template: PromptTemplate
}) => {
  const [draft, setDraft] = useState(props.template.runtime_notes)

  useEffect(() => {
    setDraft(props.template.runtime_notes)
  }, [props.template.runtime_notes])

  return (
    <article className="integration-card">
      <div className="integration-card__header">
        <div>
          <h3>{props.template.label}</h3>
          <p>{props.template.template_id}</p>
        </div>
        <span className="status-pill">schema v{props.template.schema_version}</span>
      </div>
      <p className="integration-card__description">{props.template.output_contract_summary}</p>
      <label className="field">
        <span>运行时附加说明</span>
        <textarea
          className="inline-input session-workbench__textarea"
          onChange={(event) => setDraft(event.target.value)}
          placeholder="这里写 provider 无关的补充约束，例如更偏保守、强调不要凭空补图表事实。"
          rows={5}
          value={draft}
        />
      </label>
      <div className="integration-card__footer">
        <span className="status-pill">集中模板管理</span>
        <button className="button is-primary" disabled={props.saving} onClick={() => void props.onSave(draft)} type="button">
          {props.saving ? '保存中...' : '保存模板说明'}
        </button>
      </div>
    </article>
  )
}
