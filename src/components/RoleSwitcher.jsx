import { useNavigate } from 'react-router-dom'
import { useRole } from '../contexts/RoleContext'
import { ROLE_BASE_PATHS, ROLES } from '../lib/roles'

const ROLE_LABELS = {
  [ROLES.CUSTOMER]: '客户',
  [ROLES.PARTNER]: '渠道合伙人',
  [ROLES.CONSULTANT]: '咨询师',
  [ROLES.ADMIN]: '管理员',
}

export function RoleSwitcher() {
  const { roles, currentRole, switchRole } = useRole()
  const navigate = useNavigate()

  if (roles.length <= 1) return null

  function handleSwitch(e) {
    const role = e.target.value
    switchRole(role)
    const path = role === ROLES.ADMIN ? '/today' : `${ROLE_BASE_PATHS[role]}/dashboard`
    navigate(path)
  }

  return (
    <select
      value={currentRole || roles[0]}
      onChange={handleSwitch}
      style={{
        padding: '4px 8px', border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--r-sm)', fontSize: 11, background: 'var(--bg-card)',
        color: 'var(--text-primary)', cursor: 'pointer',
      }}
    >
      {roles.map(r => (
        <option key={r} value={r}>切换到：{ROLE_LABELS[r]}</option>
      ))}
    </select>
  )
}
