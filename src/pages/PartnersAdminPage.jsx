import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import Sidebar from '../components/layout/Sidebar'
import NewPartnerModal from '../components/modals/NewPartnerModal'
import './PartnersAdminPage.css'

const fmtMoney = (n) => `£${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString()}`

export default function PartnersAdminPage() {
  const [partners, setPartners] = useState([])
  const [leadCounts, setLeadCounts] = useState({})
  const [commissionAgg, setCommissionAgg] = useState({}) // keyed by user_id
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showNew, setShowNew] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    const { data: partnerRows, error: pErr } = await supabase
      .from('partners')
      .select('id, user_id, level, commission_rate, referral_code, referral_url, status, created_at, profiles:user_id(full_name)')
      .order('created_at', { ascending: false })

    if (pErr) {
      setError(pErr.message)
      setLoading(false)
      return
    }

    setPartners(partnerRows || [])

    const ids = (partnerRows || []).map((p) => p.id)
    const userIds = (partnerRows || []).map((p) => p.user_id).filter(Boolean)

    const [{ data: leadRows }, { data: roleRows }] = await Promise.all([
      ids.length
        ? supabase.from('leads').select('partner_id').in('partner_id', ids)
        : Promise.resolve({ data: [] }),
      userIds.length
        ? supabase
            .from('deal_roles')
            .select('user_id, amount, status')
            .eq('role', 'lead_recorder')
            .in('user_id', userIds)
        : Promise.resolve({ data: [] }),
    ])

    const counts = {}
    ;(leadRows || []).forEach((l) => {
      counts[l.partner_id] = (counts[l.partner_id] || 0) + 1
    })
    setLeadCounts(counts)

    const agg = {}
    ;(roleRows || []).forEach((r) => {
      if (!r.user_id) return
      if (!agg[r.user_id]) agg[r.user_id] = { pending: 0, confirmed: 0, paid: 0 }
      const amt = Number(r.amount) || 0
      if (r.status in agg[r.user_id]) agg[r.user_id][r.status] += amt
    })
    setCommissionAgg(agg)

    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const selected = partners.find((p) => p.id === selectedId) || null

  async function handleSave(patch) {
    const { error: uErr } = await supabase
      .from('partners')
      .update(patch)
      .eq('id', selected.id)
    if (uErr) {
      alert(`保存失败：${uErr.message}`)
      return
    }
    await load()
  }

  return (
    <div className="app-layout">
      <Sidebar badgeCounts={{}} />
      <main className="main partners-admin">
        <header className="pa-header">
          <div>
            <h1 className="pa-title">伙伴管理</h1>
            <div className="pa-subtitle">管理渠道伙伴、等级与分成比例</div>
          </div>
          <button className="pa-add-btn" onClick={() => setShowNew(true)}>
            + 新增伙伴
          </button>
        </header>

        {error && <div className="pa-error">加载失败：{error}</div>}

        <div className="pa-body">
          <section className="pa-list">
            <div className="pa-list-header">
              <span>伙伴列表</span>
              <span className="pa-list-count">{partners.length}</span>
            </div>
            {loading ? (
              <div className="pa-empty">加载中...</div>
            ) : partners.length === 0 ? (
              <div className="pa-empty">暂无伙伴，点击右上角新增</div>
            ) : (
              <ul className="pa-list-items">
                {partners.map((p) => {
                  const name = p.profiles?.full_name || '未命名'
                  const isActive = p.id === selectedId
                  const agg = commissionAgg[p.user_id] || { pending: 0, confirmed: 0, paid: 0 }
                  return (
                    <li
                      key={p.id}
                      className={`pa-list-item ${isActive ? 'active' : ''}`}
                      onClick={() => setSelectedId(p.id)}
                    >
                      <div className="pa-list-row-1">
                        <span className="pa-list-name">{name}</span>
                        <span className={`pa-badge pa-badge-${p.status}`}>{p.status}</span>
                      </div>
                      <div className="pa-list-row-2">
                        <span className="pa-list-code">{p.referral_code}</span>
                      </div>
                      <div className="pa-list-row-3">
                        <span>Lv.{p.level}</span>
                        <span>·</span>
                        <span>线索 {leadCounts[p.id] || 0}</span>
                      </div>
                      <div className="pa-list-commission">
                        <span title="待确认">待 {fmtMoney(agg.pending)}</span>
                        <span title="已确认待付">确 {fmtMoney(agg.confirmed)}</span>
                        <span title="已结算">付 {fmtMoney(agg.paid)}</span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className="pa-detail">
            {selected ? (
              <PartnerDetail partner={selected} onSave={handleSave} onReload={load} />
            ) : (
              <div className="pa-detail-empty">← 从左侧选择一个伙伴</div>
            )}
          </section>
        </div>
      </main>

      {showNew && (
        <NewPartnerModal
          onClose={() => setShowNew(false)}
          onCreated={async () => {
            setShowNew(false)
            await load()
          }}
        />
      )}
    </div>
  )
}

function PartnerDetail({ partner, onSave, onReload }) {
  const [tab, setTab] = useState('info')
  const [level, setLevel] = useState(partner.level)
  const [commissionRate, setCommissionRate] = useState(partner.commission_rate)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setLevel(partner.level)
    setCommissionRate(partner.commission_rate)
    setTab('info')
  }, [partner.id, partner.level, partner.commission_rate])

  const dirty =
    Number(level) !== Number(partner.level) ||
    Number(commissionRate) !== Number(partner.commission_rate)

  async function handleSaveClick() {
    setSaving(true)
    await onSave({
      level: Number(level),
      commission_rate: Number(commissionRate),
    })
    setSaving(false)
  }

  function copyLink() {
    navigator.clipboard?.writeText(partner.referral_url || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const name = partner.profiles?.full_name || '未命名'

  return (
    <div className="pa-detail-body">
      <div className="pa-detail-head">
        <h2>{name}</h2>
        <span className={`pa-badge pa-badge-${partner.status}`}>{partner.status}</span>
      </div>

      <div className="pa-tabs">
        <button
          type="button"
          className={`pa-tab ${tab === 'info' ? 'active' : ''}`}
          onClick={() => setTab('info')}
        >
          基本信息
        </button>
        <button
          type="button"
          className={`pa-tab ${tab === 'commissions' ? 'active' : ''}`}
          onClick={() => setTab('commissions')}
        >
          佣金记录
        </button>
      </div>

      {tab === 'info' && (
        <>
          <div className="pa-field">
            <label>推广码</label>
            <div className="pa-readonly">{partner.referral_code}</div>
          </div>

          <div className="pa-field">
            <label>推广链接</label>
            <div className="pa-link-row">
              <div className="pa-readonly pa-link">{partner.referral_url}</div>
              <button type="button" className="pa-copy-btn" onClick={copyLink}>
                {copied ? '✓ 已复制' : '复制链接'}
              </button>
            </div>
          </div>

          <div className="pa-field">
            <label>等级 (1-10)</label>
            <input
              type="number"
              min="1"
              max="10"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            />
          </div>

          <div className="pa-field">
            <label>分成比例 commission_rate</label>
            <input
              type="number"
              step="0.001"
              min="0"
              max="1"
              value={commissionRate}
              onChange={(e) => setCommissionRate(e.target.value)}
            />
          </div>

          <button
            type="button"
            className="pa-save-btn"
            disabled={!dirty || saving}
            onClick={handleSaveClick}
          >
            {saving ? '保存中...' : dirty ? '保存修改' : '无修改'}
          </button>
        </>
      )}

      {tab === 'commissions' && (
        <PartnerCommissionsTab userId={partner.user_id} onChanged={onReload} />
      )}
    </div>
  )
}

function PartnerCommissionsTab({ userId, onChanged }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actingId, setActingId] = useState(null)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    setError('')
    const { data, error: err } = await supabase
      .from('deal_roles')
      .select('id, amount, status, confirmed_at, paid_at, created_at, deals(id, contract_amount, signed_at, leads(name), products(code, name_zh))')
      .eq('user_id', userId)
      .eq('role', 'lead_recorder')
      .order('created_at', { ascending: false })
    if (err) {
      setError(err.message)
    } else {
      setRows(data || [])
    }
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchRows() }, [fetchRows])

  async function handleConfirm(row) {
    setActingId(row.id)
    const { error: err } = await supabase
      .from('deal_roles')
      .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
      .eq('id', row.id)
    setActingId(null)
    if (err) return alert(`确认失败：${err.message}`)
    await fetchRows()
    onChanged?.()
  }

  async function handleMarkPaid(row) {
    setActingId(row.id)
    const { error: err } = await supabase
      .from('deal_roles')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', row.id)
    setActingId(null)
    if (err) return alert(`标记失败：${err.message}`)
    await fetchRows()
    onChanged?.()
  }

  if (loading) return <div className="pa-empty">加载中...</div>
  if (error) return <div className="pa-error">{error}</div>
  if (rows.length === 0) return <div className="pa-empty">暂无佣金记录</div>

  return (
    <table className="pa-commission-table">
      <thead>
        <tr>
          <th>客户</th>
          <th>产品</th>
          <th>合同金额</th>
          <th>应得佣金</th>
          <th>状态</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const deal = r.deals || {}
          const busy = actingId === r.id
          return (
            <tr key={r.id}>
              <td>{deal.leads?.name || '—'}</td>
              <td>{deal.products?.code || '—'}</td>
              <td>{fmtMoney(deal.contract_amount)}</td>
              <td className="pa-amount">{fmtMoney(r.amount)}</td>
              <td>
                <span className={`pa-status pa-status-${r.status}`}>
                  {r.status === 'pending' ? '待确认' : r.status === 'confirmed' ? '已确认' : '已结算'}
                </span>
              </td>
              <td>
                {r.status === 'pending' && (
                  <button className="pa-row-btn confirm" disabled={busy} onClick={() => handleConfirm(r)}>
                    ✓ 确认
                  </button>
                )}
                {r.status === 'confirmed' && (
                  <button className="pa-row-btn paid" disabled={busy} onClick={() => handleMarkPaid(r)}>
                    💰 标记已付
                  </button>
                )}
                {r.status === 'paid' && (
                  <span className="pa-row-done">已结算</span>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
