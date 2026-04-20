import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useRole } from '../../contexts/RoleContext'
import { hasPermission } from '../../lib/staffPermissions'
import { updateStageProgress } from '../../lib/api/admin'
import { attachProfile } from '../../lib/api/adminHelpers'
import {
  REPORT_TYPES, listReportsForCustomer, generateReport, getReportSignedUrl,
} from '../../lib/api/reports'

const TABS = [
  { id: 'overview', label: '概览' },
  { id: 'journey', label: 'Journey 进度' },
  { id: 'qa', label: '客户 QA' },
  { id: 'hr', label: 'HR 合规' },
  { id: 'reports', label: '报告' },
]

const STATUS_LABELS = {
  pending: '待开始', in_progress: '进行中',
  blocked_on_customer: '等待客户', blocked_on_readii: '等待 Readii',
  completed: '已完成', skipped: '已跳过',
}

export default function StaffCustomerDetail() {
  const { customerId } = useParams()
  const navigate = useNavigate()
  const { profile } = useRole()
  const staffRole = profile?.staff_role
  const [tab, setTab] = useState('overview')
  const [customer, setCustomer] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase
        .from('customer_profiles')
        .select('*')
        .eq('id', customerId)
        .single()
      setCustomer(await attachProfile(supabase, data))
      setLoading(false)
    })()
  }, [customerId])

  if (loading) return <div style={{padding:20,color:'var(--text-muted)'}}>加载中...</div>
  if (!customer) return <div style={{padding:20,color:'var(--text-muted)'}}>未找到客户</div>

  return (
    <div>
      <button onClick={() => navigate('/staff/customers')} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',fontSize:12,marginBottom:6,padding:0}}>
        ← 返回客户列表
      </button>
      <h1 style={{fontFamily:'var(--font-display)',fontSize:22,fontWeight:700,margin:'0 0 4px'}}>
        {customer.profiles?.full_name || customer.profiles?.email}
      </h1>
      <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:18}}>
        {customer.service_type} · {customer.visa_path === 'a_inside_uk' ? '路径 A' : customer.visa_path === 'b_outside_uk' ? '路径 B' : '未分路径'}
      </div>

      <div style={{display:'flex',gap:4,borderBottom:'1px solid var(--border-subtle)',marginBottom:20}}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding:'8px 14px',border:'none',background:'none',cursor:'pointer',fontSize:13,
              color: tab === t.id ? '#b8741a' : 'var(--text-muted)',
              fontWeight: tab === t.id ? 600 : 400,
              borderBottom: tab === t.id ? '2px solid #b8741a' : '2px solid transparent',
              marginBottom: -1,
            }}
          >{t.label}</button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab customer={customer} />}
      {tab === 'journey' && <JourneyTab customer={customer} staffRole={staffRole} />}
      {tab === 'qa' && <QATab customer={customer} staffRole={staffRole} />}
      {tab === 'hr' && <HRTab customer={customer} staffRole={staffRole} />}
      {tab === 'reports' && <ReportsTab customer={customer} staffRole={staffRole} />}
    </div>
  )
}

function KV({ label, value }) {
  return (
    <div style={{display:'flex',fontSize:13,padding:'4px 0'}}>
      <div style={{width:180,color:'var(--text-muted)'}}>{label}</div>
      <div style={{color:'var(--text-primary)',fontWeight:500}}>{value || '—'}</div>
    </div>
  )
}

