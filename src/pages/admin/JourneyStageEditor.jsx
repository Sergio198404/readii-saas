import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Sidebar from '../../components/layout/Sidebar'
import { supabase } from '../../lib/supabase'
import { updateJourneyStage } from '../../lib/api/admin'
import './AdminPages.css'

export default function JourneyStageEditor() {
  const { templateId, stageId } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [newDeliverable, setNewDeliverable] = useState('')

  useEffect(() => {
    supabase.from('journey_stages').select('*').eq('id', stageId).single()
      .then(({ data }) => { if (data) setForm(data) })
  }, [stageId])

  function set(field) {
    return (e) => { setForm(prev => ({ ...prev, [field]: e.target.value })); setSaved(false) }
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
    await updateJourneyStage(stageId, {
      stage_number: Number(form.stage_number),
      title: form.title,
      title_en: form.title_en || null,
      description_why: form.description_why || '',
      description_customer_action: form.description_customer_action || '',
      description_readii_action: form.description_readii_action || '',
      estimated_duration_days: form.estimated_duration_days ? Number(form.estimated_duration_days) : null,
      deliverables: form.deliverables || [],
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!form) return <div className="app-layout"><Sidebar badgeCounts={{}} /><main className="main ap-page"><div className="ap-empty">加载中...</div></main></div>

  return (
    <div className="app-layout">
      <Sidebar badgeCounts={{}} />
      <main className="main ap-page">
        <header className="ap-header">
          <div>
            <button className="ap-back" onClick={() => navigate(`/admin/journey-templates/${templateId}/stages`)}>← 返回阶段列表</button>
            <h1 className="ap-title">编辑阶段：{form.title}</h1>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            {saved && <span style={{fontSize:12,color:'#1e7a3c'}}>已保存</span>}
            <button className="ap-add-btn" onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '保存'}</button>
          </div>
        </header>

        <div className="ap-body" style={{maxWidth:720}}>
          <div className="ap-form-row">
            <div className="ap-field" style={{maxWidth:80}}><label>阶段号</label><input type="number" value={form.stage_number} onChange={set('stage_number')} /></div>
            <div className="ap-field" style={{flex:1}}><label>中文标题</label><input value={form.title} onChange={set('title')} /></div>
            <div className="ap-field" style={{flex:1}}><label>英文标题（可选）</label><input value={form.title_en || ''} onChange={set('title_en')} /></div>
            <div className="ap-field" style={{maxWidth:100}}><label>预计天数</label><input type="number" value={form.estimated_duration_days || ''} onChange={set('estimated_duration_days')} /></div>
          </div>

          <div className="ap-field">
            <label>💡 为什么重要</label>
            <textarea rows={4} value={form.description_why || ''} onChange={set('description_why')} placeholder="2-3 句话说明这一步的意义..." />
          </div>

          <div className="ap-field">
            <label>✅ 你需要做什么（客户行动）</label>
            <textarea rows={4} value={form.description_customer_action || ''} onChange={set('description_customer_action')} placeholder="3-5 个具体动作..." />
          </div>

          <div className="ap-field">
            <label>🔧 Readii 在做什么</label>
            <textarea rows={4} value={form.description_readii_action || ''} onChange={set('description_readii_action')} placeholder="Readii 团队在这一步会做的事..." />
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
        </div>
      </main>
    </div>
  )
}
