import { Routes, Route, Navigate } from 'react-router-dom'
import StaffLayout from './StaffLayout'
import StaffDashboard from './StaffDashboard'
import StaffCustomers from './StaffCustomers'
import StaffCustomerDetail from './StaffCustomerDetail'

export default function StaffRoutes() {
  return (
    <Routes>
      <Route element={<StaffLayout />}>
        <Route index element={<StaffDashboard />} />
        <Route path="customers" element={<StaffCustomers />} />
        <Route path="customers/:customerId" element={<StaffCustomerDetail />} />
        <Route path="qa-queue" element={<Placeholder title="QA 队列" />} />
        <Route path="alerts" element={<Placeholder title="合规预警" />} />
        <Route path="milestones" element={<Placeholder title="里程碑日历" />} />
        <Route path="meetings" element={<Placeholder title="会议管理" />} />
        <Route path="leads" element={<Placeholder title="新线索" />} />
        <Route path="financials" element={<Placeholder title="财务节点" />} />
        <Route path="*" element={<Navigate to="/staff" replace />} />
      </Route>
    </Routes>
  )
}

function Placeholder({ title }) {
  return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 12 }}>与 Dashboard 卡片数据同源，独立视图将在 v2 接入。</div>
    </div>
  )
}
