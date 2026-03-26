import { useEffect, useMemo, useState } from 'react'
import type { ProviderPresentation } from '@app/features/integrations/provider-catalog'

type AIProviderCardProps = {
  provider: ProviderPresentation
  saving?: boolean
  onSave: (provider: ProviderPresentation) => Promise<void> | void
}

export const AIProviderCard = ({ provider, saving, onSave }: AIProviderCardProps) => {
  const [draft, setDraft] = useState(provider)

  useEffect(() => {
    setDraft(provider)
  }, [provider])

  const configurationDetail = draft.config.configured
    ? draft.config.configured_via === 'env'
      ? '环境变量'
      : draft.config.secret_storage === 'safe-storage'
        ? '本地加密存储'
        : '本地文件存储'
    : '未配置'

  const summary = useMemo(() => {
    const state = draft.config.enabled ? '已启用' : '已暂停'
    const config = draft.config.configured ? `已配置（${configurationDetail}）` : '未配置'
    return `${draft.name} · ${state} · ${config}`
  }, [configurationDetail, draft])

  return (
    <article className="integration-card">
      <div className="integration-card__header">
        <div>
          <h3>{draft.name}</h3>
          <p>{summary}</p>
        </div>
        <button
          className={`button ${draft.config.enabled ? 'is-secondary' : 'is-primary'}`.trim()}
          onClick={() => {
            setDraft((current) => ({
              ...current,
              config: {
                ...current.config,
                enabled: !current.config.enabled,
              },
            }))
          }}
          type="button"
        >
          {draft.config.enabled ? '暂停' : '启用'}
        </button>
      </div>

      <p className="integration-card__description">{draft.description}</p>

      <div className="form-grid">
        <label className="field">
          <span>模型</span>
          <input
            className="inline-input"
            onChange={(event) => {
              const value = event.target.value
              setDraft((current) => ({
                ...current,
                config: {
                  ...current.config,
                  model: value,
                },
              }))
            }}
            type="text"
            value={draft.config.model}
          />
        </label>

        <label className="field">
          <span>{draft.endpoint_label}</span>
          <input
            className="inline-input"
            disabled={!draft.config.supports_base_url_override}
            onChange={(event) => {
              const value = event.target.value
              setDraft((current) => ({
                ...current,
                config: {
                  ...current.config,
                  base_url: value.trim().length > 0 ? value : null,
                },
              }))
            }}
            placeholder={draft.config.provider === 'custom-http' ? 'https://api.example.com/v1' : '由服务方管理'}
            type="text"
            value={draft.config.base_url ?? ''}
          />
        </label>

        {draft.config.supports_local_api_key ? (
          <label className="field field--full">
            <span>第三方 API Key</span>
            <input
              autoComplete="off"
              className="inline-input"
              onChange={(event) => {
                const value = event.target.value
                setDraft((current) => ({
                  ...current,
                  api_key_input: value,
                }))
              }}
              placeholder={draft.config.configured ? '留空则保持当前已保存 key' : 'sk-...'}
              type="password"
              value={draft.api_key_input}
            />
            <small className="field__hint">
              只在本地保存，不会回显明文，也不会进入仓库。系统支持时优先使用本地加密存储。
            </small>
          </label>
        ) : null}
      </div>

      <div className="integration-card__footer">
        <span className="status-pill">{draft.config.provider}</span>
        <button
          className="button is-primary"
          disabled={saving}
          onClick={() => onSave(draft)}
          type="button"
        >
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </article>
  )
}
