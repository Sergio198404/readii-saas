import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

function todayMMDD() {
  const d = new Date()
  return String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0')
}

export default function UpdateLeadModal({ open, onClose, lead }) {
  const [form, setForm] = useState({ s: 'S0', p: 'P2', next: 'Call', follow: '', note: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open || !lead) return
    setForm({
      s:      lead.s    || 'S0',
      p:      lead.p    || 'P2',
      next:   lead.next || 'Call',
      follow: '',
      note:   '',
    })
    setError(null)
  }, [open, lead])

  function set(field) {
    return (e) => setForm(prev => ({ ...prev, [field]: e.target.value }))
  }

  async function handleSave() {
    if (!form.note.trim()) {
      setError('请填写本次沟通备注')
      return
    }

    setSaving(true)
    setError(null)

    // 追加一条 update 记录
    const newUpdate = {
      date: todayMMDD(),
      note: `[${form.s}] ${form.note.trim()}`,
    }
    const existingUpdates = Array.isArray(lead.updates) ? lead.updates : []

    const { error: err } = await supabase
      .from('leads')
      .update({
        s:       form.s,
        p:       form.p,
        next:    form.next,
        follow:  form.follow.trim() || null,
        updates: [...existingUpdates, newUpdate],
      })
      .eq('id', lead.id)

    setSaving(false)

    if (err) {
      setError(err.message)
    } else {
      onClose()
    }
  }

  if (!open || !lead) return null

  return (
    <div className="overlay open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <span style={{ fontSize: 18 }}>↑</span>
          <span className="modal-title">更新进展 · {lead.name}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="form-grid" style={{ paddingTop: 20 }}>
          <div className="form-row">
            <label className="form-label">新阶段</label>
            <select className="form-select" value={form.s} onChange={set('s')}>
              <option value="S0">S0 新线索</option>
              <option value="S1">S1 信息已齐</option>
              <option value="S2">S2 已约电话</option>
              <option value="S3">S3 已方案 / 报价</option>
              <option value="S4">S4 已成交 ✓</option>
              <option value="S5">S5 冷 / 失联</option>
            </select>
          </div>
          <div className="form-row">
            <label className="form-label">优先级</label>
            <select className="form-select" value={form.p} onChange={set('p')}>
              <option value="P1">P1</option>
              <option value="P2">P2</option>
              <option value="P3">P3</option>
            </select>
          </div>
        </div>

        <div className="form-grid" style={{ marginTop: 12 }}>
          <div className="form-row">
            <label className="form-label">下一步动作</label>
            <select className="form-select" value={form.next} onChange={set('next')}>
              <option value="Call">Call</option>
              <option value="Docs">Docs</option>
              <option value="Pay">Pay</option>
              <option value="Intro">Intro</option>
              <option value="Wait">Wait</option>
            </select>
          </div>
          <div className="form-row">
            <label className="form-label">下次跟进日期 (MMDD)</label>
            <input className="form-input" placeholder="例：0420" maxLength={4} value={form.follow} onChange={set('follow')} />
          </div>
        </div>

        <div className="form-row full" style={{ marginTop: 12 }}>
          <label className="form-label">本次沟通备注</label>
          <textarea className="form-textarea" placeholder="简短记录本次沟通内容和客户反馈..." value={form.note} onChange={set('note')} />
        </div>

        {error && (
          <div style={{ color: 'var(--danger-text)', fontSize: 12, padding: '8px 22px 0' }}>{error}</div>
        )}

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>取消</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '保存更新'}
          </button>
        </div>
      </div>
    </div>
  )
}
