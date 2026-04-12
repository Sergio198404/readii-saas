import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import TodayView from './pages/TodayView'
import SalesBoard from './pages/SalesBoard'
import ContentPage from './pages/ContentPage'
import ExpertsPage from './pages/ExpertsPage'
import LoginPage from './pages/LoginPage'
import PartnerPage from './pages/PartnerPage'
import AppLayout from './components/layout/AppLayout'
import { useAuth } from './lib/useAuth'

function FullScreenMessage({ children }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--text-muted)',
      fontFamily: 'var(--font-body)',
      fontSize: 13,
    }}>
      {children}
    </div>
  )
}

function RequireAuth({ profile, user, allow, children }) {
  const location = useLocation()
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  if (allow && profile && !allow.includes(profile.role)) {
    const home = profile.role === 'admin' ? '/today' : '/partner'
    return <Navigate to={home} replace />
  }
  return <AppLayout>{children}</AppLayout>
}

export default function App() {
  const { user, profile, loading } = useAuth()

  if (loading) return <FullScreenMessage>加载中...</FullScreenMessage>

  const homePath = profile?.role === 'admin' ? '/today' : '/partner'

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to={homePath} replace /> : <LoginPage />}
        />

        <Route
          path="/today"
          element={
            <RequireAuth user={user} profile={profile} allow={['admin']}>
              <TodayView />
            </RequireAuth>
          }
        />
        <Route
          path="/board"
          element={
            <RequireAuth user={user} profile={profile} allow={['admin']}>
              <SalesBoard />
            </RequireAuth>
          }
        />
        <Route
          path="/content"
          element={
            <RequireAuth user={user} profile={profile} allow={['admin']}>
              <ContentPage />
            </RequireAuth>
          }
        />
        <Route
          path="/experts"
          element={
            <RequireAuth user={user} profile={profile} allow={['admin']}>
              <ExpertsPage />
            </RequireAuth>
          }
        />

        <Route
          path="/partner"
          element={
            <RequireAuth user={user} profile={profile}>
              <PartnerPage />
            </RequireAuth>
          }
        />

        <Route path="/" element={<Navigate to={user ? homePath : '/login'} replace />} />
        <Route path="*" element={<Navigate to={user ? homePath : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  )
}
