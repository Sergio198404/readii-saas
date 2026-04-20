import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useRole } from '../../contexts/RoleContext'
import { STAFF_ROLE_LABELS } from '../../lib/staffPermissions'
import { computeAlerts, daysSince } from '../../lib/complianceAlerts'

export default function StaffDashboard() {
  const { profile } = useRole()
  const staffRole = profile?.staff_role

  if (!staffRole) {
    return <div style={{padding:24,fontSize:13,color:'var(--text-muted)'}}>您的 staff_role 尚未分配，请联系管理员。</div>
  }

  return (
    <div>
      <div style={{marginBottom:20}}>
        <h1 style={{fontFamily:'var(--font-display)',fontSize:22,fontWeight:700,margin:0}}>
          {STAFF_ROLE_LABELS[staffRole]} · Dashboard
        </h1>
        <div style={{fontSize:13,color:'var(--text-muted)',marginTop:4}}>
          欢迎回来，{profile?.full_name || profile?.email}
        </div>
      </div>

      {staffRole === 'copywriter' && <KellyDashboard />}
      {staffRole === 'project_manager' && <LisaDashboard />}
      {staffRole === 'customer_manager' && <TimDashboard />}
      {staffRole === 'bdm' && <RyanDashboard />}
    </div>
  )
}

function Card({ title, count, children, accent }) {
  return (
    <div style={{
      padding:16, border:'1px solid var(--border-subtle)', borderRadius:12,
      background:'var(--bg-card)', marginBottom:14,
      borderLeft: accent ? `4px solid ${accent}` : '1px solid var(--border-subtle)',
    }}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
        <div style={{fontWeight:600,fontSize:14}}>{title}</div>
        {count != null && <div style={{fontSize:11,color:'var(--text-muted)'}}>共 {count} 项</div>}
      </div>
      {children}
    </div>
  )
}

function CustomerLink({ customerId, children }) {
  return <Link to={`/staff/customers/${customerId}`} style={{color:'#1B2A4A',textDecoration:'none'}}>{children}</Link>
}

function Empty({ text }) {
  return <div style={{padding:'20px 0',textAlign:'center',color:'var(--text-muted)',fontSize:12}}>{text}</div>
}

// ═══ Kelly（copywriter）═══
function KellyDashboard() {
  const [qas, setQas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('customer_qa')
      .select('*, customer_profiles!inner(id, profiles:user_id(full_name, email))')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(20)
      .then(({ data }) => { setQas(data || []); setLoading(false) })
  }, [])

  return (
    <>
      <Card title="待回答客户 QA" count={qas.length} accent="#1e7a3c">
        {loading ? <Empty text="加载中..." /> : qas.length === 0 ? <Empty text="暂无未回答的 QA" /> : (
          qas.map(q => (
            <div key={q.id} style={{padding:'10px 0',borderTop:'1px solid var(--border-subtle)',fontSize:13}}>
              <div style={{fontWeight:500}}>
                <CustomerLink customerId={q.customer_profiles.id}>
                  {q.customer_profiles.profiles?.full_name || q.customer_profiles.profiles?.email}
                </CustomerLink>
              </div>
              <div style={{color:'var(--text-secondary)',marginTop:4}}>{q.question}</div>
              <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>
                {new Date(q.created_at).toLocaleString('zh-CN')} · 已等 {daysSince(q.created_at)} 天
              </div>
            </div>
          ))
        )}
      </Card>
      <Card title="本周内容任务" accent="#b8741a">
        <Empty text="V1 暂未实装。FAQ / 素材管理将在 v2 接入。" />
      </Card>
    </>
  )
}

