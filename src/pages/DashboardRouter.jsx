import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRole } from '../contexts/RoleContext'
import { getDefaultRoute } from '../lib/roles'

export default function DashboardRouter() {
  const { profile, loading } = useRole()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && profile) {
      navigate(getDefaultRoute(profile), { replace: true })
    }
  }, [profile, loading, navigate])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
      正在跳转...
    </div>
  )
}
