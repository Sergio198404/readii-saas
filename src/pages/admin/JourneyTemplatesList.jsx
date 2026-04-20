import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../../components/layout/Sidebar'
import { listJourneyTemplates, createJourneyTemplate } from '../../lib/api/admin'
import './AdminPages.css'

const SERVICE_TYPES = [
  { value: 'sw_self_sponsored', label: '自雇工签' },
  { value: 'innovator_founder', label: '创新签' },
  { value: 'expansion_worker', label: '拓展工签' },
  { value: 'general_consulting', label: '综合咨询' },
]

export default function JourneyTemplatesList() {
  const navigate = useNavigate()
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('sw_self_sponsored')
  const [newWeeks, setNewWeeks] = useState(24)

  useEffect(() => {
    listJourneyTemplates().then(setTemplates).finally(() => setLoading(false))
  }, [])

  async function handleCreate() {
    if (!newName.trim()) return
    await createJourneyTemplate({ service_type: newType, name: newName.trim(), total_stages: 0, estimated_weeks: newWeeks })
    const data = await listJourneyTemplates()
    setTemplates(data)
    setShowAdd(false)
    setNewName('')
  }

  return (
    <div className="app-layout">
      <Sidebar badgeCounts={{}} />
      <main className="main ap-page">
        <header className="ap-header">
          <div><h1 className="ap-title">Journey 模板管理</h1><div className="ap-subtitle">编辑服务路径模板和阶段内容</div></div>
          <button className="ap-add-btn" onClick={() => setShowAdd(true)}>+ 新建模板</button>
        </header>

        {showAdd && (
          <div className="ap-add-form">
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="模板名称，如：自雇工签全流程" />
            <select value={newType} onChange={e => setNewType(e.target.value)}>
              {SERVICE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input type="number" value={newWeeks} onChange={e => setNewWeeks(Number(e.target.value))} placeholder="预计周数" style={{maxWidth:80}} />
            <button className="ap-add-btn" onClick={handleCreate}>创建</button>
            <button className="ap-ghost-btn" onClick={() => setShowAdd(false)}>取消</button>
          </div>
        )}

        <div className="ap-body">
          {loading ? <div className="ap-empty">加载中...</div> : templates.length === 0 ? <div className="ap-empty">暂无模板</div> : (
            <div className="ap-card-grid">
              {templates.map(t => (
                <div key={t.id} className="ap-card" onClick={() => navigate(`/admin/journey-templates/${t.id}/stages`)}>
                  <div className="ap-card-title">{t.name}</div>
                  <div className="ap-card-meta">
                    <span>{SERVICE_TYPES.find(s => s.value === t.service_type)?.label || t.service_type}</span>
                    <span>·</span>
                    <span>{t.total_stages} 个阶段</span>
                    <span>·</span>
                    <span>约 {t.estimated_weeks} 周</span>
                  </div>
                  <div className="ap-card-arrow">编辑阶段 →</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
