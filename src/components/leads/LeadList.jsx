import './LeadList.css'
import LeadCard from './LeadCard'

export default function LeadList({ leads = [], onEdit, onUpdate, onAskCoach }) {
  if (leads.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📭</div>
        <div className="empty-state-title">暂无线索</div>
        <div className="empty-state-sub">点击右上角「+ 新增线索」添加第一个客户</div>
      </div>
    )
  }

  return (
    <div className="lead-list">
      {leads.map(lead => (
        <LeadCard
          key={lead.id}
          lead={lead}
          onEdit={onEdit}
          onUpdate={onUpdate}
          onAskCoach={onAskCoach}
        />
      ))}
    </div>
  )
}
