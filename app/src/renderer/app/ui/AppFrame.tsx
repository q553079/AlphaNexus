import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { alphaNexusApi } from '@app/bootstrap/api'

const baseNavItems = [
  { to: '/', label: '首页' },
  { to: '/knowledge/review', label: 'Knowledge Review' },
  { to: '/settings/ai', label: 'AI 设置' },
  { to: '/exports', label: '导出' },
]

export const AppFrame = () => {
  const [status, setStatus] = useState('booting')
  const [navItems, setNavItems] = useState(baseNavItems)
  const navigate = useNavigate()
  const location = useLocation()
  const statusLabel = status === 'booting'
    ? '启动中'
    : status === 'alpha-nexus-mock'
      ? '模拟 API 已连接'
      : status === 'bridge-unavailable'
        ? 'Preload Bridge 不可用'
      : status

  useEffect(() => {
    void (async () => {
      try {
        await alphaNexusApi.app.initializeDatabase()
        const [result, launcherHome] = await Promise.all([
          alphaNexusApi.app.ping(),
          alphaNexusApi.launcher.getHome().catch(() => null),
        ])
        setStatus(result)

        const dynamicItems = [...baseNavItems]
        const activeSession = launcherHome?.active_session ?? launcherHome?.recent_sessions[0] ?? null
        if (activeSession) {
          dynamicItems.splice(1, 0, {
            to: `/sessions/${activeSession.id}`,
            label: 'Session 工作台',
          })

          try {
            const currentContext = await alphaNexusApi.workbench.getCurrentContext({
              session_id: activeSession.id,
              source_view: 'launcher',
            })
            if (currentContext.trade_id) {
              dynamicItems.splice(2, 0, {
                to: `/trades/${currentContext.trade_id}`,
                label: '交易详情',
              })
            }
            dynamicItems.splice(2, 0, {
              to: `/periods/${currentContext.period_id}`,
              label: '周期复盘',
            })
          } catch {}
        }

        setNavItems(dynamicItems)
      } catch {
        setStatus('bridge-unavailable')
        setNavItems(baseNavItems)
      }
    })()
  }, [])

  useEffect(() => alphaNexusApi.capture.onSaved((result) => {
    const nextPath = `/sessions/${result.screenshot.session_id}`
    if (location.pathname !== nextPath) {
      navigate(nextPath)
    }
  }), [location.pathname, navigate])

  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <div className="app-shell__brand">
          <p className="app-shell__eyebrow">本地优先交易工作台</p>
          <h1>AlphaNexus</h1>
          <p className="app-shell__description">截图、标注、复盘，并带着完整上下文回看每个 Session。</p>
        </div>

        <nav className="app-shell__nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              className={({ isActive }) => (isActive ? 'app-shell__nav-link is-active' : 'app-shell__nav-link')}
              to={item.to}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="app-shell__status">
          <span className="status-pill">状态：{statusLabel}</span>
        </div>
      </header>

      <div className="app-shell__content">
        <Outlet />
      </div>
    </div>
  )
}
