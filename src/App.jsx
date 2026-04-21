import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { RoleProvider } from './contexts/RoleContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import TodayView from './pages/TodayView'
import SalesBoard from './pages/SalesBoard'
import ContentPage from './pages/ContentPage'
import ExpertsPage from './pages/ExpertsPage'
import LoginPage from './pages/LoginPage'
import PartnerDashboard from './pages/partner/PartnerDashboard'
import PartnersAdminPage from './pages/PartnersAdminPage'
import AssessmentPage from './pages/AssessmentPage'
import ChangePasswordPage from './pages/ChangePasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import UnauthorizedPage from './pages/UnauthorizedPage'
import DashboardRouter from './pages/DashboardRouter'
import CustomerRoutes from './pages/customer/routes'
import ConsultantRoutes from './pages/consultant/routes'
import StaffRoutes from './pages/staff/routes'
import TeamManagement from './pages/admin/TeamManagement'
import JourneyTemplatesList from './pages/admin/JourneyTemplatesList'
import JourneyStagesList from './pages/admin/JourneyStagesList'
import JourneyStageEditor from './pages/admin/JourneyStageEditor'
import CustomersList from './pages/admin/CustomersList'
import CustomerProgressPage from './pages/admin/CustomerProgressPage'
import CustomerQuestionnaire from './pages/admin/CustomerQuestionnaire'
import CustomerHRCompliance from './pages/admin/CustomerHRCompliance'
import CustomerReports from './pages/admin/CustomerReports'
import AOInterviewScore from './pages/admin/AOInterviewScore'
import ApplicantInterviewScore from './pages/admin/ApplicantInterviewScore'
import MonthlyOperations from './pages/admin/MonthlyOperations'
import ProposalsAdminPage from './pages/admin/ProposalsAdminPage'
import ThirdPartyFeesPage from './pages/admin/ThirdPartyFeesPage'
import ProposalPublicPage from './pages/ProposalPublicPage'
import AppLayout from './components/layout/AppLayout'
import { useAuth } from './lib/useAuth'

function FullScreenMessage({ children }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: 13,
    }}>
      {children}
    </div>
  )
}

function isAdmin(profile) {
  return !!profile && (profile.role === 'admin' || profile.role_admin === true)
}

function RequireAuth({ profile, user, allow, children }) {
  const location = useLocation()
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  if (profile && profile.password_changed === false) {
    return <Navigate to="/change-password" replace />
  }
  if (allow && profile) {
    // Accept admin via either legacy role='admin' or role_admin=true
    const admitted = allow.includes(profile.role) || (allow.includes('admin') && isAdmin(profile))
    if (!admitted) {
      const home = isAdmin(profile) ? '/today' : '/partner'
      return <Navigate to={home} replace />
    }
  }
  return <AppLayout>{children}</AppLayout>
}

