import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/useAuth'
import { attachProfile, attachProfiles } from '../../lib/api/adminHelpers'

const SOURCE_TYPES = [
  { key: 'content',  label: '内容引流' },
  { key: 'referral', label: '朋友介绍' },
  { key: 'ref_link', label: '专属链接' },
  { key: 'direct',   label: '直接录入' },
]

const EMPTY_FORM = {
  name: '', channel: '',
  p: 'P2', s: 'S0', prod: 'IFV', b: 'B0',
  exp: '', goal: '',
  next: 'Call', follow: '',
  note: '',
  partner_id: '',
  source_type: 'content',
}

const VALID_P = ['P1', 'P2', 'P3']
const VALID_S = ['S0', 'S1', 'S2', 'S3', 'S4', 'S5']
const VALID_PROD = ['IFV', 'SW', 'EW', 'GT', 'Student', 'PlanB', '?']
const VALID_B = ['B0', 'B1', 'B2', 'B3', 'B4']
const VALID_NEXT = ['Call', 'Docs', 'Pay', 'Intro', 'Wait']

/**
 * 解析微信格式客户卡片：
 * 【姓名-渠道】P?｜S?｜产品｜预算｜Exp:YYYYMM｜Goal:YYYYMM｜下一步｜跟进:MMDD｜一句话进度
 */
function parseWechatCard(text) {
  const trimmed = text.trim()
  if (!trimmed) return null

  const headerMatch = trimmed.match(/[【\[](.*?)[】\]]/)
  if (!headerMatch) return null

  const headerParts = headerMatch[1].split(/[-–—]/)
  const name = (headerParts[0] || '').trim()
  const channel = (headerParts.slice(1).join('-') || '').trim()

  if (!name) return null

  const rest = trimmed.slice(headerMatch.index + headerMatch[0].length).trim()
  const segments = rest.split(/[｜|]/).map(s => s.trim()).filter(Boolean)

  const result = { name, channel }

  for (const seg of segments) {
    const upper = seg.toUpperCase()

    if (VALID_P.includes(upper)) {
      result.p = upper
    } else if (VALID_S.includes(upper)) {
      result.s = upper
    } else if (VALID_B.includes(upper)) {
      result.b = upper
    } else if (VALID_PROD.find(p => upper === p.toUpperCase())) {
      result.prod = VALID_PROD.find(p => upper === p.toUpperCase())
    } else if (VALID_NEXT.find(n => upper === n.toUpperCase())) {
      result.next = VALID_NEXT.find(n => upper === n.toUpperCase())
    } else if (/^exp[:\s：]/i.test(seg)) {
      result.exp = seg.replace(/^exp[:\s：]*/i, '').trim()
    } else if (/^goal[:\s：]/i.test(seg)) {
      result.goal = seg.replace(/^goal[:\s：]*/i, '').trim()
    } else if (/^跟进[:\s：]/i.test(seg)) {
      result.follow = seg.replace(/^跟进[:\s：]*/i, '').trim()
    } else if (seg.length > 6) {
      result.note = seg
    }
  }

  return result
}