function OverviewTab({ customer }) {
  return (
    <div style={{maxWidth:680}}>
      <h2 style={{fontSize:14,fontWeight:600,marginBottom:10}}>基本信息</h2>
      <KV label="客户 ID" value={customer.id} />
      <KV label="服务类型" value={customer.service_type} />
      <KV label="签约日期" value={customer.signed_date} />
      <KV label="签证路径" value={customer.visa_path} />
      <KV label="状态" value={customer.status} />
      <KV label="合同金额（便士）" value={customer.total_contract_value_pence} />
      <KV label="已付金额（便士）" value={customer.paid_amount_pence} />
      <KV label="问卷完成" value={customer.questionnaire_completed ? '已完成' : '未完成'} />
      <KV label="需要 TB 体检" value={customer.requires_tb_test ? '是' : '否'} />
      <KV label="需要无犯罪证明" value={customer.requires_criminal_record ? '是' : '否'} />
      <KV label="运营陪跑" value={customer.needs_mentoring ? '是' : '否'} />
      <KV label="预计完成日期" value={customer.expected_completion_date} />

      {customer.warnings && customer.warnings.length > 0 && (
        <>
          <h2 style={{fontSize:14,fontWeight:600,margin:'20px 0 10px'}}>风险预警</h2>
          {customer.warnings.map((w, i) => (
            <div key={i} style={{
              padding:'8px 12px',marginBottom:6,borderRadius:6,fontSize:12,
              background: w.severity === 'red' || w.severity === 'blocker' ? '#fde7e7' : '#fff4e0',
              color: w.severity === 'red' || w.severity === 'blocker' ? '#c33' : '#b8741a',
            }}>{w.message}</div>
          ))}
        </>
      )}
    </div>
  )
}

