import { useMemo, useState } from 'react'
import { defaultMarkdownExportOptions, type MarkdownExportOptions, type SessionExportPayload } from '@shared/export/contracts'
import type { SessionWorkbenchPayload } from '@shared/contracts/workbench'

type SessionExportPanelProps = {
  payload: SessionWorkbenchPayload
  onExport: () => Promise<void> | void
  filePath: string
  markdown: string
}

const buildExportPayload = (payload: SessionWorkbenchPayload): SessionExportPayload => ({
  sessionId: payload.session.id,
  title: payload.session.title,
  notes: payload.panels.my_realtime_view,
  events: payload.events.map((event) => ({
    label: event.title,
    timestamp: event.occurred_at,
    summary: event.summary,
    screenshotIds: event.screenshot_id ? [event.screenshot_id] : [],
  })),
  aiInsights: payload.analysis_cards.map((card) => ({
    providerId: card.ai_run_id,
    summary: card.summary_short,
    detailsMarkdown: card.deep_analysis_md,
  })),
})

export const SessionExportPanel = ({ payload, onExport, filePath, markdown }: SessionExportPanelProps) => {
  const [options, setOptions] = useState<MarkdownExportOptions>(defaultMarkdownExportOptions)

  const exportPayload = useMemo(() => buildExportPayload(payload), [payload])
  const summary = useMemo(() => {
    const aiSection = options.includeAiSummaries ? '包含' : '省略'
    const eventSection = options.includeEvents ? '包含' : '省略'
    const screenshotRefs = exportPayload.events.filter((event) => (event.screenshotIds?.length ?? 0) > 0).length
    return `事件流：${eventSection} · AI 摘要：${aiSection} · 带截图引用的事件：${screenshotRefs}`
  }, [exportPayload.events, options.includeAiSummaries, options.includeEvents])

  return (
    <div className="stack">
      <div className="two-column">
        <div className="compact-list__item">
          <strong>{exportPayload.title}</strong>
          <p>{summary}</p>
        </div>
        <div className="compact-list__item">
          <strong>{exportPayload.aiInsights?.length ?? 0} 个 AI 洞察块</strong>
          <p>{exportPayload.events.length} 条事件已准备好按 Markdown 顺序导出。</p>
        </div>
      </div>

      <div className="checkbox-row">
        <label>
          <input
            checked={options.includeEvents}
            onChange={() => setOptions((current) => ({ ...current, includeEvents: !current.includeEvents }))}
            type="checkbox"
          />
          包含事件流
        </label>
        <label>
          <input
            checked={options.includeAiSummaries}
            onChange={() => setOptions((current) => ({ ...current, includeAiSummaries: !current.includeAiSummaries }))}
            type="checkbox"
          />
          包含 AI 摘要块
        </label>
      </div>

      <div className="action-row">
        <button className="button is-primary" onClick={() => void onExport()} type="button">
          导出当前 Session
        </button>
      </div>

      <p>{filePath || '还没有导出文件。'}</p>
      <pre className="code-preview">{markdown || 'Markdown 预览会显示在这里。'}</pre>
    </div>
  )
}
