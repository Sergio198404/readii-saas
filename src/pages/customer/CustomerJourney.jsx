import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useRole } from '../../contexts/RoleContext'
import { calculateProgress, loadVariantsForStages, setServiceMode } from '../../lib/api/customer'
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

function formatPrice(pence) {
  if (pence == null) return null
  return `£${(pence / 100).toLocaleString('en-GB', { maximumFractionDigits: 0 })}`
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
        .from('customer_profiles').select('*').eq('user_id', user.id).maybeSingle()
      if (!customer) { setLoading(false); return }

      const { data: template } = await supabase
        .from('journey_templates').select('*')
        .eq('service_type', customer.service_type).eq('is_active', true).maybeSingle()
      if (!template) { setData({ customer, stages: [], progress: [], variants: [] }); setLoading(false); return }

      const [{ data: stages }, { data: progress }] = await Promise.all([
        supabase.from('journey_stages').select('*').eq('template_id', template.id).order('stage_number'),
        supabase.from('customer_journey_progress').select('*').eq('customer_id', customer.id),
      ])
      const stageIds = (stages || []).map(s => s.id)
      const variants = await loadVariantsForStages(stageIds)

      setData({ customer, template, stages: stages || [], progress: progress || [], variants })
      setLoading(false)
    })()
  }, [user?.id])

  async function handleSetMode(progressId, mode) {
    const updated = await setServiceMode(progressId, mode)
    setData(d => ({
      ...d,
      progress: d.progress.map(p => p.id === progressId ? updated : p),
    }))
  }

  if (loading) return <div style={{padding:40,textAlign:'center',color:'var(--text-muted)',fontSize:13}}>加载中...</div>
  if (!data) return <div style={{padding:40,textAlign:'center',color:'var(--text-muted)',fontSize:13}}>客户档案未建立</div>
  if (!data.stages.length) return <div style={{padding:40,textAlign:'center',color:'var(--text-muted)',fontSize:13}}>服务路径尚未配置，请联系顾问</div>

  const progressMap = Object.fromEntries(data.progress.map(p => [p.stage_id, p]))
  const variantById = Object.fromEntries(data.variants.map(v => [v.id, v]))
  const pct = calculateProgress(data.stages, data.progress)
  const completedCount = data.progress.filter(p => p.status === 'completed').length

  // Show only stages the customer actually has progress records for (path/conditional filtered)
  const customerStageIds = new Set(data.progress.map(p => p.stage_id))
  const visibleStages = data.progress.length > 0
    ? data.stages.filter(s => customerStageIds.has(s.id))
    : data.stages

  return (
    <div style={{maxWidth:720}}>
      <h1 style={{fontFamily:'var(--font-display)',fontSize:22,fontWeight:700,margin:'0 0 4px'}}>我的完整路径</h1>
      <div style={{fontSize:13,color:'var(--text-muted)',marginBottom:24}}>
        完成度 {pct}%（{completedCount}/{visibleStages.length}）· {data.template?.name}
      </div>

      <div className="cj-timeline">
        {visibleStages.map((stage, idx) => {
          const p = progressMap[stage.id]
          const status = p?.status || 'pending'
          const isCurrent = stage.id === data.customer.current_stage_id
          const expanded = expandedId === stage.id
          const color = STATUS_COLORS[status]
          const isLast = idx === visibleStages.length - 1

          const variant = p?.selected_variant_id ? variantById[p.selected_variant_id] : null
          const title = variant?.title || stage.title
          const why = variant?.description_why || stage.description_why
          const youDo = variant?.description_customer_action || stage.description_customer_action
          const readiiDo = variant?.description_readii_action || stage.description_readii_action
          const deliverables = variant?.deliverables?.length ? variant.deliverables : stage.deliverables
          const durationDays = variant?.estimated_duration_days || stage.estimated_duration_days

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
                    <div className="cj-card-title">{title}</div>
                    <div className="cj-card-meta">
                      {durationDays && `${durationDays} 天 · `}
                      <span style={{color}}>{STATUS_LABELS[status]}</span>
                      {variant && <span style={{color:'var(--text-muted)',marginLeft:6}}>· {variant.variant_code}</span>}
                    </div>
                  </div>
                  <span style={{color:'var(--text-muted)',fontSize:12}}>{expanded ? '▲' : '▼'}</span>
                </div>

                {expanded && (
                  <div className="cj-card-body" onClick={e => e.stopPropagation()}>
                    <div className="csc-grid">
                      <div className="csc-card csc-card-why"><div className="csc-card-label">💡 为什么重要</div><div className="csc-card-text">{why || '—'}</div></div>
                      <div className="csc-card csc-card-you"><div className="csc-card-label">✅ 你需要做什么</div><div className="csc-card-text">{youDo || '—'}</div></div>
                      <div className="csc-card csc-card-readii"><div className="csc-card-label">🔧 Readii 在做什么</div><div className="csc-card-text">{readiiDo || '—'}</div></div>
                    </div>

                    {deliverables?.length > 0 && (
                      <div style={{marginTop:12}}>
                        <div className="csc-card-label">📦 交付物</div>
                        <ul style={{margin:'6px 0 0 16px',fontSize:13,color:'var(--text-secondary)',lineHeight:1.8}}>
                          {deliverables.map((d,i) => <li key={i}>{d}</li>)}
                        </ul>
                      </div>
                    )}

                    {stage.has_sku && p && (
                      <ServiceModePicker
                        stage={stage}
                        progress={p}
                        onPick={(mode) => handleSetMode(p.id, mode)}
                      />
                    )}

                    {stage.has_sub_module && stage.sub_module_type === 'hr_compliance' && (
                      <Link
                        to="/customer/hr-compliance"
                        onClick={e => e.stopPropagation()}
                        style={{
                          marginTop: 16, display: 'flex', alignItems: 'center', gap: 10,
                          padding: '12px 14px', border: '2px dashed #b8741a', borderRadius: 8,
                          textDecoration: 'none', color: 'var(--text-primary)', background: '#fff8ee',
                        }}
                      >
                        <span style={{fontSize:20}}>📋</span>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:600,fontSize:13}}>进入 HR 合规子模块（22 项）</div>
                          <div style={{fontSize:11,color:'var(--text-muted)'}}>逐项检查与证据留档</div>
                        </div>
                        <span style={{color:'#b8741a'}}>→</span>
                      </Link>
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

function ServiceModePicker({ stage, progress, onPick }) {
  const mode = progress.service_mode
  const confirmed = progress.service_mode_confirmed
  const price = formatPrice(stage.sku_price_pence)
  const memberPrice = formatPrice(stage.sku_member_price_pence)

  return (
    <div style={{marginTop:16,paddingTop:14,borderTop:'1px solid var(--border-subtle)'}}>
      <div style={{fontSize:12,textTransform:'uppercase',letterSpacing:'.06em',color:'var(--text-muted)',marginBottom:8,fontWeight:600}}>
        选择服务方式
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <button
          type="button"
          onClick={() => onPick('self')}
          style={{
            textAlign:'left',padding:'12px 14px',borderRadius:8,cursor:'pointer',
            border: mode === 'self' && confirmed ? '2px solid #1e7a3c' : '1px solid var(--border-subtle)',
            background: mode === 'self' && confirmed ? '#e6f4ea' : 'var(--bg-card)',
          }}
        >
          <div style={{fontSize:13,fontWeight:600,marginBottom:4}}>🛠 自助做</div>
          <div style={{fontSize:11,color:'var(--text-muted)'}}>{stage.sku_self_serve_label || '自助版'}</div>
        </button>
        <button
          type="button"
          onClick={() => onPick('delegate')}
          style={{
            textAlign:'left',padding:'12px 14px',borderRadius:8,cursor:'pointer',
            border: mode === 'delegate' && confirmed ? '2px solid #b8741a' : '1px solid var(--border-subtle)',
            background: mode === 'delegate' && confirmed ? '#fef8ed' : 'var(--bg-card)',
          }}
        >
          <div style={{fontSize:13,fontWeight:600,marginBottom:4}}>📦 委托 Readii</div>
          <div style={{fontSize:11,color:'var(--text-muted)'}}>
            {stage.sku_delegate_label || (price ? price : '委托版')}
            {memberPrice && <span style={{color:'#b8741a',marginLeft:4}}>· 会员 {memberPrice}</span>}
          </div>
        </button>
      </div>

      {mode === 'self' && confirmed && stage.sku_self_serve_content && (
        <div style={{marginTop:12,padding:'12px 14px',background:'#f8f8f6',borderRadius:8,fontSize:13,color:'var(--text-secondary)',whiteSpace:'pre-wrap',lineHeight:1.6}}>
          {stage.sku_self_serve_content}
        </div>
      )}
      {mode === 'delegate' && confirmed && (
        <div style={{marginTop:12,padding:'10px 14px',background:'#fef8ed',borderRadius:8,fontSize:12,color:'#b8741a'}}>
          已提交委托，Readii 团队会在 1 个工作日内联系你确认细节。
        </div>
      )}
    </div>
  )
}
