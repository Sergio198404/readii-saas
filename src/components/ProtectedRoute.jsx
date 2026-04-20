import { Navigate, useLocation } from 'react-router-dom'
import { useRole } from '../contexts/RoleContext'
import { hasRole, getRequiredRoleFromPath } from '../lib/roles'

export function ProtectedRoute({ children, requireRole }) {
  const { user, profile, loading } = useRole()
  const location = useLocation()

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: 13 }}>
        加载中...
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  const roleToCheck = requireRole || getRequiredRoleFromPath(location.pathname)

  if (roleToCheck && !hasRole(profile, roleToCheck)) {
    return <Navigate to="/unauthorized" replace />
  }

  return children
}
