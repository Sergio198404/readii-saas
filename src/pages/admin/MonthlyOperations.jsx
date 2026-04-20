import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Sidebar from '../../components/layout/Sidebar'
import { supabase } from '../../lib/supabase'
import { getMonthlyOperations, saveMonthlyOperations, generateReport, getReportSignedUrl } from '../../lib/api/reports'
import './AdminPages.css'

const EMPTY_ROW = () => ({
  month: new Date().toISOString().slice(0, 7),
  revenue: 0,
  bank_balance: 0,
  paye_amount: 0,
  employees: 1,
  sl_status: '',
  sms_required: false,
  actions_completed: [],
  risks: [],
  next_month_todos: [],
  readii_summary: '',
})

export default function MonthlyOperations() {
  const { customerId } = useParams()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [editing, setEditing] = useState(null)

  useEffect(() => {
    ;(async () => {
      const [{ data: cust }, arr] = await Promise.all([
        supabase.from('customer_profiles').select('*, profiles:user_id(full_name, email)').eq('id', customerId).single(),
        getMonthlyOperations(customerId),
      ])
      setCustomer(cust)
      setRows(arr)
      setLoading(false)
    })()
  }, [customerId])

  async function saveRow(idx, row) {
    const next = [...rows]
    if (idx === -1) next.push(row); else next[idx] = row
    next.sort((a, b) => a.month.localeCompare(b.month))
    await saveMonthlyOperations(customerId, next)
    setRows(next)
    setEditing(null)
  }

  async function deleteRow(idx) {
    if (!confirm('确认删除此月份记录？')) return
    const next = rows.filter((_, i) => i !== idx)
    await saveMonthlyOperations(customerId, next)
    setRows(next)
  }

  async function handleGenerateLatest() {
    try {
      const res = await generateReport('monthly_operations', customerId)
      const url = await getReportSignedUrl(res.filePath)
      window.open(url, '_blank')
    } catch (e) {
      alert('生成失败：' + (e.message || e))
    }
  }

  if (loading) return <div className="app-layout"><Sidebar badgeCounts={{}} /><main className="main ap-page"><div className="ap-empty">加载中...</div></main></div>

  return (
    <div className="app-layout">
      <Sidebar badgeCounts={{}} />
      <main className="main ap-page">
        <header className="ap-header">
          <div>
            <button className="ap-back" onClick={() => navigate(`/admin/customers/${customerId}/reports`)}>← 返回报告中心</button>
            <h1 className="ap-title">月度运营数据录入</h1>
            <div className="ap-subtitle">{customer?.profiles?.full_name || customer?.profiles?.email} · 共 {rows.length} 个月份记录</div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button className="ap-ghost-btn" onClick={() => setEditing({ row: EMPTY_ROW(), idx: -1 })}>+ 新增月份</button>
            <button className="ap-add-btn" onClick={handleGenerateLatest} disabled={rows.length === 0}>
              生成本月报告
            </button>
          </div>
        </header>

        <div className="ap-body" style={{maxWidth:820}}>
          {rows.length === 0 && !editing && <div className="ap-empty">还没有月份记录，点击"新增月份"开始</div>}

          {rows.map((r, idx) => (
            editing?.idx === idx ? (
              <MonthForm key={idx} initial={r} onSave={(v) => saveRow(idx, v)} onCancel={() => setEditing(null)} />
            ) : (
              <div key={idx} style={{padding:14,border:'1px solid var(--border-subtle)',borderRadius:8,background:'var(--bg-card)',marginBottom:10}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div>
                    <div style={{fontWeight:600,fontSize:14}}>{r.month}</div>
                    <div style={{fontSize:11,color:'var(--text-muted)'}}>
                      营业额 £{Number(r.revenue).toLocaleString()} · 余额 £{Number(r.bank_balance).toLocaleString()} · 员工 {r.employees}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:6}}>
                    <button className="ap-sm-btn" onClick={() => setEditing({ row: r, idx })}>编辑</button>
                    <button className="ap-sm-btn" style={{color:'#c33'}} onClick={() => deleteRow(idx)}>删除</button>
                  </div>
                </div>
              </div>
            )
          ))}

          {editing?.idx === -1 && (
            <MonthForm initial={editing.row} onSave={(v) => saveRow(-1, v)} onCancel={() => setEditing(null)} />
          )}
        </div>
      </main>
    </div>
  )
}

function MonthForm({ initial, onSave, onCancel }) {
  const [r, setR] = useState(initial)
  function set(field) {
    return (e) => {
      const v = e.target.type === 'number' ? Number(e.target.value)
        : e.target.type === 'checkbox' ? e.target.checked
        : e.target.value
      setR(p => ({ ...p, [field]: v }))
    }
  }
  function setList(field, text) {
    setR(p => ({ ...p, [field]: text.split('\n').map(s => s.trim()).filter(Boolean) }))
  }

  return (
    <div style={{padding:16,border:'1px solid var(--border-subtle)',borderRadius:8,background:'var(--bg-muted)',marginBottom:10}}>
      <div className="ap-form-row">
        <div className="ap-field" style={{flex:1}}><label>月份（YYYY-MM）</label><input value={r.month} onChange={set('month')} placeholder="2026-04" /></div>
        <div className="ap-field" style={{flex:1}}><label>员工数</label><input type="number" value={r.employees} onChange={set('employees')} /></div>
      </div>
      <div className="ap-form-row">
        <div className="ap-field" style={{flex:1}}><label>营业额（£）</label><input type="number" value={r.revenue} onChange={set('revenue')} /></div>
        <div className="ap-field" style={{flex:1}}><label>月末银行余额（£）</label><input type="number" value={r.bank_balance} onChange={set('bank_balance')} /></div>
        <div className="ap-field" style={{flex:1}}><label>PAYE 申报额（£）</label><input type="number" value={r.paye_amount} onChange={set('paye_amount')} /></div>
      </div>
      <div className="ap-form-row">
        <div className="ap-field" style={{flex:1}}><label>SL 状态</label><input value={r.sl_status || ''} onChange={set('sl_status')} placeholder="申请中 / 已获批..." /></div>
        <div className="ap-field" style={{maxWidth:220}}>
          <label><input type="checkbox" checked={!!r.sms_required} onChange={set('sms_required')} /> 本月 SMS 需上报</label>
        </div>
      </div>
      <div className="ap-field">
        <label>本月完成的合规动作（每行一条）</label>
        <textarea rows={4} value={(r.actions_completed || []).join('\n')} onChange={e => setList('actions_completed', e.target.value)} />
      </div>
      <div className="ap-field">
        <label>风险预警（每行一条）</label>
        <textarea rows={3} value={(r.risks || []).join('\n')} onChange={e => setList('risks', e.target.value)} />
      </div>
      <div className="ap-field">
        <label>下月重点待办（每行一条）</label>
        <textarea rows={3} value={(r.next_month_todos || []).join('\n')} onChange={e => setList('next_month_todos', e.target.value)} />
      </div>
      <div className="ap-field">
        <label>Readii 顾问本月工作摘要</label>
        <textarea rows={3} value={r.readii_summary || ''} onChange={set('readii_summary')} />
      </div>
      <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
        <button className="ap-ghost-btn" onClick={onCancel}>取消</button>
        <button className="ap-add-btn" onClick={() => onSave(r)}>保存</button>
      </div>
    </div>
  )
}
