import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Sidebar from '../../components/layout/Sidebar'
import { getCustomerProgress, updateStageProgress, syncCurrentStage } from '../../lib/api/admin'
import './AdminPages.css'

const STATUS_OPTIONS = [
  { value: 'pending', label: '待开始', color: '#8A8780' },
  { value: 'in_progress', label: '进行中', color: '#b8741a' },
  { value: 'blocked_on_customer', label: '等待客户', color: '#c33' },
  { value: 'blocked_on_readii', label: 'Readii 处理中', color: '#e67e22' },
  { value: 'completed', label: '已完成', color: '#1e7a3c' },
  { value: 'skipped', label: '已跳过', color: '#999' },
]

export default function CustomerProgressPage() {
  const { customerId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const d = await getCustomerProgress(customerId)
    setData(d)
    setLoading(false)
  }, [customerId])

  useEffect(() => { load() }, [load])

  async function handleStatusChange(stageId, newStatus) {
    await updateStageProgress(customerId, stageId, { status: newStatus })
    const d = await getCustomerProgress(customerId)
    setData(d)
    await syncCurrentStage(customerId, d.stages, d.progress)
  }

  async function handleNoteChange(stageId, notes) {
    await updateStageProgress(customerId, stageId, { notes })
  }

  if (loading || !data) return <div className="app-layout"><Sidebar badgeCounts={{}} /><main className="main ap-page"><div className="ap-empty">加载中...</div></main></div>

  const { customer, stages, progress } = data
  const progressMap = Object.fromEntries((progress || []).map(p => [p.stage_id, p]))
  const completedCount = progress.filter(p => p.status === 'completed').length
  const customerName = customer.profiles?.full_name || customer.profiles?.email || '客户'

  return (
    <div className="app-layout">
      <Sidebar badgeCounts={{}} />
      <main className="main ap-page">
        <header className="ap-header">
          <div>
            <button className="ap-back" onClick={() => navigate('/admin/customers')}>← 返回客户列表</button>
            <h1 className="ap-title">{customerName} · 服务进度</h1>
            <div className="ap-subtitle">{customer.service_type} · 完成 {completedCount}/{stages.length}</div>
          </div>
        </header>

        <div className="ap-body" style={{maxWidth:800}}>
          {stages.length === 0 ? (
            <div className="ap-empty">该客户的服务类型暂无 Journey 模板，请先在模板管理中创建</div>
          ) : (
            <div className="ap-progress-list">
              {stages.map(stage => {
                const p = progressMap[stage.id]
                const status = p?.status || 'pending'
                const statusInfo = STATUS_OPTIONS.find(o => o.value === status)
                return (
                  <div key={stage.id} className={`ap-progress-card ${status === 'completed' ? 'done' : status === 'in_progress' ? 'active' : ''}`}>
                    <div className="ap-progress-num" style={{borderColor: statusInfo?.color}}>
                      {status === 'completed' ? '✓' : stage.stage_number}
                    </div>
                    <div className="ap-progress-body">
                      <div className="ap-progress-title">{stage.title}</div>
                      <div className="ap-progress-controls">
                        <select value={status} onChange={e => handleStatusChange(stage.id, e.target.value)} style={{borderColor: statusInfo?.color}}>
                          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <input
                          placeholder="备注..."
                          defaultValue={p?.notes || ''}
                          onBlur={e => { if (e.target.value !== (p?.notes || '')) handleNoteChange(stage.id, e.target.value) }}
                          style={{flex:1}}
                        />
                      </div>
                      {p?.completed_at && <div className="ap-progress-time">完成于 {new Date(p.completed_at).toLocaleString('zh-CN')}</div>}
                      {p?.blocker_reason && <div className="ap-progress-blocker">卡住原因：{p.blocker_reason}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
