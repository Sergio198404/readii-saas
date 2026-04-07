import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import TodayView from './pages/TodayView'
import SalesBoard from './pages/SalesBoard'
import ContentPage from './pages/ContentPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/today" element={<TodayView />} />
        <Route path="/board" element={<SalesBoard />} />
        <Route path="/content" element={<ContentPage />} />
        <Route path="/" element={<Navigate to="/today" replace />} />
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
