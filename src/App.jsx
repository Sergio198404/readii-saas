import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import TodayView from './pages/TodayView'
import SalesBoard from './pages/SalesBoard'
import ContentPage from './pages/ContentPage'
import ExpertsPage from './pages/ExpertsPage'
import LoginPage from './pages/LoginPage'
import PartnerPage from './pages/PartnerPage'
import PartnersAdminPage from './pages/PartnersAdminPage'
import ProposalsPage from './pages/ProposalsPage'
import ProposalWizardPage from './pages/ProposalWizardPage'
import AssessmentPage from './pages/AssessmentPage'
import ChangePasswordPage from './pages/ChangePasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
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
  if (profile && profile.password_changed === false) {
    return <Navigate to="/change-password" replace />
  }
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
  console.log('[App] routing decision:', {
    hasUser: !!user,
    role: profile?.role,
    homePath,
  })

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to={homePath} replace /> : <LoginPage />}
        />

        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/assessment" element={<AssessmentPage />} />

        <Route
          path="/change-password"
          element={
            !user
              ? <Navigate to="/login" replace />
              : <ChangePasswordPage />
          }
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

        <Route
          path="/admin/partners"
          element={
            <RequireAuth user={user} profile={profile} allow={['admin']}>
              <PartnersAdminPage />
            </RequireAuth>
          }
        />

        <Route
          path="/admin/proposals"
          element={
            <RequireAuth user={user} profile={profile} allow={['admin']}>
              <ProposalsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/proposals/new"
          element={
            <RequireAuth user={user} profile={profile} allow={['admin']}>
              <ProposalWizardPage />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/proposals/:id/edit"
          element={
            <RequireAuth user={user} profile={profile} allow={['admin']}>
              <ProposalWizardPage />
            </RequireAuth>
          }
        />

        <Route path="/" element={<Navigate to={user ? homePath : '/login'} replace />} />
        <Route path="*" element={<Navigate to={user ? homePath : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  )
}
