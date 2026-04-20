import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Sidebar from '../../components/layout/Sidebar'
import { getJourneyTemplateWithStages, createJourneyStage, deleteJourneyStage } from '../../lib/api/admin'
import './AdminPages.css'

export default function JourneyStagesList() {
  const { templateId } = useParams()
  const navigate = useNavigate()
  const [template, setTemplate] = useState(null)
  const [stages, setStages] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const data = await getJourneyTemplateWithStages(templateId)
    setTemplate(data.template)
    setStages(data.stages)
    setLoading(false)
  }, [templateId])

  useEffect(() => { load() }, [load])

  async function handleAdd() {
    if (!newTitle.trim()) return
    const nextNum = stages.length ? Math.max(...stages.map(s => s.stage_number)) + 1 : 1
    await createJourneyStage(templateId, {
      stage_number: nextNum,
      title: newTitle.trim(),
      description_why: '',
      description_customer_action: '',
      description_readii_action: '',
    })
    setNewTitle('')
    setAdding(false)
    await load()
  }

  async function handleDelete(stage) {
    if (!confirm(`确认删除「${stage.title}」？`)) return
    await deleteJourneyStage(stage.id, templateId)
    await load()
  }

  function statusLabel(stage) {
    if (stage.description_why && stage.description_customer_action && stage.description_readii_action) return '✓ 内容完整'
    return '⚠ 待填写'
  }

  return (
    <div className="app-layout">
      <Sidebar badgeCounts={{}} />
      <main className="main ap-page">
        <header className="ap-header">
          <div>
            <button className="ap-back" onClick={() => navigate('/admin/journey-templates')}>← 返回模板列表</button>
            <h1 className="ap-title">{template?.name || '加载中...'}</h1>
            <div className="ap-subtitle">{stages.length} 个阶段 · 约 {template?.estimated_weeks || '—'} 周</div>
          </div>
          <button className="ap-add-btn" onClick={() => setAdding(true)}>+ 新增阶段</button>
        </header>

        {adding && (
          <div className="ap-add-form">
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="阶段标题，如：英国公司注册" onKeyDown={e => e.key === 'Enter' && handleAdd()} />
            <button className="ap-add-btn" onClick={handleAdd}>添加</button>
            <button className="ap-ghost-btn" onClick={() => { setAdding(false); setNewTitle('') }}>取消</button>
          </div>
        )}

        <div className="ap-body">
          {loading ? <div className="ap-empty">加载中...</div> : stages.length === 0 ? <div className="ap-empty">暂无阶段，点击右上角新增</div> : (
            <table className="ap-table">
              <thead><tr><th>#</th><th>标题</th><th>预计天数</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                {stages.map(s => (
                  <tr key={s.id}>
                    <td className="ap-stage-num">{s.stage_number}</td>
                    <td className="ap-stage-title">{s.title}{s.title_en && <span className="ap-stage-en"> · {s.title_en}</span>}</td>
                    <td>{s.estimated_duration_days || '—'}</td>
                    <td><span className={`ap-status ${s.description_why ? 'complete' : 'incomplete'}`}>{statusLabel(s)}</span></td>
                    <td className="ap-actions">
                      <button onClick={() => navigate(`/admin/journey-templates/${templateId}/stages/${s.id}/edit`)}>编辑</button>
                      <button onClick={() => handleDelete(s)} style={{color:'var(--danger-text, #c33)'}}>删除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}
