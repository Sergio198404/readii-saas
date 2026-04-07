import './TopBar.css'

export default function TopBar({ onOpenAdd, onOpenCoach, onToggleEmail, onSearch }) {
  const today = new Date()
  const days = ['日','一','二','三','四','五','六']
  const dateLabel = `${today.getFullYear()}年${today.getMonth()+1}月${today.getDate()}日 · 周${days[today.getDay()]}`

  return (
    <header className="topbar">
      <span className="topbar-title">销售看板</span>
      <span className="topbar-date">{dateLabel}</span>
      <div className="search-wrap">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          className="search-input"
          placeholder="搜索姓名、渠道、标签..."
          onChange={(e) => onSearch?.(e.target.value)}
        />
      </div>
      <div className="topbar-actions">
        <button className="btn btn-coach" onClick={onOpenCoach}>🧠 AI 教练</button>
        <button className="btn btn-email" onClick={onToggleEmail}>📧 邮件提醒</button>
        <button className="btn btn-primary" onClick={onOpenAdd}>+ 新增线索</button>
      </div>
    </header>
  )
}
