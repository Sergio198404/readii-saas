import { Routes, Route, Navigate } from 'react-router-dom'
import CustomerDashboard from './CustomerDashboard'

export default function CustomerRoutes() {
  return (
    <Routes>
      <Route path="dashboard" element={<CustomerDashboard />} />
      <Route path="*" element={<Navigate to="dashboard" replace />} />
    </Routes>
  )
}
