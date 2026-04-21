import { useEffect, useState } from 'react'
import Sidebar from '../../components/layout/Sidebar'
import { supabase } from '../../lib/supabase'
import { SERVICE_TYPE_LABELS, SERVICE_TYPE_ORDER } from '../../lib/proposalDefaults'
import './AdminPages.css'

const FREQUENCY_OPTIONS = ['一次性', '按年计', '按案收费', '首年含注册', '按课时']

function fmtPriceCell(item) {
  if (item.price_fixed_pence != null) {
    return `£${Math.round(item.price_fixed_pence / 100).toLocaleString()}`
  }
  if (item.price_from_pence != null && item.price_to_pence != null) {
    return `£${Math.round(item.price_from_pence / 100).toLocaleString()}–£${Math.round(item.price_to_pence / 100).toLocaleString()}`
  }
  if (item.price_from_pence != null) return `£${Math.round(item.price_from_pence / 100).toLocaleString()}+`
  return '—'
}

const EMPTY_FEE_DRAFT = {
  id: null,
  service_type: 'ifv_innovator',
  item_order: 0,
  item_name: '',
  item_note: '',
  is_required: true,
  frequency: '一次性',
  price_mode: 'fixed',
  price_fixed: '',
  price_from: '',
  price_to: '',
}

const EMPTY_TIMELINE_DRAFT = {
  id: null,
  service_type: 'ifv_innovator',
  item_order: 0,
  month_label: '',
  task_name: '',
  task_sub: '',
  is_key_milestone: false,
}

export default function ThirdPartyFeesPage() {
  const [topTab, setTopTab] = useState('fees')   // 'fees' | 'timeline'
  const [currentType, setCurrentType] = useState('ifv_innovator')

  return (
    <div className="app-layout">
      <Sidebar badgeCounts={{}} />
      <main className="main ap-page">
        <header className="ap-header">
          <div>
            <h1 className="ap-title">方案书默认值</h1>
            <div className="ap-subtitle">维护第三方费用和时间线默认值，生成方案书时会自动预填</div>
          </div>
        </header>

        <div style={{ padding: '14px 28px 0', display: 'flex', gap: 6, borderBottom: '1px solid var(--border-subtle)' }}>
          <TopTab active={topTab === 'fees'} onClick={() => setTopTab('fees')} label="💷 第三方费用" />
          <TopTab active={topTab === 'timeline'} onClick={() => setTopTab('timeline')} label="📅 时间线默认值" />
        </div>

        <div style={{ padding: '12px 28px 0', display: 'flex', gap: 8, flexWrap: 'wrap', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 14 }}>
          {SERVICE_TYPE_ORDER.map(key => (
            <button
              key={key}
              onClick={() => setCurrentType(key)}
              className={currentType === key ? 'ap-add-btn' : 'ap-ghost-btn'}
              style={{ fontSize: 12 }}
            >
              {SERVICE_TYPE_LABELS[key]}
            </button>
          ))}
        </div>

        {topTab === 'fees'
          ? <FeesTab currentType={currentType} />
          : <TimelineTab currentType={currentType} />}
      </main>
    </div>
  )
}

function TopTab({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 18px',
        border: 'none',
        borderBottom: `3px solid ${active ? 'var(--text-primary)' : 'transparent'}`,
        background: 'none',
        fontSize: 13,
        fontWeight: 600,
        color: active ? 'var(--text-primary)' : 'var(--text-muted)',
        cursor: 'pointer',
        marginBottom: -1,
      }}
    >{label}</button>
  )
}

// ═══════════════════════════════════════════════════════════════
// FEES TAB
// ═══════════════════════════════════════════════════════════════

