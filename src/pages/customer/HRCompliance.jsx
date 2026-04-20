import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useRole } from '../../contexts/RoleContext'
import {
  listHRItems, getCustomerHRProgress, ensureHRProgressInit,
  updateHRProgress, uploadHREvidence, getHREvidenceSignedUrl,
  getLatestHRReport, generateHRReport, getReportSignedUrl,
  groupByPhase, isPhaseUnlocked, isAllCompleted,
} from '../../lib/api/hrCompliance'
import './HRCompliance.css'

const STATUS_LABELS = {
  pending: '待完成',
  in_progress: '进行中',
  completed: '已完成',
  waived: '已豁免',
}

const PHASE_TITLES = {
  1: 'Phase 1：现有员工合规审计',
  2: 'Phase 2：雇佣合同和政策文件',
  3: 'Phase 3：Payroll / HMRC / ICO',
  4: 'Phase 4：招聘和入职流程',
}

export default function HRCompliance() {
  const { user } = useRole()
  const [loading, setLoading] = useState(true)
  const [customer, setCustomer] = useState(null)
  const [items, setItems] = useState([])
  const [progress, setProgress] = useState([])
  const [expandedId, setExpandedId] = useState(null)
  const [latestReport, setLatestReport] = useState(null)
  const [generating, setGenerating] = useState(false)

  const reload = useCallback(async (customerId) => {
    const [its, prog, rep] = await Promise.all([
      listHRItems(),
      getCustomerHRProgress(customerId),
      getLatestHRReport(customerId),
    ])
    setItems(its)
    setProgress(prog)
    setLatestReport(rep)
  }, [])

  useEffect(() => {
    if (!user?.id) return
    ;(async () => {
      try {
        const { data: cust } = await supabase.from('customer_profiles')
          .select('*').eq('user_id', user.id).maybeSingle()
        if (!cust) { setLoading(false); return }
        setCustomer(cust)
        await ensureHRProgressInit(cust.id)
        await reload(cust.id)
      } finally {
        setLoading(false)
      }
    })()
  }, [user?.id, reload])

  if (loading) return <div style={{padding:40,textAlign:'center',color:'var(--text-muted)',fontSize:13}}>加载中...</div>
  if (!customer) return <div style={{padding:40,textAlign:'center',color:'var(--text-muted)',fontSize:13}}>客户档案未建立</div>

  const phases = groupByPhase(items, progress)
  const completedCount = progress.filter(p => p.status === 'completed' || p.status === 'waived').length
  const total = items.length
  const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0
  const allDone = isAllCompleted(items, progress)

  async function handleGenerate() {
    setGenerating(true)
    try {
      await generateHRReport(customer.id)
      await reload(customer.id)
    } catch (e) {
      alert('生成报告失败：' + (e.message || e))
    } finally {
      setGenerating(false)
    }
  }

  async function handleDownload() {
    if (!latestReport?.file_url) return
    try {
      const url = await getReportSignedUrl(latestReport.file_url)
      window.open(url, '_blank')
    } catch (e) {
      alert('获取下载链接失败：' + (e.message || e))
    }
  }

  return (
    <div className="hrc-container">
      <div className="hrc-header">
        <h1 className="hrc-title">HR 合规审计（{total} 项）</h1>
        <div className="hrc-subtitle">
          为 Sponsor Licence 申请准备的英国雇主合规清单。按 Phase 顺序完成，完成全部后系统会生成可下载的《HR 合规审计报告》PDF。
        </div>

        <div className="hrc-progress-bar"><div className="hrc-progress-fill" style={{width:`${pct}%`}} /></div>
        <div className="hrc-progress-text">{completedCount}/{total} 已完成（{pct}%）</div>

        <div className="hrc-actions">
          <button
            className="hrc-generate-btn"
            onClick={handleGenerate}
            disabled={!allDone || generating}
            title={allDone ? '' : '需全部 26 项完成才能生成报告'}
          >
            {generating ? '生成中...' : '生成 HR 合规审计报告（PDF）'}
          </button>
          {latestReport && (
            <button className="hrc-download-btn" onClick={handleDownload}>
              下载最新报告（{new Date(latestReport.created_at).toLocaleDateString('zh-CN')}）
            </button>
          )}
        </div>
      </div>

      {[1, 2, 3, 4].map(phaseNum => {
        const phaseItems = phases[phaseNum] || []
        const unlocked = isPhaseUnlocked(phaseNum, phases)
        const phaseCompleted = phaseItems.filter(({ progress: p }) => p?.status === 'completed' || p?.status === 'waived').length

        return (
          <div key={phaseNum} className={`hrc-phase ${unlocked ? '' : 'locked'}`}>
            <div className="hrc-phase-header">
              <div>
                <div className="hrc-phase-title">{PHASE_TITLES[phaseNum]}</div>
                <div className="hrc-phase-count">{phaseCompleted}/{phaseItems.length} 已完成</div>
              </div>
              {!unlocked && <span className="hrc-phase-locked-badge">🔒 Phase {phaseNum - 1} 完成后解锁</span>}
            </div>

            {unlocked && phaseItems.map(({ item, progress: p }) => (
              <HRItem
                key={item.id}
                customer={customer}
                item={item}
                progress={p}
                expanded={expandedId === item.id}
                onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                onChanged={() => reload(customer.id)}
              />
            ))}
          </div>
        )
      })}

      {customer && (
        <div style={{marginTop:20,fontSize:12,color:'var(--text-muted)'}}>
          <Link to="/customer/journey" style={{color:'inherit'}}>← 返回 Journey</Link>
        </div>
      )}
    </div>
  )
}

