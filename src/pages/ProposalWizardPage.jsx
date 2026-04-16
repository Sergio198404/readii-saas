import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Sidebar from '../components/layout/Sidebar'
import QRCode from 'qrcode'
import './ProposalWizardPage.css'

const STEPS = [
  { key: 'basic', title: '基本信息', desc: '客户信息和签证路线' },
  { key: 'assessment', title: '现状评估', desc: '客户优势分析与顾问撰写' },
  { key: 'goals', title: '目标', desc: 'AI生成 + 顾问选择' },
  { key: 'metrics', title: '衡量标准', desc: 'AI自动生成' },
  { key: 'values', title: '价值主张', desc: '从价值库勾选' },
  { key: 'timeline', title: '时间安排', desc: '时间线与风险提示' },
  { key: 'preview', title: '预览 & 生成', desc: '确认并生成链接' },
]

const VISA_ROUTES = [
  { zh: '创新签', en: 'Innovator Founder Visa', code: 'IFV' },
  { zh: '自担保工签', en: 'Self-Sponsored Skilled Worker Visa', code: 'SW' },
  { zh: '拓展工签', en: 'Expansion Worker Visa', code: 'EW' },
]

const TIERS = ['自助申请', '陪跑', '全案委托', '结果保障']

const TYPICAL_DISADVANTAGES = [
  '公司尚未注册，需从零开始', '无合适的AO人选', 'PSW仅剩3–6个月，时间极紧',
  '职业背景不够清晰连续', '无在英银行账户或财务记录', '商业计划书尚未准备',
  '家庭成员签证情况复杂', '在英国境外申请，流程更复杂', '缺乏英国本地担保人',
  '行业背景与签证路线匹配度低',
]

const CLIENT_ADVANTAGES = [
  '公司已注册，法律主体就绪', '永居合伙人可合法担任AO', 'PSW还有12个月以上，准备充裕',
  '10年以上专业从业背景，清晰连续', '在英银行账户已开立，流水完整', '已有真实客户合同或业务收入',
  '孩子在英就读，学籍稳定', '商业计划书框架已初步建立', '已有英国本地合规律师配合',
  '持有相关专业资质或认证', '已完成英国公司年度合规报告', '有明确的英国市场客户资源',
]

const VALUE_LIBRARY = [
  { id: 'child_education', icon: '👨‍👦', title: '孩子的未来保障', desc: '工签获批后，孩子完成A-Level可以以UK resident身份申请英国大学，学费与本地生相同（约£9,250/年）。', loss: '若签证中断，孩子将以国际生身份就读（£25,000+/年），四年差额超过£60,000。' },
  { id: 'identity_control', icon: '🛡', title: '身份自主掌控', desc: '自雇路线建立的是不依赖外部雇主的身份架构，续签都在自己手里。', loss: '依赖外部雇主工签，雇主随时可以撤销CoS，面临被动失去签证资格的风险。' },
  { id: 'time_saving', icon: '⏱', title: '时间成本节省', desc: 'Readii 全程协调，您不需要请假、不需要跑机构，只在关键节点配合提供材料。', loss: '自行摸索的错误代价极大——一次材料错误可能导致拒签，重新准备至少6个月。' },
  { id: 'decision_accuracy', icon: '🎯', title: '决策精准度', desc: '基于真实案例和当前政策的判断，帮您排除错误路线，避免在不适合的方向上投入。', loss: '在错误路线上准备6个月，压缩了签证到期前的有效操作窗口，代价难以挽回。' },
  { id: 'community', icon: '👥', title: '同路人网络', desc: '加入 Readii 英国创业社群，连接与您处于相似阶段的跨境家庭，每月直播答疑。', loss: '独自面对陌生系统，缺少真实参照，没有人告诉你和我一样情况的人是怎么走通的。' },
  { id: 'compliance_asset', icon: '📋', title: '合规架构资产', desc: 'Sponsor Licence 一旦建立，是未来为其他员工发工签的长期资格，随业务发展持续增值。', loss: '没有Sponsor Licence，公司无法合法为任何人发工签，限制了未来的商业灵活性。' },
  { id: 'business_future', icon: '🏢', title: '英国商业落地', desc: '获得合法居留身份后，可以正式以个人名义签署英国商业合同，开展本地业务。', loss: '没有稳定身份，英国本地合作方对长期合作的意愿会大打折扣。' },
  { id: 'endorsement', icon: '🏛', title: '背书机构资源', desc: 'Readii 与 Nexus/UKES 背书机构长期合作，可协助评估背书申请的可行性和材料准备。', loss: '背书机构审核严格，没有专业指导直接申请，被拒概率极高且无法退款。' },
]

