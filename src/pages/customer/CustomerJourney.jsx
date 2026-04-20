import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRole } from '../../contexts/RoleContext'
import { calculateProgress } from '../../lib/api/customer'
import '../../components/customer/CustomerComponents.css'

const STATUS_LABELS = {
  completed: '已完成',
  in_progress: '进行中',
  blocked_on_customer: '等待你的行动',
  blocked_on_readii: 'Readii 处理中',
  pending: '待开始',
  skipped: '已跳过',
}

const STATUS_COLORS = {
  completed: '#1e7a3c',
  in_progress: '#b8741a',
  blocked_on_customer: '#c33',
  blocked_on_readii: '#e67e22',
  pending: '#8A8780',
  skipped: '#999',
}

export default function CustomerJourney() {
  const { user } = useRole()
  const [data, setData] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    ;(async () => {
      const { data: customer } = await supabase
        .from('customer_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
      if (!customer) { setLoading(false); return }

      const { data: template } = await supabase
        .from('journey_templates')
        .select('*')
        .eq('service_type', customer.service_type)
        .eq('is_active', true)
        .maybeSingle()
      if (!template) { setData({ customer, stages: [], progress: [] }); setLoading(false); return }

      const [{ data: stages }, { data: progress }] = await Promise.all([
        supabase.from('journey_stages').select('*').eq('template_id', template.id).order('stage_number'),
        supabase.from('customer_journey_progress').select('*').eq('customer_id', customer.id),
      ])
      setData({ customer, template, stages: stages || [], progress: progress || [] })
      setLoading(false)
    })()
  }, [user?.id])

  if (loading) return <div style={{padding:40,textAlign:'center',color:'var(--text-muted)',fontSize:13}}>加载中...</div>
  if (!data) return <div style={{padding:40,textAlign:'center',color:'var(--text-muted)',fontSize:13}}>客户档案未建立</div>
  if (!data.stages.length) return <div style={{padding:40,textAlign:'center',color:'var(--text-muted)',fontSize:13}}>服务路径尚未配置，请联系顾问</div>

  const progressMap = Object.fromEntries(data.progress.map(p => [p.stage_id, p]))
  const pct = calculateProgress(data.stages, data.progress)
  const completedCount = data.progress.filter(p => p.status === 'completed').length

  return (
    <div style={{maxWidth:720}}>
      <h1 style={{fontFamily:'var(--font-display)',fontSize:22,fontWeight:700,margin:'0 0 4px'}}>我的完整路径</h1>
      <div style={{fontSize:13,color:'var(--text-muted)',marginBottom:24}}>
        完成度 {pct}%（{completedCount}/{data.stages.length}）· {data.template?.name}
      </div>

      <div className="cj-timeline">
        {data.stages.map((stage, idx) => {
          const p = progressMap[stage.id]
          const status = p?.status || 'pending'
          const isCurrent = stage.id === data.customer.current_stage_id
          const expanded = expandedId === stage.id
          const color = STATUS_COLORS[status]
          const isLast = idx === data.stages.length - 1

          return (
            <div key={stage.id} className="cj-node">
              <div className="cj-line-col">
                <div className="cj-dot" style={{borderColor: color, background: status === 'completed' ? color : 'var(--bg-card)', color: status === 'completed' ? '#fff' : color}}>
                  {status === 'completed' ? '✓' : stage.stage_number}
                </div>
                {!isLast && <div className="cj-line" style={{background: status === 'completed' ? color : 'var(--border-subtle)'}} />}
              </div>

              <div className={`cj-card ${isCurrent ? 'cj-card-current' : ''}`} onClick={() => setExpandedId(expanded ? null : stage.id)}>
                <div className="cj-card-header">
                  <div>
                    <div className="cj-card-title">{stage.title}</div>
                    <div className="cj-card-meta">
                      {stage.estimated_duration_days && `${stage.estimated_duration_days} 天 · `}
                      <span style={{color}}>{STATUS_LABELS[status]}</span>
                    </div>
                  </div>
                  <span style={{color:'var(--text-muted)',fontSize:12}}>{expanded ? '▲' : '▼'}</span>
                </div>

                {expanded && (
                  <div className="cj-card-body">
                    <div className="csc-grid">
                      <div className="csc-card csc-card-why"><div className="csc-card-label">💡 为什么重要</div><div className="csc-card-text">{stage.description_why || '—'}</div></div>
                      <div className="csc-card csc-card-you"><div className="csc-card-label">✅ 你需要做什么</div><div className="csc-card-text">{stage.description_customer_action || '—'}</div></div>
                      <div className="csc-card csc-card-readii"><div className="csc-card-label">🔧 Readii 在做什么</div><div className="csc-card-text">{stage.description_readii_action || '—'}</div></div>
                    </div>
                    {stage.deliverables?.length > 0 && (
                      <div style={{marginTop:12}}><div className="csc-card-label">📦 交付物</div><ul style={{margin:'6px 0 0 16px',fontSize:13,color:'var(--text-secondary)',lineHeight:1.8}}>{stage.deliverables.map((d,i)=><li key={i}>{d}</li>)}</ul></div>
                    )}
                    {p?.blocker_reason && <div style={{marginTop:12,padding:'8px 12px',background:'#fee',borderRadius:6,fontSize:12,color:'#c33'}}>卡住原因：{p.blocker_reason}</div>}
                    {p?.completed_at && <div style={{marginTop:8,fontSize:12,color:'#1e7a3c'}}>✓ 完成于 {new Date(p.completed_at).toLocaleString('zh-CN')}</div>}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
