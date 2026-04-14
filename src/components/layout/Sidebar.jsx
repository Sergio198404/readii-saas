import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/useAuth'
import './Sidebar.css'

const VIEW_FILTERS = [
  { key: 'all',   icon: '◈', label: '全部线索' },
  { key: 'today', icon: '◷', label: '今日跟进' },
  { key: 'P1',    icon: '◉', label: 'P1 紧急' },
  { key: 'P2',    icon: '○', label: 'P2 跟进中' },
]

const STAGE_FILTERS = [
  { key: 'S0',     icon: '✦', label: 'S0 新线索' },
  { key: 'active', icon: '▷', label: '进行中 S1–S3' },
  { key: 'S4',     icon: '✓', label: 'S4 已成交' },
  { key: 'S5',     icon: '–', label: 'S5 冷/失联' },
]

const PRODUCT_FILTERS = [
  { key: 'IFV',   icon: '◆', label: 'IFV 创新签' },
  { key: 'SW',    icon: '◆', label: 'SW 自担保工签' },
  { key: 'EW',    icon: '◆', label: 'EW 拓展工签' },
  { key: 'GT',    icon: '◆', label: 'GT 全球人才' },
  { key: 'PlanB', icon: '◆', label: 'PlanB 评估' },
]

export default function Sidebar({ currentFilter, onFilterChange, badgeCounts = {} }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const isToday = location.pathname === '/today' || location.pathname === '/'
  const isContent = location.pathname === '/content'
  const isExperts = location.pathname === '/experts'
  const isPartnersAdmin = location.pathname === '/admin/partners'

  function handleFilterClick(key) {
    if (key === 'today') {
      navigate('/today')
    } else if (key === 'content') {
      navigate('/content')
    } else if (key === 'experts') {
      navigate('/experts')
    } else if (key === 'admin-partners') {
      navigate('/admin/partners')
    } else {
      if (isToday || isContent || isExperts || isPartnersAdmin) navigate('/board')
      onFilterChange?.(key)
    }
  }

  const renderItem = ({ key, icon, label }) => {
    const isActive = key === 'today' ? isToday
      : key === 'content' ? isContent
      : key === 'experts' ? isExperts
      : key === 'admin-partners' ? isPartnersAdmin
      : (!isToday && !isContent && !isExperts && !isPartnersAdmin && currentFilter === key)
    return (
      <div
        key={key}
        className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
        onClick={() => handleFilterClick(key)}
      >
        <span className="nav-icon">{icon}</span> {label}
        <span className="nav-badge">{badgeCounts[key] ?? '–'}</span>
      </div>
    )
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo" onClick={() => navigate('/today')} style={{ cursor: 'pointer' }}>
        <div className="wordmark">Readii</div>
        <div className="tagline">Sales Intelligence</div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-label">视图</div>
        {VIEW_FILTERS.map(renderItem)}
      </div>

      <div className="sidebar-divider" />

      <div className="sidebar-section">
        <div className="sidebar-section-label">阶段</div>
        {STAGE_FILTERS.map(renderItem)}
      </div>

      <div className="sidebar-divider" />

      <div className="sidebar-section">
        <div className="sidebar-section-label">产品</div>
        {PRODUCT_FILTERS.map(renderItem)}
      </div>

      <div className="sidebar-divider" />

      <div className="sidebar-section">
        <div className="sidebar-section-label">工具</div>
        {renderItem({ key: 'content', icon: '✎', label: '内容中心' })}
        {renderItem({ key: 'experts', icon: '🧠', label: '专家库' })}
      </div>

      {isAdmin && (
        <>
          <div className="sidebar-divider" />
          <div className="sidebar-section">
            <div className="sidebar-section-label">管理</div>
            {renderItem({ key: 'admin-partners', icon: '◇', label: '伙伴管理' })}
          </div>
        </>
      )}

      <div className="sidebar-stats">
        <div className="sidebar-stat-row">
          <span className="sidebar-stat-label">本月成交</span>
          <span className="sidebar-stat-value hot">{badgeCounts.S4 ?? '–'}</span>
        </div>
        <div className="sidebar-stat-row">
          <span className="sidebar-stat-label">总线索数</span>
          <span className="sidebar-stat-value">{badgeCounts.all ?? '–'}</span>
        </div>
      </div>
    </aside>
  )
}
