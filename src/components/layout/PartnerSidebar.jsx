import './Sidebar.css'
import './PartnerSidebar.css'

const ITEMS = [
  { key: 'leads',       icon: '◈', label: '我的线索' },
  { key: 'commissions', icon: '◇', label: '佣金记录' },
  { key: 'promo',       icon: '◆', label: '推广信息' },
]

export default function PartnerSidebar({ activeSection, onJump, counts = {} }) {
  return (
    <aside className="sidebar partner-sidebar">
      <div className="sidebar-logo">
        <div className="wordmark">Readii</div>
        <div className="tagline">Partner</div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-label">工作台</div>
        {ITEMS.map((item) => {
          const isActive = activeSection === item.key
          return (
            <div
              key={item.key}
              className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => onJump?.(item.key)}
            >
              <span className="nav-icon">{item.icon}</span> {item.label}
              <span className="nav-badge">{counts[item.key] ?? '–'}</span>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
