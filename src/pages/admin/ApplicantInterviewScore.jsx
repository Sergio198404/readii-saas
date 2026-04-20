import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Sidebar from '../../components/layout/Sidebar'
import { supabase } from '../../lib/supabase'
import { getApplicantScores, upsertApplicantScores, generateReport, getReportSignedUrl } from '../../lib/api/reports'
import './AdminPages.css'

const DIMENSIONS = [
  { key: 'consistency', label: '信息一致性', max: 25 },
  { key: 'job', label: '工作内容理解', max: 25 },
  { key: 'employer', label: '雇主关系真实性', max: 20 },
  { key: 'lifestyle', label: '英国生活准备度', max: 15 },
  { key: 'english', label: '英语表达', max: 15 },
]

const EMPTY = {
  applicant_name: '', consultant_name: '',
  session1_date: '', session1_mode: '中文逻辑梳理', session1_duration_minutes: 45,
  session2_date: '', session2_mode: '英语全真模拟', session2_duration_minutes: 45,
  special_notes: '', final_verdict: 'needs_more',
}

export default function ApplicantInterviewScore() {
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
        supabase.from('customer_profiles').select('*, profiles:user_id(full_name, email)').eq('id', customerId).single(),
        getApplicantScores(customerId),
      ])
      setCustomer(cust)
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
      await upsertApplicantScores({ customer_id: customerId, ...row, scored_at: new Date().toISOString() })
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
      const res = await generateReport('applicant_interview_readiness', customerId)
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
            <h1 className="ap-title">申请人面试评分录入</h1>
            <div className="ap-subtitle">{customer?.profiles?.full_name || customer?.profiles?.email} · 共 2 次模拟</div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button className="ap-ghost-btn" onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '保存'}</button>
            <button className="ap-add-btn" onClick={handleGenerate} disabled={generating || !row.session2_date}>
              {generating ? '生成中...' : '保存并生成 PDF'}
            </button>
          </div>
        </header>

        <div className="ap-body" style={{maxWidth:900}}>
          <div className="ap-form-row">
            <div className="ap-field" style={{flex:1}}><label>申请人姓名</label><input value={row.applicant_name || ''} onChange={set('applicant_name')} /></div>
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

          {[1, 2].map(i => (
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
            <label>自雇场景特别注意事项</label>
            <textarea rows={4} value={row.special_notes || ''} onChange={set('special_notes')} placeholder="针对此客户特定情况的个性化提醒..." />
          </div>
        </div>
      </main>
    </div>
  )
}
