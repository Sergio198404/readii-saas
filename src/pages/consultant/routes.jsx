import { Routes, Route, Navigate } from 'react-router-dom'
import ConsultantDashboard from './ConsultantDashboard'

export default function ConsultantRoutes() {
  return (
    <Routes>
      <Route path="dashboard" element={<ConsultantDashboard />} />
      <Route path="*" element={<Navigate to="dashboard" replace />} />
    </Routes>
  )
}
