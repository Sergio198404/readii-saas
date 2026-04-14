import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import PartnerSidebar from '../components/layout/PartnerSidebar'
import AddLeadModal from '../components/modals/AddLeadModal'
import UpdateLeadModal from '../components/modals/UpdateLeadModal'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import './PartnerPage.css'

const STATUS_LABEL = {
  pending:   '待确认',
  confirmed: '已确认',
  paid:      '已结算',
}

function firstOfMonthISO() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
}

function fmtMoney(n) {
  return `£${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString()}`
}

export default function PartnerPage() {
  const { user, profile } = useAuth()
  const [partner, setPartner] = useState(null)
  const [leads, setLeads] = useState([])
  const [commissions, setCommissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeSection, setActiveSection] = useState('leads')
  const [showAdd, setShowAdd] = useState(false)
  const [updating, setUpdating] = useState(null)
  const [copied, setCopied] = useState(false)

  const leadsRef = useRef(null)
  const commissionsRef = useRef(null)
  const promoRef = useRef(null)

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setError('')

    const { data: partnerRow, error: pErr } = await supabase
      .from('partners')
      .select('id, referral_code, referral_url, level, commission_rate, multiplier')
      .eq('user_id', user.id)
      .maybeSingle()

    if (pErr) {
      setError(pErr.message)
      setLoading(false)
      return
    }

    if (!partnerRow) {
      setPartner(null)
      setLeads([])
      setCommissions([])
      setLoading(false)
      return
    }

    setPartner(partnerRow)

    const [{ data: leadRows }, { data: roleRows }] = await Promise.all([
      supabase
        .from('leads')
        .select('*')
        .eq('partner_id', partnerRow.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('deal_roles')
        .select('id, amount, status, confirmed_at, paid_at, deals(id, contract_amount, status, signed_at, leads(name), products(code, name_zh))')
        .eq('user_id', user.id)
        .eq('role', 'lead_recorder')
        .order('created_at', { ascending: false }),
    ])

    setLeads(leadRows || [])
    setCommissions(roleRows || [])
    setLoading(false)
  }, [user?.id])

  useEffect(() => { load() }, [load])

  const stats = useMemo(() => {
    const monthStart = firstOfMonthISO()
    const total = leads.length
    const thisMonth = leads.filter((l) => l.created_at && l.created_at >= monthStart).length
    const won = leads.filter((l) => l.s === 'S4').length
    const pendingCommission = commissions
      .filter((r) => r.status === 'pending')
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0)
    return { total, thisMonth, won, pendingCommission }
  }, [leads, commissions])

  function jumpTo(section) {
    setActiveSection(section)
    const map = { leads: leadsRef, commissions: commissionsRef, promo: promoRef }
    map[section]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function copyLink() {
    if (!partner?.referral_url) return
    navigator.clipboard?.writeText(partner.referral_url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="app-layout">
      <PartnerSidebar
        activeSection={activeSection}
        onJump={jumpTo}
        counts={{ leads: stats.total, commissions: commissions.length }}
      />

      <main className="main partner-page">
        <header className="pp-header">
          <div>
            <h1 className="pp-title">伙伴工作台</h1>
            <div className="pp-subtitle">
              {profile?.full_name || user?.email}
              {partner && (
                <> · Lv.{partner.level} · 分成 {(Number(partner.commission_rate) * 100).toFixed(1)}% × {Number(partner.multiplier).toFixed(1)}x</>
              )}
            </div>
          </div>
          <button className="pp-add-btn" onClick={() => setShowAdd(true)}>
            + 新增线索
          </button>
        </header>

        {error && <div className="pp-error">加载失败：{error}</div>}

        {!loading && !partner && (
          <div className="pp-empty-state">
            你的账号还没有关联 partner 记录，请联系管理员。
          </div>
        )}

        {partner && (
          <>
            <section className="pp-stats">
              <div className="pp-stat">
                <div className="pp-stat-label">我的线索</div>
                <div className="pp-stat-value">{stats.total}</div>
              </div>
              <div className="pp-stat">
                <div className="pp-stat-label">本月新增</div>
                <div className="pp-stat-value">{stats.thisMonth}</div>
              </div>
              <div className="pp-stat">
                <div className="pp-stat-label">已成交</div>
                <div className="pp-stat-value">{stats.won}</div>
              </div>
              <div className="pp-stat pp-stat-accent">
                <div className="pp-stat-label">待结算佣金</div>
                <div className="pp-stat-value">{fmtMoney(stats.pendingCommission)}</div>
              </div>
            </section>

            <section className="pp-grid">
              <div ref={leadsRef} className="pp-col pp-col-leads">
                <div className="pp-col-head">
                  <h2>我的线索</h2>
                  <span className="pp-col-count">{leads.length}</span>
                </div>
                {loading ? (
                  <div className="pp-empty">加载中...</div>
                ) : leads.length === 0 ? (
                  <div className="pp-empty">还没有线索，点击右上角新增</div>
                ) : (
                  <ul className="pp-lead-list">
                    {leads.map((l) => (
                      <li key={l.id} className="pp-lead-item">
                        <div className="pp-lead-row-1">
                          <span className="pp-lead-name">{l.name}</span>
                          <span className={`pp-badge pp-badge-${(l.s || 'S0').toLowerCase()}`}>{l.s}</span>
                        </div>
                        <div className="pp-lead-row-2">
                          <span>{l.prod || '?'}</span>
                          {l.follow && <span>· 跟进 {l.follow}</span>}
                          {l.next && <span>· {l.next}</span>}
                        </div>
                        {l.note && <div className="pp-lead-note">{l.note}</div>}
                        <div className="pp-lead-actions">
                          <button onClick={() => setUpdating(l)}>更新进展</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div ref={commissionsRef} className="pp-col pp-col-commissions">
                <div className="pp-col-head">
                  <h2>佣金记录</h2>
                  <span className="pp-col-count">{commissions.length}</span>
                </div>
                {loading ? (
                  <div className="pp-empty">加载中...</div>
                ) : commissions.length === 0 ? (
                  <div className="pp-empty">暂无分成记录</div>
                ) : (
                  <table className="pp-commission-table">
                    <thead>
                      <tr>
                        <th>客户</th>
                        <th>产品</th>
                        <th>合同</th>
                        <th>佣金</th>
                        <th>状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {commissions.map((r) => {
                        const deal = r.deals || {}
                        return (
                          <tr key={r.id}>
                            <td>{deal.leads?.name || '—'}</td>
                            <td>{deal.products?.code || '—'}</td>
                            <td>{fmtMoney(deal.contract_amount)}</td>
                            <td className="pp-amount">{fmtMoney(r.amount)}</td>
                            <td>
                              <span className={`pp-status pp-status-${r.status}`}>
                                {STATUS_LABEL[r.status] || r.status}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </section>

            <section ref={promoRef} className="pp-promo">
              <div className="pp-col-head">
                <h2>我的推广</h2>
              </div>
              <div className="pp-promo-body">
                <div className="pp-promo-field">
                  <label>推广码</label>
                  <div className="pp-promo-code">{partner.referral_code}</div>
                </div>
                <div className="pp-promo-field">
                  <label>推广链接</label>
                  <div className="pp-promo-link-row">
                    <div className="pp-promo-link">{partner.referral_url}</div>
                    <button className="pp-copy-btn" onClick={copyLink}>
                      {copied ? '✓ 已复制' : '复制链接'}
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      <AddLeadModal
        open={showAdd}
        onClose={async () => { setShowAdd(false); await load() }}
      />

      <UpdateLeadModal
        open={!!updating}
        onClose={async () => { setUpdating(null); await load() }}
        lead={updating}
      />
    </div>
  )
}
