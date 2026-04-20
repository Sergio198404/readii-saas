import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Sidebar from '../../components/layout/Sidebar'
import { supabase } from '../../lib/supabase'
import {
  listHRItems, getCustomerHRProgress, ensureHRProgressInit,
  updateHRProgress, getHREvidenceSignedUrl, groupByPhase, isAllCompleted,
} from '../../lib/api/hrCompliance'
import './AdminPages.css'

const PHASE_TITLES = {
  1: 'Phase 1：现有员工合规审计',
  2: 'Phase 2：雇佣合同和政策文件',
  3: 'Phase 3：Payroll / HMRC / ICO',
  4: 'Phase 4：招聘和入职流程',
}

const STATUS_OPTIONS = [
  { value: 'pending', label: '待完成' },
  { value: 'in_progress', label: '进行中' },
  { value: 'completed', label: '已完成' },
  { value: 'waived', label: '豁免' },
]

export default function CustomerHRCompliance() {
  const { customerId } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [customer, setCustomer] = useState(null)
  const [items, setItems] = useState([])
  const [progress, setProgress] = useState([])

  const reload = useCallback(async () => {
    const [its, prog] = await Promise.all([
      listHRItems(),
      getCustomerHRProgress(customerId),
    ])
    setItems(its)
    setProgress(prog)
  }, [customerId])

  useEffect(() => {
    ;(async () => {
      const { data: cust } = await supabase.from('customer_profiles')
        .select('*, profiles:user_id(full_name, email)').eq('id', customerId).single()
      setCustomer(cust)
      await ensureHRProgressInit(customerId)
      await reload()
      setLoading(false)
    })()
  }, [customerId, reload])

  async function handleSignOff(phaseNum) {
    const code = phaseNum === 1 ? '3_1' : '4_1'
    const signoffItem = items.find(i => i.item_code === code)
    if (!signoffItem) return
    const signoffProgress = progress.find(p => p.item_id === signoffItem.id)
    if (!signoffProgress) return
    if (!confirm(`确认签字完成 Phase ${phaseNum}？`)) return
    await updateHRProgress(signoffProgress.id, { status: 'completed', completed_by: 'readii' })
    await reload()
  }

  async function handleStatusChange(progressId, status) {
    await updateHRProgress(progressId, { status, completed_by: status === 'completed' ? 'readii' : null })
    await reload()
  }

  async function handleViewEvidence(path) {
    try {
      const url = await getHREvidenceSignedUrl(path)
      window.open(url, '_blank')
    } catch (err) {
      alert('打开失败：' + (err.message || err))
    }
  }

  if (loading) return <div className="app-layout"><Sidebar badgeCounts={{}} /><main className="main ap-page"><div className="ap-empty">加载中...</div></main></div>
  if (!customer) return <div className="app-layout"><Sidebar badgeCounts={{}} /><main className="main ap-page"><div className="ap-empty">未找到客户</div></main></div>

  const phases = groupByPhase(items, progress)
  const progressByItemId = Object.fromEntries(progress.map(p => [p.item_id, p]))
  const completedCount = progress.filter(p => p.status === 'completed' || p.status === 'waived').length
  const allDone = isAllCompleted(items, progress)

  const phase1Completed = (phases[1] || []).every(({ progress: p }) => p?.status === 'completed' || p?.status === 'waived')
  const phase2Completed = (phases[2] || []).every(({ progress: p }) => p?.status === 'completed' || p?.status === 'waived')
  const signoffPhase1 = items.find(i => i.item_code === '3_1')
  const signoffPhase2 = items.find(i => i.item_code === '4_1')
  const signoffPhase1Done = signoffPhase1 && progressByItemId[signoffPhase1.id]?.status === 'completed'
  const signoffPhase2Done = signoffPhase2 && progressByItemId[signoffPhase2.id]?.status === 'completed'

  return (
    <div className="app-layout">
      <Sidebar badgeCounts={{}} />
      <main className="main ap-page">
        <header className="ap-header">
          <div>
            <button className="ap-back" onClick={() => navigate(`/admin/customers/${customerId}/progress`)}>← 返回客户进度</button>
            <h1 className="ap-title">{customer.profiles?.full_name || customer.profiles?.email} · HR 合规</h1>
            <div className="ap-subtitle">{completedCount}/{items.length} 已完成{allDone && '（可生成报告）'}</div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button
              className="ap-add-btn"
              onClick={() => handleSignOff(1)}
              disabled={!phase1Completed || signoffPhase1Done}
              title={phase1Completed ? '' : 'Phase 1 其他 7 项全部完成后方可签字'}
              style={{background: signoffPhase1Done ? '#ccc' : undefined}}
            >
              {signoffPhase1Done ? '✓ Phase 1 已签字' : 'Phase 1 Sign-Off'}
            </button>
            <button
              className="ap-add-btn"
              onClick={() => handleSignOff(2)}
              disabled={!phase2Completed || signoffPhase2Done}
              title={phase2Completed ? '' : 'Phase 2 全部完成后方可签字'}
              style={{background: signoffPhase2Done ? '#ccc' : undefined}}
            >
              {signoffPhase2Done ? '✓ Phase 2 已签字' : 'Phase 2 Sign-Off'}
            </button>
          </div>
        </header>

        <div className="ap-body" style={{maxWidth:900}}>
          {[1, 2, 3, 4].map(phaseNum => {
            const phaseItems = phases[phaseNum] || []
            const phaseCompleted = phaseItems.filter(({ progress: p }) => p?.status === 'completed' || p?.status === 'waived').length

            return (
              <div key={phaseNum} style={{marginBottom:24}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
                  <h3 style={{margin:0,fontSize:14,fontWeight:600}}>{PHASE_TITLES[phaseNum]}</h3>
                  <span style={{fontSize:12,color:'var(--text-muted)'}}>{phaseCompleted}/{phaseItems.length}</span>
                </div>

                <table className="ap-table">
                  <thead><tr><th>#</th><th>项目</th><th>证据</th><th>状态</th><th>完成于</th></tr></thead>
                  <tbody>
                    {phaseItems.map(({ item, progress: p }) => {
                      const sign = item.is_signoff
                      return (
                        <tr key={item.id}>
                          <td className="ap-stage-num">{item.item_number}</td>
                          <td className="ap-stage-title">
                            {item.title}
                            {sign && <span style={{marginLeft:8,fontSize:10,padding:'1px 6px',background:'#fef8ed',color:'#b8741a',borderRadius:100}}>sign-off</span>}
                          </td>
                          <td>
                            {p?.evidence_url ? (
                              <button
                                className="ap-sm-btn"
                                onClick={() => handleViewEvidence(p.evidence_url)}
                              >📎 查看</button>
                            ) : sign ? <span style={{color:'var(--text-muted)',fontSize:11}}>—</span> : <span style={{color:'var(--text-muted)',fontSize:11}}>未上传</span>}
                          </td>
                          <td>
                            <select
                              value={p?.status || 'pending'}
                              onChange={e => handleStatusChange(p.id, e.target.value)}
                              style={{fontSize:11,padding:'3px 6px'}}
                            >
                              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </td>
                          <td style={{fontSize:11,color:'var(--text-muted)'}}>
                            {p?.completed_at ? new Date(p.completed_at).toLocaleDateString('zh-CN') : '—'}
                            {p?.completed_by && <span style={{marginLeft:4}}>· {p.completed_by}</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
