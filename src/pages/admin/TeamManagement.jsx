import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../../components/layout/Sidebar'
import { supabase } from '../../lib/supabase'
import { STAFF_ROLE_LABELS } from '../../lib/staffPermissions'
import './AdminPages.css'

const STAFF_ROLE_OPTIONS = [
  { value: 'copywriter', label: 'Copywriter（Kelly）' },
  { value: 'project_manager', label: 'Project Manager（Lisa）' },
  { value: 'customer_manager', label: 'Customer Manager（Tim）' },
  { value: 'bdm', label: 'BDM（Ryan）' },
]

export default function TeamManagement() {
  const navigate = useNavigate()
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', staff_role: 'copywriter' })
  const [creating, setCreating] = useState(false)
  const [lastCreatedPwd, setLastCreatedPwd] = useState(null)

  const reload = useCallback(async () => {
    const { data } = await supabase.from('profiles')
      .select('id, full_name, role_staff, staff_role, role_admin, created_at')
      .eq('role_staff', true)
      .order('created_at', { ascending: true })
    setStaff(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { reload() }, [reload])

  async function handleCreate() {
    if (!form.full_name.trim() || !form.email.trim()) {
      alert('姓名和邮箱必填')
      return
    }
    setCreating(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/.netlify/functions/create-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
      setLastCreatedPwd({ email: form.email, password: json.temp_password })
      setForm({ full_name: '', email: '', staff_role: 'copywriter' })
      setShowForm(false)
      await reload()
    } catch (e) {
      alert('创建失败：' + (e.message || e))
    } finally {
      setCreating(false)
    }
  }

  async function handleUpdateRole(userId, newRole) {
    if (!confirm(`确认将此账号 staff_role 改为 ${newRole}？`)) return
    await supabase.from('profiles').update({ staff_role: newRole }).eq('id', userId)
    await reload()
  }

  async function handleDisable(userId) {
    if (!confirm('确认禁用此 Staff 账号？账号本身不删除，仅移除 role_staff 标志。')) return
    await supabase.from('profiles').update({ role_staff: false, staff_role: null }).eq('id', userId)
    await reload()
  }

  return (
    <div className="app-layout">
      <Sidebar badgeCounts={{}} />
      <main className="main ap-page">
        <header className="ap-header">
          <div>
            <h1 className="ap-title">内部团队</h1>
            <div className="ap-subtitle">管理 Readii 内部员工（Kelly / Lisa / Tim / Ryan）</div>
          </div>
          <button className="ap-add-btn" onClick={() => setShowForm(true)}>+ 开通账号</button>
        </header>

        {lastCreatedPwd && (
          <div style={{margin:'16px 28px',padding:'12px 16px',background:'#e6f4ea',borderRadius:8,fontSize:13,color:'#1e7a3c'}}>
            ✓ 账号已创建：<strong>{lastCreatedPwd.email}</strong> · 临时密码 <code style={{background:'#fff',padding:'2px 6px',borderRadius:4}}>{lastCreatedPwd.password}</code>
            <button onClick={() => setLastCreatedPwd(null)} style={{marginLeft:12,background:'none',border:'none',cursor:'pointer',color:'inherit'}}>关闭</button>
          </div>
        )}

        {showForm && (
          <div className="ap-add-form">
            <input placeholder="姓名" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
            <input placeholder="邮箱" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            <select value={form.staff_role} onChange={e => setForm({ ...form, staff_role: e.target.value })}>
              {STAFF_ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button className="ap-add-btn" onClick={handleCreate} disabled={creating}>
              {creating ? '创建中...' : '创建'}
            </button>
            <button className="ap-ghost-btn" onClick={() => setShowForm(false)}>取消</button>
          </div>
        )}

        <div className="ap-body">
          {loading ? <div className="ap-empty">加载中...</div> : staff.length === 0 ? (
            <div className="ap-empty">还没有内部员工账号，点击右上角开通</div>
          ) : (
            <table className="ap-table">
              <thead><tr><th>姓名</th><th>Staff Role</th><th>开通日期</th><th>操作</th></tr></thead>
              <tbody>
                {staff.map(s => (
                  <tr key={s.id}>
                    <td style={{fontWeight:600}}>{s.full_name || '—'}</td>
                    <td>{STAFF_ROLE_LABELS[s.staff_role] || s.staff_role || '—'}</td>
                    <td style={{color:'var(--text-muted)',fontSize:12}}>{new Date(s.created_at).toLocaleDateString('zh-CN')}</td>
                    <td className="ap-actions">
                      <select
                        value={s.staff_role || ''}
                        onChange={e => handleUpdateRole(s.id, e.target.value)}
                        style={{fontSize:11,padding:'3px 6px'}}
                      >
                        {STAFF_ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <button onClick={() => handleDisable(s.id)} style={{color:'#c33'}}>禁用</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}
