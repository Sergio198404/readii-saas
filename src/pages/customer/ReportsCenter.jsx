import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useRole } from '../../contexts/RoleContext'
import {
  REPORT_TYPES, listReportsForCustomer, generateReport, getReportSignedUrl,
} from '../../lib/api/reports'

const CUSTOMER_TYPES = REPORT_TYPES.filter(t => t.customerVisible)

export default function ReportsCenter() {
  const { user } = useRole()
  const [customer, setCustomer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState([])
  const [busy, setBusy] = useState(null)

  const reload = useCallback(async (customerId) => {
    const rows = await listReportsForCustomer(customerId)
    setReports(rows)
  }, [])

  useEffect(() => {
    if (!user?.id) return
    ;(async () => {
      try {
        const { data: cust } = await supabase.from('customer_profiles').select('*').eq('user_id', user.id).maybeSingle()
        if (!cust) { setLoading(false); return }
        setCustomer(cust)
        await reload(cust.id)
      } finally {
        setLoading(false)
      }
    })()
  }, [user?.id, reload])

  async function handleGenerate(type) {
    setBusy(type)
    try {
      await generateReport(type, customer.id)
      await reload(customer.id)
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
      alert('获取下载链接失败：' + (e.message || e))
    }
  }

  if (loading) return <div style={{padding:40,textAlign:'center',color:'var(--text-muted)',fontSize:13}}>加载中...</div>
  if (!customer) return <div style={{padding:40,textAlign:'center',color:'var(--text-muted)',fontSize:13}}>客户档案未建立</div>

  const byType = reports.reduce((acc, r) => { (acc[r.report_type] = acc[r.report_type] || []).push(r); return acc }, {})

  return (
    <div style={{maxWidth:720}}>
      <h1 style={{fontFamily:'var(--font-display)',fontSize:22,fontWeight:700,margin:'0 0 4px'}}>我的报告</h1>
      <div style={{fontSize:13,color:'var(--text-muted)',marginBottom:24}}>
        所有报告以 PDF 格式生成。下载链接 10 分钟有效，过期可重新获取。
      </div>

      {CUSTOMER_TYPES.map(t => {
        const list = byType[t.key] || []
        const latest = list.find(r => r.is_latest)
        const canGenerate = t.key === 'journey_progress' || t.key === 'monthly_operations' || t.key === 'hr_compliance_audit'
        return (
          <div key={t.key} style={{
            padding: 16, border: '1px solid var(--border-subtle)', borderRadius: 12,
            background: 'var(--bg-card)', marginBottom: 14,
          }}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
              <div>
                <div style={{fontWeight:600,fontSize:14}}>{t.label}</div>
                {latest
                  ? <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>
                      最新版：{new Date(latest.created_at).toLocaleString('zh-CN')}
                    </div>
                  : <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>尚未生成</div>}
              </div>
              <div style={{display:'flex',gap:8}}>
                {latest && (
                  <button
                    onClick={() => handleDownload(latest.file_url)}
                    style={{padding:'7px 14px',border:'1px solid var(--border-subtle)',borderRadius:6,background:'var(--bg-card)',cursor:'pointer',fontSize:12}}
                  >下载 PDF</button>
                )}
                {canGenerate && (
                  <button
                    onClick={() => handleGenerate(t.key)}
                    disabled={busy === t.key}
                    style={{padding:'7px 14px',border:'none',borderRadius:6,background:'#1B2A4A',color:'#fff',cursor:'pointer',fontSize:12}}
                  >{busy === t.key ? '生成中...' : latest ? '重新生成' : '生成'}</button>
                )}
              </div>
            </div>

            {list.length > 1 && (
              <details style={{marginTop:8}}>
                <summary style={{fontSize:12,color:'var(--text-muted)',cursor:'pointer'}}>历史版本（{list.length - 1}）</summary>
                <div style={{marginTop:8}}>
                  {list.filter(r => !r.is_latest).map(r => (
                    <div key={r.id} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',fontSize:12,borderTop:'1px solid var(--border-subtle)'}}>
                      <span>{new Date(r.created_at).toLocaleDateString('zh-CN')}</span>
                      <button
                        onClick={() => handleDownload(r.file_url)}
                        style={{border:'none',background:'none',color:'#1B2A4A',textDecoration:'underline',cursor:'pointer',fontSize:12}}
                      >下载</button>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )
      })}
    </div>
  )
}
