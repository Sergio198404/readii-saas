import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Sidebar from '../../components/layout/Sidebar'
import { supabase } from '../../lib/supabase'
import { attachProfile } from '../../lib/api/adminHelpers'
import { getAOScores, upsertAOScores, generateReport, getReportSignedUrl } from '../../lib/api/reports'
import './AdminPages.css'

const DIMENSIONS = [
  { key: 'business', label: '公司业务理解', max: 20 },
  { key: 'role', label: '岗位真实性论证', max: 25 },
  { key: 'compliance', label: '合规义务掌握', max: 25 },
  { key: 'english', label: '英语表达清晰度', max: 20 },
  { key: 'composure', label: '镇定与可信度', max: 10 },
]

const EMPTY = {
  ao_name: '', consultant_name: '',
  session1_date: '', session1_mode: '英语熟悉', session1_duration_minutes: 45,
  session2_date: '', session2_mode: '中文梳理', session2_duration_minutes: 45,
  session3_date: '', session3_mode: '英语全真模拟', session3_duration_minutes: 45,
  weaknesses_notes: '', final_verdict: 'needs_more',
}

export default function AOInterviewScore() {
  const { customerId } = useParams()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [row, setRow] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    ;(async () => {
      const [{ data: cust }, existing] = await Promise.all([
        supabase.from('customer_profiles').select('*').eq('id', customerId).single(),
        getAOScores(customerId),
      ])
      setCustomer(await attachProfile(supabase, cust))
      if (existing) setRow({ ...EMPTY, ...existing })
      setLoading(false)
    })()
  }, [customerId])

  function set(field) {
    return (e) => setRow(p => ({ ...p, [field]: e.target.type === 'number' ? Number(e.target.value) : e.target.value }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await upsertAOScores({ customer_id: customerId, ...row, scored_at: new Date().toISOString() })
      alert('已保存')
    } catch (e) {
      alert('保存失败：' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  async function handleGenerate() {
    await handleSave()
    setGenerating(true)
    try {
      const res = await generateReport('ao_interview_readiness', customerId)
      const url = await getReportSignedUrl(res.filePath)
      window.open(url, '_blank')
    } catch (e) {
      alert('生成报告失败：' + (e.message || e))
    } finally {
      setGenerating(false)
    }
  }

  function sessionTotal(i) {
    return DIMENSIONS.reduce((s, d) => s + (Number(row[`session${i}_${d.key}_score`]) || 0), 0)
  }

  if (loading) return <div className="app-layout"><Sidebar badgeCounts={{}} /><main className="main ap-page"><div className="ap-empty">加载中...</div></main></div>

  return (
    <div className="app-layout">
      <Sidebar badgeCounts={{}} />
      <main className="main ap-page">
        <header className="ap-header">
          <div>
            <button className="ap-back" onClick={() => navigate(`/admin/customers/${customerId}/reports`)}>← 返回报告中心</button>
            <h1 className="ap-title">AO 面试评分录入</h1>
            <div className="ap-subtitle">{customer?.profiles?.full_name || customer?.profiles?.email} · 共 3 次模拟</div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button className="ap-ghost-btn" onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '保存'}</button>
            <button className="ap-add-btn" onClick={handleGenerate} disabled={generating || !row.session3_date}>
              {generating ? '生成中...' : '保存并生成 PDF'}
            </button>
          </div>
        </header>

        <div className="ap-body" style={{maxWidth:900}}>
          <div className="ap-form-row">
            <div className="ap-field" style={{flex:1}}><label>AO 姓名</label><input value={row.ao_name || ''} onChange={set('ao_name')} /></div>
            <div className="ap-field" style={{flex:1}}><label>评估顾问</label><input value={row.consultant_name || ''} onChange={set('consultant_name')} /></div>
            <div className="ap-field" style={{maxWidth:180}}>
              <label>最终结论</label>
              <select value={row.final_verdict} onChange={set('final_verdict')}>
                <option value="needs_more">需继续练习</option>
                <option value="pass">通过</option>
                <option value="fail">未通过</option>
              </select>
            </div>
          </div>

          {[1, 2, 3].map(i => (
            <div key={i} style={{marginTop:20,padding:14,border:'1px solid var(--border-subtle)',borderRadius:8,background:'var(--bg-card)'}}>
              <h3 style={{margin:'0 0 10px',fontSize:14,fontWeight:600}}>第 {i} 次模拟</h3>
              <div className="ap-form-row">
                <div className="ap-field" style={{flex:1}}><label>日期</label><input type="date" value={row[`session${i}_date`] || ''} onChange={set(`session${i}_date`)} /></div>
                <div className="ap-field" style={{flex:1}}><label>模式</label><input value={row[`session${i}_mode`] || ''} onChange={set(`session${i}_mode`)} /></div>
                <div className="ap-field" style={{maxWidth:120}}><label>时长（分钟）</label><input type="number" value={row[`session${i}_duration_minutes`] || ''} onChange={set(`session${i}_duration_minutes`)} /></div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:10,marginTop:8}}>
                {DIMENSIONS.map(d => (
                  <div key={d.key} className="ap-field">
                    <label>{d.label}（{d.max}）</label>
                    <input
                      type="number" min="0" max={d.max}
                      value={row[`session${i}_${d.key}_score`] ?? ''}
                      onChange={set(`session${i}_${d.key}_score`)}
                    />
                  </div>
                ))}
              </div>
              <div style={{marginTop:6,fontSize:12,color:'var(--text-muted)'}}>本次总分：{sessionTotal(i)}/100</div>
            </div>
          ))}

          <div className="ap-field" style={{marginTop:20}}>
            <label>主要薄弱点（改进说明）</label>
            <textarea rows={5} value={row.weaknesses_notes || ''} onChange={set('weaknesses_notes')} placeholder="每次面试发现的问题和已改进情况..." />
          </div>
        </div>
      </main>
    </div>
  )
}
