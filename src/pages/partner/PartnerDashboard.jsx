import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/useAuth'
import AddLeadModal from '../../components/modals/AddLeadModal'
import UpdateLeadModal from '../../components/modals/UpdateLeadModal'
import './PartnerDashboard.css'

// Map lead stage code → 0-based current-milestone index (5 dots: S0..S4)
const STAGE_INDEX = { S0: 0, S1: 1, S2: 2, S3: 3, S4: 4, S5: 0 }
const TIER_LABEL = { 1: '推荐官 · Lv.1', 2: '渠道经理 · Lv.2', 3: '战略合伙人 · Lv.3' }

function fmtGBP(n) {
  return `£${Math.round(Number(n) || 0).toLocaleString()}`
}

function firstGlyph(name) {
  if (!name) return '?'
  return [...name][0]
}

function daysSince(iso) {
  if (!iso) return null
  const diffMs = Date.now() - new Date(iso).getTime()
  return Math.max(0, Math.floor(diffMs / 86400000))
}

function monthStartISO() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
}

function relTime(iso) {
  if (!iso) return ''
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60)     return '刚刚'
  if (s < 3600)   return `${Math.floor(s / 60)} 分钟前`
  if (s < 86400)  return `${Math.floor(s / 3600)} 小时前`
  if (s < 604800) return `${Math.floor(s / 86400)} 天前`
  return `${Math.floor(s / 604800)} 周前`
}

// Sidebar nav items — all inert in v1 except 总览
const NAV = [
  { section: '工作台', items: [
    { key: 'dashboard', icon: '📊', label: '总览', active: true },
    { key: 'clients',   icon: '👥', label: '我的客户', badgeKey: 'clients' },
    { key: 'commission', icon: '💰', label: '佣金与收入' },
    { key: 'leads',     icon: '🎯', label: '线索管理', badgeKey: 'leads' },
  ]},
  { section: '赋能', items: [
    { key: 'kb',        icon: '📚', label: '知识库' },
    { key: 'ai',        icon: '🤖', label: 'AI 助手' },
    { key: 'content',   icon: '🎨', label: '内容素材' },
    { key: 'stories',   icon: '📣', label: '成功故事' },
  ]},
  { section: '我的账户', items: [
    { key: 'link',      icon: '🔗', label: '推荐链接' },
    { key: 'agreement', icon: '📜', label: '合作协议' },
  ]},
]

function MilestoneRow({ stage }) {
  const current = STAGE_INDEX[stage] ?? 0
  const dots = [0, 1, 2, 3, 4]
  return (
    <div className="pd-milestone-row">
      {dots.map((i, idx) => (
        <span key={`dot-${i}`} style={{ display: 'contents' }}>
          <div className={`pd-ms-dot ${i < current ? 'done' : i === current ? 'current' : ''}`} />
          {idx < dots.length - 1 && (
            <div className={`pd-ms-line ${i < current ? 'done' : ''}`} />
          )}
        </span>
      ))}
    </div>
  )
}

function WelcomeScreen() {
  return (
    <div className="pd-welcome-screen">
      <div className="pd-welcome-card">
        <div className="pd-welcome-brand">Readii</div>
        <div className="pd-welcome-brand-sub">Partner</div>
        <div className="pd-welcome-title">欢迎加入 Readii <em>渠道网络</em></div>
        <div className="pd-welcome-sub">你的账号正在审核中，通常在 1–2 个工作日内完成</div>
        <div className="pd-welcome-contact">
          如有疑问，请联系：<br />
          <a href="mailto:xiaoyusu@readii.co.uk">xiaoyusu@readii.co.uk</a>
          <span> · </span>
          微信：<strong>sergio07</strong>
        </div>
        <div className="pd-welcome-footnote">
          审核通过后，你将收到通知，届时即可开始推广并获取佣金
        </div>
      </div>
    </div>
  )
}

