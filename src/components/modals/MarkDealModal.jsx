import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/useAuth'
import { buildDealRoles } from '../../lib/commission'
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
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    (async () => {
      const { data, error: pErr } = await supabase
        .from('products')
        .select('id, code, name_zh, type, base_price, platform_rate, commission_model, is_active')
        .eq('is_active', true)
        .order('code')
      if (pErr) {
        setError(`加载产品失败：${pErr.message}`)
      } else {
        setProducts(data || [])
        const match = (data || []).find((p) => p.code === lead?.prod)
        if (match) {
          setProductId(match.id)
          if (match.base_price) setContractAmount(String(match.base_price))
        }
      }
      setLoading(false)
    })()
  }, [lead])

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === productId) || null,
    [products, productId]
  )

  const contractNum = Number(contractAmount) || 0
  const platformRate = Number(selectedProduct?.platform_rate ?? 0.30)
  const platformAmount = Math.round(contractNum * platformRate * 100) / 100
  const distributable = Math.round(contractNum * (1 - platformRate) * 100) / 100

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!productId) return setError('请选择产品')
    if (!contractNum) return setError('请输入合同金额')

    setSubmitting(true)
    try {
      // Look up lead's partner info (if any) for lead_recorder commission
      let leadPartner = null
      if (lead?.partner_id) {
        const { data: partnerRow } = await supabase
          .from('partners')
          .select('user_id, commission_rate')
          .eq('id', lead.partner_id)
          .maybeSingle()
        if (partnerRow) leadPartner = partnerRow
      }

      // Insert deal
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

      // Build and insert deal_roles
      const roles = buildDealRoles({
        commissionModel: selectedProduct.commission_model || {},
        contractAmount: contractNum,
        distributable,
        currentUserId: user.id,
        leadPartner,
      })

      if (roles.length) {
        const rows = roles.map((r) => ({ ...r, deal_id: dealRow.id, status: 'pending' }))
        const { error: roleErr } = await supabase.from('deal_roles').insert(rows)
        if (roleErr) throw new Error(`写入 deal_roles 失败：${roleErr.message}`)
      }

      // Mark lead as S4
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
                  <span>平台抽成 ({Math.round(platformRate * 100)}%)</span>
                  <strong>£{platformAmount.toLocaleString()}</strong>
                </div>
                <div className="md-preview-row">
                  <span>可分配金额</span>
                  <strong>£{distributable.toLocaleString()}</strong>
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
