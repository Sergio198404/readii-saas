import { Routes, Route, Navigate } from 'react-router-dom'
import CustomerLayout from './CustomerLayout'
import CustomerDashboard from './CustomerDashboard'

export default function CustomerRoutes() {
  return (
    <Routes>
      <Route element={<CustomerLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<CustomerDashboard />} />
        <Route path="journey" element={<Placeholder title="我的进度" />} />
        <Route path="documents" element={<Placeholder title="我的文档" />} />
        <Route path="qa" element={<Placeholder title="问答" />} />
        <Route path="meetings" element={<Placeholder title="会议" />} />
        <Route path="settings" element={<Placeholder title="设置" />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>
    </Routes>
  )
}

function Placeholder({ title }) {
  return (
    <div style={{ padding: 60, textAlign: 'center' }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>功能建设中，敬请期待</div>
    </div>
  )
}
