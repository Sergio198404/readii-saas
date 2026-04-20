import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { RoleSwitcher } from '../../components/RoleSwitcher'
import { useRole } from '../../contexts/RoleContext'
import { signOut } from '../../lib/supabase'
import { STAFF_ROLE_LABELS } from '../../lib/staffPermissions'
import '../customer/CustomerLayout.css'

const COMMON_ITEMS = [
  { to: '/staff', end: true, label: '我的 Dashboard', icon: '◈' },
  { to: '/staff/customers', label: '所有客户', icon: '◷' },
]

const ROLE_ITEMS = {
  copywriter: [
    { to: '/staff/qa-queue', label: 'QA 队列', icon: '◆' },
  ],
  project_manager: [
    { to: '/staff/alerts', label: '合规预警', icon: '⚠' },
    { to: '/staff/milestones', label: '里程碑日历', icon: '◉' },
  ],
  customer_manager: [
    { to: '/staff/qa-queue', label: 'QA 队列', icon: '◆' },
    { to: '/staff/meetings', label: '会议管理', icon: '○' },
  ],
  bdm: [
    { to: '/staff/leads', label: '新线索', icon: '◇' },
    { to: '/staff/financials', label: '财务节点', icon: '£' },
  ],
}

export default function StaffLayout() {
  const { profile } = useRole()
  const navigate = useNavigate()
  const name = profile?.full_name || profile?.email || ''
  const initial = (name[0] || '?').toUpperCase()
  const staffRole = profile?.staff_role

  async function handleSignOut() {
    try { await signOut() } catch (e) { console.error(e) }
    navigate('/login')
  }

  const navItems = [...COMMON_ITEMS, ...(ROLE_ITEMS[staffRole] || [])]

  return (
    <div className="cl-root">
      <header className="cl-topbar">
        <div className="cl-topbar-left">
          <span className="cl-brand">Readii</span>
          <span className="cl-brand-sub">内部工作台 · {STAFF_ROLE_LABELS[staffRole] || '未分配角色'}</span>
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
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
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
