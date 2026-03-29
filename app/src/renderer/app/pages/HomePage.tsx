import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { alphaNexusApi } from '@app/bootstrap/api'
import { PageHeading } from '@app/components/PageHeading'
import { SectionCard } from '@app/components/SectionCard'
import { SessionLauncherForm } from '@app/features/session-launcher/SessionLauncherForm'
import { SessionLauncherList } from '@app/features/session-launcher/SessionLauncherList'
import type { CreateSessionInput, LauncherHomePayload } from '@shared/contracts/launcher'

export const HomePage = () => {
  const navigate = useNavigate()
  const [payload, setPayload] = useState<LauncherHomePayload | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const refreshHome = async() => {
    try {
      const nextPayload = await alphaNexusApi.launcher.getHome()
      setPayload(nextPayload)
    } catch (error) {
      setMessage(error instanceof Error ? `加载失败：${error.message}` : '加载 Session 启动页失败。')
    }
  }

  useEffect(() => {
    void refreshHome()
  }, [])

  const handleCreateSession = async(input: CreateSessionInput) => {
    try {
      setBusy(true)
      const result = await alphaNexusApi.launcher.createSession(input)
      navigate(`/sessions/${result.session.id}`)
    } catch (error) {
      setMessage(error instanceof Error ? `创建失败：${error.message}` : '创建 Session 失败。')
    } finally {
      setBusy(false)
    }
  }

  const recentSessions = payload?.recent_sessions.filter((session) => session.id !== payload.active_session?.id) ?? []

  if (payload?.active_session) {
    return <Navigate replace to={`/sessions/${payload.active_session.id}`} />
  }

  return (
    <div className="stack">
      <PageHeading
        eyebrow="工作入口"
        summary="没有活跃工作过程时，才在这里创建或切换主线。进入后直接在工作台里完成记录、截图、笔记和 AI 分析。"
        title="启动工作过程"
      />

      {message ? <div className="status-inline">{message}</div> : null}

      <div className="two-column">
        <SectionCard subtitle="最近打开过的工作过程保持一键可达，不再重复显示当前这一条。" title="最近记录">
          {payload ? (
            <SessionLauncherList
              emptyMessage="还没有历史工作过程。"
              sessions={recentSessions}
            />
          ) : (
            <div className="empty-state">正在加载最近记录...</div>
          )}
        </SectionCard>

        <SectionCard subtitle="只有在切换到一条新的推理主线时，才需要新建工作过程。" title="新建工作过程">
          {payload ? (
            <SessionLauncherForm busy={busy} contracts={payload.contracts} onSubmit={(input) => void handleCreateSession(input)} />
          ) : (
            <div className="empty-state">正在加载启动上下文...</div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
