import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { alphaNexusApi } from '@app/bootstrap/api'
import { PageHeading } from '@app/components/PageHeading'
import { SectionCard } from '@app/components/SectionCard'
import { SessionLauncherForm } from '@app/features/session-launcher/SessionLauncherForm'
import { SessionLauncherList } from '@app/features/session-launcher/SessionLauncherList'
import { formatDateTime, translateSessionStatus } from '@app/ui/display-text'
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

  return (
    <div className="stack">
      <PageHeading
        actions={(
          payload?.active_session ? (
            <Link className="button is-primary" to={`/sessions/${payload.active_session.id}`}>
              打开当前活跃 Session
            </Link>
          ) : null
        )}
        eyebrow="Session 启动页"
        summary="从已有合约开始新的真实 Session，或重新打开最近的活跃工作台，让当天的截图、笔记和 AI 分析都落在正确的本地上下文里。"
        title="启动或重新打开 Session"
      />

      {message ? <div className="status-inline">{message}</div> : null}

      <div className="two-column">
        <div className="stack">
          <SectionCard subtitle="无参数打开工作台时，默认会落到最近的活跃 Session。" title="当前活跃 Session">
            {payload?.active_session ? (
              <div className="compact-list">
                <div className="compact-list__item">
                  <div className="action-row">
                    <strong>{payload.active_session.title}</strong>
                    <span className={`badge badge-${payload.active_session.status}`.trim()}>{translateSessionStatus(payload.active_session.status)}</span>
                  </div>
                  <p>{payload.active_session.contract_symbol} · {formatDateTime(payload.active_session.started_at)}</p>
                  <p>{payload.active_session.event_count} 个事件 · {payload.active_session.trade_count} 笔交易</p>
                </div>
                <div className="action-row">
                  <Link className="button is-primary" to={`/sessions/${payload.active_session.id}`}>打开工作台</Link>
                </div>
              </div>
            ) : (
              <div className="empty-state">当前还没有活跃 Session。先在下面创建一个，开始今天的记录。</div>
            )}
          </SectionCard>

          <SectionCard subtitle="基于现有合约创建 Session，并自动挂到当前周周期下。" title="创建新 Session">
            {payload ? (
              <SessionLauncherForm busy={busy} contracts={payload.contracts} onSubmit={(input) => void handleCreateSession(input)} />
            ) : (
              <div className="empty-state">正在加载启动上下文...</div>
            )}
          </SectionCard>
        </div>

        <SectionCard subtitle="最近使用的 Session 保持一键可达。" title="最近 Sessions">
          {payload ? (
            <SessionLauncherList
              emptyMessage="还没有任何 Session 记录。"
              sessions={payload.recent_sessions}
            />
          ) : (
            <div className="empty-state">正在加载最近 Sessions...</div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
