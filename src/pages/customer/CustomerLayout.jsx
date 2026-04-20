import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { RoleSwitcher } from '../../components/RoleSwitcher'
import { useRole } from '../../contexts/RoleContext'
import { signOut } from '../../lib/supabase'
import './CustomerLayout.css'

const NAV_ITEMS = [
  { to: '/customer/dashboard', label: '工作台', icon: '◈' },
  { to: '/customer/journey', label: '我的进度', icon: '◷' },
  { to: '/customer/documents', label: '我的文档', icon: '◇' },
  { to: '/customer/qa', label: '问答', icon: '◆' },
  { to: '/customer/meetings', label: '会议', icon: '○' },
  { to: '/customer/settings', label: '设置', icon: '◉' },
]

export default function CustomerLayout() {
  const { profile } = useRole()
  const navigate = useNavigate()
  const name = profile?.full_name || ''
  const initial = (name[0] || '?').toUpperCase()

  async function handleSignOut() {
    try { await signOut() } catch (e) { console.error(e) }
    navigate('/login')
  }

  return (
    <div className="cl-root">
      <header className="cl-topbar">
        <div className="cl-topbar-left">
          <span className="cl-brand">Readii</span>
          <span className="cl-brand-sub">客户工作台</span>
        </div>
        <div className="cl-topbar-right">
          <RoleSwitcher />
          <span className="cl-user-name">{name}</span>
          <div className="cl-avatar" title={name}>{initial}</div>
          <button className="cl-signout" onClick={handleSignOut}>退出</button>
        </div>
      </header>

      <div className="cl-body">
        <aside className="cl-sidebar">
          <nav className="cl-nav">
            {NAV_ITEMS.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `cl-nav-item ${isActive ? 'active' : ''}`}
              >
                <span className="cl-nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="cl-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
