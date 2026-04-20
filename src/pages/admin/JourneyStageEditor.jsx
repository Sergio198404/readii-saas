import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Sidebar from '../../components/layout/Sidebar'
import { supabase } from '../../lib/supabase'
import {
  updateJourneyStage,
  listStageVariants, createStageVariant, updateStageVariant, deleteStageVariant,
} from '../../lib/api/admin'
import './AdminPages.css'

const APPLIES_TO_OPTIONS = [
  { value: 'always', label: '所有客户' },
  { value: 'path_a', label: '仅路径 A（境内）' },
  { value: 'path_b', label: '仅路径 B（境外）' },
  { value: 'conditional', label: '条件阶段' },
]

const TABS = [
  { id: 'basic', label: '基本信息' },
  { id: 'content', label: '三段式内容' },
  { id: 'sku', label: 'SKU 设置' },
  { id: 'variants', label: '变体管理' },
]

export default function JourneyStageEditor() {
  const { templateId, stageId } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [newDeliverable, setNewDeliverable] = useState('')
  const [tab, setTab] = useState('basic')
  const [variants, setVariants] = useState([])

  const loadVariants = useCallback(() => {
    listStageVariants(stageId).then(setVariants)
  }, [stageId])

  useEffect(() => {
    supabase.from('journey_stages').select('*').eq('id', stageId).single()
      .then(({ data }) => { if (data) setForm(data) })
    loadVariants()
  }, [stageId, loadVariants])

  function set(field) {
    return (e) => {
      const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
      setForm(prev => ({ ...prev, [field]: val }))
      setSaved(false)
    }
  }

  function addDeliverable() {
    if (!newDeliverable.trim()) return
    setForm(prev => ({ ...prev, deliverables: [...(prev.deliverables || []), newDeliverable.trim()] }))
    setNewDeliverable('')
    setSaved(false)
  }

  function removeDeliverable(idx) {
    setForm(prev => ({ ...prev, deliverables: (prev.deliverables || []).filter((_, i) => i !== idx) }))
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    try {
      await updateJourneyStage(stageId, {
        stage_number: Number(form.stage_number),
        stage_code: form.stage_code || null,
        applies_to: form.applies_to || 'always',
        title: form.title,
        title_en: form.title_en || null,
        description_why: form.description_why || '',
        description_customer_action: form.description_customer_action || '',
        description_readii_action: form.description_readii_action || '',
        estimated_duration_days: form.estimated_duration_days ? Number(form.estimated_duration_days) : null,
        deliverables: form.deliverables || [],
        has_sku: !!form.has_sku,
        sku_self_serve_label: form.sku_self_serve_label || null,
        sku_delegate_label: form.sku_delegate_label || null,
        sku_price_pence: form.sku_price_pence ? Number(form.sku_price_pence) : null,
        sku_member_price_pence: form.sku_member_price_pence ? Number(form.sku_member_price_pence) : null,
        sku_self_serve_content: form.sku_self_serve_content || null,
        has_sub_module: !!form.has_sub_module,
        sub_module_type: form.sub_module_type || null,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  if (!form) return <div className="app-layout"><Sidebar badgeCounts={{}} /><main className="main ap-page"><div className="ap-empty">加载中...</div></main></div>

  return (
    <div className="app-layout">
      <Sidebar badgeCounts={{}} />
      <main className="main ap-page">
        <header className="ap-header">
          <div>
            <button className="ap-back" onClick={() => navigate(`/admin/journey-templates/${templateId}/stages`)}>← 返回阶段列表</button>
            <h1 className="ap-title">阶段 {form.stage_number}：{form.title}</h1>
            <div className="ap-subtitle">{form.stage_code || '（未设 stage_code）'} · {APPLIES_TO_OPTIONS.find(o => o.value === form.applies_to)?.label || 'always'}</div>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            {saved && <span style={{fontSize:12,color:'#1e7a3c'}}>已保存</span>}
            <button className="ap-add-btn" onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '保存'}</button>
          </div>
        </header>

        <div style={{display:'flex',gap:4,padding:'10px 28px',borderBottom:'1px solid var(--border-subtle)'}}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={tab === t.id ? 'ap-add-btn' : 'ap-ghost-btn'}
              style={{padding: '6px 14px', fontSize: 12}}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="ap-body" style={{maxWidth:720}}>
          {tab === 'basic' && (
            <>
              <div className="ap-form-row">
                <div className="ap-field" style={{maxWidth:100}}>
                  <label>阶段号</label>
                  <input type="number" value={form.stage_number} onChange={set('stage_number')} />
                </div>
                <div className="ap-field" style={{maxWidth:160}}>
                  <label>stage_code</label>
                  <input value={form.stage_code || ''} onChange={set('stage_code')} placeholder="stage_01" />
                </div>
                <div className="ap-field" style={{maxWidth:200}}>
                  <label>适用</label>
                  <select value={form.applies_to || 'always'} onChange={set('applies_to')}>
                    {APPLIES_TO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="ap-field" style={{maxWidth:100}}>
                  <label>预计天数</label>
                  <input type="number" value={form.estimated_duration_days || ''} onChange={set('estimated_duration_days')} />
                </div>
              </div>

              <div className="ap-form-row">
                <div className="ap-field" style={{flex:1}}>
                  <label>中文标题</label>
                  <input value={form.title} onChange={set('title')} />
                </div>
                <div className="ap-field" style={{flex:1}}>
                  <label>英文标题（可选）</label>
                  <input value={form.title_en || ''} onChange={set('title_en')} />
                </div>
              </div>

              <div className="ap-field">
                <label>📦 交付物清单</label>
                {(form.deliverables || []).map((d, i) => (
                  <div key={i} className="ap-form-row" style={{marginBottom:4}}>
                    <input value={d} readOnly style={{flex:1,background:'var(--bg-muted)'}} />
                    <button className="ap-sm-btn" onClick={() => removeDeliverable(i)}>×</button>
                  </div>
                ))}
                <div className="ap-form-row">
                  <input value={newDeliverable} onChange={e => setNewDeliverable(e.target.value)} placeholder="添加交付物..." onKeyDown={e => e.key === 'Enter' && addDeliverable()} style={{flex:1}} />
                  <button className="ap-sm-btn" onClick={addDeliverable}>添加</button>
                </div>
              </div>

              <div className="ap-field">
                <label style={{display:'flex',alignItems:'center',gap:8}}>
                  <input type="checkbox" checked={!!form.has_sub_module} onChange={set('has_sub_module')} />
                  <span>包含子模块</span>
                </label>
                {form.has_sub_module && (
                  <input value={form.sub_module_type || ''} onChange={set('sub_module_type')} placeholder="子模块类型，如 hr_compliance" />
                )}
              </div>
            </>
          )}

          {tab === 'content' && (
            <>
              <div className="ap-field">
                <label>💡 为什么重要</label>
                <textarea rows={6} value={form.description_why || ''} onChange={set('description_why')} placeholder="2-3 句话说明这一步的意义..." />
              </div>
              <div className="ap-field">
                <label>✅ 你需要做什么（客户行动）</label>
                <textarea rows={8} value={form.description_customer_action || ''} onChange={set('description_customer_action')} placeholder="3-5 个具体动作..." />
              </div>
              <div className="ap-field">
                <label>🔧 Readii 在做什么</label>
                <textarea rows={8} value={form.description_readii_action || ''} onChange={set('description_readii_action')} placeholder="Readii 团队在这一步会做的事..." />
              </div>
            </>
          )}

          {tab === 'sku' && (
            <>
              <div className="ap-field">
                <label style={{display:'flex',alignItems:'center',gap:8}}>
                  <input type="checkbox" checked={!!form.has_sku} onChange={set('has_sku')} />
                  <span>此阶段提供 SKU（自助 / 委托选项）</span>
                </label>
              </div>
              {form.has_sku && (
                <>
                  <div className="ap-form-row">
                    <div className="ap-field" style={{flex:1}}>
                      <label>自助版按钮文案</label>
                      <input value={form.sku_self_serve_label || ''} onChange={set('sku_self_serve_label')} placeholder="自助免费（Readii 提供指引）" />
                    </div>
                    <div className="ap-field" style={{flex:1}}>
                      <label>委托版按钮文案</label>
                      <input value={form.sku_delegate_label || ''} onChange={set('sku_delegate_label')} placeholder="委托 Readii（£1,799）" />
                    </div>
                  </div>
                  <div className="ap-form-row">
                    <div className="ap-field" style={{flex:1}}>
                      <label>委托价（便士）</label>
                      <input type="number" value={form.sku_price_pence || ''} onChange={set('sku_price_pence')} placeholder="179900" />
                    </div>
                    <div className="ap-field" style={{flex:1}}>
                      <label>会员价（便士，可选）</label>
                      <input type="number" value={form.sku_member_price_pence || ''} onChange={set('sku_member_price_pence')} />
                    </div>
                  </div>
                  <div className="ap-field">
                    <label>自助版内容说明</label>
                    <textarea rows={6} value={form.sku_self_serve_content || ''} onChange={set('sku_self_serve_content')} placeholder="客户选择自助后展开给他看的操作指引..." />
                  </div>
                </>
              )}
            </>
          )}

          {tab === 'variants' && (
            <VariantManager stageId={stageId} variants={variants} onChanged={loadVariants} />
          )}
        </div>
      </main>
    </div>
  )
}

function VariantManager({ stageId, variants, onChanged }) {
  const [editing, setEditing] = useState(null)
  const [showNew, setShowNew] = useState(false)

  return (
    <>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <div style={{fontSize:13,color:'var(--text-muted)'}}>共 {variants.length} 个变体</div>
        <button className="ap-add-btn" onClick={() => { setShowNew(true); setEditing(null) }}>+ 新增变体</button>
      </div>

      {variants.length === 0 && !showNew && (
        <div className="ap-empty" style={{padding:'24px 0'}}>此阶段暂无变体。有变体的阶段：2 / 4 / 6 / 9 / 23</div>
      )}

      {variants.map(v => (
        editing === v.id ? (
          <VariantForm
            key={v.id}
            stageId={stageId}
            initial={v}
            onCancel={() => setEditing(null)}
            onSaved={() => { setEditing(null); onChanged() }}
          />
        ) : (
          <div key={v.id} className="ap-progress-card" style={{marginBottom:8}}>
            <div style={{flex:1}}>
              <div style={{fontWeight:600,marginBottom:4}}>{v.variant_code} · {v.title}</div>
              <div style={{fontSize:11,color:'var(--text-muted)'}}>
                {v.trigger_field} == {v.trigger_value} · {v.estimated_duration_days || '—'} 天
              </div>
            </div>
            <div style={{display:'flex',gap:6}}>
              <button className="ap-sm-btn" onClick={() => { setEditing(v.id); setShowNew(false) }}>编辑</button>
              <button
                className="ap-sm-btn"
                style={{color:'#c33'}}
                onClick={async () => {
                  if (!confirm(`确认删除变体「${v.variant_code}」？`)) return
                  await deleteStageVariant(v.id)
                  onChanged()
                }}
              >删除</button>
            </div>
          </div>
        )
      ))}

      {showNew && (
        <VariantForm
          stageId={stageId}
          onCancel={() => setShowNew(false)}
          onSaved={() => { setShowNew(false); onChanged() }}
        />
      )}
    </>
  )
}

function VariantForm({ stageId, initial, onCancel, onSaved }) {
  const [row, setRow] = useState(initial || {
    variant_code: '', variant_label: '', trigger_field: '', trigger_value: '',
    title: '', description_why: '', description_customer_action: '', description_readii_action: '',
    estimated_duration_days: null, deliverables: [],
  })
  const [saving, setSaving] = useState(false)
  const [newDeliv, setNewDeliv] = useState('')

  function set(f) {
    return (e) => setRow(prev => ({ ...prev, [f]: e.target.value }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payload = {
        variant_code: row.variant_code,
        variant_label: row.variant_label,
        trigger_field: row.trigger_field,
        trigger_value: row.trigger_value,
        title: row.title,
        description_why: row.description_why || '',
        description_customer_action: row.description_customer_action || '',
        description_readii_action: row.description_readii_action || '',
        estimated_duration_days: row.estimated_duration_days ? Number(row.estimated_duration_days) : null,
        deliverables: row.deliverables || [],
      }
      if (initial?.id) {
        await updateStageVariant(initial.id, payload)
      } else {
        await createStageVariant(stageId, payload)
      }
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{padding:16,border:'1px solid var(--border-subtle)',borderRadius:8,marginBottom:12,background:'var(--bg-muted)'}}>
      <div className="ap-form-row">
        <div className="ap-field" style={{flex:1}}><label>variant_code</label><input value={row.variant_code} onChange={set('variant_code')} placeholder="variant_2a" /></div>
        <div className="ap-field" style={{flex:1}}><label>标签（内部用）</label><input value={row.variant_label} onChange={set('variant_label')} placeholder="英国学历豁免" /></div>
      </div>
      <div className="ap-form-row">
        <div className="ap-field" style={{flex:1}}><label>触发字段</label><input value={row.trigger_field} onChange={set('trigger_field')} placeholder="employee_english_status" /></div>
        <div className="ap-field" style={{flex:1}}><label>触发值</label><input value={row.trigger_value} onChange={set('trigger_value')} placeholder="uk_degree" /></div>
        <div className="ap-field" style={{maxWidth:100}}><label>预计天数</label><input type="number" value={row.estimated_duration_days || ''} onChange={set('estimated_duration_days')} /></div>
      </div>
      <div className="ap-field"><label>展示标题</label><input value={row.title} onChange={set('title')} placeholder="英语要求 · 英国学历豁免 ✓" /></div>
      <div className="ap-field"><label>💡 为什么重要</label><textarea rows={4} value={row.description_why} onChange={set('description_why')} /></div>
      <div className="ap-field"><label>✅ 你需要做什么</label><textarea rows={5} value={row.description_customer_action} onChange={set('description_customer_action')} /></div>
      <div className="ap-field"><label>🔧 Readii 在做什么</label><textarea rows={5} value={row.description_readii_action} onChange={set('description_readii_action')} /></div>
      <div className="ap-field">
        <label>📦 交付物</label>
        {(row.deliverables || []).map((d, i) => (
          <div key={i} className="ap-form-row" style={{marginBottom:4}}>
            <input value={d} readOnly style={{flex:1,background:'var(--bg-card)'}} />
            <button className="ap-sm-btn" onClick={() => setRow(p => ({ ...p, deliverables: (p.deliverables || []).filter((_, j) => j !== i) }))}>×</button>
          </div>
        ))}
        <div className="ap-form-row">
          <input value={newDeliv} onChange={e => setNewDeliv(e.target.value)} placeholder="添加..." style={{flex:1}}
            onKeyDown={e => { if (e.key === 'Enter' && newDeliv.trim()) { setRow(p => ({ ...p, deliverables: [...(p.deliverables || []), newDeliv.trim()] })); setNewDeliv('') } }} />
        </div>
      </div>
      <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
        <button className="ap-ghost-btn" onClick={onCancel}>取消</button>
        <button className="ap-add-btn" onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '保存变体'}</button>
      </div>
    </div>
  )
}
