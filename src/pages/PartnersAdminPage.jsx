import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import Sidebar from '../components/layout/Sidebar'
import NewPartnerModal from '../components/modals/NewPartnerModal'
import './PartnersAdminPage.css'

export default function PartnersAdminPage() {
  const [partners, setPartners] = useState([])
  const [leadCounts, setLeadCounts] = useState({})
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
    if (ids.length) {
      const { data: leadRows } = await supabase
        .from('leads')
        .select('partner_id')
        .in('partner_id', ids)
      const counts = {}
      ;(leadRows || []).forEach((l) => {
        counts[l.partner_id] = (counts[l.partner_id] || 0) + 1
      })
      setLeadCounts(counts)
    } else {
      setLeadCounts({})
    }

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
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className="pa-detail">
            {selected ? (
              <PartnerDetail partner={selected} onSave={handleSave} />
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

function PartnerDetail({ partner, onSave }) {
  const [level, setLevel] = useState(partner.level)
  const [commissionRate, setCommissionRate] = useState(partner.commission_rate)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setLevel(partner.level)
    setCommissionRate(partner.commission_rate)
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
    </div>
  )
}
