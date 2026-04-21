import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../../components/layout/Sidebar'
import { supabase } from '../../lib/supabase'
import { SERVICE_TYPE_LABELS } from '../../lib/proposalDefaults'
import './AdminPages.css'

function fmtDateShort(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function relativeTime(iso) {
  if (!iso) return ''
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  return `${Math.floor(diff / 86400)} 天前`
}

const STATUS_META = {
  draft:     { icon: '📝', label: '草稿',     cls: 'incomplete' },
  sent:      { icon: '📤', label: '已发送',   cls: 'incomplete' },
  viewed:    { icon: '👁',  label: '已查看',   cls: 'incomplete' },
  confirmed: { icon: '✅', label: '已确认',   cls: 'complete' },
  expired:   { icon: '⏰', label: '已过期',   cls: 'incomplete' },
  converted: { icon: '🎉', label: '已转客户', cls: 'complete' },
}

function derivedStatus(p) {
  if (p.status === 'converted' || p.status === 'confirmed' || p.status === 'draft') return p.status
  if (p.expires_at && new Date(p.expires_at) < new Date()) return 'expired'
  return p.status
}

export default function ProposalsAdminPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [convertingId, setConvertingId] = useState(null)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('proposals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) setErr(error.message)
    else setRows(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function copyLink(token) {
    const siteUrl = window.location.origin
    try {
      await navigator.clipboard.writeText(`${siteUrl}/p/${token}`)
      alert('链接已复制')
    } catch {
      alert(`链接：${siteUrl}/p/${token}`)
    }
  }

  async function convertToCustomer(p) {
    const email = prompt(`将「${p.client_name}」转为付费客户\n\n请输入客户邮箱（用于开通账号）：`)
    if (!email) return
    const fullName = prompt('客户全名', p.client_name || '') || p.client_name
    setConvertingId(p.id)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) throw new Error('请先登录')

      const res = await fetch('/.netlify/functions/convert-proposal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          proposal_token: p.token,
          email: email.trim(),
          full_name: fullName.trim(),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '转换失败')
      if (json.temp_password) {
        alert(`已开通客户账号\n临时密码：${json.temp_password}\n（已存入 profiles.password_changed=false，客户首次登录后须改密）`)
      }
      navigate(`/admin/customers/${json.customer_id}/questionnaire`)
    } catch (e) {
      alert(`转换失败：${e.message}`)
    } finally {
      setConvertingId(null)
    }
  }

  return (
    <div className="app-layout">
      <Sidebar badgeCounts={{}} />
      <main className="main ap-page">
        <header className="ap-header">
          <div>
            <h1 className="ap-title">方案书管理</h1>
            <div className="ap-subtitle">查看所有已发出的方案书，跟踪查看与确认状态</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="ap-ghost-btn" onClick={() => navigate('/admin/settings/third-party-fees')}>
              第三方费用设置
            </button>
          </div>
        </header>
        <div className="ap-body">
          {err && <div style={{ color: 'var(--danger-text)', marginBottom: 12 }}>{err}</div>}
          {loading ? (
            <div className="ap-empty">加载中…</div>
          ) : rows.length === 0 ? (
            <div className="ap-empty">尚未生成方案书。可在销售看板线索卡上点「方案书」生成。</div>
          ) : (
            <table className="ap-table">
              <thead>
                <tr>
                  <th>客户</th>
                  <th>签证类型</th>
                  <th>价格</th>
                  <th>状态</th>
                  <th>发送时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(p => {
                  const s = derivedStatus(p)
                  const meta = STATUS_META[s] || STATUS_META.sent
                  const price = `£${Math.round((p.service_price_pence || 0) / 100).toLocaleString()}`
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>
                        {p.client_name || '—'}
                        {p.client_meta && <div style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 12 }}>{p.client_meta}</div>}
                      </td>
                      <td>{SERVICE_TYPE_LABELS[p.service_type] || p.service_type}</td>
                      <td>{price}</td>
                      <td>
                        <span className={`ap-status ${meta.cls}`}>{meta.icon} {meta.label}</span>
                        {s === 'viewed' && p.viewed_at && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                            查看于 {fmtDateShort(p.viewed_at)}
                          </div>
                        )}
                        {s === 'confirmed' && p.confirmed_at && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.55 }}>
                            <div>确认于 {fmtDateShort(p.confirmed_at)}</div>
                            {p.confirmed_client_phone && <div>📱 {p.confirmed_client_phone}</div>}
                            {p.confirmed_client_email && <div>✉️ {p.confirmed_client_email}</div>}
                            {p.confirmed_client_address && <div>🏠 {p.confirmed_client_address}</div>}
                          </div>
                        )}
                      </td>
                      <td>
                        {fmtDateShort(p.created_at)}
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{relativeTime(p.created_at)}</div>
                      </td>
                      <td className="ap-actions">
                        <button onClick={() => window.open(`/p/${p.token}`, '_blank')}>查看</button>
                        <button onClick={() => copyLink(p.token)}>复制链接</button>
                        {s === 'confirmed' && (
                          <button
                            onClick={() => convertToCustomer(p)}
                            disabled={convertingId === p.id}
                            style={{ borderColor: '#1e7a3c', color: '#1e7a3c' }}
                          >
                            {convertingId === p.id ? '转换中…' : '转为客户'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}
