import { useEffect, useState } from 'react'
import { alphaNexusApi } from '@app/bootstrap/api'
import type { CapturePreferences } from '@shared/capture/contracts'

export const CaptureSettingsPanel = () => {
  const [preferences, setPreferences] = useState<CapturePreferences | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void alphaNexusApi.capture.getPreferences().then(setPreferences)
  }, [])

  if (!preferences) {
    return <div className="empty-state">正在加载截图偏好...</div>
  }

  return (
    <article className="integration-card">
      {status ? <div className="status-inline">{status}</div> : null}
      <label className="field">
        <span>快捷键</span>
        <input
          className="inline-input"
          onChange={(event) => setPreferences((current) => current ? {
            ...current,
            snip_accelerator: event.target.value,
          } : current)}
          value={preferences.snip_accelerator}
        />
      </label>
      <label className="field">
        <span>默认屏幕策略</span>
        <select
          className="session-workbench__trade-select"
          onChange={(event) => setPreferences((current) => current ? {
            ...current,
            display_strategy: event.target.value as CapturePreferences['display_strategy'],
          } : current)}
          value={preferences.display_strategy}
        >
          <option value="cursor-display">跟随鼠标所在屏幕</option>
          <option value="main-window-display">跟随主窗口所在屏幕</option>
        </select>
      </label>
      <div className="integration-card__footer">
        <span className="session-workbench__editor-hint">修改后会在主进程重新注册系统级截图快捷键。</span>
        <button
          className="button is-primary"
          disabled={saving}
          onClick={() => {
            void (async() => {
              try {
                setSaving(true)
                const next = await alphaNexusApi.capture.savePreferences({
                  snip_accelerator: preferences.snip_accelerator,
                  display_strategy: preferences.display_strategy,
                })
                setPreferences(next)
                setStatus('已保存截图偏好。')
              } catch {
                setStatus('保存截图偏好失败。')
              } finally {
                setSaving(false)
              }
            })()
          }}
          type="button"
        >
          {saving ? '保存中...' : '保存截图偏好'}
        </button>
      </div>
    </article>
  )
}
