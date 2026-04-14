import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/useAuth'
import { buildDealRoles, computeDealAmounts } from '../../lib/commission'
import './MarkDealModal.css'

function todayISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function MarkDealModal({ lead, onClose, onDone }) {
  const { user } = useAuth()
  const [products, setProducts] = useState([])
  const [productId, setProductId] = useState('')
  const [contractAmount, setContractAmount] = useState('')
  const [paidAmount, setPaidAmount] = useState('')
  const [signedAt, setSignedAt] = useState(todayISO())
  const [leadPartner, setLeadPartner] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    (async () => {
      const productsPromise = supabase
        .from('products')
        .select('id, code, name_zh, type, base_price, platform_rate, commission_model, is_active')
        .eq('is_active', true)
        .order('code')

      const partnerPromise = lead?.partner_id
        ? supabase
            .from('partners')
            .select('user_id, commission_rate, multiplier')
            .eq('id', lead.partner_id)
            .maybeSingle()
        : Promise.resolve({ data: null })

      const [{ data: pData, error: pErr }, { data: partnerRow }] = await Promise.all([
        productsPromise,
        partnerPromise,
      ])

      if (pErr) {
        setError(`加载产品失败：${pErr.message}`)
      } else {
        setProducts(pData || [])
        const match = (pData || []).find((p) => p.code === lead?.prod)
        if (match) {
          setProductId(match.id)
          if (match.base_price) setContractAmount(String(match.base_price))
        }
      }
      setLeadPartner(partnerRow || null)
      setLoading(false)
    })()
  }, [lead])

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === productId) || null,
    [products, productId]
  )

  const platformRate = Number(selectedProduct?.platform_rate ?? 0.30)
  const contractNum = Number(contractAmount) || 0

  const amounts = useMemo(
    () => computeDealAmounts({ contractAmount: contractNum, platformRate, leadPartner }),
    [contractNum, platformRate, leadPartner]
  )

  const previewRoles = useMemo(() => {
    if (!selectedProduct || !user?.id || !contractNum) return []
    return buildDealRoles({
      commissionModel: selectedProduct.commission_model || {},
      contractAmount: contractNum,
      platformRate,
      currentUserId: user.id,
      leadPartner,
    })
  }, [selectedProduct, contractNum, platformRate, user?.id, leadPartner])

  const yourShare = useMemo(() => {
    return previewRoles
      .filter((r) => r.user_id === user?.id)
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0)
  }, [previewRoles, user?.id])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!productId) return setError('请选择产品')
    if (!contractNum) return setError('请输入合同金额')

    setSubmitting(true)
    try {
      const { data: dealRow, error: dealErr } = await supabase
        .from('deals')
        .insert({
          lead_id: lead.id,
          product_id: productId,
          contract_amount: contractNum,
          paid_amount: Number(paidAmount) || 0,
          status: 'active',
          signed_at: signedAt ? new Date(signedAt).toISOString() : new Date().toISOString(),
        })
        .select()
        .single()
      if (dealErr) throw new Error(`写入 deals 失败：${dealErr.message}`)

      const roles = buildDealRoles({
        commissionModel: selectedProduct.commission_model || {},
        contractAmount: contractNum,
        platformRate,
        currentUserId: user.id,
        leadPartner,
      })

      if (roles.length) {
        const rows = roles.map((r) => ({ ...r, deal_id: dealRow.id, status: 'pending' }))
        const { error: roleErr } = await supabase.from('deal_roles').insert(rows)
        if (roleErr) throw new Error(`写入 deal_roles 失败：${roleErr.message}`)
      }

      const { error: leadErr } = await supabase
        .from('leads')
        .update({ s: 'S4', product_id: productId })
        .eq('id', lead.id)
      if (leadErr) throw new Error(`更新 lead 失败：${leadErr.message}`)

      onDone?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const fmt = (n) => `£${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString()}`

  return (
    <div className="md-backdrop" onClick={onClose}>
      <div className="md-modal" onClick={(e) => e.stopPropagation()}>
        <div className="md-head">
          <h2>🎉 标记成交 · {lead?.name}</h2>
          <button className="md-close" onClick={onClose}>×</button>
        </div>

        {loading ? (
          <div className="md-body"><div className="md-empty">加载产品中...</div></div>
        ) : (
          <form className="md-body" onSubmit={handleSubmit}>
            <div className="md-field">
              <label>产品</label>
              <select value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">— 请选择 —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} · {p.name_zh}
                  </option>
                ))}
              </select>
            </div>

            <div className="md-field">
              <label>合同金额 (£)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={contractAmount}
                onChange={(e) => setContractAmount(e.target.value)}
              />
            </div>

            <div className="md-field">
              <label>首付金额 (£)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
              />
            </div>

            <div className="md-field">
              <label>签约日期</label>
              <input
                type="date"
                value={signedAt}
                onChange={(e) => setSignedAt(e.target.value)}
              />
            </div>

            {selectedProduct && contractNum > 0 && (
              <div className="md-preview">
                <div className="md-preview-row">
                  <span>合同金额</span>
                  <strong>{fmt(amounts.contract)}</strong>
                </div>
                <div className="md-preview-row">
                  <span>平台抽成 ({Math.round(platformRate * 100)}%)</span>
                  <strong>{fmt(amounts.platform)}</strong>
                </div>
                <div className="md-preview-row">
                  <span>
                    渠道佣金
                    {leadPartner
                      ? ` (Lv·${Number(leadPartner.commission_rate || 0) * 100}% × ${Number(leadPartner.multiplier || 1).toFixed(1)}x)`
                      : ' (无渠道)'}
                  </span>
                  <strong>{fmt(amounts.channelAmount)}</strong>
                </div>
                <div className="md-preview-row">
                  <span>剩余池（转化/方案/执行 按 532 分）</span>
                  <strong>{fmt(amounts.remainingPool)}</strong>
                </div>
                <div className="md-preview-divider" />
                <div className="md-preview-row md-preview-you">
                  <span>你实得</span>
                  <strong>{fmt(yourShare)}</strong>
                </div>
              </div>
            )}

            {error && <div className="md-error">{error}</div>}

            <button type="submit" className="md-submit" disabled={submitting}>
              {submitting ? '提交中...' : '确认成交'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