export default function AddLeadModal({ open, onClose, editingLead }) {
  const { user, profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const isEdit = !!editingLead

  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [pasteText, setPasteText] = useState('')
  const [pasteCollapsed, setPasteCollapsed] = useState(false)
  const [parseMsg, setParseMsg] = useState(null)
  const [partners, setPartners] = useState([])
  const [selfPartnerId, setSelfPartnerId] = useState(null)

  // Load partners list + current user's own partner row (for partner role lock)
  useEffect(() => {
    if (!open) return
    (async () => {
      if (isAdmin) {
        const { data } = await supabase
          .from('partners')
          .select('id, user_id, referral_code')
          .eq('status', 'active')
          .order('created_at', { ascending: false })
        setPartners(await attachProfiles(supabase, data || []))
      } else if (user?.id) {
        const { data } = await supabase
          .from('partners')
          .select('id, user_id, referral_code')
          .eq('user_id', user.id)
          .maybeSingle()
        if (data) {
          const enriched = await attachProfile(supabase, data)
          setPartners([enriched])
          setSelfPartnerId(data.id)
        }
      }
    })()
  }, [open, isAdmin, user?.id])

  // Open: reset or populate
  useEffect(() => {
    if (!open) return
    if (editingLead) {
      setForm({
        name:        editingLead.name        || '',
        channel:     editingLead.channel     || '',
        p:           editingLead.p           || 'P2',
        s:           editingLead.s           || 'S0',
        prod:        editingLead.prod        || 'IFV',
        b:           editingLead.b           || 'B0',
        exp:         editingLead.exp         || '',
        goal:        editingLead.goal        || '',
        next:        editingLead.next        || 'Call',
        follow:      editingLead.follow      || '',
        note:        editingLead.note        || '',
        partner_id:  editingLead.partner_id  || '',
        source_type: editingLead.source_type || 'content',
      })
      setPasteCollapsed(true)
    } else {
      setForm({
        ...EMPTY_FORM,
        partner_id: !isAdmin && selfPartnerId ? selfPartnerId : '',
      })
      setPasteCollapsed(false)
    }
    setPasteText('')
    setParseMsg(null)
    setError(null)
  }, [open, editingLead, isAdmin, selfPartnerId])

  // 智能粘贴仅覆盖业务字段，不覆盖归属区块（partner_id / source_type / recorder）
  function applyParsed(parsed) {
    setForm((prev) => ({
      ...prev,
      ...parsed,
      partner_id: prev.partner_id,
      source_type: prev.source_type,
    }))
    setPasteCollapsed(true)
    setParseMsg({ ok: true, text: `已解析「${parsed.name}」的信息，请确认后保存` })
  }

  function handleParse() {
    const result = parseWechatCard(pasteText)
    if (result) {
      applyParsed(result)
    } else {
      setParseMsg({ ok: false, text: '解析失败，请检查格式：【姓名-渠道】P?｜S?｜产品｜预算｜...' })
    }
  }

  function handlePasteEvent(e) {
    setTimeout(() => {
      const val = e.target.value
      if (val && val.includes('【')) {
        const result = parseWechatCard(val)
        if (result) applyParsed(result)
      }
    }, 0)
  }

  function set(field) {
    return (e) => setForm(prev => ({ ...prev, [field]: e.target.value }))
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setError('姓名不能为空')
      return
    }

    setSaving(true)
    setError(null)

    const row = {
      name:        form.name.trim(),
      channel:     form.channel.trim() || null,
      p:           form.p,
      s:           form.s,
      prod:        form.prod,
      b:           form.b,
      exp:         form.exp.trim() || null,
      goal:        form.goal.trim() || null,
      next:        form.next,
      follow:      form.follow.trim() || null,
      note:        form.note.trim() || null,
      partner_id:  isAdmin ? (form.partner_id || null) : (selfPartnerId || null),
      recorder_id: user?.id || null,
      source_type: form.source_type || 'direct',
    }

    let result
    if (isEdit) {
      result = await supabase.from('leads').update(row).eq('id', editingLead.id)
    } else {
      result = await supabase.from('leads').insert(row)
    }

    setSaving(false)

    if (result.error) {
      setError(result.error.message)
    } else {
      onClose()
    }
  }

  const lockedPartner = useMemo(() => {
    if (isAdmin) return null
    return partners.find((p) => p.id === selfPartnerId) || null
  }, [isAdmin, partners, selfPartnerId])

  if (!open) return null

  return (
    <div className="overlay open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span style={{ fontSize: 18 }}>📋</span>
          <span className="modal-title">{isEdit ? '编辑客户卡片' : '新建客户卡片'}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* 智能粘贴区域 */}
        {!isEdit && !pasteCollapsed && (
          <div className="smart-paste-area">
            <textarea
              className="form-textarea smart-paste-input"
              placeholder="粘贴微信客户卡片格式，自动填写字段…&#10;例：【Harry-朋友介绍（Paul）】P2｜S2｜IFV｜B4｜Exp:202711｜Goal:202611｜Call｜跟进:0415｜国内有一个直发棒项目…&#10;或粘贴含 ?ref=READII-XXX-2025 的推广链接"
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              onPaste={handlePasteEvent}
              rows={3}
            />
            <div className="smart-paste-actions">
              <button className="btn btn-primary" onClick={handleParse} disabled={!pasteText.trim()} style={{ fontSize: 12, padding: '5px 12px' }}>
                ⚡ 智能解析
              </button>
              {parseMsg && (
                <span style={{ fontSize: 12, color: parseMsg.ok ? 'var(--s-active-text)' : 'var(--danger-text)' }}>
                  {parseMsg.text}
                </span>
              )}
            </div>
          </div>
        )}
        {!isEdit && pasteCollapsed && (
          <div className="smart-paste-collapsed" onClick={() => { setPasteCollapsed(false); setParseMsg(null) }}>
            {parseMsg?.ok ? `✓ ${parseMsg.text}` : '📋 点击展开智能粘贴'}
          </div>
        )}

        <div className="form-grid" style={{ paddingTop: 20 }}>
          <div className="form-row">
            <label className="form-label">姓名</label>
            <input className="form-input" placeholder="例：张三" value={form.name} onChange={set('name')} />
          </div>
          <div className="form-row">
            <label className="form-label">来源渠道</label>
            <input className="form-input" placeholder="例：小红书、朋友介绍" value={form.channel} onChange={set('channel')} />
          </div>
        </div>

        <div className="form-grid" style={{ marginTop: 12 }}>
          <div className="form-row">
            <label className="form-label">优先级 P</label>
            <select className="form-select" value={form.p} onChange={set('p')}>
              <option value="P1">P1 — 7天内决策 / 窗口紧</option>
              <option value="P2">P2 — 30天内可能决策</option>
              <option value="P3">P3 — 观望</option>
            </select>
          </div>
          <div className="form-row">
            <label className="form-label">阶段 S</label>
            <select className="form-select" value={form.s} onChange={set('s')}>
              <option value="S0">S0 — 新线索</option>
              <option value="S1">S1 — 已预筛信息齐</option>
              <option value="S2">S2 — 已约电话</option>
              <option value="S3">S3 — 已方案 / 报价</option>
              <option value="S4">S4 — 已成交 / 付款</option>
              <option value="S5">S5 — 冷 / 失联 / 拒绝</option>
            </select>
          </div>
        </div>

        <div className="form-grid" style={{ marginTop: 12 }}>
          <div className="form-row">
            <label className="form-label">产品</label>
            <select className="form-select" value={form.prod} onChange={set('prod')}>
              <option value="IFV">IFV — 创新签</option>
              <option value="SW">SW — 自担保工签</option>
              <option value="EW">EW — 拓展工签</option>
              <option value="GT">GT — 全球人才</option>
              <option value="Student">Student — 学签 / 陪读</option>
              <option value="PlanB">PlanB — 路线图 / 评估</option>
              <option value="?">未确定</option>
            </select>
          </div>
          <div className="form-row">
            <label className="form-label">预算 B</label>
            <select className="form-select" value={form.b} onChange={set('b')}>
              <option value="B0">B0 — 未知</option>
              <option value="B1">B1 — ≤ £5k</option>
              <option value="B2">B2 — £5k – £20k</option>
              <option value="B3">B3 — £20k – £60k</option>
              <option value="B4">B4 — ≥ £60k</option>
            </select>
          </div>
        </div>

        <div className="form-grid" style={{ marginTop: 12 }}>
          <div className="form-row">
            <label className="form-label">签证到期 Exp <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(YYYYMM)</span></label>
            <input className="form-input" placeholder="202609" maxLength={6} value={form.exp} onChange={set('exp')} />
          </div>
          <div className="form-row">
            <label className="form-label">目标月份 Goal <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(YYYYMM)</span></label>
            <input className="form-input" placeholder="202507" maxLength={6} value={form.goal} onChange={set('goal')} />
          </div>
        </div>

        <div className="form-grid" style={{ marginTop: 12 }}>
          <div className="form-row">
            <label className="form-label">下一步动作</label>
            <select className="form-select" value={form.next} onChange={set('next')}>
              <option value="Call">Call — 约 / 打电话</option>
              <option value="Docs">Docs — 要资料</option>
              <option value="Pay">Pay — 收定金 / 付款</option>
              <option value="Intro">Intro — 引荐</option>
              <option value="Wait">Wait — 等回复</option>
            </select>
          </div>
          <div className="form-row">
            <label className="form-label">跟进日期 <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(MMDD)</span></label>
            <input className="form-input" placeholder="0415" maxLength={4} value={form.follow} onChange={set('follow')} />
          </div>
        </div>

        <div className="form-row full" style={{ marginTop: 12 }}>
          <label className="form-label">一句话进度</label>
          <textarea className="form-textarea" placeholder="例：刚加微信，对IFV有兴趣，签证2026年底到期，决策节点9月" value={form.note} onChange={set('note')} />
        </div>

        {/* 归属区块 */}
        <div className="form-row full" style={{ marginTop: 18 }}>
          <label className="form-label" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 11, color: 'var(--text-muted)' }}>
            归属
          </label>
        </div>

        <div className="form-grid" style={{ marginTop: 6 }}>
          <div className="form-row">
            <label className="form-label">渠道伙伴</label>
            {isAdmin ? (
              <select
                className="form-select"
                value={form.partner_id}
                onChange={set('partner_id')}
              >
                <option value="">— 无渠道 —</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {(p.profiles?.full_name || '未命名')} · {p.referral_code}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="form-input"
                value={
                  lockedPartner
                    ? `${lockedPartner.profiles?.full_name || '你'} · ${lockedPartner.referral_code}`
                    : '（无绑定伙伴）'
                }
                readOnly
                style={{ background: 'var(--bg-muted)', cursor: 'not-allowed' }}
              />
            )}
          </div>
          <div className="form-row">
            <label className="form-label">录入人</label>
            <input
              className="form-input"
              value={profile?.full_name || user?.email || ''}
              readOnly
              style={{ background: 'var(--bg-muted)', cursor: 'not-allowed' }}
            />
          </div>
        </div>

        <div className="form-row full" style={{ marginTop: 12 }}>
          <label className="form-label">来源类型</label>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', paddingTop: 4 }}>
            {SOURCE_TYPES.map((s) => (
              <label key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="source_type"
                  value={s.key}
                  checked={form.source_type === s.key}
                  onChange={set('source_type')}
                />
                {s.label}
              </label>
            ))}
          </div>
        </div>

        {error && (
          <div style={{ color: 'var(--danger-text)', fontSize: 12, padding: '8px 22px 0' }}>{error}</div>
        )}

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>取消</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '保存卡片'}
          </button>
        </div>
      </div>
    </div>
  )
}
