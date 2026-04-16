import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import './NewProposalModal.css'

const VISA_ROUTES = [
  { zh: '创新签', en: 'Innovator Founder Visa', code: 'IFV' },
  { zh: '自担保工签', en: 'Self-Sponsored Skilled Worker Visa', code: 'SW' },
  { zh: '拓展工签', en: 'Expansion Worker Visa', code: 'EW' },
]

const TIERS = ['自助申请', '陪跑', '全案委托', '结果保障']

export default function NewProposalModal({ onClose, onCreated, prefillLead }) {
  const [leads, setLeads] = useState([])
  const [leadId, setLeadId] = useState(prefillLead?.id || '')
  const [clientName, setClientName] = useState(prefillLead?.name || '')
  const [clientTitle, setClientTitle] = useState('女士')
  const [routeIdx, setRouteIdx] = useState(0)
  const [background, setBackground] = useState('')
  const [clientQuote, setClientQuote] = useState('')
  const [exclusionReason, setExclusionReason] = useState('')
  const [advisorNote, setAdvisorNote] = useState('')
  const [selectedTier, setSelectedTier] = useState('全案委托')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [resultLink, setResultLink] = useState('')

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('leads').select('id, name').order('created_at', { ascending: false }).limit(200)
      setLeads(data || [])
    })()
  }, [])

  useEffect(() => {
    if (prefillLead) {
      setLeadId(prefillLead.id)
      setClientName(prefillLead.name || '')
      const prodMatch = VISA_ROUTES.findIndex(r => r.code === prefillLead.prod)
      if (prodMatch >= 0) setRouteIdx(prodMatch)
    }
  }, [prefillLead])

  function handleLeadChange(e) {
    const id = e.target.value
    setLeadId(id)
    const lead = leads.find(l => l.id === id)
    if (lead) setClientName(lead.name)
  }

  const route = VISA_ROUTES[routeIdx]

  async function handleSubmit(e) {
    e.preventDefault()
    if (!clientName.trim()) return setError('客户姓名必填')
    setSubmitting(true)
    setError('')

    // Generate proposal_no via RPC
    const { data: noData, error: noErr } = await supabase.rpc('generate_proposal_no')
    if (noErr) {
      setError(`编号生成失败：${noErr.message}`)
      setSubmitting(false)
      return
    }
    const proposalNo = noData

    const proposalDate = new Date().toISOString().slice(0, 10)
    const deadlineDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

    const row = {
      lead_id: leadId || null,
      client_name: clientName.trim(),
      client_title: clientTitle,
      visa_route_zh: route.zh,
      visa_route_en: route.en,
      proposal_no: proposalNo,
      proposal_date: proposalDate,
      deadline_date: deadlineDate,
      validity_days: 60,
      background_summary: background.trim() || null,
      client_quote: clientQuote.trim() || null,
      exclusion_reason: exclusionReason.trim() || null,
      advisor_note: advisorNote.trim() || null,
      selected_tier: selectedTier,
      status: 'draft',
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('proposals')
      .insert(row)
      .select('token')
      .single()

    setSubmitting(false)

    if (insertErr) {
      setError(`创建失败：${insertErr.message}`)
      return
    }

    const link = `${window.location.origin}/.netlify/functions/proposal-view?token=${inserted.token}`
    setResultLink(link)
  }

  function copyLink() {
    navigator.clipboard?.writeText(resultLink)
  }

  return (
    <div className="npp-backdrop" onClick={onClose}>
      <div className="npp-modal" onClick={e => e.stopPropagation()}>
        <div className="npp-head">
          <h2>{resultLink ? '建议书已生成' : '新建建议书'}</h2>
          <button className="npp-close" onClick={onClose}>×</button>
        </div>

        {resultLink ? (
          <div className="npp-body">
            <div className="npp-success">✓ 建议书创建成功</div>
            <div className="npp-field">
              <label>访问链接</label>
              <div className="npp-link-row">
                <input className="npp-readonly" value={resultLink} readOnly />
                <button className="npp-copy-btn" onClick={copyLink}>复制</button>
              </div>
            </div>
            <div className="npp-actions">
              <button className="npp-submit" onClick={() => window.open(resultLink, '_blank')}>预览建议书</button>
              <button className="npp-ghost" onClick={() => onCreated?.()}>完成</button>
            </div>
          </div>
        ) : (
          <form className="npp-body" onSubmit={handleSubmit}>
            <div className="npp-field">
              <label>关联客户</label>
              <select value={leadId} onChange={handleLeadChange}>
                <option value="">— 不关联 —</option>
                {leads.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div className="npp-row">
              <div className="npp-field">
                <label>客户姓名</label>
                <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="王某某" />
              </div>
              <div className="npp-field" style={{maxWidth:120}}>
                <label>称呼</label>
                <select value={clientTitle} onChange={e => setClientTitle(e.target.value)}>
                  <option value="先生">先生</option>
                  <option value="女士">女士</option>
                </select>
              </div>
            </div>
            <div className="npp-field">
              <label>签证路线</label>
              <select value={routeIdx} onChange={e => setRouteIdx(Number(e.target.value))}>
                {VISA_ROUTES.map((r, i) => <option key={r.code} value={i}>{r.code} · {r.zh}</option>)}
              </select>
            </div>
            <div className="npp-field">
              <label>现状评估</label>
              <textarea rows={4} value={background} onChange={e => setBackground(e.target.value)} placeholder="本建议书提交给xxx，基于我们于xxxx进行的初步咨询..." />
            </div>
            <div className="npp-field">
              <label>客户原话</label>
              <textarea rows={2} value={clientQuote} onChange={e => setClientQuote(e.target.value)} placeholder="最重要的是孩子不能因为签证问题影响上学。" />
            </div>
            <div className="npp-field">
              <label>排除路线及原因（如有）</label>
              <textarea rows={2} value={exclusionReason} onChange={e => setExclusionReason(e.target.value)} placeholder="我们评估了xxx路线并予以排除..." />
            </div>
            <div className="npp-field">
              <label>顾问引言</label>
              <textarea rows={3} value={advisorNote} onChange={e => setAdvisorNote(e.target.value)} placeholder="在审阅您的情况时..." />
            </div>
            <div className="npp-field">
              <label>推荐方案</label>
              <select value={selectedTier} onChange={e => setSelectedTier(e.target.value)}>
                {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {error && <div className="npp-error">{error}</div>}

            <button type="submit" className="npp-submit" disabled={submitting}>
              {submitting ? '生成中...' : '生成建议书'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