export default function PartnerDashboard() {
  const { user, profile } = useAuth()
  const [partner, setPartner] = useState(null)
  const [leads, setLeads] = useState([])
  const [commissions, setCommissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copyFlag, setCopyFlag] = useState(false)
  const [activeNav, setActiveNav] = useState('dashboard')
  const [showAdd, setShowAdd] = useState(false)
  const [updating, setUpdating] = useState(null)
  const [aiInput, setAiInput] = useState('')

  const load = useCallback(async () => {
    if (!user?.id) {
      // useAuth hasn't hydrated yet; don't flip loading off — the effect
      // will re-fire as soon as user.id becomes available.
      return
    }
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
      // RLS (partner_read_own_leads) restricts this to the caller's own
      // leads, so no explicit partner_id filter is needed.
      supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('deal_roles')
        .select('id, amount, status, confirmed_at, paid_at, created_at, deals(id, contract_amount, status, signed_at, leads(name), products(code, name_zh))')
        .eq('user_id', user.id)
        .eq('role', 'lead_recorder')
        .order('created_at', { ascending: false }),
    ])
    setLeads(leadRows || [])
    setCommissions(roleRows || [])
    setLoading(false)
  }, [user?.id])

  useEffect(() => {
    load()
  }, [load])

  // ══ Derived stats ══
  const stats = useMemo(() => {
    const ms = monthStartISO()
    const monthCommissions = commissions
      .filter(r => r.created_at && r.created_at >= ms)
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0)

    const pendingClientCommission = commissions
      .filter(r => r.status === 'confirmed')
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0)

    const paidCommission = commissions
      .filter(r => r.status === 'paid')
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0)

    const activeLeads = leads.filter(l => l.s === 'S4').length
    const pendingLeads = leads.filter(l => ['S0','S1','S2'].includes(l.s)).length

    return {
      monthCommissions,
      pendingClientCommission,
      paidCommission,
      totalClients: leads.length,
      activeLeads,
      pendingLeads,
      newThisMonth: leads.filter(l => l.created_at && l.created_at >= ms).length,
    }
  }, [leads, commissions])

  const notifications = useMemo(() => {
    // Derive a simple feed from recent commissions + latest leads
    const items = []
    commissions.slice(0, 3).forEach(c => {
      const d = c.deals || {}
      items.push({
        icon: c.status === 'paid' ? '💰' : '🎉',
        iconTone: c.status === 'paid' ? 'teal' : '',
        title: `${d.leads?.name || '客户'} 佣金 ${fmtGBP(c.amount)}`,
        text: c.status === 'paid' ? '已到账' : c.status === 'confirmed' ? '已确认，待支付' : '待确认',
        time: relTime(c.created_at),
      })
    })
    if (items.length === 0) {
      items.push({
        icon: '🕊',
        title: '暂无动态',
        text: '你的第一笔线索进展会在这里显示',
      })
    }
    return items
  }, [commissions])

  const greetingName = profile?.full_name || user?.email?.split('@')[0] || '伙伴'

  async function copyLink() {
    if (!partner?.referral_url) return
    try {
      await navigator.clipboard.writeText(partner.referral_url)
      setCopyFlag(true)
      setTimeout(() => setCopyFlag(false), 1500)
    } catch { /* noop */ }
  }

  if (loading) {
    return (
      <div className="pd-welcome-screen">
        <div style={{ color: '#8A8780', fontSize: 13 }}>加载中…</div>
      </div>
    )
  }

  if (!partner) return <WelcomeScreen />

  const tierText = TIER_LABEL[partner.level] || `Lv.${partner.level}`

  return (
    <div className="pd-app">
      {/* ══ SIDEBAR ══ */}
      <aside className="pd-sidebar">
        <div className="pd-sb-brand">
          <span>Readii</span>
          <span className="pd-sb-brand-sub">Partner</span>
        </div>

        {NAV.map(section => (
          <div key={section.section}>
            <div className="pd-sb-section-title">{section.section}</div>
            {section.items.map(item => {
              const badge = item.badgeKey === 'clients' ? stats.totalClients
                          : item.badgeKey === 'leads'   ? stats.pendingLeads
                          : null
              return (
                <button
                  key={item.key}
                  className={`pd-sb-item ${activeNav === item.key ? 'active' : ''}`}
                  onClick={() => setActiveNav(item.key)}
                >
                  <span className="pd-sb-icon">{item.icon}</span>
                  <span>{item.label}</span>
                  {badge != null && badge > 0 && <span className="pd-sb-badge">{badge}</span>}
                </button>
              )
            })}
          </div>
        ))}

        <div className="pd-sb-footer">
          <div className="pd-sb-avatar">{firstGlyph(greetingName)}</div>
          <div>
            <div className="pd-sb-user-name">{greetingName}</div>
            <div className="pd-sb-user-tier">{tierText}</div>
          </div>
        </div>
      </aside>

      {/* ══ MAIN ══ */}
      <main className="pd-main">
        <div className="pd-topbar">
          <div className="pd-tb-title">
            你好，<em>{greetingName}</em> — 今天又有新进展 🎉
          </div>
          <div className="pd-tb-right">
            <div className="pd-tb-search">
              <input type="text" placeholder="搜索客户、知识库..." />
            </div>
            <button className="pd-tb-notif" aria-label="通知">🔔</button>
            <button className="pd-tb-btn" onClick={() => setShowAdd(true)}>+ 提交新线索</button>
          </div>
        </div>

        <div className="pd-content">
          {error && (
            <div style={{ color: '#8B3318', marginBottom: 12, fontSize: 13 }}>
              数据加载失败：{error}
            </div>
          )}

          {/* Referral bar */}
          <div className="pd-referral-bar">
            <div className="pd-ref-left">
              <div>
                <div className="pd-ref-label">您的专属推荐码</div>
                <div className="pd-ref-code">{partner.referral_code}</div>
                <div className="pd-ref-url">{partner.referral_url}</div>
              </div>
            </div>
            <button className="pd-ref-copy-btn" onClick={copyLink}>
              📋 {copyFlag ? '已复制' : '复制链接'}
            </button>
          </div>

          {/* KPI grid */}
          <div className="pd-kpi-grid">
            <div className="pd-kpi-card featured">
              <div className="pd-kpi-header">
                <span className="pd-kpi-label">本月佣金</span>
                <div className="pd-kpi-icon">💰</div>
              </div>
              <div className="pd-kpi-value">{fmtGBP(stats.monthCommissions)}</div>
              <div className="pd-kpi-change">本月累计到账/待确认合计</div>
              <div className="pd-kpi-sub">来自你的所有转化</div>
            </div>
            <div className="pd-kpi-card">
              <div className="pd-kpi-header">
                <span className="pd-kpi-label">累计客户</span>
                <div className="pd-kpi-icon">👥</div>
              </div>
              <div className="pd-kpi-value">{stats.totalClients}</div>
              <div className="pd-kpi-change">↑ {stats.newThisMonth} 本月新增</div>
              <div className="pd-kpi-sub">成交 {stats.activeLeads}</div>
            </div>
            <div className="pd-kpi-card">
              <div className="pd-kpi-header">
                <span className="pd-kpi-label">待处理线索</span>
                <div className="pd-kpi-icon">🎯</div>
              </div>
              <div className="pd-kpi-value">{stats.pendingLeads}</div>
              <div className="pd-kpi-change">S0–S2 跟进中</div>
              <div className="pd-kpi-sub">点开每条线索更新进展</div>
            </div>
            <div className="pd-kpi-card">
              <div className="pd-kpi-header">
                <span className="pd-kpi-label">次年订阅分成</span>
                <div className="pd-kpi-icon">📈</div>
              </div>
              <div className="pd-kpi-value">£0</div>
              <div className="pd-kpi-change">待上线</div>
              <div className="pd-kpi-sub">订阅产品 v2 将开放续费分成</div>
            </div>
          </div>

          {/* Two-col: clients + commission & notif */}
          <div className="pd-two-col">
            <div className="pd-card">
              <div className="pd-card-header">
                <div className="pd-card-title">我的<em>客户进度</em></div>
                <span className="pd-card-link" style={{ color: '#8A8780' }}>共 {leads.length}</span>
              </div>
              <div className="pd-card-body">
                {leads.length === 0 ? (
                  <div className="pd-empty-row">还没有线索，点右上角「+ 提交新线索」开始</div>
                ) : leads.slice(0, 6).map(l => (
                  <div className="pd-client-item" key={l.id}>
                    <div className="pd-client-avatar">{firstGlyph(l.name)}</div>
                    <div className="pd-client-info">
                      <div className="pd-client-name">
                        {l.name}
                        {l.prod && <span className="pd-client-tag">{l.prod}</span>}
                      </div>
                      <div className="pd-client-meta">
                        {l.channel && <span>{l.channel}</span>}
                        {l.channel && l.created_at && <span>·</span>}
                        {l.created_at && <span>接入 {daysSince(l.created_at)} 天</span>}
                        {l.s && <><span>·</span><span>{l.s}</span></>}
                      </div>
                      <MilestoneRow stage={l.s} />
                    </div>
                    <div className="pd-client-value">
                      <button
                        type="button"
                        onClick={() => setUpdating(l)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B8792A', fontSize: 12, fontFamily: 'inherit' }}
                      >
                        更新进展 →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="pd-comm-card">
                <div className="pd-comm-label">🎉 佣金概览</div>
                <div className="pd-comm-total">{fmtGBP(stats.monthCommissions)}</div>
                <div className="pd-comm-sub">本月累计 · 次月 1 日结算</div>
                <div className="pd-comm-breakdown">
                  <div className="pd-comm-row">
                    <span className="pd-comm-row-label">待确认</span>
                    <span className="pd-comm-row-value">{fmtGBP(stats.pendingClientCommission)}</span>
                  </div>
                  <div className="pd-comm-row">
                    <span className="pd-comm-row-label">已到账</span>
                    <span className="pd-comm-row-value pos">{fmtGBP(stats.paidCommission)}</span>
                  </div>
                  <div className="pd-comm-row">
                    <span className="pd-comm-row-label">订阅持续分成</span>
                    <span className="pd-comm-row-value">£0</span>
                  </div>
                </div>
              </div>

              <div className="pd-card">
                <div className="pd-card-header">
                  <div className="pd-card-title"><em>通知</em>动态</div>
                </div>
                <div className="pd-card-body">
                  {notifications.map((n, i) => (
                    <div className="pd-notif-item" key={i}>
                      <div className={`pd-notif-icon ${n.iconTone || ''}`}>{n.icon}</div>
                      <div className="pd-notif-content">
                        <div className="pd-notif-title">{n.title}</div>
                        <div className="pd-notif-text">{n.text}</div>
                        {n.time && <div className="pd-notif-time">{n.time}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* AI assistant section */}
          <div className="pd-ai-section">
            <div className="pd-ai-header">
              <div className="pd-ai-avatar">R</div>
              <div>
                <div className="pd-ai-intro">Readii AI 助手</div>
                <div className="pd-ai-subtitle">遇到问题不知道怎么回答客户？<em>问我就行</em></div>
              </div>
            </div>
            <div className="pd-ai-body">
              <div className="pd-ai-prompts">
                <button className="pd-ai-prompt" onClick={() => setAiInput('客户问工签最低年薪是多少？')}>客户问工签最低年薪是多少？</button>
                <button className="pd-ai-prompt" onClick={() => setAiInput('帮我生成首次联系话术')}>帮我生成首次联系话术</button>
                <button className="pd-ai-prompt" onClick={() => setAiInput('IFV 和 SW 的区别是什么？')}>IFV 和 SW 的区别是什么？</button>
              </div>
              <div className="pd-ai-input-wrap">
                <input
                  type="text"
                  className="pd-ai-input"
                  placeholder="输入你的问题，或描述客户情况..."
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                />
                <button
                  className="pd-ai-send"
                  onClick={() => alert('AI 话术助手功能开发中')}
                  aria-label="发送"
                >↑</button>
              </div>
            </div>
          </div>
        </div>
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