function JourneyTab({ customer, staffRole }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const canUpdate = hasPermission(staffRole, 'updateProgress')

  const reload = useCallback(async () => {
    const { data: template } = await supabase.from('journey_templates')
      .select('*').eq('service_type', customer.service_type).eq('is_active', true).maybeSingle()
    if (!template) { setRows([]); setLoading(false); return }
    const [{ data: stages }, { data: progress }] = await Promise.all([
      supabase.from('journey_stages').select('*').eq('template_id', template.id).order('stage_number'),
      supabase.from('customer_journey_progress').select('*').eq('customer_id', customer.id),
    ])
    const progressByStageId = Object.fromEntries((progress || []).map(p => [p.stage_id, p]))
    const merged = (stages || [])
      .filter(s => progressByStageId[s.id])
      .map(s => ({ stage: s, progress: progressByStageId[s.id] }))
    setRows(merged)
    setLoading(false)
  }, [customer.id, customer.service_type])

  useEffect(() => { reload() }, [reload])

  async function handleStatusChange(row, newStatus) {
    await updateStageProgress(customer.id, row.stage.id, { status: newStatus })
    await reload()
  }

  if (loading) return <div style={{fontSize:12,color:'var(--text-muted)'}}>加载中...</div>
  if (rows.length === 0) return <div style={{fontSize:12,color:'var(--text-muted)'}}>问卷未完成或 Journey 未生成</div>

  return (
    <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
      <thead>
        <tr style={{borderBottom:'1px solid var(--border-subtle)',textAlign:'left'}}>
          <th style={{padding:'8px',fontSize:10,textTransform:'uppercase',color:'var(--text-muted)'}}>#</th>
          <th style={{padding:'8px',fontSize:10,textTransform:'uppercase',color:'var(--text-muted)'}}>标题</th>
          <th style={{padding:'8px',fontSize:10,textTransform:'uppercase',color:'var(--text-muted)'}}>状态</th>
          <th style={{padding:'8px',fontSize:10,textTransform:'uppercase',color:'var(--text-muted)'}}>已用/预计</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.stage.id} style={{borderBottom:'1px solid var(--border-subtle)'}}>
            <td style={{padding:'8px',fontWeight:600,color:'var(--text-muted)'}}>{r.stage.stage_number}</td>
            <td style={{padding:'8px'}}>{r.stage.title}</td>
            <td style={{padding:'8px'}}>
              {canUpdate ? (
                <select
                  value={r.progress.status}
                  onChange={e => handleStatusChange(r, e.target.value)}
                  style={{fontSize:11,padding:'2px 4px'}}
                >
                  {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              ) : (
                <span style={{fontSize:11,padding:'2px 8px',borderRadius:100,background:'var(--bg-muted)'}}>{STATUS_LABELS[r.progress.status]}</span>
              )}
            </td>
            <td style={{padding:'8px',color:'var(--text-muted)',fontSize:11}}>
              {r.progress.started_at && r.progress.status !== 'completed'
                ? `${Math.floor((Date.now() - new Date(r.progress.started_at)) / 86400000)} / ${r.stage.estimated_duration_days || '—'} 天`
                : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function QATab({ customer, staffRole }) {
  const [qas, setQas] = useState([])
  const [loading, setLoading] = useState(true)
  const [answering, setAnswering] = useState({})
  const canAnswer = hasPermission(staffRole, 'answerQA')

  const reload = useCallback(async () => {
    const { data } = await supabase.from('customer_qa')
      .select('*')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
    setQas(data || [])
    setLoading(false)
  }, [customer.id])

  useEffect(() => { reload() }, [reload])

  async function handleAnswer(qaId) {
    const text = answering[qaId]?.trim()
    if (!text) return
    await supabase.from('customer_qa').update({
      answer: text,
      answered_by: null, // RLS restricts; supabase fills auth.uid() if column default set
      answered_at: new Date().toISOString(),
      status: 'answered',
    }).eq('id', qaId)
    setAnswering(a => ({ ...a, [qaId]: '' }))
    await reload()
  }

  if (loading) return <div style={{fontSize:12,color:'var(--text-muted)'}}>加载中...</div>
  if (qas.length === 0) return <div style={{fontSize:12,color:'var(--text-muted)'}}>暂无 QA 记录</div>

  return (
    <div>
      {qas.map(q => (
        <div key={q.id} style={{padding:12,border:'1px solid var(--border-subtle)',borderRadius:8,marginBottom:10,background:'var(--bg-card)'}}>
          <div style={{fontSize:11,color:'var(--text-muted)'}}>{new Date(q.created_at).toLocaleString('zh-CN')} · 状态：{q.status}</div>
          <div style={{fontSize:13,fontWeight:500,margin:'6px 0'}}>{q.question}</div>
          {q.answer ? (
            <div style={{padding:10,background:'var(--bg-muted)',borderRadius:6,fontSize:13}}>{q.answer}</div>
          ) : canAnswer ? (
            <div>
              <textarea
                rows={3}
                value={answering[q.id] || ''}
                onChange={e => setAnswering(a => ({ ...a, [q.id]: e.target.value }))}
                placeholder="输入回答..."
                style={{width:'100%',padding:8,fontSize:13,border:'1px solid var(--border-subtle)',borderRadius:6}}
              />
              <button
                onClick={() => handleAnswer(q.id)}
                disabled={!answering[q.id]?.trim()}
                style={{marginTop:6,padding:'6px 14px',background:'#1B2A4A',color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontSize:12}}
              >提交回答</button>
            </div>
          ) : (
            <div style={{fontSize:11,color:'var(--text-muted)',fontStyle:'italic'}}>你的角色没有回答权限</div>
          )}
        </div>
      ))}
    </div>
  )
}

function HRTab({ customer, staffRole }) {
  const [items, setItems] = useState([])
  const [progress, setProgress] = useState([])
  const [loading, setLoading] = useState(true)
  const canSignOff = hasPermission(staffRole, 'signOffHR')

  useEffect(() => {
    ;(async () => {
      const [{ data: its }, { data: prog }] = await Promise.all([
        supabase.from('hr_compliance_items').select('*').order('phase_number').order('item_number'),
        supabase.from('customer_hr_compliance').select('*').eq('customer_id', customer.id),
      ])
      setItems(its || [])
      setProgress(prog || [])
      setLoading(false)
    })()
  }, [customer.id])

  if (loading) return <div style={{fontSize:12,color:'var(--text-muted)'}}>加载中...</div>

  const progressByItemId = Object.fromEntries(progress.map(p => [p.item_id, p]))
  const completed = items.filter(i => ['completed', 'waived'].includes(progressByItemId[i.id]?.status)).length

  return (
    <div>
      <div style={{marginBottom:16,fontSize:13}}>
        进度 <strong>{completed}/{items.length}</strong>
        {!canSignOff && <span style={{marginLeft:12,color:'var(--text-muted)',fontSize:11}}>（你的角色无 Sign-Off 权限）</span>}
      </div>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
        <thead>
          <tr style={{borderBottom:'1px solid var(--border-subtle)',textAlign:'left'}}>
            <th style={{padding:'8px',fontSize:10,textTransform:'uppercase',color:'var(--text-muted)'}}>#</th>
            <th style={{padding:'8px',fontSize:10,textTransform:'uppercase',color:'var(--text-muted)'}}>Phase</th>
            <th style={{padding:'8px',fontSize:10,textTransform:'uppercase',color:'var(--text-muted)'}}>项目</th>
            <th style={{padding:'8px',fontSize:10,textTransform:'uppercase',color:'var(--text-muted)'}}>状态</th>
          </tr>
        </thead>
        <tbody>
          {items.map(i => {
            const p = progressByItemId[i.id]
            const status = p?.status || 'pending'
            return (
              <tr key={i.id} style={{borderBottom:'1px solid var(--border-subtle)'}}>
                <td style={{padding:'6px 8px',fontWeight:600,color:'var(--text-muted)'}}>{i.item_number}</td>
                <td style={{padding:'6px 8px',fontSize:11}}>Phase {i.phase_number}</td>
                <td style={{padding:'6px 8px'}}>{i.title}{i.is_signoff && <span style={{marginLeft:6,fontSize:10,padding:'1px 6px',background:'#fef8ed',color:'#b8741a',borderRadius:100}}>sign-off</span>}</td>
                <td style={{padding:'6px 8px'}}>
                  <span style={{
                    fontSize:10,padding:'2px 8px',borderRadius:100,
                    background: status === 'completed' ? '#e6f4ea' : status === 'in_progress' ? '#fff4e0' : 'var(--bg-muted)',
                    color: status === 'completed' ? '#1e7a3c' : status === 'in_progress' ? '#b8741a' : 'var(--text-muted)',
                  }}>{status}</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ReportsTab({ customer, staffRole }) {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const canGenerate = hasPermission(staffRole, 'generateReports')

  const reload = useCallback(async () => {
    const rows = await listReportsForCustomer(customer.id)
    setReports(rows)
    setLoading(false)
  }, [customer.id])

  useEffect(() => { reload() }, [reload])

  async function handleGenerate(type) {
    setBusy(type)
    try {
      await generateReport(type, customer.id)
      await reload()
    } catch (e) {
      alert('生成失败：' + (e.message || e))
    } finally {
      setBusy(null)
    }
  }
  async function handleDownload(path) {
    const url = await getReportSignedUrl(path)
    window.open(url, '_blank')
  }

  if (loading) return <div style={{fontSize:12,color:'var(--text-muted)'}}>加载中...</div>

  const byType = reports.reduce((acc, r) => { (acc[r.report_type] = acc[r.report_type] || []).push(r); return acc }, {})

  return (
    <div>
      {REPORT_TYPES.map(t => {
        const list = byType[t.key] || []
        const latest = list.find(r => r.is_latest)
        return (
          <div key={t.key} style={{padding:12,border:'1px solid var(--border-subtle)',borderRadius:8,marginBottom:8,background:'var(--bg-card)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontWeight:500,fontSize:13}}>{t.label}</div>
              <div style={{fontSize:11,color:'var(--text-muted)'}}>
                {latest ? `最新：${new Date(latest.created_at).toLocaleDateString('zh-CN')}` : '尚未生成'}
              </div>
            </div>
            <div style={{display:'flex',gap:6}}>
              {latest && (
                <button
                  onClick={() => handleDownload(latest.file_url)}
                  style={{padding:'5px 10px',border:'1px solid var(--border-subtle)',borderRadius:6,background:'var(--bg-card)',cursor:'pointer',fontSize:11}}
                >下载</button>
              )}
              {canGenerate && (
                <button
                  onClick={() => handleGenerate(t.key)}
                  disabled={busy === t.key}
                  style={{padding:'5px 10px',border:'none',borderRadius:6,background:'#1B2A4A',color:'#fff',cursor:'pointer',fontSize:11}}
                >{busy === t.key ? '...' : (latest ? '重新生成' : '生成')}</button>
              )}
            </div>
          </div>
        )
      })}
      {!canGenerate && <div style={{fontSize:11,color:'var(--text-muted)',marginTop:8}}>你的角色没有报告生成权限。</div>}
    </div>
  )
}
