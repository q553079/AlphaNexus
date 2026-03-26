import { useEffect, useState } from 'react'
import { alphaNexusApi } from '@app/bootstrap/api'
import { PageHeading } from '@app/components/PageHeading'
import { SectionCard } from '@app/components/SectionCard'
import { SessionExportPanel } from '@app/features/integrations/SessionExportPanel'
import type { SessionWorkbenchPayload } from '@shared/contracts/workbench'

export const ExportsPage = () => {
  const [payload, setPayload] = useState<SessionWorkbenchPayload | null>(null)
  const [markdown, setMarkdown] = useState<string>('')
  const [filePath, setFilePath] = useState<string>('')

  useEffect(() => {
    void alphaNexusApi.workbench.getSession().then(setPayload)
  }, [])

  return (
    <div className="stack">
      <PageHeading
        eyebrow="导出"
        summary="按当前 Session 生成 Markdown 预览与导出文件，保留事件顺序、AI 摘要和用户笔记。"
        title="Markdown 导出"
      />

      <SectionCard title="将当前 Session 导出为 Markdown">
        {payload ? (
          <SessionExportPanel
            filePath={filePath}
            markdown={markdown}
            onExport={async() => {
              const result = await alphaNexusApi.export.sessionMarkdown({ session_id: payload.session.id })
              setMarkdown(result.markdown)
              setFilePath(result.file_path)
            }}
            payload={payload}
          />
        ) : (
          <div className="empty-state">正在加载导出内容...</div>
        )}
      </SectionCard>
    </div>
  )
}
