import { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import {
  PROPOSAL_PRICE_DEFAULTS,
  SERVICE_TYPE_LABELS,
  SERVICE_TYPE_ORDER,
  leadProdToServiceType,
} from '../../lib/proposalDefaults'

const FREQUENCY_OPTIONS = ['一次性', '按年计', '按案收费', '首年含注册', '按课时']

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fmtGBP(n) {
  return `£${Math.round(Number(n) || 0).toLocaleString()}`
}

function feeDisplayPrice(row) {
  if (row.price_fixed_pence != null) return fmtGBP(row.price_fixed_pence / 100)
  if (row.price_from_pence != null && row.price_to_pence != null) {
    return `${fmtGBP(row.price_from_pence / 100)}–${fmtGBP(row.price_to_pence / 100)}`
  }
  if (row.price_from_pence != null) return `${fmtGBP(row.price_from_pence / 100)}+`
  return '—'
}

const STEPS = [
  { n: 1, label: '客户信息' },
  { n: 2, label: '服务方案' },
  { n: 3, label: '时间线' },
  { n: 4, label: '第三方费用' },
  { n: 5, label: '预览生成' },
]

export default function ProposalCreateModal({ lead, onClose }) {
  const initialType = useMemo(() => leadProdToServiceType(lead?.prod), [lead])
  const defaults = PROPOSAL_PRICE_DEFAULTS[initialType]

  const [step, setStep] = useState(1)
  const [error, setError] = useState('')

  // Step 1
  const [clientName, setClientName] = useState(lead?.name || '')
  const [clientMeta, setClientMeta] = useState('')
  const [serviceType, setServiceType] = useState(initialType)
  const [routeNote, setRouteNote] = useState('')

  // Step 2
  const [recName, setRecName] = useState('陪跑方案')
  const [recPrice, setRecPrice] = useState(defaults.service_price)
  const [recDesc, setRecDesc] = useState('你来执行，Readii 陪你走完全程')
  const [originalPrice, setOriginalPrice] = useState(6600)
  const [promoPrice, setPromoPrice] = useState(5800)
  const [anchName, setAnchName] = useState('全案委托服务')
  const [anchPrice, setAnchPrice] = useState(defaults.anchor_price)
  const [anchDesc, setAnchDesc] = useState('同类型全案律师/咨询机构的市场参考价')
  const [payment1, setPayment1] = useState(defaults.payment_1)
  const [payment1Trigger, setPayment1Trigger] = useState('确认启动后 5 个工作日内')
  const [payment2, setPayment2] = useState(defaults.payment_2)
  const [payment2Trigger, setPayment2Trigger] = useState('按阶段里程碑')

  // Step 3
  const [timelineRows, setTimelineRows] = useState([])
  const [loadingTimeline, setLoadingTimeline] = useState(false)

  // Step 4
  const [feeRows, setFeeRows] = useState([])
  const [feeEditingId, setFeeEditingId] = useState(null)
  const [loadingFees, setLoadingFees] = useState(false)

  // Final submit
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [copyFlag, setCopyFlag] = useState(false)

  // When service_type changes, reapply Step 2 numeric defaults (prices/payments
  // only — leave plan names/descriptions untouched so user edits are preserved
  // across service_type changes after initial wizard start)
  useEffect(() => {
    const d = PROPOSAL_PRICE_DEFAULTS[serviceType]
    if (!d) return
    setRecPrice(d.service_price)
    setAnchPrice(d.anchor_price)
    setPayment1(d.payment_1)
    setPayment2(d.payment_2)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceType])

  const loadTimeline = useCallback(async () => {
    setLoadingTimeline(true)
    const { data, error: err } = await supabase
      .from('proposal_timeline_defaults')
      .select('*')
      .eq('service_type', serviceType)
      .eq('is_active', true)
      .order('item_order')
    if (err) {
      setError(`加载时间线默认值失败：${err.message}`)
      setTimelineRows([])
    } else {
      setTimelineRows((data || []).map(r => ({
        key: r.id,
        checked: true,
        month_label: r.month_label || '',
        task_name: r.task_name || '',
        task_sub: r.task_sub || '',
        is_key_milestone: !!r.is_key_milestone,
      })))
    }
    setLoadingTimeline(false)
  }, [serviceType])

  const loadFees = useCallback(async () => {
    setLoadingFees(true)
    const { data, error: err } = await supabase
      .from('proposal_third_party_defaults')
      .select('*')
      .eq('service_type', serviceType)
      .eq('is_active', true)
      .order('item_order')
    if (err) {
      setError(`加载第三方费用默认值失败：${err.message}`)
      setFeeRows([])
    } else {
      setFeeRows((data || []).map(r => ({
        key: r.id,
        checked: !!r.is_required,
        item_name: r.item_name || '',
        item_note: r.item_note || '',
        frequency: r.frequency || '一次性',
        is_required: !!r.is_required,
        price_mode: r.price_fixed_pence != null ? 'fixed' : 'range',
        price_fixed: r.price_fixed_pence != null ? Math.round(r.price_fixed_pence / 100) : '',
        price_from:  r.price_from_pence  != null ? Math.round(r.price_from_pence / 100)  : '',
        price_to:    r.price_to_pence    != null ? Math.round(r.price_to_pence / 100)    : '',
      })))
    }
    setLoadingFees(false)
  }, [serviceType])

  // Lazy load each list the first time user lands on that step
  useEffect(() => {
    if (step === 3 && timelineRows.length === 0 && !loadingTimeline) loadTimeline()
    if (step === 4 && feeRows.length === 0 && !loadingFees) loadFees()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  // If user changes service_type after loading rows, refetch defaults
  useEffect(() => {
    if (timelineRows.length > 0) loadTimeline()
    if (feeRows.length > 0) loadFees()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceType])

  function canAdvance() {
    setError('')
    if (step === 1) {
      if (!clientName.trim()) { setError('客户姓名必填'); return false }
      if (!serviceType) { setError('请选择签证类型'); return false }
    }
    if (step === 2) {
      if (!recName.trim() || !anchName.trim()) { setError('两个方案的名称都要填'); return false }
    }
    return true
  }

  function goNext() {
    if (!canAdvance()) return
    setStep(s => Math.min(5, s + 1))
  }
  function goBack() {
    setError('')
    setStep(s => Math.max(1, s - 1))
  }

  // --- Step 3 row helpers ---
  function toggleTimelineRow(i) {
    setTimelineRows(rows => rows.map((r, idx) => idx === i ? { ...r, checked: !r.checked } : r))
  }
  function updateTimelineField(i, field, value) {
    setTimelineRows(rows => rows.map((r, idx) => idx === i ? { ...r, [field]: value } : r))
  }
  function addTimelineRow() {
    setTimelineRows(rows => [...rows, {
      key: `new-${Date.now()}-${rows.length}`,
      checked: true, month_label: '', task_name: '', task_sub: '', is_key_milestone: false,
    }])
  }
  function removeTimelineRow(i) {
    setTimelineRows(rows => rows.filter((_, idx) => idx !== i))
  }

  // --- Step 4 row helpers ---
  function toggleFeeRow(i) {
    setFeeRows(rows => rows.map((r, idx) => idx === i ? { ...r, checked: !r.checked } : r))
  }
  function updateFeeField(i, field, value) {
    setFeeRows(rows => rows.map((r, idx) => idx === i ? { ...r, [field]: value } : r))
  }
  function addFeeRow() {
    const k = `new-${Date.now()}-${feeRows.length}`
    setFeeRows(rows => [...rows, {
      key: k, checked: true, item_name: '', item_note: '',
      frequency: '一次性', is_required: true,
      price_mode: 'fixed', price_fixed: '', price_from: '', price_to: '',
    }])
    setFeeEditingId(k)
  }
  function removeFeeRow(i) {
    setFeeRows(rows => rows.filter((_, idx) => idx !== i))
  }

  // --- Summary math ---
  const selectedTimeline = timelineRows.filter(r => r.checked && r.task_name.trim())
  const keyMilestoneCount = selectedTimeline.filter(r => r.is_key_milestone).length

  const selectedFees = feeRows.filter(r => r.checked && r.item_name.trim())
  const requiredFees = selectedFees.filter(r => r.is_required)
  const optionalFees = selectedFees.filter(r => !r.is_required)

  async function handleSubmit() {
    setError('')
    setSubmitting(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) throw new Error('请先登录')

      const timeline_items = selectedTimeline.map(r => ({
        month: r.month_label,
        task: r.task_name,
        sub: r.task_sub || null,
        is_key: !!r.is_key_milestone,
      }))

      const third_party_items = selectedFees.map(r => {
        const out = {
          item_name: r.item_name,
          item_note: r.item_note || null,
          frequency: r.frequency,
          is_required: !!r.is_required,
        }
        if (r.price_mode === 'fixed') {
          const v = Number(r.price_fixed)
          out.price_fixed_pence = Number.isFinite(v) ? Math.round(v * 100) : null
        } else {
          const f = Number(r.price_from); const t = Number(r.price_to)
          out.price_from_pence = Number.isFinite(f) ? Math.round(f * 100) : null
          out.price_to_pence   = Number.isFinite(t) ? Math.round(t * 100) : null
        }
        return out
      })

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
          route_label: recName.trim() || PROPOSAL_PRICE_DEFAULTS[serviceType].route_label,
          route_note: routeNote.trim() || null,
          service_price: Number(recPrice) || 0,
          anchor_price:  Number(anchPrice) || 0,
          payment_1:     Number(payment1) || 0,
          payment_2:     Number(payment2) || 0,
          original_price: originalPrice === '' ? null : Number(originalPrice),
          promo_price:    promoPrice === ''    ? null : Number(promoPrice),
          recommended_plan_name: recName.trim() || null,
          recommended_plan_desc: recDesc.trim() || null,
          anchor_plan_name: anchName.trim() || null,
          anchor_plan_desc: anchDesc.trim() || null,
          payment_1_trigger: payment1Trigger.trim() || null,
          payment_2_trigger: payment2Trigger.trim() || null,
          timeline_items,
          third_party_items,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '生成失败')
      setResult(json)
    } catch (e) {
      setError(e.message)
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
    } catch { /* noop */ }
  }

  // Stepper
  const stepper = (
    <div style={{ display: 'flex', gap: 4, padding: '14px 22px 4px', flexWrap: 'wrap' }}>
      {STEPS.map(s => (
        <div
          key={s.n}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 999,
            fontSize: 12, fontWeight: 600,
            background: step === s.n ? 'var(--text-primary)' : step > s.n ? '#e6f4ea' : 'var(--bg-muted)',
            color: step === s.n ? '#fff' : step > s.n ? '#1e7a3c' : 'var(--text-muted)',
            border: '1px solid ' + (step === s.n ? 'var(--text-primary)' : step > s.n ? '#b7e0c2' : 'var(--border-subtle)'),
          }}
        >
          <span style={{ fontSize: 10 }}>{step > s.n ? '✓' : s.n}</span>
          {s.label}
        </div>
      ))}
    </div>
  )

  // Success state (after submit on step 5)
  if (result) {
    return (
      <div className="overlay open" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal">
          <div className="modal-header">
            <span style={{ fontSize: 18 }}>📄</span>
            <span className="modal-title">方案书链接已生成</span>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
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
              fontSize: 13, wordBreak: 'break-all', marginBottom: 10,
            }}>
              {result.url}
            </div>
            <button type="button" className="btn btn-primary" onClick={copyLink}>
              {copyFlag ? '已复制 ✓' : '复制链接'}
            </button>
            <div style={{ marginTop: 18, fontSize: 13, color: 'var(--text-secondary)' }}>
              有效期至 <strong>{fmtDate(result.expires_at)}</strong>
              <div style={{ marginTop: 4, color: 'var(--text-muted)', fontSize: 12 }}>
                把链接通过微信/邮件发给客户即可，客户无需登录
              </div>
            </div>
            <div className="modal-footer" style={{ marginTop: 16 }}>
              <button type="button" className="btn btn-ghost" onClick={onClose}>关闭</button>
              <a href="/admin/proposals" className="btn btn-primary" style={{ textDecoration: 'none' }}>
                方案书管理
              </a>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="overlay open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <span style={{ fontSize: 18 }}>📄</span>
          <span className="modal-title">生成方案书 · {lead?.name || ''}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {stepper}

        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 4px' }}>
          {/* ───────────────── Step 1 ───────────────── */}
          {step === 1 && (
            <>
              <div className="form-grid" style={{ paddingTop: 12 }}>
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
              <div className="form-row full" style={{ marginTop: 12 }}>
                <label className="form-label">签证类型</label>
                <select className="form-select" value={serviceType} onChange={(e) => setServiceType(e.target.value)}>
                  {SERVICE_TYPE_ORDER.map(key => (
                    <option key={key} value={key}>{SERVICE_TYPE_LABELS[key]}</option>
                  ))}
                </select>
              </div>
              <div className="form-row full" style={{ marginTop: 12 }}>
                <label className="form-label">路径说明（推荐这条路径的理由）</label>
                <textarea
                  className="form-textarea"
                  rows={5}
                  value={routeNote}
                  onChange={(e) => setRouteNote(e.target.value)}
                  placeholder="结合客户情况，解释为什么推荐这条签证路径。这段会显示在公开方案书页面顶部。"
                />
              </div>
            </>
          )}

          {/* ───────────────── Step 2 ───────────────── */}
          {step === 2 && (
            <div style={{ padding: '12px 22px 0' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                选择推荐给客户的方案，左卡为默认推荐。两张卡都会显示在公开方案书的「方案对比」区。
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {/* Recommended */}
                <div style={{ border: '2px solid #1e7a3c', borderRadius: 10, padding: 14, background: '#f1faf4' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#1e7a3c', letterSpacing: '0.1em', marginBottom: 8, textTransform: 'uppercase' }}>
                    ⭐ 为你推荐
                  </div>
                  <div className="ap-field">
                    <label>方案名</label>
                    <input value={recName} onChange={(e) => setRecName(e.target.value)} placeholder="陪跑方案" />
                  </div>
                  <div className="ap-field">
                    <label>推荐价格 £（含 VAT）</label>
                    <input type="number" min="0" value={recPrice} onChange={(e) => setRecPrice(e.target.value)} />
                  </div>
                  <div className="ap-field">
                    <label>描述</label>
                    <textarea rows={3} value={recDesc} onChange={(e) => setRecDesc(e.target.value)} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 6, paddingTop: 10, borderTop: '1px dashed #b7e0c2' }}>
                    <div className="ap-field" style={{ marginBottom: 0 }}>
                      <label>原价（含 VAT）£</label>
                      <input type="number" min="0" value={originalPrice} onChange={(e) => setOriginalPrice(e.target.value)} />
                    </div>
                    <div className="ap-field" style={{ marginBottom: 0 }}>
                      <label>限时优惠价（含 VAT）£</label>
                      <input type="number" min="0" value={promoPrice} onChange={(e) => setPromoPrice(e.target.value)} />
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                    在公开方案书 CTA 区展示「原价 → 优惠价」的划线对比，5 天内确认即享。
                  </div>
                </div>
                {/* Anchor */}
                <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 14, background: 'var(--bg-muted)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.1em', marginBottom: 8, textTransform: 'uppercase' }}>
                    市面全案参考
                  </div>
                  <div className="ap-field">
                    <label>方案名</label>
                    <input value={anchName} onChange={(e) => setAnchName(e.target.value)} />
                  </div>
                  <div className="ap-field">
                    <label>锚定价格 £</label>
                    <input type="number" min="0" value={anchPrice} onChange={(e) => setAnchPrice(e.target.value)} />
                  </div>
                  <div className="ap-field">
                    <label>描述</label>
                    <textarea rows={3} value={anchDesc} onChange={(e) => setAnchDesc(e.target.value)} />
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 18, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8 }}>
                付款计划
              </div>
              <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, alignItems: 'center' }}>
                  <div className="ap-field" style={{ marginBottom: 0 }}>
                    <label>首期付款 £</label>
                    <input type="number" min="0" value={payment1} onChange={(e) => setPayment1(e.target.value)} />
                  </div>
                  <div className="ap-field" style={{ marginBottom: 0 }}>
                    <label>触发条件</label>
                    <input value={payment1Trigger} onChange={(e) => setPayment1Trigger(e.target.value)} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, alignItems: 'center', marginTop: 10 }}>
                  <div className="ap-field" style={{ marginBottom: 0 }}>
                    <label>第二期付款 £</label>
                    <input type="number" min="0" value={payment2} onChange={(e) => setPayment2(e.target.value)} />
                  </div>
                  <div className="ap-field" style={{ marginBottom: 0 }}>
                    <label>触发条件</label>
                    <input value={payment2Trigger} onChange={(e) => setPayment2Trigger(e.target.value)} />
                  </div>
                </div>
                <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--bg-muted)', borderRadius: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                  第三方费用：<strong>实报实付</strong> · 客户自行向第三方缴纳
                </div>
              </div>
            </div>
          )}

          {/* ───────────────── Step 3 ───────────────── */}
          {step === 3 && (
            <div style={{ padding: '12px 22px 0' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                勾选包含在方案书中的节点。默认来自该签证类型的时间线模板，可在「第三方费用设置」页面维护。
              </div>
              {loadingTimeline ? (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>加载中…</div>
              ) : timelineRows.length === 0 ? (
                <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, background: 'var(--bg-muted)', borderRadius: 8 }}>
                  该签证类型暂无默认时间线。点下方「新增节点」手动添加。
                </div>
              ) : (
                <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '36px 130px 1fr 90px 40px', gap: 8, padding: '8px 10px', background: 'var(--bg-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                    <div></div>
                    <div>时间</div>
                    <div>任务 / 说明</div>
                    <div>关键节点</div>
                    <div></div>
                  </div>
                  {timelineRows.map((r, i) => (
                    <div key={r.key} style={{
                      display: 'grid', gridTemplateColumns: '36px 130px 1fr 90px 40px',
                      gap: 8, padding: '10px', borderTop: '1px solid var(--border-subtle)',
                      alignItems: 'flex-start',
                      background: r.checked ? 'var(--bg-card)' : '#f7f5f0',
                      opacity: r.checked ? 1 : 0.55,
                    }}>
                      <div>
                        <input type="checkbox" checked={r.checked} onChange={() => toggleTimelineRow(i)} />
                      </div>
                      <div>
                        <input
                          style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border-subtle)', borderRadius: 6, fontSize: 12 }}
                          placeholder="第 1 个月"
                          value={r.month_label}
                          onChange={(e) => updateTimelineField(i, 'month_label', e.target.value)}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <input
                          style={{ padding: '6px 8px', border: '1px solid var(--border-subtle)', borderRadius: 6, fontSize: 13, fontWeight: 600 }}
                          placeholder="任务名称"
                          value={r.task_name}
                          onChange={(e) => updateTimelineField(i, 'task_name', e.target.value)}
                        />
                        <input
                          style={{ padding: '6px 8px', border: '1px solid var(--border-subtle)', borderRadius: 6, fontSize: 12, color: 'var(--text-secondary)' }}
                          placeholder="副标题说明（可选）"
                          value={r.task_sub}
                          onChange={(e) => updateTimelineField(i, 'task_sub', e.target.value)}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={r.is_key_milestone}
                            onChange={(e) => updateTimelineField(i, 'is_key_milestone', e.target.checked)}
                          />
                          {r.is_key_milestone ? '● 关键' : '○ 普通'}
                        </label>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <button
                          className="ap-sm-btn"
                          onClick={() => removeTimelineRow(i)}
                          style={{ padding: '2px 6px', color: 'var(--danger-text)' }}
                          title="删除"
                        >✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button className="ap-ghost-btn" style={{ marginTop: 12 }} onClick={addTimelineRow}>
                + 新增节点
              </button>
            </div>
          )}

          {/* ───────────────── Step 4 ───────────────── */}
          {step === 4 && (
            <div style={{ padding: '12px 22px 0' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                勾选包含在方案书中的第三方费用。「必须」项默认勾选，「按需」项默认不勾选。
              </div>
              {loadingFees ? (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>加载中…</div>
              ) : feeRows.length === 0 ? (
                <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, background: 'var(--bg-muted)', borderRadius: 8 }}>
                  该签证类型暂无默认费用。点下方「新增费用项」手动添加。
                </div>
              ) : (
                <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 110px 90px 120px 80px', gap: 8, padding: '8px 10px', background: 'var(--bg-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                    <div></div>
                    <div>费用项目</div>
                    <div>频率</div>
                    <div>类型</div>
                    <div>参考价格</div>
                    <div></div>
                  </div>
                  {feeRows.map((r, i) => {
                    const expanded = feeEditingId === r.key
                    return (
                      <div key={r.key} style={{
                        borderTop: '1px solid var(--border-subtle)',
                        background: r.checked ? 'var(--bg-card)' : '#f7f5f0',
                        opacity: r.checked ? 1 : 0.55,
                      }}>
                        <div style={{
                          display: 'grid', gridTemplateColumns: '36px 1fr 110px 90px 120px 80px',
                          gap: 8, padding: '10px', alignItems: 'center',
                        }}>
                          <div>
                            <input type="checkbox" checked={r.checked} onChange={() => toggleFeeRow(i)} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{r.item_name || <span style={{ color: 'var(--text-muted)' }}>（未命名）</span>}</div>
                            {r.item_note && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{r.item_note}</div>}
                          </div>
                          <div style={{ fontSize: 12 }}>{r.frequency}</div>
                          <div>
                            <span className={`ap-status ${r.is_required ? 'complete' : 'incomplete'}`}>
                              {r.is_required ? '● 必须' : '○ 按需'}
                            </span>
                          </div>
                          <div style={{ fontSize: 13 }}>{
                            r.price_mode === 'fixed'
                              ? (r.price_fixed !== '' ? fmtGBP(r.price_fixed) : '—')
                              : (r.price_from !== '' && r.price_to !== '' ? `${fmtGBP(r.price_from)}–${fmtGBP(r.price_to)}` : '—')
                          }</div>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              className="ap-sm-btn"
                              onClick={() => setFeeEditingId(expanded ? null : r.key)}
                              style={{ padding: '2px 8px' }}
                            >{expanded ? '收起' : '编辑'}</button>
                            <button
                              className="ap-sm-btn"
                              onClick={() => removeFeeRow(i)}
                              style={{ padding: '2px 6px', color: 'var(--danger-text)' }}
                              title="删除"
                            >✕</button>
                          </div>
                        </div>
                        {expanded && (
                          <div style={{ padding: '4px 14px 14px', background: '#fcfbf7', borderTop: '1px dashed var(--border-subtle)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                              <div className="ap-field" style={{ marginBottom: 8 }}>
                                <label>名称</label>
                                <input value={r.item_name} onChange={(e) => updateFeeField(i, 'item_name', e.target.value)} />
                              </div>
                              <div className="ap-field" style={{ marginBottom: 8 }}>
                                <label>频率</label>
                                <select value={r.frequency} onChange={(e) => updateFeeField(i, 'frequency', e.target.value)}>
                                  {FREQUENCY_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                                </select>
                              </div>
                            </div>
                            <div className="ap-field" style={{ marginBottom: 8 }}>
                              <label>说明（方案书显示）</label>
                              <input value={r.item_note} onChange={(e) => updateFeeField(i, 'item_note', e.target.value)} />
                            </div>
                            <div style={{ display: 'flex', gap: 16, marginBottom: 8, fontSize: 12 }}>
                              <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                <input type="radio" checked={r.is_required} onChange={() => updateFeeField(i, 'is_required', true)} />必须
                              </label>
                              <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                <input type="radio" checked={!r.is_required} onChange={() => updateFeeField(i, 'is_required', false)} />按需
                              </label>
                              <span style={{ color: 'var(--border-medium)' }}>|</span>
                              <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                <input type="radio" checked={r.price_mode === 'fixed'} onChange={() => updateFeeField(i, 'price_mode', 'fixed')} />固定价
                              </label>
                              <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                <input type="radio" checked={r.price_mode === 'range'} onChange={() => updateFeeField(i, 'price_mode', 'range')} />区间价
                              </label>
                            </div>
                            {r.price_mode === 'fixed' ? (
                              <div className="ap-field" style={{ marginBottom: 0 }}>
                                <label>固定价 £</label>
                                <input type="number" min="0" value={r.price_fixed} onChange={(e) => updateFeeField(i, 'price_fixed', e.target.value)} />
                              </div>
                            ) : (
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                <div className="ap-field" style={{ marginBottom: 0 }}>
                                  <label>区间起 £</label>
                                  <input type="number" min="0" value={r.price_from} onChange={(e) => updateFeeField(i, 'price_from', e.target.value)} />
                                </div>
                                <div className="ap-field" style={{ marginBottom: 0 }}>
                                  <label>区间止 £</label>
                                  <input type="number" min="0" value={r.price_to} onChange={(e) => updateFeeField(i, 'price_to', e.target.value)} />
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
              <button className="ap-ghost-btn" style={{ marginTop: 12 }} onClick={addFeeRow}>
                + 新增费用项
              </button>
            </div>
          )}

          {/* ───────────────── Step 5 ───────────────── */}
          {step === 5 && (
            <div style={{ padding: '16px 22px 0' }}>
              <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden' }}>
                <SummaryRow label="客户" value={clientName + (clientMeta ? ` · ${clientMeta}` : '')} />
                <SummaryRow label="签证类型" value={SERVICE_TYPE_LABELS[serviceType] || serviceType} />
                <SummaryRow label="推荐方案" value={`${recName} · ${fmtGBP(recPrice)}（锚定 ${fmtGBP(anchPrice)}）`} />
                {(Number(originalPrice) > 0 || Number(promoPrice) > 0) && (
                  <SummaryRow
                    label="限时优惠"
                    value={<><span style={{ textDecoration: 'line-through', color: 'var(--text-muted)', marginRight: 8 }}>{fmtGBP(originalPrice)}</span><strong>{fmtGBP(promoPrice)}</strong><span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-muted)' }}>含 VAT · 5 天内确认</span></>}
                  />
                )}
                <SummaryRow label="付款" value={`${fmtGBP(payment1)} 首期 + ${fmtGBP(payment2)} 第二期`} />
                <SummaryRow
                  label="时间线"
                  value={selectedTimeline.length === 0
                    ? <span style={{ color: 'var(--danger-text)' }}>未选任何节点</span>
                    : `${selectedTimeline.length} 个节点（含 ${keyMilestoneCount} 个关键节点）`}
                />
                <SummaryRow
                  label="Readii 服务费"
                  value={<strong>{fmtGBP(recPrice)}</strong>}
                />
                <SummaryRow
                  label="第三方参考费用"
                  value={selectedFees.length === 0
                    ? <span style={{ color: 'var(--text-muted)' }}>未选任何费用</span>
                    : <>
                        {requiredFees.length} 项必须 + {optionalFees.length} 项按需
                        <span style={{ color: 'var(--text-muted)', marginLeft: 6, fontSize: 11 }}>（仅供参考，客户直付）</span>
                      </>}
                  isLast
                />
              </div>
              <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                点击「生成方案书链接」后会创建一个 8 位 token 的链接（5 天有效），把链接发给客户即可。
              </div>
            </div>
          )}
        </div>

        {error && (
          <div style={{ color: 'var(--danger-text)', fontSize: 12, padding: '8px 22px 0' }}>{error}</div>
        )}

        <div className="modal-footer">
          {step > 1 ? (
            <button className="btn btn-ghost" onClick={goBack} disabled={submitting}>← 上一步</button>
          ) : (
            <button className="btn btn-ghost" onClick={onClose} disabled={submitting}>取消</button>
          )}
          {step < 5 ? (
            <button className="btn btn-primary" onClick={goNext}>下一步 →</button>
          ) : (
            <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? '生成中…' : '生成方案书链接'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function SummaryRow({ label, value, isLast }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12,
      padding: '12px 14px',
      borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)',
      alignItems: 'center',
    }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{value}</div>
    </div>
  )
}