const DEFAULT_TIMELINE = [
  { phase: '启动', title: '签署协议 & 启动会议', desc: '', type: 'highlight' },
  { phase: '第1-2周', title: '材料收集与初审', desc: '', type: 'normal' },
  { phase: '第3-4周', title: '方案设计与文件准备', desc: '', type: 'normal' },
  { phase: '第5-6周', title: '递交申请', desc: '', type: 'highlight' },
  { phase: '获批后', title: '后续安排与合规维护', desc: '', type: 'normal' },
]

async function aiAssist(fieldType, context) {
  const res = await fetch('/.netlify/functions/proposal-ai-assist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ field_type: fieldType, context }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'AI request failed')
  return data.result
}

export default function ProposalWizardPage() {
  const { id: editId } = useParams()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [proposalId, setProposalId] = useState(editId || null)
  const [leads, setLeads] = useState([])
  const [form, setForm] = useState({
    lead_id: '', client_name: '', client_email: '', client_title: '女士',
    visa_route_idx: 0, selected_tier: '全案委托', validity_days: 60,
    cover_tags: ['', '', '', ''],
    background_summary: '', client_quote: '', exclusion_reason: '', advisor_note: '',
    typical_disadvantages: [], client_advantages: [],
    selected_goals: [], metrics: {},
    selected_values: [],
    timeline: DEFAULT_TIMELINE.map(t => ({ ...t })),
    risk_note: '',
  })
  const [resultLink, setResultLink] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')

  const route = VISA_ROUTES[form.visa_route_idx] || VISA_ROUTES[0]

  useEffect(() => {
    supabase.from('leads').select('id, name, prod').order('created_at', { ascending: false }).limit(200)
      .then(({ data }) => setLeads(data || []))
  }, [])

  useEffect(() => {
    if (!editId) return
    supabase.from('proposals').select('*').eq('id', editId).maybeSingle().then(({ data }) => {
      if (!data) return
      const ri = VISA_ROUTES.findIndex(r => r.zh === data.visa_route_zh)
      setForm(prev => ({
        ...prev,
        lead_id: data.lead_id || '',
        client_name: data.client_name || '',
        client_email: data.client_email || '',
        client_title: data.client_title || '女士',
        visa_route_idx: ri >= 0 ? ri : 0,
        selected_tier: data.selected_tier || '全案委托',
        validity_days: data.validity_days || 60,
        cover_tags: data.cover_tags?.length === 4 ? data.cover_tags : ['', '', '', ''],
        background_summary: data.background_summary || '',
        client_quote: data.client_quote || '',
        exclusion_reason: data.exclusion_reason || '',
        advisor_note: data.advisor_note || '',
        typical_disadvantages: data.typical_disadvantages || [],
        client_advantages: data.client_advantages || [],
        selected_goals: data.selected_goals || [],
        metrics: data.metrics || {},
        selected_values: data.selected_values || [],
        timeline: data.timeline?.length ? data.timeline : DEFAULT_TIMELINE.map(t => ({ ...t })),
        risk_note: data.risk_note || '',
      }))
    })
  }, [editId])

  function set(field) {
    return (e) => setForm(prev => ({ ...prev, [field]: e.target.value }))
  }

  function setField(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function saveDraft() {
    setSaving(true)
    const r = VISA_ROUTES[form.visa_route_idx]
    const row = {
      lead_id: form.lead_id || null,
      client_name: form.client_name.trim(),
      client_email: form.client_email.trim() || null,
      client_title: form.client_title,
      visa_route_zh: r.zh, visa_route_en: r.en,
      selected_tier: form.selected_tier,
      validity_days: form.validity_days,
      cover_tags: form.cover_tags,
      background_summary: form.background_summary.trim() || null,
      client_quote: form.client_quote.trim() || null,
      exclusion_reason: form.exclusion_reason.trim() || null,
      advisor_note: form.advisor_note.trim() || null,
      typical_disadvantages: form.typical_disadvantages,
      client_advantages: form.client_advantages,
      selected_goals: form.selected_goals,
      metrics: form.metrics,
      selected_values: form.selected_values,
      timeline: form.timeline,
      risk_note: form.risk_note?.trim() || null,
    }

    if (proposalId) {
      await supabase.from('proposals').update(row).eq('id', proposalId)
    } else {
      const { data: noData } = await supabase.rpc('generate_proposal_no')
      row.proposal_no = noData
      row.proposal_date = new Date().toISOString().slice(0, 10)
      row.deadline_date = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
      row.status = 'draft'
      const { data, error } = await supabase.from('proposals').insert(row).select('id, token').single()
      if (error) { alert(`保存失败：${error.message}`); setSaving(false); return }
      setProposalId(data.id)
    }
    setSaving(false)
  }

  async function generateLink() {
    await saveDraft()
    if (!proposalId) return
    const { data } = await supabase.from('proposals').select('token').eq('id', proposalId).single()
    if (!data) return
    const link = `${window.location.origin}/.netlify/functions/proposal-view?token=${data.token}`
    setResultLink(link)
    try { setQrDataUrl(await QRCode.toDataURL(link, { width: 200, margin: 2 })) } catch {}
  }

  async function nextStep() {
    await saveDraft()
    setStep(s => Math.min(s + 1, 6))
  }

  return (
    <div className="app-layout">
      <Sidebar badgeCounts={{}} />
      <main className="main pw-page">
        <header className="pw-header">
          <h1 className="pw-title">{editId ? '编辑建议书' : '新建建议书'}</h1>
          <button className="pw-back" onClick={() => navigate('/admin/proposals')}>← 返回列表</button>
        </header>

        <div className="pw-steps">
          {STEPS.map((s, i) => (
            <div key={s.key} className={`pw-step-dot ${i === step ? 'active' : i < step ? 'done' : ''}`} onClick={() => { if (i <= step || proposalId) setStep(i) }}>
              <span className="pw-step-n">{i + 1}</span>
              <span className="pw-step-label">{s.title}</span>
            </div>
          ))}
        </div>

        <div className="pw-body">
          {step === 0 && <Step1Basic form={form} set={set} setField={setField} leads={leads} route={route} />}
          {step === 1 && <Step2Assessment form={form} set={set} setField={setField} route={route} />}
          {step === 2 && <Step3Goals form={form} setField={setField} route={route} />}
          {step === 3 && <Step4Metrics form={form} setField={setField} route={route} />}
          {step === 4 && <Step5Values form={form} setField={setField} />}
          {step === 5 && <Step6Timeline form={form} setField={setField} set={set} route={route} />}
          {step === 6 && <Step7Preview form={form} route={route} resultLink={resultLink} qrDataUrl={qrDataUrl} onGenerate={generateLink} />}
        </div>

        <div className="pw-footer">
          {step > 0 && <button className="pw-btn pw-btn-ghost" onClick={() => setStep(s => s - 1)}>上一步</button>}
          <button className="pw-btn pw-btn-secondary" onClick={saveDraft} disabled={saving}>{saving ? '保存中...' : '保存草稿'}</button>
          {step < 6 && <button className="pw-btn pw-btn-primary" onClick={nextStep} disabled={saving}>下一步</button>}
        </div>
      </main>
    </div>
  )
}

function Step1Basic({ form, set, setField, leads, route }) {
  const [aiLoading, setAiLoading] = useState(false)

  function handleLeadChange(e) {
    const id = e.target.value
    setField('lead_id', id)
    const lead = leads.find(l => l.id === id)
    if (lead) {
      setField('client_name', lead.name)
      const ri = VISA_ROUTES.findIndex(r => r.code === lead.prod)
      if (ri >= 0) setField('visa_route_idx', ri)
    }
  }

  async function generateTags() {
    setAiLoading(true)
    try {
      const tags = await aiAssist('tags', { client_name: form.client_name, client_title: form.client_title, visa_route_zh: route.zh, client_advantages: form.client_advantages })
      if (Array.isArray(tags) && tags.length >= 4) setField('cover_tags', tags.slice(0, 4))
    } catch (e) { console.error(e) }
    setAiLoading(false)
  }

  return (
    <div className="pw-step-content">
      <div className="pw-field"><label>关联客户</label>
        <select value={form.lead_id} onChange={handleLeadChange}><option value="">— 不关联 —</option>{leads.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
      <div className="pw-row">
        <div className="pw-field"><label>客户姓名</label><input value={form.client_name} onChange={set('client_name')} /></div>
        <div className="pw-field" style={{maxWidth:100}}><label>称呼</label><select value={form.client_title} onChange={set('client_title')}><option>先生</option><option>女士</option></select></div>
        <div className="pw-field"><label>邮箱</label><input type="email" value={form.client_email} onChange={set('client_email')} /></div>
      </div>
      <div className="pw-row">
        <div className="pw-field"><label>签证路线</label><select value={form.visa_route_idx} onChange={e => setField('visa_route_idx', Number(e.target.value))}>{VISA_ROUTES.map((r, i) => <option key={r.code} value={i}>{r.code} · {r.zh}</option>)}</select></div>
        <div className="pw-field"><label>推荐方案</label><select value={form.selected_tier} onChange={set('selected_tier')}>{TIERS.map(t => <option key={t}>{t}</option>)}</select></div>
        <div className="pw-field" style={{maxWidth:100}}><label>有效期(天)</label><input type="number" value={form.validity_days} onChange={set('validity_days')} /></div>
      </div>
      <div className="pw-field"><label>封面标签（4个）<button type="button" className="pw-ai-btn" onClick={generateTags} disabled={aiLoading}>{aiLoading ? '生成中...' : '🧠 AI生成'}</button></label>
        <div className="pw-row">{form.cover_tags.map((t, i) => <input key={i} value={t} onChange={e => { const tags = [...form.cover_tags]; tags[i] = e.target.value; setField('cover_tags', tags) }} placeholder={`标签${i+1}`} />)}</div>
      </div>
    </div>
  )
}

function Step2Assessment({ form, set, setField, route }) {
  const [aiField, setAiField] = useState(null)

  function toggleList(field, item) {
    setField(field, form[field].includes(item) ? form[field].filter(x => x !== item) : [...form[field], item])
  }

  async function aiWrite(fieldType, targetField) {
    setAiField(targetField)
    try {
      const text = await aiAssist(fieldType, { background: form.background_summary, visa_route_zh: route.zh, client_advantages: form.client_advantages })
      setField(targetField, text)
    } catch (e) { console.error(e) }
    setAiField(null)
  }

  return (
    <div className="pw-step-content">
      <div className="pw-assess-grid">
        <div className="pw-assess-col">
          <div className="pw-assess-title">✗ 典型申请人的起点</div>
          {TYPICAL_DISADVANTAGES.map(item => (
            <label key={item} className="pw-check"><input type="checkbox" checked={form.typical_disadvantages.includes(item)} onChange={() => toggleList('typical_disadvantages', item)} />{item}</label>
          ))}
        </div>
        <div className="pw-assess-col">
          <div className="pw-assess-title">✓ 您已具备的条件</div>
          {CLIENT_ADVANTAGES.map(item => (
            <label key={item} className="pw-check"><input type="checkbox" checked={form.client_advantages.includes(item)} onChange={() => toggleList('client_advantages', item)} />{item}</label>
          ))}
        </div>
      </div>
      <div className="pw-field"><label>现状评估（背景描述）</label><textarea rows={4} value={form.background_summary} onChange={set('background_summary')} placeholder="本建议书提交给xxx，基于我们于xxxx进行的初步咨询..." /></div>
      <div className="pw-field"><label>客户原话</label><textarea rows={2} value={form.client_quote} onChange={set('client_quote')} /></div>
      <div className="pw-field"><label>排除路线及原因 <button type="button" className="pw-ai-btn" onClick={() => aiWrite('exclusion', 'exclusion_reason')} disabled={!!aiField}>{aiField === 'exclusion_reason' ? '生成中...' : '🧠 AI撰写'}</button></label>
        <textarea rows={3} value={form.exclusion_reason} onChange={set('exclusion_reason')} /></div>
      <div className="pw-field"><label>顾问引言 <button type="button" className="pw-ai-btn" onClick={() => aiWrite('advisor_note', 'advisor_note')} disabled={!!aiField}>{aiField === 'advisor_note' ? '生成中...' : '🧠 AI撰写'}</button></label>
        <textarea rows={3} value={form.advisor_note} onChange={set('advisor_note')} /></div>
    </div>
  )
}

function Step3Goals({ form, setField, route }) {
  const [generating, setGenerating] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [custom, setCustom] = useState({ title: '', description: '', tag: '核心目标' })

  async function generate() {
    setGenerating(true)
    try {
      const goals = await aiAssist('goals', { background: form.background_summary, visa_route_zh: route.zh, client_advantages: form.client_advantages })
      if (Array.isArray(goals)) setSuggestions(goals)
    } catch (e) { console.error(e) }
    setGenerating(false)
  }

  useEffect(() => { if (!suggestions.length && !form.selected_goals.length) generate() }, [])

  function toggleGoal(goal) {
    const exists = form.selected_goals.find(g => g.title === goal.title)
    setField('selected_goals', exists ? form.selected_goals.filter(g => g.title !== goal.title) : [...form.selected_goals, goal])
  }

  function addCustom() {
    if (!custom.title.trim()) return
    setField('selected_goals', [...form.selected_goals, { ...custom }])
    setCustom({ title: '', description: '', tag: '核心目标' })
  }

  const TAGS = ['核心目标', '合规目标', '家庭目标', '长期目标']

  return (
    <div className="pw-step-content">
      <div style={{display:'flex',gap:8,marginBottom:16}}>
        <button className="pw-btn pw-btn-secondary" onClick={generate} disabled={generating}>{generating ? '生成中...' : '🧠 AI生成目标'}</button>
      </div>
      <div className="pw-goals-grid">
        {(suggestions.length ? suggestions : form.selected_goals).map((g, i) => {
          const selected = form.selected_goals.some(s => s.title === g.title)
          return (
            <div key={i} className={`pw-goal-card ${selected ? 'selected' : ''}`} onClick={() => toggleGoal(g)}>
              <div className="pw-goal-tag">{g.tag}</div>
              <div className="pw-goal-title">{g.title}</div>
              <div className="pw-goal-desc">{g.description}</div>
            </div>
          )
        })}
      </div>
      <div className="pw-field" style={{marginTop:16}}><label>添加自定义目标</label>
        <div className="pw-row">
          <input value={custom.title} onChange={e => setCustom(c => ({...c, title: e.target.value}))} placeholder="目标标题" />
          <input value={custom.description} onChange={e => setCustom(c => ({...c, description: e.target.value}))} placeholder="说明" style={{flex:2}} />
          <select value={custom.tag} onChange={e => setCustom(c => ({...c, tag: e.target.value}))}>{TAGS.map(t => <option key={t}>{t}</option>)}</select>
          <button className="pw-btn pw-btn-secondary" onClick={addCustom}>添加</button>
        </div>
      </div>
      <div style={{fontSize:12,color:'var(--text-muted)',marginTop:8}}>已选 {form.selected_goals.length} 个目标</div>
    </div>
  )
}

function Step4Metrics({ form, setField, route }) {
  const [generating, setGenerating] = useState(false)

  async function generate() {
    setGenerating(true)
    try {
      const result = await aiAssist('metrics', { selected_goals: form.selected_goals, visa_route_zh: route.zh })
      if (Array.isArray(result)) {
        const obj = {}
        result.forEach(item => { obj[item.goal_title] = item.metrics || [] })
        setField('metrics', obj)
      }
    } catch (e) { console.error(e) }
    setGenerating(false)
  }

  useEffect(() => { if (form.selected_goals.length && !Object.keys(form.metrics).length) generate() }, [])

  function updateMetric(goalTitle, idx, value) {
    const m = { ...form.metrics }
    m[goalTitle] = [...(m[goalTitle] || [])]
    m[goalTitle][idx] = value
    setField('metrics', m)
  }

  function removeMetric(goalTitle, idx) {
    const m = { ...form.metrics }
    m[goalTitle] = (m[goalTitle] || []).filter((_, i) => i !== idx)
    setField('metrics', m)
  }

  function addMetric(goalTitle) {
    const m = { ...form.metrics }
    m[goalTitle] = [...(m[goalTitle] || []), '']
    setField('metrics', m)
  }

  return (
    <div className="pw-step-content">
      <button className="pw-btn pw-btn-secondary" onClick={generate} disabled={generating} style={{marginBottom:16}}>{generating ? '生成中...' : '🧠 AI生成衡量标准'}</button>
      {form.selected_goals.map(goal => (
        <div key={goal.title} className="pw-metric-group">
          <div className="pw-metric-title">{goal.title}</div>
          {(form.metrics[goal.title] || []).map((m, i) => (
            <div key={i} className="pw-row" style={{marginBottom:6}}>
              <input value={m} onChange={e => updateMetric(goal.title, i, e.target.value)} style={{flex:1}} />
              <button className="pw-btn-sm" onClick={() => removeMetric(goal.title, i)}>✕</button>
            </div>
          ))}
          <button className="pw-btn-sm" onClick={() => addMetric(goal.title)}>+ 添加</button>
        </div>
      ))}
    </div>
  )
}

function Step5Values({ form, setField }) {
  function toggleValue(val) {
    const exists = form.selected_values.find(v => v.id === val.id)
    if (exists) {
      setField('selected_values', form.selected_values.filter(v => v.id !== val.id))
    } else if (form.selected_values.length < 6) {
      setField('selected_values', [...form.selected_values, { ...val }])
    }
  }

  function updateLoss(valId, newLoss) {
    setField('selected_values', form.selected_values.map(v => v.id === valId ? { ...v, loss: newLoss } : v))
  }

  return (
    <div className="pw-step-content">
      <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:12}}>最多选择6个（已选 {form.selected_values.length}/6）</div>
      <div className="pw-values-grid">
        {VALUE_LIBRARY.map(val => {
          const selected = form.selected_values.some(v => v.id === val.id)
          return (
            <div key={val.id} className={`pw-value-card ${selected ? 'selected' : ''}`} onClick={() => toggleValue(val)}>
              <div className="pw-value-icon">{val.icon}</div>
              <div className="pw-value-title">{val.title}</div>
              <div className="pw-value-desc">{val.desc}</div>
            </div>
          )
        })}
      </div>
      {form.selected_values.length > 0 && (
        <div style={{marginTop:20}}>
          <div style={{fontSize:12,fontWeight:600,color:'var(--text-muted)',marginBottom:8}}>编辑损失描述</div>
          {form.selected_values.map(v => (
            <div key={v.id} className="pw-field" style={{marginBottom:8}}>
              <label>{v.icon} {v.title}</label>
              <textarea rows={2} value={v.loss} onChange={e => updateLoss(v.id, e.target.value)} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Step6Timeline({ form, setField, set, route }) {
  const [aiField, setAiField] = useState(null)

  function updateNode(idx, field, value) {
    const tl = form.timeline.map((n, i) => i === idx ? { ...n, [field]: value } : n)
    setField('timeline', tl)
  }

  function addNode() {
    setField('timeline', [...form.timeline, { phase: '', title: '', desc: '', type: 'normal' }])
  }

  function removeNode(idx) {
    setField('timeline', form.timeline.filter((_, i) => i !== idx))
  }

  async function aiWriteRisk() {
    setAiField('risk_note')
    try {
      const text = await aiAssist('risk_note', { background: form.background_summary, visa_route_zh: route.zh })
      setField('risk_note', text)
    } catch (e) { console.error(e) }
    setAiField(null)
  }

  return (
    <div className="pw-step-content">
      {form.timeline.map((node, idx) => (
        <div key={idx} className="pw-timeline-node">
          <div className="pw-row">
            <input value={node.phase} onChange={e => updateNode(idx, 'phase', e.target.value)} placeholder="阶段" style={{maxWidth:120}} />
            <input value={node.title} onChange={e => updateNode(idx, 'title', e.target.value)} placeholder="节点标题" style={{flex:1}} />
            <select value={node.type} onChange={e => updateNode(idx, 'type', e.target.value)} style={{maxWidth:100}}><option value="normal">普通</option><option value="highlight">强调</option></select>
            <button className="pw-btn-sm" onClick={() => removeNode(idx)}>✕</button>
          </div>
          <textarea rows={2} value={node.desc} onChange={e => updateNode(idx, 'desc', e.target.value)} placeholder="节点描述" />
        </div>
      ))}
      <button className="pw-btn pw-btn-secondary" onClick={addNode} style={{marginTop:8}}>+ 添加节点</button>
      <div className="pw-field" style={{marginTop:20}}>
        <label>风险提示 <button type="button" className="pw-ai-btn" onClick={aiWriteRisk} disabled={!!aiField}>{aiField === 'risk_note' ? '生成中...' : '🧠 AI撰写'}</button></label>
        <textarea rows={3} value={form.risk_note || ''} onChange={set('risk_note')} placeholder="如果不行动可能面临的后果..." />
      </div>
    </div>
  )
}

function Step7Preview({ form, route, resultLink, qrDataUrl, onGenerate }) {
  const [copied, setCopied] = useState(false)

  return (
    <div className="pw-step-content">
      <div className="pw-preview-section"><strong>客户：</strong>{form.client_name}{form.client_title} · {form.client_email || '无邮箱'}</div>
      <div className="pw-preview-section"><strong>签证路线：</strong>{route.zh} · {route.en}</div>
      <div className="pw-preview-section"><strong>推荐方案：</strong>{form.selected_tier}</div>
      <div className="pw-preview-section"><strong>封面标签：</strong>{form.cover_tags.filter(Boolean).join(' | ') || '未设置'}</div>
      <div className="pw-preview-section"><strong>已具备条件：</strong>{form.client_advantages.length} 项</div>
      <div className="pw-preview-section"><strong>目标：</strong>{form.selected_goals.length} 个</div>
      <div className="pw-preview-section"><strong>价值主张：</strong>{form.selected_values.length} 个</div>
      <div className="pw-preview-section"><strong>时间节点：</strong>{form.timeline.length} 个</div>

      {!resultLink ? (
        <button className="pw-btn pw-btn-primary" onClick={onGenerate} style={{marginTop:20}}>生成建议书链接</button>
      ) : (
        <div className="pw-result">
          <div className="pw-field"><label>访问链接</label>
            <div className="pw-row"><input value={resultLink} readOnly style={{flex:1,background:'var(--bg-muted)'}} />
              <button className="pw-btn pw-btn-secondary" onClick={() => { navigator.clipboard?.writeText(resultLink); setCopied(true); setTimeout(() => setCopied(false), 1500) }}>{copied ? '✓ 已复制' : '复制'}</button>
              <button className="pw-btn pw-btn-secondary" onClick={() => window.open(resultLink, '_blank')}>预览</button>
            </div>
          </div>
          {qrDataUrl && <div style={{marginTop:16,textAlign:'center'}}><img src={qrDataUrl} alt="QR Code" style={{width:160,height:160,border:'1px solid var(--border-subtle)',borderRadius:8}} /></div>}
        </div>
      )}
    </div>
  )
}
