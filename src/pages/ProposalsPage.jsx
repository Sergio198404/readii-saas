import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Sidebar from '../components/layout/Sidebar'
import './ProposalsPage.css'

const STATUS_MAP = {
  draft: { label: '草稿', cls: 'pp-st-draft' },
  sent: { label: '已发送', cls: 'pp-st-sent' },
  viewed: { label: '已查看', cls: 'pp-st-viewed' },
  signed: { label: '已签署', cls: 'pp-st-signed' },
  expired: { label: '已过期', cls: 'pp-st-expired' },
}

export default function ProposalsPage() {
  const [proposals, setProposals] = useState([])
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('proposals')
      .select('id, token, client_name, visa_route_zh, status, proposal_date, view_count, proposal_no, stripe_subscription_id')
      .order('created_at', { ascending: false })
    if (err) setError(err.message)
    else setProposals(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function copyLink(token) {
    const link = `${window.location.origin}/.netlify/functions/proposal-view?token=${token}`
    navigator.clipboard?.writeText(link)
    setCopied(token)
    setTimeout(() => setCopied(null), 1500)
  }

  function openLink(token) {
    window.open(`${window.location.origin}/.netlify/functions/proposal-view?token=${token}`, '_blank')
  }

  return (
    <div className="app-layout">
      <Sidebar badgeCounts={{}} />
      <main className="main prop-admin">
        <header className="prop-header">
          <div>
            <h1 className="prop-title">建议书管理</h1>
            <div className="prop-subtitle">生成、追踪和管理客户建议书</div>
          </div>
          <button className="prop-add-btn" onClick={() => navigate('/admin/proposals/new')}>
            + 新建建议书
          </button>
        </header>

        {error && <div className="prop-error">{error}</div>}

        <div className="prop-body">
          {loading ? (
            <div className="prop-empty">加载中...</div>
          ) : proposals.length === 0 ? (
            <div className="prop-empty">暂无建议书</div>
          ) : (
            <table className="prop-table">
              <thead>
                <tr>
                  <th>编号</th>
                  <th>客户</th>
                  <th>签证路线</th>
                  <th>状态</th>
                  <th>日期</th>
                  <th>查看</th>
                  <th>订阅</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {proposals.map((p) => {
                  const st = STATUS_MAP[p.status] || STATUS_MAP.draft
                  return (
                    <tr key={p.id}>
                      <td className="prop-no">{p.proposal_no}</td>
                      <td className="prop-client">{p.client_name}</td>
                      <td>{p.visa_route_zh}</td>
                      <td><span className={`prop-status ${st.cls}`}>{st.label}</span></td>
                      <td className="prop-date">{p.proposal_date}</td>
                      <td className="prop-views">{p.view_count || 0}</td>
                      <td>
                        {p.stripe_subscription_id && p.status === 'signed' && (
                          <span className="prop-sub prop-sub-active">● 已订阅</span>
                        )}
                        {p.stripe_subscription_id && p.status === 'expired' && (
                          <span className="prop-sub prop-sub-cancelled">● 已取消</span>
                        )}
                      </td>
                      <td className="prop-actions">
                        <button onClick={() => navigate(`/admin/proposals/${p.id}/edit`)}>编辑</button>
                        <button onClick={() => copyLink(p.token)}>
                          {copied === p.token ? '✓ 已复制' : '复制链接'}
                        </button>
                        <button onClick={() => openLink(p.token)}>查看</button>
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
