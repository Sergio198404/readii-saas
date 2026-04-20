import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Sidebar from '../../components/layout/Sidebar'
import { supabase } from '../../lib/supabase'
import {
  REPORT_TYPES, listReportsForCustomer, generateReport, getReportSignedUrl,
} from '../../lib/api/reports'
import './AdminPages.css'

export default function CustomerReports() {
  const { customerId } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [customer, setCustomer] = useState(null)
  const [reports, setReports] = useState([])
  const [busy, setBusy] = useState(null)

  const reload = useCallback(async () => {
    const rows = await listReportsForCustomer(customerId)
    setReports(rows)
  }, [customerId])

  useEffect(() => {
    ;(async () => {
      const { data: cust } = await supabase
        .from('customer_profiles')
        .select('*, profiles:user_id(full_name, email)')
        .eq('id', customerId)
        .single()
      setCustomer(cust)
      await reload()
      setLoading(false)
    })()
  }, [customerId, reload])

  async function handleGenerate(type) {
    setBusy(type)
    try {
      const res = await generateReport(type, customerId)
      await reload()
      alert(`已生成 ${res.fileName}`)
    } catch (e) {
      alert('生成失败：' + (e.message || e))
    } finally {
      setBusy(null)
    }
  }

  async function handleDownload(path) {
    try {
      const url = await getReportSignedUrl(path)
      window.open(url, '_blank')
    } catch (e) {
      alert('获取链接失败：' + (e.message || e))
    }
  }

  if (loading) return <div className="app-layout"><Sidebar badgeCounts={{}} /><main className="main ap-page"><div className="ap-empty">加载中...</div></main></div>
  if (!customer) return <div className="app-layout"><Sidebar badgeCounts={{}} /><main className="main ap-page"><div className="ap-empty">未找到客户</div></main></div>

  const byType = reports.reduce((acc, r) => { (acc[r.report_type] = acc[r.report_type] || []).push(r); return acc }, {})

  return (
    <div className="app-layout">
      <Sidebar badgeCounts={{}} />
      <main className="main ap-page">
        <header className="ap-header">
          <div>
            <button className="ap-back" onClick={() => navigate('/admin/customers')}>← 返回客户列表</button>
            <h1 className="ap-title">{customer.profiles?.full_name || customer.profiles?.email} · 报告中心</h1>
            <div className="ap-subtitle">所有 7 种报告的生成入口和历史记录。</div>
          </div>
        </header>

        <div className="ap-body" style={{maxWidth:860}}>
          {REPORT_TYPES.map(t => {
            const list = byType[t.key] || []
            const latest = list.find(r => r.is_latest)

            return (
              <div key={t.key} style={{
                padding: 16, border: '1px solid var(--border-subtle)', borderRadius: 12,
                background: 'var(--bg-card)', marginBottom: 14,
              }}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                  <div>
                    <div style={{fontWeight:600,fontSize:14}}>{t.label}</div>
                    <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>
                      {t.customerVisible ? '客户可见' : '仅内部'} · 已生成 {list.length} 次
                    </div>
                    {latest && (
                      <div style={{fontSize:12,color:'var(--text-muted)',marginTop:4}}>
                        最新：{new Date(latest.created_at).toLocaleString('zh-CN')}
                      </div>
                    )}
                  </div>
                  <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                    {t.key === 'ao_interview_readiness' && (
                      <button
                        className="ap-ghost-btn"
                        onClick={() => navigate(`/admin/customers/${customerId}/ao-interview-score`)}
                      >录入评分</button>
                    )}
                    {t.key === 'applicant_interview_readiness' && (
                      <button
                        className="ap-ghost-btn"
                        onClick={() => navigate(`/admin/customers/${customerId}/applicant-interview-score`)}
                      >录入评分</button>
                    )}
                    {t.key === 'monthly_operations' && (
                      <button
                        className="ap-ghost-btn"
                        onClick={() => navigate(`/admin/customers/${customerId}/monthly-ops`)}
                      >录入月度数据</button>
                    )}
                    {latest && (
                      <button className="ap-ghost-btn" onClick={() => handleDownload(latest.file_url)}>下载 PDF</button>
                    )}
                    <button
                      className="ap-add-btn"
                      onClick={() => handleGenerate(t.key)}
                      disabled={busy === t.key}
                    >{busy === t.key ? '生成中...' : latest ? '重新生成' : '生成'}</button>
                  </div>
                </div>

                {list.length > 1 && (
                  <details style={{marginTop:8}}>
                    <summary style={{fontSize:12,color:'var(--text-muted)',cursor:'pointer'}}>历史版本（{list.length - 1}）</summary>
                    <div style={{marginTop:8}}>
                      {list.filter(r => !r.is_latest).map(r => (
                        <div key={r.id} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',fontSize:12,borderTop:'1px solid var(--border-subtle)'}}>
                          <span>{new Date(r.created_at).toLocaleString('zh-CN')}</span>
                          <button className="ap-sm-btn" onClick={() => handleDownload(r.file_url)}>下载</button>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
