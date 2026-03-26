import { useEffect, useMemo, useState } from 'react'
import { alphaNexusApi } from '@app/bootstrap/api'
import { AIProviderCard } from '@app/features/integrations/AIProviderCard'
import { presentProvider, sortProviders, toSaveInput, type ProviderPresentation } from '@app/features/integrations/provider-catalog'

export const AIProviderList = () => {
  const [providers, setProviders] = useState<ProviderPresentation[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const load = async() => {
      const configs = await alphaNexusApi.ai.listProviders()
      if (!active) {
        return
      }

      setProviders(sortProviders(configs.map(presentProvider)))
      setLoading(false)
    }

    void load()

    return () => {
      active = false
    }
  }, [])

  const enabledCount = useMemo(() => providers.filter((provider) => provider.config.enabled).length, [providers])

  const handleSave = async(provider: ProviderPresentation) => {
    setSavingId(provider.id)
    setStatus(`正在保存 ${provider.name}...`)

    try {
      const nextConfigs = await alphaNexusApi.ai.saveProviderConfig(toSaveInput(provider))
      setProviders(sortProviders(nextConfigs.map(presentProvider)))
      setStatus(`已保存 ${provider.name}`)
    } catch {
      setStatus(`无法保存 ${provider.name}`)
    } finally {
      setSavingId(null)
    }
  }

  if (loading) {
    return <div className="empty-state">正在加载 AI 提供方设置...</div>
  }

  return (
    <div className="stack">
      <div className="section-meta">
        <strong>已启用提供方：{enabledCount} / {providers.length}</strong>
        <p>密钥不进入仓库。这个页面会保存本地启用状态、模型、可选基础 URL，以及 OpenAI-compatible 第三方 provider 的本地 key。</p>
      </div>

      {status ? <div className="status-inline">{status}</div> : null}

      <div className="compact-list">
        {providers.map((provider) => (
          <AIProviderCard
            key={provider.id}
            onSave={handleSave}
            provider={provider}
            saving={savingId === provider.id}
          />
        ))}
      </div>
    </div>
  )
}
