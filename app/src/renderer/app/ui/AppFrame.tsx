import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { alphaNexusApi } from '@app/bootstrap/api'

const navItems = [
  { to: '/', label: '首页' },
  { to: '/sessions/session_20260325_am', label: 'Session 工作台' },
  { to: '/knowledge/review', label: 'Knowledge Review' },
  { to: '/trades/trade_nq_long_1', label: '交易详情' },
  { to: '/periods/period_2026w13', label: '周期复盘' },
  { to: '/settings/ai', label: 'AI 设置' },
  { to: '/exports', label: '导出' },
]

export const AppFrame = () => {
  const [status, setStatus] = useState('booting')
  const navigate = useNavigate()
  const location = useLocation()
  const statusLabel = status === 'booting'
    ? '启动中'
    : status === 'alpha-nexus-mock'
      ? '模拟 API 已连接'
      : status

  useEffect(() => {
    void (async () => {
      await alphaNexusApi.app.initializeDatabase()
      const result = await alphaNexusApi.app.ping()
      setStatus(result)
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