// ═══ Lisa（project_manager）═══
function LisaDashboard() {
  const [loading, setLoading] = useState(true)
  const [alerts, setAlerts] = useState([])
  const [overdueCount, setOverdueCount] = useState(0)

  useEffect(() => {
    ;(async () => {
      const [{ data: customers }, { data: progress }, { data: stages }] = await Promise.all([
        supabase.from('customer_profiles').select('*, profiles:user_id(full_name, email)'),
        supabase.from('customer_journey_progress').select('*'),
        supabase.from('journey_stages').select('*'),
      ])
      const stagesById = Object.fromEntries((stages || []).map(s => [s.id, s]))
      const progressByCustomer = {}
      for (const p of (progress || [])) {
        (progressByCustomer[p.customer_id] = progressByCustomer[p.customer_id] || []).push(p)
      }
      const computed = computeAlerts({
        customers: customers || [],
        progressByCustomer,
        stagesById,
      })
      setAlerts(computed)
      setOverdueCount(computed.filter(a => a.type === 'stage_overdue').length)
      setLoading(false)
    })()
  }, [])

  return (
    <>
      <Card
        title={`合规预警（${alerts.length} 条）`}
        count={alerts.length}
        accent={alerts.some(a => a.severity === 'red') ? '#c33' : '#b8741a'}
      >
        {loading ? <Empty text="加载中..." /> : alerts.length === 0 ? <Empty text="无预警，一切正常 ✓" /> : (
          alerts.map((a, i) => (
            <div key={i} style={{
              padding:'10px 12px',marginTop:8,borderRadius:6,fontSize:12,
              background: a.severity === 'red' ? '#fde7e7' : '#fff4e0',
              color: a.severity === 'red' ? '#c33' : '#b8741a',
            }}>
              <div style={{fontWeight:600}}>
                <CustomerLink customerId={a.customer_id}>
                  {a.customer_name || a.customer_id}
                </CustomerLink>
                <span style={{marginLeft:8,fontSize:10,textTransform:'uppercase'}}>[{a.type}]</span>
              </div>
              <div style={{marginTop:2}}>{a.message}</div>
              {a.detail && <div style={{marginTop:2,fontSize:11,opacity:.8}}>{a.detail}</div>}
            </div>
          ))
        )}
      </Card>
      <Card title="阶段超时阶段概览" count={overdueCount} accent="#b8741a">
        <div style={{fontSize:12,color:'var(--text-muted)'}}>
          已在"合规预警"中标红展示。详细里程碑日历将在 v2 接入。
        </div>
      </Card>
    </>
  )
}

