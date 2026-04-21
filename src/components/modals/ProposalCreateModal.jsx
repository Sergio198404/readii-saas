import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import {
  PROPOSAL_PRICE_DEFAULTS,
  SERVICE_TYPE_LABELS,
  SERVICE_TYPE_ORDER,
  leadProdToServiceType,
} from '../../lib/proposalDefaults'

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function ProposalCreateModal({ lead, onClose }) {
  const initialType = useMemo(() => leadProdToServiceType(lead?.prod), [lead])

  const [step, setStep] = useState(1)
  const [clientName, setClientName] = useState(lead?.name || '')
  const [clientMeta, setClientMeta] = useState('')
  const [serviceType, setServiceType] = useState(initialType)
  const [routeLabel, setRouteLabel] = useState(PROPOSAL_PRICE_DEFAULTS[initialType].route_label)
  const [routeNote, setRouteNote] = useState('')
  const [servicePrice, setServicePrice] = useState(PROPOSAL_PRICE_DEFAULTS[initialType].service_price)
  const [anchorPrice, setAnchorPrice] = useState(PROPOSAL_PRICE_DEFAULTS[initialType].anchor_price)
  const [payment1, setPayment1] = useState(PROPOSAL_PRICE_DEFAULTS[initialType].payment_1)
  const [payment2, setPayment2] = useState(PROPOSAL_PRICE_DEFAULTS[initialType].payment_2)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [copyFlag, setCopyFlag] = useState(false)

  // When user changes service_type, reapply defaults (preserving current price only if user has edited)
  useEffect(() => {
    const d = PROPOSAL_PRICE_DEFAULTS[serviceType]
    if (!d) return
    setRouteLabel(d.route_label)
    setServicePrice(d.service_price)
    setAnchorPrice(d.anchor_price)
    setPayment1(d.payment_1)
    setPayment2(d.payment_2)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceType])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!clientName.trim()) return setError('客户姓名必填')
    if (!serviceType) return setError('请选择签证类型')

    setSubmitting(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) throw new Error('请先登录')

      const res = await fetch('/.netlify/functions/create-proposal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          lead_id: lead?.id || null,
          service_type: serviceType,
          client_name: clientName.trim(),
          client_meta: clientMeta.trim() || null,
          route_label: routeLabel.trim() || null,
          route_note: routeNote.trim() || null,
          service_price: Number(servicePrice) || 0,
          anchor_price: Number(anchorPrice) || 0,
          payment_1: Number(payment1) || 0,
          payment_2: Number(payment2) || 0,
          timeline_items: [],
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '生成失败')
      setResult(json)
      setStep(2)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function copyLink() {
    if (!result?.url) return
    try {
      await navigator.clipboard.writeText(result.url)
      setCopyFlag(true)
      setTimeout(() => setCopyFlag(false), 1500)
    } catch {
      // noop
    }
  }

  return (
    <div className="overlay open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span style={{ fontSize: 18 }}>📄</span>
          <span className="modal-title">
            {step === 1 ? `生成方案书 · ${lead?.name || ''}` : '方案书链接已生成'}
          </span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {step === 1 ? (
          <form onSubmit={handleSubmit}>
            <div className="form-grid" style={{ paddingTop: 20 }}>
              <div className="form-row">
                <label className="form-label">客户姓名</label>
                <input className="form-input" value={clientName} onChange={(e) => setClientName(e.target.value)} />
              </div>
              <div className="form-row">
                <label className="form-label">客户描述</label>
                <input
                  className="form-input"
                  placeholder="例：35岁 · 上海 · SaaS 创业者"
                  value={clientMeta}
                  onChange={(e) => setClientMeta(e.target.value)}
                />
              </div>
            </div>

            <div className="form-grid" style={{ marginTop: 12 }}>
              <div className="form-row">
                <label className="form-label">签证类型</label>
                <select className="form-select" value={serviceType} onChange={(e) => setServiceType(e.target.value)}>
                  {SERVICE_TYPE_ORDER.map(key => (
                    <option key={key} value={key}>{SERVICE_TYPE_LABELS[key]}</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">方案标签</label>
                <input className="form-input" value={routeLabel} onChange={(e) => setRouteLabel(e.target.value)} />
              </div>
            </div>

            <div className="form-row full" style={{ marginTop: 12 }}>
              <label className="form-label">路径说明（推荐这个方案的理由）</label>
              <textarea
                className="form-textarea"
                rows={4}
                value={routeNote}
                onChange={(e) => setRouteNote(e.target.value)}
                placeholder="结合客户情况，解释为什么推荐这条签证路径"
              />
            </div>

            <div className="form-grid" style={{ marginTop: 12 }}>
              <div className="form-row">
                <label className="form-label">推荐价格 £</label>
                <input type="number" min="0" className="form-input" value={servicePrice} onChange={(e) => setServicePrice(e.target.value)} />
              </div>
              <div className="form-row">
                <label className="form-label">锚定价格 £</label>
                <input type="number" min="0" className="form-input" value={anchorPrice} onChange={(e) => setAnchorPrice(e.target.value)} />
              </div>
            </div>

            <div className="form-grid" style={{ marginTop: 12 }}>
              <div className="form-row">
                <label className="form-label">首期付款 £</label>
                <input type="number" min="0" className="form-input" value={payment1} onChange={(e) => setPayment1(e.target.value)} />
              </div>
              <div className="form-row">
                <label className="form-label">第二期付款 £</label>
                <input type="number" min="0" className="form-input" value={payment2} onChange={(e) => setPayment2(e.target.value)} />
              </div>
            </div>

            <div style={{ padding: '14px 22px 0', fontSize: 12, color: 'var(--text-muted)' }}>
              第三方费用将使用该签证类型的当前默认值，可在「设置 → 第三方费用」中修改。
            </div>

            {error && <div style={{ color: 'var(--danger-text)', fontSize: 12, padding: '8px 22px 0' }}>{error}</div>}

            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>取消</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? '生成中…' : '生成方案书链接'}
              </button>
            </div>
          </form>
        ) : (
          <div style={{ padding: '22px 22px 10px' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
              方案书链接
            </div>
            <div style={{
              background: 'var(--bg-muted)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--r-sm)',
              padding: '10px 12px',
              fontFamily: 'ui-monospace, SFMono-Regular, monospace',
              fontSize: 13,
              wordBreak: 'break-all',
              marginBottom: 10,
            }}>
              {result?.url}
            </div>
            <button type="button" className="btn btn-primary" onClick={copyLink}>
              {copyFlag ? '已复制 ✓' : '复制链接'}
            </button>
            <div style={{ marginTop: 18, fontSize: 13, color: 'var(--text-secondary)' }}>
              有效期至 <strong>{fmtDate(result?.expires_at)}</strong>
              <div style={{ marginTop: 4, color: 'var(--text-muted)', fontSize: 12 }}>
                把链接通过微信/邮件发给客户即可，客户无需登录
              </div>
            </div>
            <div className="modal-footer" style={{ marginTop: 16 }}>
              <button type="button" className="btn btn-ghost" onClick={onClose}>关闭</button>
              <a
                href="/admin/proposals"
                className="btn btn-primary"
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
              >
                方案书管理
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