function FeesTab({ currentType }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('proposal_third_party_defaults')
      .select('*')
      .eq('is_active', true)
      .order('service_type')
      .order('item_order')
    if (error) setErr(error.message)
    else setRows(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const currentRows = rows.filter(r => r.service_type === currentType)

  function startNew() {
    const nextOrder = currentRows.length > 0 ? Math.max(...currentRows.map(r => r.item_order || 0)) + 1 : 1
    setEditing({ ...EMPTY_FEE_DRAFT, service_type: currentType, item_order: nextOrder })
  }

  function startEdit(row) {
    setEditing({
      id: row.id,
      service_type: row.service_type,
      item_order: row.item_order,
      item_name: row.item_name || '',
      item_note: row.item_note || '',
      is_required: !!row.is_required,
      frequency: row.frequency || '一次性',
      price_mode: row.price_fixed_pence != null ? 'fixed' : 'range',
      price_fixed: row.price_fixed_pence != null ? String(Math.round(row.price_fixed_pence / 100)) : '',
      price_from: row.price_from_pence != null ? String(Math.round(row.price_from_pence / 100)) : '',
      price_to: row.price_to_pence != null ? String(Math.round(row.price_to_pence / 100)) : '',
    })
  }

  async function saveEditing() {
    if (!editing.item_name.trim()) { alert('费用名称必填'); return }
    setSaving(true)

    const toPence = v => {
      const n = Number(v)
      return Number.isFinite(n) && v !== '' ? Math.round(n * 100) : null
    }

    const payload = {
      service_type: editing.service_type,
      item_order: Number(editing.item_order) || 0,
      item_name: editing.item_name.trim(),
      item_note: editing.item_note.trim() || null,
      is_required: editing.is_required,
      frequency: editing.frequency,
      price_fixed_pence: editing.price_mode === 'fixed' ? toPence(editing.price_fixed) : null,
      price_from_pence:  editing.price_mode === 'range' ? toPence(editing.price_from) : null,
      price_to_pence:    editing.price_mode === 'range' ? toPence(editing.price_to)   : null,
      is_active: true,
      updated_at: new Date().toISOString(),
    }

    let error
    if (editing.id) {
      ({ error } = await supabase
        .from('proposal_third_party_defaults').update(payload).eq('id', editing.id))
    } else {
      ({ error } = await supabase
        .from('proposal_third_party_defaults').insert(payload))
    }

    setSaving(false)
    if (error) { alert(`保存失败：${error.message}`); return }
    setEditing(null)
    await load()
  }

  async function softDelete(row) {
    if (!confirm(`确认删除「${row.item_name}」？`)) return
    const { error } = await supabase
      .from('proposal_third_party_defaults')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', row.id)
    if (error) { alert(error.message); return }
    await load()
  }

  async function moveOrder(row, delta) {
    const newOrder = (row.item_order || 0) + delta
    const { error } = await supabase
      .from('proposal_third_party_defaults')
      .update({ item_order: newOrder, updated_at: new Date().toISOString() })
      .eq('id', row.id)
    if (error) { alert(error.message); return }
    await load()
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 28px 0' }}>
        <button className="ap-add-btn" onClick={startNew}>+ 新增费用项</button>
      </div>

      <div className="ap-body">
        {err && <div style={{ color: 'var(--danger-text)', marginBottom: 12 }}>{err}</div>}
        {loading ? (
          <div className="ap-empty">加载中…</div>
        ) : currentRows.length === 0 ? (
          <div className="ap-empty">该签证类型尚未配置第三方费用。点右上角「新增费用项」添加。</div>
        ) : (
          <table className="ap-table">
            <thead>
              <tr>
                <th style={{ width: 100 }}>#</th>
                <th>费用项目</th>
                <th>频率</th>
                <th>类型</th>
                <th>参考价格</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {currentRows.map(r => (
                <tr key={r.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button className="ap-sm-btn" onClick={() => moveOrder(r, -1)} style={{ padding: '2px 6px' }}>▲</button>
                      <button className="ap-sm-btn" onClick={() => moveOrder(r, 1)} style={{ padding: '2px 6px' }}>▼</button>
                      <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>{r.item_order}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.item_name}</div>
                    {r.item_note && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{r.item_note}</div>}
                  </td>
                  <td>{r.frequency}</td>
                  <td>
                    <span className={`ap-status ${r.is_required ? 'complete' : 'incomplete'}`}>
                      {r.is_required ? '● 必须' : '○ 按需'}
                    </span>
                  </td>
                  <td>{fmtPriceCell(r)}</td>
                  <td className="ap-actions">
                    <button onClick={() => startEdit(r)}>编辑</button>
                    <button onClick={() => softDelete(r)} style={{ color: 'var(--danger-text)' }}>删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <FeeEditModal
          editing={editing}
          setEditing={setEditing}
          saving={saving}
          onSave={saveEditing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}

function FeeEditModal({ editing, setEditing, saving, onSave, onClose }) {
  return (
    <div className="overlay open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span style={{ fontSize: 18 }}>💷</span>
          <span className="modal-title">{editing.id ? '编辑费用项' : '新增费用项'}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: 20 }}>
          <div className="ap-field">
            <label>费用名称 *</label>
            <input value={editing.item_name} onChange={(e) => setEditing({ ...editing, item_name: e.target.value })} />
          </div>
          <div className="ap-field">
            <label>说明（方案书显示）</label>
            <input value={editing.item_note} onChange={(e) => setEditing({ ...editing, item_note: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="ap-field">
              <label>签证类型</label>
              <select value={editing.service_type} onChange={(e) => setEditing({ ...editing, service_type: e.target.value })}>
                {SERVICE_TYPE_ORDER.map(k => <option key={k} value={k}>{SERVICE_TYPE_LABELS[k]}</option>)}
              </select>
            </div>
            <div className="ap-field">
              <label>频率</label>
              <select value={editing.frequency} onChange={(e) => setEditing({ ...editing, frequency: e.target.value })}>
                {FREQUENCY_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>

          <div className="ap-field">
            <label>类型</label>
            <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="radio" checked={editing.is_required} onChange={() => setEditing({ ...editing, is_required: true })} />必须
              </label>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="radio" checked={!editing.is_required} onChange={() => setEditing({ ...editing, is_required: false })} />按需
              </label>
            </div>
          </div>

          <div className="ap-field">
            <label>价格类型</label>
            <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="radio" checked={editing.price_mode === 'fixed'} onChange={() => setEditing({ ...editing, price_mode: 'fixed' })} />固定价
              </label>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="radio" checked={editing.price_mode === 'range'} onChange={() => setEditing({ ...editing, price_mode: 'range' })} />区间价
              </label>
            </div>
          </div>

          {editing.price_mode === 'fixed' ? (
            <div className="ap-field">
              <label>固定价 £</label>
              <input type="number" min="0" value={editing.price_fixed} onChange={(e) => setEditing({ ...editing, price_fixed: e.target.value })} />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="ap-field">
                <label>区间起 £</label>
                <input type="number" min="0" value={editing.price_from} onChange={(e) => setEditing({ ...editing, price_from: e.target.value })} />
              </div>
              <div className="ap-field">
                <label>区间止 £</label>
                <input type="number" min="0" value={editing.price_to} onChange={(e) => setEditing({ ...editing, price_to: e.target.value })} />
              </div>
            </div>
          )}

          <div className="ap-field">
            <label>排序</label>
            <input type="number" value={editing.item_order} onChange={(e) => setEditing({ ...editing, item_order: e.target.value })} />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>取消</button>
          <button className="btn btn-primary" onClick={onSave} disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// TIMELINE TAB
// ═══════════════════════════════════════════════════════════════

function TimelineTab({ currentType }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('proposal_timeline_defaults')
      .select('*')
      .eq('is_active', true)
      .order('service_type')
      .order('item_order')
    if (error) setErr(error.message)
    else setRows(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const currentRows = rows.filter(r => r.service_type === currentType)

  function startNew() {
    const nextOrder = currentRows.length > 0 ? Math.max(...currentRows.map(r => r.item_order || 0)) + 1 : 1
    setEditing({ ...EMPTY_TIMELINE_DRAFT, service_type: currentType, item_order: nextOrder })
  }

  function startEdit(row) {
    setEditing({
      id: row.id,
      service_type: row.service_type,
      item_order: row.item_order,
      month_label: row.month_label || '',
      task_name: row.task_name || '',
      task_sub: row.task_sub || '',
      is_key_milestone: !!row.is_key_milestone,
    })
  }

  async function saveEditing() {
    if (!editing.task_name.trim()) { alert('任务名称必填'); return }
    if (!editing.month_label.trim()) { alert('月份标签必填'); return }
    setSaving(true)

    const payload = {
      service_type: editing.service_type,
      item_order: Number(editing.item_order) || 0,
      month_label: editing.month_label.trim(),
      task_name: editing.task_name.trim(),
      task_sub: editing.task_sub.trim() || null,
      is_key_milestone: editing.is_key_milestone,
      is_active: true,
      updated_at: new Date().toISOString(),
    }

    let error
    if (editing.id) {
      ({ error } = await supabase
        .from('proposal_timeline_defaults').update(payload).eq('id', editing.id))
    } else {
      ({ error } = await supabase
        .from('proposal_timeline_defaults').insert(payload))
    }

    setSaving(false)
    if (error) { alert(`保存失败：${error.message}`); return }
    setEditing(null)
    await load()
  }

  async function softDelete(row) {
    if (!confirm(`确认删除「${row.task_name}」？`)) return
    const { error } = await supabase
      .from('proposal_timeline_defaults')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', row.id)
    if (error) { alert(error.message); return }
    await load()
  }

  async function moveOrder(row, delta) {
    const newOrder = (row.item_order || 0) + delta
    const { error } = await supabase
      .from('proposal_timeline_defaults')
      .update({ item_order: newOrder, updated_at: new Date().toISOString() })
      .eq('id', row.id)
    if (error) { alert(error.message); return }
    await load()
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 28px 0' }}>
        <button className="ap-add-btn" onClick={startNew}>+ 新增时间线节点</button>
      </div>

      <div className="ap-body">
        {err && <div style={{ color: 'var(--danger-text)', marginBottom: 12 }}>{err}</div>}
        {loading ? (
          <div className="ap-empty">加载中…</div>
        ) : currentRows.length === 0 ? (
          <div className="ap-empty">该签证类型尚未配置时间线默认值。点右上角「新增时间线节点」添加。</div>
        ) : (
          <table className="ap-table">
            <thead>
              <tr>
                <th style={{ width: 100 }}>#</th>
                <th>月份标签</th>
                <th>任务 / 副标题</th>
                <th>关键节点</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {currentRows.map(r => (
                <tr key={r.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button className="ap-sm-btn" onClick={() => moveOrder(r, -1)} style={{ padding: '2px 6px' }}>▲</button>
                      <button className="ap-sm-btn" onClick={() => moveOrder(r, 1)} style={{ padding: '2px 6px' }}>▼</button>
                      <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>{r.item_order}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{r.month_label}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.task_name}</div>
                    {r.task_sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{r.task_sub}</div>}
                  </td>
                  <td>
                    <span className={`ap-status ${r.is_key_milestone ? 'complete' : 'incomplete'}`}>
                      {r.is_key_milestone ? '● 关键' : '○ 普通'}
                    </span>
                  </td>
                  <td className="ap-actions">
                    <button onClick={() => startEdit(r)}>编辑</button>
                    <button onClick={() => softDelete(r)} style={{ color: 'var(--danger-text)' }}>删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <TimelineEditModal
          editing={editing}
          setEditing={setEditing}
          saving={saving}
          onSave={saveEditing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}

function TimelineEditModal({ editing, setEditing, saving, onSave, onClose }) {
  return (
    <div className="overlay open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span style={{ fontSize: 18 }}>📅</span>
          <span className="modal-title">{editing.id ? '编辑时间线节点' : '新增时间线节点'}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="ap-field">
              <label>签证类型</label>
              <select value={editing.service_type} onChange={(e) => setEditing({ ...editing, service_type: e.target.value })}>
                {SERVICE_TYPE_ORDER.map(k => <option key={k} value={k}>{SERVICE_TYPE_LABELS[k]}</option>)}
              </select>
            </div>
            <div className="ap-field">
              <label>月份标签 *</label>
              <input value={editing.month_label} onChange={(e) => setEditing({ ...editing, month_label: e.target.value })} placeholder="例：第 1 个月" />
            </div>
          </div>
          <div className="ap-field">
            <label>任务名称 *</label>
            <input value={editing.task_name} onChange={(e) => setEditing({ ...editing, task_name: e.target.value })} placeholder="例：商业叙事构建" />
          </div>
          <div className="ap-field">
            <label>副标题说明</label>
            <textarea
              rows={3}
              value={editing.task_sub}
              onChange={(e) => setEditing({ ...editing, task_sub: e.target.value })}
              placeholder="例：Readii 视频通话 × 2，输出叙事框架文档"
            />
          </div>
          <div className="ap-field">
            <label>
              <input
                type="checkbox"
                checked={editing.is_key_milestone}
                onChange={(e) => setEditing({ ...editing, is_key_milestone: e.target.checked })}
                style={{ marginRight: 6 }}
              />
              标记为关键节点
            </label>
          </div>
          <div className="ap-field">
            <label>排序</label>
            <input type="number" value={editing.item_order} onChange={(e) => setEditing({ ...editing, item_order: e.target.value })} />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>取消</button>
          <button className="btn btn-primary" onClick={onSave} disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
