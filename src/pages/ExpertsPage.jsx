import { useState, useEffect } from 'react'
import Sidebar from '../components/layout/Sidebar'
import { supabase } from '../lib/supabase'
import { useLeads } from '../lib/useLeads'
import './ExpertsPage.css'

const USE_CASE_OPTIONS = ['朋友圈', '口播稿', '文章', '销售策略']

export default function ExpertsPage() {
  const [experts, setExperts] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [currentFilter, setCurrentFilter] = useState('all')
  const { badgeCounts } = useLeads('all', '')

  useEffect(() => { fetchExperts() }, [])

  async function fetchExperts() {
    setLoading(true)
    const { data } = await supabase.from('experts').select('*').order('created_at', { ascending: true })
    setExperts(data || [])
    setLoading(false)
  }

  async function saveField(id, field, value) {
    await supabase.from('experts').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', id)
    setExperts(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e))
    if (selected?.id === id) setSelected(prev => ({ ...prev, [field]: value }))
  }

  async function deleteExpert(id) {
    await supabase.from('experts').delete().eq('id', id)
    setExperts(prev => prev.filter(e => e.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  return (
    <div className="app-layout">
      <Sidebar currentFilter={currentFilter} onFilterChange={setCurrentFilter} badgeCounts={badgeCounts} />

      <main className="main">
        <header className="content-header">
          <div className="content-header-left">
            <h1 className="today-title">专家库</h1>
            <span className="topbar-date">{experts.length} 位专家</span>
          </div>
          <div className="content-header-right">
            <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ 新增专家</button>
          </div>
        </header>

        <div className="experts-layout">
          {/* 左侧列表 */}
          <div className="experts-list">
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>加载中...</div>
            ) : experts.length === 0 ? (
              <div className="today-empty">还没有专家，点击「+ 新增专家」添加</div>
            ) : experts.map(e => (
              <div
                key={e.id}
                className={`expert-card ${selected?.id === e.id ? 'expert-card--active' : ''}`}
                onClick={() => setSelected(e)}
              >
                <div className="expert-card-name">{e.name}</div>
                {e.description && <div className="expert-card-desc">{e.description}</div>}
                <div className="expert-card-tags">
                  {(e.use_cases || []).map(uc => (
                    <span className="badge badge-prod" key={uc}>{uc}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* 右侧详情 */}
          <div className="expert-detail">
            {selected ? (
              <ExpertDetail expert={selected} onSave={saveField} onDelete={deleteExpert} />
            ) : (
              <div className="expert-detail-empty">
                <div style={{ fontSize: 32, marginBottom: 12 }}>👈</div>
                <div>点击左侧专家卡片查看和编辑详情</div>
              </div>
            )}
          </div>
        </div>
      </main>

      {showAdd && (
        <AddExpertModal
          onClose={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); fetchExperts() }}
        />
      )}
    </div>
  )
}

// ============================================================
// 专家详情编辑
// ============================================================
function ExpertDetail({ expert, onSave, onDelete }) {
  const [editingField, setEditingField] = useState(null)
  const [editValue, setEditValue] = useState('')

  function startEdit(field, value) {
    setEditingField(field)
    setEditValue(value || '')
  }

  function saveEdit(field) {
    onSave(expert.id, field, editValue)
    setEditingField(null)
  }

  function toggleUseCase(uc) {
    const current = expert.use_cases || []
    const next = current.includes(uc) ? current.filter(u => u !== uc) : [...current, uc]
    onSave(expert.id, 'use_cases', next)
  }

  return (
    <div className="expert-detail-content">
      <div className="expert-detail-header">
        <h2 className="expert-detail-name">{expert.name}</h2>
        <button className="btn-action" onClick={() => onDelete(expert.id)} style={{ color: 'var(--danger-text)' }}>删除专家</button>
      </div>

      {/* 名称 */}
      <DetailField
        label="名称" value={expert.name}
        editing={editingField === 'name'} editValue={editValue}
        onStartEdit={() => startEdit('name', expert.name)}
        onChange={setEditValue} onSave={() => saveEdit('name')} onCancel={() => setEditingField(null)}
      />

      {/* 简介 */}
      <DetailField
        label="简介" value={expert.description} textarea
        editing={editingField === 'description'} editValue={editValue}
        onStartEdit={() => startEdit('description', expert.description)}
        onChange={setEditValue} onSave={() => saveEdit('description')} onCancel={() => setEditingField(null)}
      />

      {/* 风格指令 */}
      <DetailField
        label="风格指令（style_prompt）" value={expert.style_prompt} textarea
        editing={editingField === 'style_prompt'} editValue={editValue}
        onStartEdit={() => startEdit('style_prompt', expert.style_prompt)}
        onChange={setEditValue} onSave={() => saveEdit('style_prompt')} onCancel={() => setEditingField(null)}
      />

      {/* 适用场景 */}
      <div className="detail-field">
        <div className="detail-field-label">适用场景</div>
        <div className="detail-field-tags">
          {USE_CASE_OPTIONS.map(uc => (
            <span
              key={uc}
              className={`badge detail-tag ${(expert.use_cases || []).includes(uc) ? 'badge-prod' : 'badge-stage'}`}
              onClick={() => toggleUseCase(uc)}
              style={{ cursor: 'pointer' }}
            >
              {(expert.use_cases || []).includes(uc) ? '✓ ' : ''}{uc}
            </span>
          ))}
        </div>
      </div>

      {/* 样本输入 */}
      <DetailField
        label="样本原文（用于提取风格的参考文章）" value={expert.sample_input} textarea
        editing={editingField === 'sample_input'} editValue={editValue}
        onStartEdit={() => startEdit('sample_input', expert.sample_input)}
        onChange={setEditValue} onSave={() => saveEdit('sample_input')} onCancel={() => setEditingField(null)}
      />
    </div>
  )
}

function DetailField({ label, value, editing, editValue, onStartEdit, onChange, onSave, onCancel, textarea }) {
  return (
    <div className="detail-field">
      <div className="detail-field-label">{label}</div>
      {editing ? (
        <div className="detail-field-edit">
          {textarea ? (
            <textarea className="form-textarea" value={editValue} onChange={e => onChange(e.target.value)} rows={4} />
          ) : (
            <input className="form-input" value={editValue} onChange={e => onChange(e.target.value)} />
          )}
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button className="btn btn-primary" onClick={onSave} style={{ fontSize: 12, padding: '4px 12px' }}>保存</button>
            <button className="btn btn-ghost" onClick={onCancel} style={{ fontSize: 12, padding: '4px 12px' }}>取消</button>
          </div>
        </div>
      ) : (
        <div className="detail-field-value" onClick={onStartEdit}>
          {value || <span style={{ color: 'var(--text-muted)' }}>点击编辑...</span>}
        </div>
      )}
    </div>
  )
}

// ============================================================
// 新增专家 Modal
// ============================================================
function AddExpertModal({ onClose, onAdded }) {
  const [mode, setMode] = useState('manual') // manual | extract
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [stylePrompt, setStylePrompt] = useState('')
  const [useCases, setUseCases] = useState([])
  const [sampleInput, setSampleInput] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function toggleUC(uc) {
    setUseCases(prev => prev.includes(uc) ? prev.filter(u => u !== uc) : [...prev, uc])
  }

  async function handleExtract() {
    if (!sampleInput.trim()) return
    setExtracting(true)
    setError(null)
    try {
      const res = await fetch('/.netlify/functions/extract-style', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: sampleInput }),
      })
      const data = await res.json()
      if (data.style_prompt) {
        setStylePrompt(data.style_prompt)
      } else {
        setError(data.error || '提取失败')
      }
    } catch (err) { setError(err.message) }
    finally { setExtracting(false) }
  }

  async function handleSave() {
    if (!name.trim() || !stylePrompt.trim()) {
      setError('名称和风格指令不能为空')
      return
    }
    setSaving(true)
    const { error: err } = await supabase.from('experts').insert({
      name: name.trim(),
      description: description.trim() || null,
      style_prompt: stylePrompt.trim(),
      use_cases: useCases,
      sample_input: sampleInput.trim() || null,
    })
    setSaving(false)
    if (err) { setError(err.message) } else { onAdded() }
  }

  return (
    <div className="overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <span style={{ fontSize: 18 }}>🧠</span>
          <span className="modal-title">新增专家</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* 模式切换 */}
        <div style={{ display: 'flex', gap: 4, padding: '16px 22px 0' }}>
          <button className={`content-tab ${mode === 'manual' ? 'active' : ''}`} onClick={() => setMode('manual')}>手动填写</button>
          <button className={`content-tab ${mode === 'extract' ? 'active' : ''}`} onClick={() => setMode('extract')}>粘贴原文提取</button>
        </div>

        <div style={{ padding: '16px 22px' }}>
          {/* 基础信息 */}
          <div className="form-grid" style={{ padding: 0, gap: 10, marginBottom: 14 }}>
            <div className="form-row">
              <label className="form-label">专家名称</label>
              <input className="form-input" placeholder="例：Dan Koe" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="form-row">
              <label className="form-label">简介</label>
              <input className="form-input" placeholder="一句话描述" value={description} onChange={e => setDescription(e.target.value)} />
            </div>
          </div>

          {/* 适用场景 */}
          <div style={{ marginBottom: 14 }}>
            <label className="form-label" style={{ marginBottom: 6, display: 'block' }}>适用场景</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {USE_CASE_OPTIONS.map(uc => (
                <span
                  key={uc}
                  className={`badge detail-tag ${useCases.includes(uc) ? 'badge-prod' : 'badge-stage'}`}
                  onClick={() => toggleUC(uc)}
                  style={{ cursor: 'pointer' }}
                >
                  {useCases.includes(uc) ? '✓ ' : ''}{uc}
                </span>
              ))}
            </div>
          </div>

          {mode === 'extract' && (
            <>
              <div className="form-row" style={{ marginBottom: 10 }}>
                <label className="form-label">粘贴 3-5 篇文章或视频文案</label>
                <textarea
                  className="form-textarea"
                  placeholder="粘贴该博主/专家的文章原文，AI 将自动分析写作风格..."
                  value={sampleInput}
                  onChange={e => setSampleInput(e.target.value)}
                  rows={6}
                />
              </div>
              <button className="btn btn-coach" onClick={handleExtract} disabled={extracting || !sampleInput.trim()} style={{ marginBottom: 14 }}>
                {extracting ? '🧠 分析中...' : '🧠 AI 提取风格'}
              </button>
            </>
          )}

          {/* 风格指令 */}
          <div className="form-row">
            <label className="form-label">风格指令（style_prompt）{mode === 'extract' && stylePrompt && ' ✓ 已提取'}</label>
            <textarea
              className="form-textarea"
              placeholder={mode === 'extract' ? 'AI 提取后自动填入，也可手动修改' : '描述该专家的写作风格，将注入到 AI 生成内容的 prompt 中'}
              value={stylePrompt}
              onChange={e => setStylePrompt(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        {error && (
          <div style={{ color: 'var(--danger-text)', fontSize: 12, padding: '0 22px 8px' }}>{error}</div>
        )}

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>取消</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '保存专家'}
          </button>
        </div>
      </div>
    </div>
  )
}
