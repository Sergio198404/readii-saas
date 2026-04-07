import './LeadCard.css'

export default function LeadCard({ lead, onEdit, onUpdate, onAskCoach }) {
  const initials = lead?.name
    ? [...lead.name].length >= 2
      ? [...lead.name][0] + [...lead.name].at(-1)
      : [...lead.name][0]
    : '?'

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-avatar">{initials}</div>
        <div className="card-name-block">
          <div className="card-name">{lead?.name || '—'}</div>
          <div className="card-channel">{lead?.channel || ''}</div>
        </div>
        <div className="card-header-right">
          {lead?.p && <span className={`badge badge-${lead.p.toLowerCase()}`}>{lead.p}</span>}
          {lead?.s && <span className="badge badge-stage">{lead.s}</span>}
        </div>
      </div>

      <div className="card-badges">
        {lead?.prod && <span className="badge badge-prod">{lead.prod}</span>}
        {lead?.b && <span className="badge badge-budget">{lead.b}</span>}
        {lead?.next && <span className="badge badge-date">{lead.next}</span>}
        {lead?.follow && <span className="badge badge-today">{lead.follow}</span>}
      </div>

      {lead?.note && (
        <div className="card-note">{lead.note}</div>
      )}

      {lead?.updates?.length > 0 && (
        <div className="card-updates">
          {lead.updates.map((u, i) => (
            <div className="update-row" key={i}>
              <div className="update-dot" />
              <span className="update-date">{u.date}</span>
              <span className="update-text">{u.note}</span>
            </div>
          ))}
        </div>
      )}

      <div className="card-actions">
        <button className="btn-action" onClick={() => onEdit?.(lead)}>编辑</button>
        <button className="btn-action update" onClick={() => onUpdate?.(lead)}>更新进展</button>
        <button className="btn-action ai-btn" onClick={() => onAskCoach?.(lead)}>🧠 AI建议</button>
      </div>
    </div>
  )
}