// ═══ Tim（customer_manager）═══
function TimDashboard() {
  const [loading, setLoading] = useState(true)
  const [urgentQAs, setUrgentQAs] = useState([])
  const [todayMeetings, setTodayMeetings] = useState([])
  const [silentCustomers, setSilentCustomers] = useState([])

  useEffect(() => {
    ;(async () => {
      const now = new Date()
      const yesterday = new Date(now.getTime() - 24 * 3600 * 1000).toISOString()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()

      const [{ data: qas }, { data: meetings }, { data: silents }] = await Promise.all([
        supabase.from('customer_qa')
          .select('*, customer_profiles!inner(id, profiles:user_id(full_name, email))')
          .eq('status', 'pending')
          .lte('created_at', yesterday),
        supabase.from('customer_meetings')
          .select('*, customer_profiles!inner(id, profiles:user_id(full_name, email))')
          .gte('scheduled_at', todayStart)
          .lt('scheduled_at', todayEnd)
          .in('status', ['scheduled', 'confirmed'])
          .order('scheduled_at', { ascending: true }),
        supabase.from('customer_profiles')
          .select('*, profiles:user_id(full_name, email)')
          .eq('status', 'active')
          .order('updated_at', { ascending: true })
          .limit(5),
      ])
      setUrgentQAs(qas || [])
      setTodayMeetings(meetings || [])
      setSilentCustomers((silents || []).filter(c => daysSince(c.updated_at) >= 14))
      setLoading(false)
    })()
  }, [])

  return (
    <>
      <Card title="24 小时内未回复 QA" count={urgentQAs.length} accent="#c33">
        {loading ? <Empty text="加载中..." /> : urgentQAs.length === 0 ? <Empty text="无超时未回复 QA ✓" /> : (
          urgentQAs.map(q => (
            <div key={q.id} style={{padding:'10px 0',borderTop:'1px solid var(--border-subtle)',fontSize:13}}>
              <div>
                <CustomerLink customerId={q.customer_profiles.id}>
                  <strong>{q.customer_profiles.profiles?.full_name || q.customer_profiles.profiles?.email}</strong>
                </CustomerLink>
                <span style={{color:'#c33',marginLeft:8,fontSize:11}}>已等 {Math.round((Date.now() - new Date(q.created_at)) / 3600000)} 小时</span>
              </div>
              <div style={{color:'var(--text-secondary)',marginTop:4}}>{q.question}</div>
            </div>
          ))
        )}
      </Card>
      <Card title="今日会议" count={todayMeetings.length} accent="#1e7a3c">
        {todayMeetings.length === 0 ? <Empty text="今日无会议安排" /> : (
          todayMeetings.map(m => (
            <div key={m.id} style={{padding:'10px 0',borderTop:'1px solid var(--border-subtle)',fontSize:13}}>
              <CustomerLink customerId={m.customer_profiles.id}>
                {m.customer_profiles.profiles?.full_name || m.customer_profiles.profiles?.email}
              </CustomerLink>
              {' · '}{m.title}{' · '}{new Date(m.scheduled_at).toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit'})}
            </div>
          ))
        )}
      </Card>
      <Card title="长时间无互动（≥14 天）" count={silentCustomers.length} accent="#b8741a">
        {silentCustomers.length === 0 ? <Empty text="所有客户近期均有互动 ✓" /> : (
          silentCustomers.map(c => (
            <div key={c.id} style={{padding:'8px 0',borderTop:'1px solid var(--border-subtle)',fontSize:13}}>
              <CustomerLink customerId={c.id}>
                {c.profiles?.full_name || c.profiles?.email}
              </CustomerLink>
              <span style={{color:'var(--text-muted)',marginLeft:8,fontSize:11}}>最后活动 {daysSince(c.updated_at)} 天前</span>
            </div>
          ))
        )}
      </Card>
    </>
  )
}

// ═══ Ryan（bdm）═══
function RyanDashboard() {
  const [loading, setLoading] = useState(true)
  const [financialCustomers, setFinancialCustomers] = useState([])
  const [milestoneAlerts, setMilestoneAlerts] = useState([])

  useEffect(() => {
    ;(async () => {
      const { data: customers } = await supabase
        .from('customer_profiles')
        .select('*, profiles:user_id(full_name, email)')
        .eq('status', 'active')

      const withOps = (customers || []).filter(c => {
        const ops = Array.isArray(c.monthly_operations_data) ? c.monthly_operations_data : []
        return ops.length > 0
      })

      // Milestone check: <£30K by month 3 or <£100K by month 6
      const alerts = []
      for (const c of customers || []) {
        const ops = Array.isArray(c.monthly_operations_data) ? c.monthly_operations_data : []
        const cumulative = ops.reduce((s, m) => s + (Number(m.revenue) || 0), 0)
        if (ops.length >= 3 && cumulative < 30000) {
          alerts.push({ customer: c, months: ops.length, cumulative, target: 30000, label: '3 个月' })
        }
        if (ops.length >= 6 && cumulative < 100000) {
          alerts.push({ customer: c, months: ops.length, cumulative, target: 100000, label: '6 个月' })
        }
      }
      setFinancialCustomers(withOps)
      setMilestoneAlerts(alerts)
      setLoading(false)
    })()
  }, [])

  const totalRevenue = financialCustomers.reduce((s, c) => {
    const ops = c.monthly_operations_data || []
    return s + ops.reduce((s2, m) => s2 + (Number(m.revenue) || 0), 0)
  }, 0)

  return (
    <>
      <Card title="运营客户营业额总览" accent="#1e7a3c">
        <div style={{fontSize:24,fontWeight:700,color:'#1B2A4A'}}>
          £{totalRevenue.toLocaleString('en-GB')}
        </div>
        <div style={{fontSize:12,color:'var(--text-muted)',marginTop:4}}>
          来自 {financialCustomers.length} 位有月度数据的客户
        </div>
      </Card>
      <Card title="财务里程碑预警" count={milestoneAlerts.length} accent="#c33">
        {loading ? <Empty text="加载中..." /> : milestoneAlerts.length === 0 ? <Empty text="所有客户达标 ✓" /> : (
          milestoneAlerts.map((a, i) => (
            <div key={i} style={{padding:'8px 12px',marginTop:6,borderRadius:6,background:'#fff4e0',fontSize:12,color:'#b8741a'}}>
              <CustomerLink customerId={a.customer.id}>
                <strong>{a.customer.profiles?.full_name || a.customer.profiles?.email}</strong>
              </CustomerLink>
              {' · '}{a.label}节点累计 £{a.cumulative.toLocaleString('en-GB')} / 目标 £{a.target.toLocaleString('en-GB')}
            </div>
          ))
        )}
      </Card>
      <Card title="新线索 / 新签约" accent="#b8741a">
        <Empty text="V1 从现有客户数据系统读取（Admin 侧已有），此视图将在 v2 合并。" />
      </Card>
    </>
  )
}
