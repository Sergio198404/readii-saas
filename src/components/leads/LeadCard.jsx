import { useState } from 'react'
import './LeadCard.css'

const Q_LABELS = {
  Q1: '姓名', Q2: '所在地', Q3: '联系方式', Q4: '来源', Q5: '签证类型',
  Q6: '到期时间', Q7: '注册公司', Q8: '家庭情况', Q9: '职业领域', Q10: '从业年限',
  Q11: '商业意向', Q12: '英国合伙人', Q13: '目标', Q14: '时间要求', Q15: '预算', Q16: '补充说明',
}

export default function LeadCard({ lead, dealSummary, onEdit, onUpdate, onAskCoach, onDelete, onMarkDeal, onProposal }) {
  const [showAssessment, setShowAssessment] = useState(false)
  const initials = lead?.name
    ? [...lead.name].length >= 2
      ? [...lead.name][0] + [...lead.name].at(-1)
      : [...lead.name][0]
    : '?'

  const isS3 = lead?.s === 'S3'
  const isS4 = lead?.s === 'S4'

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

      {isS4 && dealSummary && (
        <div className="card-deal-summary">
          <div className="deal-total">
            成交 <strong>£{dealSummary.contract.toLocaleString()}</strong>
          </div>
          <div className="deal-split">
            <span>平台 £{dealSummary.platform.toLocaleString()}</span>
            <span>·</span>
            <span>渠道 £{dealSummary.channel.toLocaleString()}</span>
            <span>·</span>
            <span className="deal-you">你实得 £{dealSummary.you.toLocaleString()}</span>
          </div>
        </div>
      )}

      {lead?.assessment_data && (
        <div className="card-assessment">
          <button className="btn-action" onClick={() => setShowAssessment(v => !v)} style={{fontSize:11}}>
            {showAssessment ? '▾ 收起问卷' : '▸ 查看问卷原始答案'}
          </button>
          {showAssessment && (
            <div className="assessment-answers">
              {Object.entries(lead.assessment_data).map(([k, v]) => (
                <div key={k} className="assessment-row">
                  <span className="assessment-label">{Q_LABELS[k] || k}</span>
                  <span className="assessment-value">{Array.isArray(v) ? v.join('、') : String(v)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {lead?.contact_info && (
        <div className="card-contact" style={{fontSize:12,color:'var(--text-muted)',marginBottom:6}}>联系方式：{lead.contact_info}</div>
      )}

      <div className="card-actions">
        <button className="btn-action" onClick={() => onEdit?.(lead)}>编辑</button>
        <button className="btn-action update" onClick={() => onUpdate?.(lead)}>更新进展</button>
        <button className="btn-action ai-btn" onClick={() => onAskCoach?.(lead)}>🧠 AI建议</button>
        <button className="btn-action" onClick={() => onProposal?.(lead)}>📄 建议书</button>
        {isS3 && (
          <button className="btn-action deal-btn" onClick={() => onMarkDeal?.(lead)}>🎉 标记成交</button>
        )}
        <button className="btn-action" onClick={() => { if (confirm(`确认删除「${lead.name}」？`)) onDelete?.(lead) }} style={{ color: 'var(--danger-text)' }}>删除</button>
      </div>
    </div>
  )
}