function HRItem({ customer, item, progress, expanded, onToggle, onChanged }) {
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const status = progress?.status || 'pending'

  const statusCls = status === 'completed' ? 'hrc-status-completed'
    : status === 'in_progress' ? 'hrc-status-in-progress'
    : status === 'waived' ? 'hrc-status-waived'
    : 'hrc-status-pending'

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const { path, fileName } = await uploadHREvidence(customer.id, item.item_code, file)
      await updateHRProgress(progress.id, {
        evidence_url: path,
        evidence_file_name: fileName,
        status: status === 'pending' ? 'in_progress' : status,
      })
      onChanged()
    } catch (err) {
      alert('上传失败：' + (err.message || err))
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleOpenEvidence() {
    try {
      const url = await getHREvidenceSignedUrl(progress.evidence_url)
      window.open(url, '_blank')
    } catch (err) {
      alert('打开文件失败：' + (err.message || err))
    }
  }

  async function handleMarkComplete() {
    setSaving(true)
    try {
      await updateHRProgress(progress.id, { status: 'completed', completed_by: 'customer' })
      onChanged()
    } finally { setSaving(false) }
  }

  async function handleReopen() {
    setSaving(true)
    try {
      await updateHRProgress(progress.id, { status: 'in_progress', completed_at: null })
      onChanged()
    } finally { setSaving(false) }
  }

  return (
    <div className="hrc-item">
      <div className="hrc-item-row" onClick={onToggle}>
        <div className="hrc-item-num">{item.item_number}</div>
        <div className="hrc-item-title">{item.title}</div>
        <span className={`hrc-item-status ${statusCls}`}>{STATUS_LABELS[status]}</span>
        <span style={{color:'var(--text-muted)',fontSize:12}}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="hrc-item-body">
          {item.compliance_basis && (
            <>
              <div className="hrc-item-label">合规依据</div>
              <div className="hrc-item-basis">{item.compliance_basis}</div>
            </>
          )}

          <div className="hrc-item-label">说明</div>
          <div className="hrc-item-desc">{item.description}</div>

          <div className="hrc-item-label">需要的证明文件</div>
          <div className="hrc-item-desc">{item.evidence_type}</div>

          {item.is_signoff ? (
            <div className="hrc-signoff-wait">
              🔒 此项需要 Readii 合规团队确认。完成所有同 Phase 的其它项目后，团队会在 1-2 个工作日内完成签字。
            </div>
          ) : (
            <>
              <div className="hrc-upload-zone">
                {progress?.evidence_url ? (
                  <>
                    <div className="hrc-evidence">
                      <span>📎 {progress.evidence_file_name}</span>
                      <button className="hrc-evidence-link" onClick={handleOpenEvidence} style={{background:'none',border:'none',cursor:'pointer'}}>查看</button>
                    </div>
                    <label className="hrc-upload-btn" style={{marginTop:10}}>
                      {uploading ? '上传中...' : '替换文件'}
                      <input type="file" onChange={handleUpload} disabled={uploading} />
                    </label>
                  </>
                ) : (
                  <>
                    <div>还未上传证明文件</div>
                    <label className="hrc-upload-btn">
                      {uploading ? '上传中...' : '上传文件'}
                      <input type="file" onChange={handleUpload} disabled={uploading} />
                    </label>
                  </>
                )}
              </div>

              <div className="hrc-item-buttons">
                {status !== 'completed' ? (
                  <button className="hrc-btn hrc-btn-primary" onClick={handleMarkComplete} disabled={saving}>
                    {saving ? '...' : '标记为已完成'}
                  </button>
                ) : (
                  <button className="hrc-btn hrc-btn-ghost" onClick={handleReopen} disabled={saving}>
                    {saving ? '...' : '重新打开'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
