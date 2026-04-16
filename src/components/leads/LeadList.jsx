import './LeadList.css'
import LeadCard from './LeadCard'

export default function LeadList({ leads = [], dealSummaries = {}, onEdit, onUpdate, onAskCoach, onDelete, onMarkDeal, onProposal }) {
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
          dealSummary={dealSummaries[lead.id]}
          onEdit={onEdit}
          onUpdate={onUpdate}
          onAskCoach={onAskCoach}
          onDelete={onDelete}
          onMarkDeal={onMarkDeal}
          onProposal={onProposal}
        />
      ))}
    </div>
  )
}
