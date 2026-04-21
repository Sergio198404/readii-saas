import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { SERVICE_TYPE_LABELS } from '../lib/proposalDefaults'
import './ProposalPublicPage.css'

function pad(n) { return String(n).padStart(2, '0') }

function formatCountdown(msLeft) {
  if (msLeft <= 0) return { h: '00', m: '00', s: '00' }
  const total = Math.floor(msLeft / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return { h: pad(h), m: pad(m), s: pad(s) }
}

function fmtGBP(pence) {
  const n = Math.round((pence || 0) / 100)
  return `£${n.toLocaleString()}`
}

function fmtFee(item) {
  if (item.price_fixed_pence != null) return fmtGBP(item.price_fixed_pence)
  if (item.price_from_pence != null && item.price_to_pence != null) {
    return `${fmtGBP(item.price_from_pence)}–${fmtGBP(item.price_to_pence)}`
  }
  if (item.price_from_pence != null) return `${fmtGBP(item.price_from_pence)}+`
  return '—'
}

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function firstChar(name) {
  if (!name) return '?'
  return [...name][0]
}

export default function ProposalPublicPage() {
  const { token } = useParams()
  const [proposal, setProposal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState('')
  const [now, setNow] = useState(Date.now())

  const [showForm, setShowForm] = useState(false)
  const [confirmName, setConfirmName] = useState('')
  const [phone, setPhone] = useState('')
  const [consent, setConsent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitErr, setSubmitErr] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch(`/.netlify/functions/get-proposal?token=${encodeURIComponent(token)}`)
        const json = await res.json()
        if (!alive) return
        if (!res.ok) {
          setLoadErr(json.error || '无法加载方案书')
        } else {
          setProposal(json)
          setConfirmName(json.client_name || '')
          if (json.status === 'confirmed' || json.status === 'converted') setConfirmed(true)
        }
      } catch (err) {
        if (alive) setLoadErr(err.message)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [token])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const msLeft = useMemo(() => {
    if (!proposal?.expires_at) return 0
    return new Date(proposal.expires_at).getTime() - now
  }, [proposal?.expires_at, now])

  const expired = proposal?.is_expired || msLeft <= 0
  const urgent = !expired && msLeft < 6 * 3600 * 1000

  const countdown = formatCountdown(msLeft)

  const requiredTotalPence = useMemo(() => {
    const items = proposal?.third_party_items || []
    return items.reduce((sum, it) => {
      if (!it.is_required) return sum
      if (it.price_fixed_pence != null) return sum + it.price_fixed_pence
      if (it.price_from_pence != null) return sum + it.price_from_pence
      return sum
    }, 0)
  }, [proposal?.third_party_items])

  async function handleConfirm(e) {
    e.preventDefault()
    setSubmitErr('')
    if (!phone.trim()) return setSubmitErr('请填写手机号')
    if (!consent) return setSubmitErr('请勾选同意')
    setSubmitting(true)
    try {
      const res = await fetch('/.netlify/functions/confirm-proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, client_phone: phone.trim() }),
      })
      const json = await res.json()
      if (res.status === 410) {
        setSubmitErr('此方案已失效，请联系 Readii 重新咨询')
      } else if (!res.ok) {
        setSubmitErr(json.error || '提交失败')
      } else {
        setConfirmed(true)
      }
    } catch (err) {
      setSubmitErr(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="pp-root"><div className="pp-loading">加载方案书中…</div></div>
  }

  if (loadErr || !proposal) {
    return (
      <div className="pp-root">
        <div className="pp-wrap">
          <div className="pp-card">
            <div className="pp-section" style={{ textAlign: 'center', padding: '60px 24px' }}>
              <div style={{ fontSize: 42, marginBottom: 10 }}>⚠️</div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>{loadErr || '方案书不存在或已失效'}</div>
              <div style={{ color: 'var(--text-muted)', marginTop: 8, fontSize: 13 }}>请联系 Readii 获取新链接</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const serviceLabel = SERVICE_TYPE_LABELS[proposal.service_type] || proposal.service_type
  const timelineItems = Array.isArray(proposal.timeline_items) ? proposal.timeline_items : []
  const thirdParty = Array.isArray(proposal.third_party_items) ? proposal.third_party_items : []

  return (
    <div className="pp-root">
      <div className={`pp-countdown ${expired ? 'expired' : urgent ? 'warning' : ''}`}>
        {expired
          ? <>报价已失效 · 请联系 Readii 重新出方案</>
          : <>此方案书有效期剩余 <strong>{countdown.h}</strong>:
            <strong>{countdown.m}</strong>:<strong>{countdown.s}</strong> ·
            到期时间 {fmtDate(proposal.expires_at)}</>}
      </div>

      <div className="pp-wrap">
        <div className="pp-card">
          <div className="pp-head">
            <div>
              <div className="pp-brand">Readii</div>
              <div className="pp-brand-sub">定制方案书</div>
            </div>
            <div className="pp-head-meta">
              <div>方案编号 <strong>{proposal.token}</strong></div>
              <div>出具 {fmtDate(proposal.created_at)}</div>
              <div>有效至 {fmtDate(proposal.expires_at)}</div>
            </div>
          </div>

          <div className="pp-client">
            <div className="pp-client-avatar">{firstChar(proposal.client_name)}</div>
            <div>
              <div className="pp-client-name">{proposal.client_name || '—'}</div>
              {proposal.client_meta && <div className="pp-client-meta">{proposal.client_meta}</div>}
            </div>
          </div>

          <div className="pp-section">
            <div className="pp-section-title">推荐路径</div>
            <div className="pp-route-badge">{proposal.route_label || serviceLabel}</div>
            {proposal.route_note && <div className="pp-route-note">{proposal.route_note}</div>}
          </div>

          {timelineItems.length > 0 && (
            <div className="pp-section">
              <div className="pp-section-title">执行时间线</div>
              <div className="pp-timeline">
                {timelineItems.map((t, i) => (
                  <div className="pp-timeline-row" key={i}>
                    <div className="pp-timeline-month">{t.month || ''}</div>
                    <div>
                      <div className={`pp-timeline-task ${t.is_key ? 'key' : ''}`}>
                        {t.is_key ? '● ' : '○ '}{t.task || ''}
                      </div>
                      {t.sub && <div className="pp-timeline-sub">{t.sub}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pp-section">
            <div className="pp-section-title">方案对比</div>
            <div className="pp-compare">
              <div className="pp-compare-card recommended">
                <div className="pp-compare-label">Readii 推荐方案</div>
                <div className="pp-compare-price">{fmtGBP(proposal.service_price_pence)}</div>
                <div className="pp-compare-note">包含路径诊断、材料代写、申请陪伴、递交审核等 Readii 服务费</div>
              </div>
              <div className="pp-compare-card">
                <div className="pp-compare-label">市面全案参考</div>
                <div className="pp-compare-price">{fmtGBP(proposal.anchor_price_pence)}</div>
                <div className="pp-compare-note">同类型全案律师/咨询机构的市场参考价</div>
              </div>
            </div>
          </div>

          {thirdParty.length > 0 && (
            <div className="pp-section">
              <div className="pp-section-title">第三方费用清单</div>
              <table className="pp-fees-table">
                <thead>
                  <tr>
                    <th>项目</th>
                    <th>频率</th>
                    <th>类型</th>
                    <th style={{ textAlign: 'right' }}>参考价</th>
                  </tr>
                </thead>
                <tbody>
                  {thirdParty.map((it, i) => (
                    <tr key={i}>
                      <td>
                        <div className="pp-fee-name">{it.item_name}</div>
                        {it.item_note && <div className="pp-fee-note">{it.item_note}</div>}
                      </td>
                      <td>{it.frequency || '—'}</td>
                      <td>
                        <span className={`pp-fee-tag ${it.is_required ? 'required' : 'optional'}`}>
                          {it.is_required ? '必须' : '按需'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>{fmtFee(it)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="pp-total-row">
                <span>Readii 服务费 + 必要第三方费合计（估算）</span>
                <strong>{fmtGBP((proposal.service_price_pence || 0) + requiredTotalPence)}</strong>
              </div>
            </div>
          )}

          <div className="pp-section">
            <div className="pp-section-title">付款计划</div>
            <div className="pp-payment">
              <div className="pp-payment-box">
                <div className="pp-payment-label">签约首期</div>
                <div className="pp-payment-amount">{fmtGBP(proposal.payment_1_pence)}</div>
                <div className="pp-payment-sub">确认启动后 5 个工作日内</div>
              </div>
              <div className="pp-payment-box">
                <div className="pp-payment-label">第二期</div>
                <div className="pp-payment-amount">{fmtGBP(proposal.payment_2_pence)}</div>
                <div className="pp-payment-sub">按阶段里程碑</div>
              </div>
              <div className="pp-payment-box">
                <div className="pp-payment-label">第三方费用</div>
                <div className="pp-payment-amount">实报实付</div>
                <div className="pp-payment-sub">客户自行向第三方缴纳</div>
              </div>
            </div>
          </div>

          {confirmed ? (
            <div className="pp-success">
              <div className="pp-success-icon">✓</div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>已收到你的确认</div>
              <div style={{ color: 'var(--text-muted)', marginTop: 6, fontSize: 13 }}>
                Readii 会在 1 个工作日内与你联系，推进签约和启动
              </div>
            </div>
          ) : expired ? (
            <div className="pp-state-banner error">
              此方案书已过期。请联系 Readii 重新出方案。
            </div>
          ) : (
            <div className="pp-cta">
              <div className="pp-cta-title">确认你希望启动这个方案</div>
              <div className="pp-cta-sub">Readii 在收到你的确认后会尽快与你联系推进签约</div>

              {!showForm ? (
                <button className="pp-cta-btn" onClick={() => setShowForm(true)}>
                  确认启动
                </button>
              ) : (
                <form className="pp-form" onSubmit={handleConfirm}>
                  <div>
                    <label>姓名确认</label>
                    <input
                      type="text"
                      value={confirmName}
                      onChange={(e) => setConfirmName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label>手机号</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="方便 Readii 联系你的手机号"
                    />
                  </div>
                  <label className="pp-form-consent">
                    <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                    <span>我已阅读并确认上述方案，同意 Readii 与我联系推进签约。</span>
                  </label>
                  {submitErr && <div className="pp-error-text">{submitErr}</div>}
                  <button
                    type="submit"
                    className="pp-cta-btn"
                    disabled={submitting || !phone.trim() || !consent}
                  >
                    {submitting ? '提交中…' : '提交确认'}
                  </button>
                </form>
              )}
            </div>
          )}

          <div className="pp-disclaimer">
            免责声明：本方案书为基于你当前提供信息的初步建议，最终服务范围、价格及时间线以正式签约合同为准。
            第三方费用（签证官方申请费、IHS、律师审核等）由相应机构收取，Readii 不从中收取差价。
            Readii 不提供任何签证结果担保，最终审批权属于 UKVI / Home Office。
          </div>
        </div>
      </div>
    </div>
  )
}