export default function App() {
  const { user, profile, loading } = useAuth()

  if (loading) return <FullScreenMessage>加载中...</FullScreenMessage>

  const homePath = isAdmin(profile)
    ? '/today'
    : profile?.role_staff
      ? '/staff'
      : profile?.role_customer
        ? '/customer/dashboard'
        : '/partner'

  return (
    <RoleProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={user ? <Navigate to={homePath} replace /> : <LoginPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/assessment" element={<AssessmentPage />} />
          <Route path="/p/:token" element={<ProposalPublicPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          <Route path="/change-password" element={!user ? <Navigate to="/login" replace /> : <ChangePasswordPage />} />

          {/* v1 role-based dashboard router */}
          <Route path="/dashboard" element={<ProtectedRoute><DashboardRouter /></ProtectedRoute>} />

          {/* v1 Customer routes */}
          <Route path="/customer/*" element={
            <ProtectedRoute requireRole="customer"><CustomerRoutes /></ProtectedRoute>
          } />

          {/* v1 Consultant routes */}
          <Route path="/consultant/*" element={
            <ProtectedRoute requireRole="consultant"><ConsultantRoutes /></ProtectedRoute>
          } />

          {/* v1 Staff routes */}
          <Route path="/staff/*" element={
            <ProtectedRoute requireRole="staff"><StaffRoutes /></ProtectedRoute>
          } />

          {/* ═══ Existing admin routes (unchanged) ═══ */}
          <Route path="/today" element={<RequireAuth user={user} profile={profile} allow={['admin']}><TodayView /></RequireAuth>} />
          <Route path="/board" element={<RequireAuth user={user} profile={profile} allow={['admin']}><SalesBoard /></RequireAuth>} />
          <Route path="/content" element={<RequireAuth user={user} profile={profile} allow={['admin']}><ContentPage /></RequireAuth>} />
          <Route path="/experts" element={<RequireAuth user={user} profile={profile} allow={['admin']}><ExpertsPage /></RequireAuth>} />
          <Route path="/admin/partners" element={<RequireAuth user={user} profile={profile} allow={['admin']}><PartnersAdminPage /></RequireAuth>} />

          {/* ═══ Admin v1 routes ═══ */}
          <Route path="/admin/journey-templates" element={<RequireAuth user={user} profile={profile} allow={['admin']}><JourneyTemplatesList /></RequireAuth>} />
          <Route path="/admin/journey-templates/:templateId/stages" element={<RequireAuth user={user} profile={profile} allow={['admin']}><JourneyStagesList /></RequireAuth>} />
          <Route path="/admin/journey-templates/:templateId/stages/:stageId/edit" element={<RequireAuth user={user} profile={profile} allow={['admin']}><JourneyStageEditor /></RequireAuth>} />
          <Route path="/admin/customers" element={<RequireAuth user={user} profile={profile} allow={['admin']}><CustomersList /></RequireAuth>} />
          <Route path="/admin/customers/:customerId/progress" element={<RequireAuth user={user} profile={profile} allow={['admin']}><CustomerProgressPage /></RequireAuth>} />
          <Route path="/admin/customers/:customerId/questionnaire" element={<RequireAuth user={user} profile={profile} allow={['admin']}><CustomerQuestionnaire /></RequireAuth>} />
          <Route path="/admin/customers/:customerId/hr-compliance" element={<RequireAuth user={user} profile={profile} allow={['admin']}><CustomerHRCompliance /></RequireAuth>} />
          <Route path="/admin/customers/:customerId/reports" element={<RequireAuth user={user} profile={profile} allow={['admin']}><CustomerReports /></RequireAuth>} />
          <Route path="/admin/customers/:customerId/ao-interview-score" element={<RequireAuth user={user} profile={profile} allow={['admin']}><AOInterviewScore /></RequireAuth>} />
          <Route path="/admin/customers/:customerId/applicant-interview-score" element={<RequireAuth user={user} profile={profile} allow={['admin']}><ApplicantInterviewScore /></RequireAuth>} />
          <Route path="/admin/customers/:customerId/monthly-ops" element={<RequireAuth user={user} profile={profile} allow={['admin']}><MonthlyOperations /></RequireAuth>} />
          <Route path="/admin/team" element={<RequireAuth user={user} profile={profile} allow={['admin']}><TeamManagement /></RequireAuth>} />
          <Route path="/admin/proposals" element={<RequireAuth user={user} profile={profile} allow={['admin']}><ProposalsAdminPage /></RequireAuth>} />
          <Route path="/admin/settings/third-party-fees" element={<RequireAuth user={user} profile={profile} allow={['admin']}><ThirdPartyFeesPage /></RequireAuth>} />

          {/* ═══ Existing partner route (unchanged) ═══ */}
          <Route path="/partner" element={<RequireAuth user={user} profile={profile}><PartnerDashboard /></RequireAuth>} />
          <Route path="/partner/dashboard" element={<RequireAuth user={user} profile={profile}><PartnerDashboard /></RequireAuth>} />

          {/* Fallback */}
          <Route path="/" element={<Navigate to={user ? homePath : '/login'} replace />} />
          <Route path="*" element={<Navigate to={user ? homePath : '/login'} replace />} />
        </Routes>
      </BrowserRouter>
    </RoleProvider>
  )
}
