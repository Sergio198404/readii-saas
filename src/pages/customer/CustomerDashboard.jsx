import { useEffect, useState } from 'react'
import { getCustomerDashboard, calculateProgress, getCurrentStageDetails, getServiceTypeLabel } from '../../lib/api/customer'
import JourneyProgressBar from '../../components/customer/JourneyProgressBar'
import CurrentStageCard from '../../components/customer/CurrentStageCard'
import QuickActionPanel from '../../components/customer/QuickActionPanel'
import UpcomingMeetings from '../../components/customer/UpcomingMeetings'
import { useRole } from '../../contexts/RoleContext'

export default function CustomerDashboard() {
  const { profile } = useRole()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getCustomerDashboard()
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>加载中...</div>
  }

  if (error) {
    return <div style={{ padding: 40, color: '#c33', fontSize: 13 }}>加载失败：{error}</div>
  }

  if (!data) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>客户档案尚未建立</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 400, margin: '0 auto' }}>
          您的顾问正在为您准备服务档案，建立完成后您将看到完整的服务进度和工作台。如有疑问请联系苏晓宇。
        </p>
      </div>
    )
  }

  const { customer, stages, progress, upcomingMeetings } = data
  const currentStage = getCurrentStageDetails(data)
  const progressPercent = calculateProgress(stages, progress)
  const completedCount = progress.filter(p => p.status === 'completed').length

  return (
    <div style={{ maxWidth: 960, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Welcome */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-lg, 12px)', padding: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>
          你好，{profile?.full_name || customer.notes || '客户'}
        </h1>
        <div style={{ display: 'flex', gap: 24, fontSize: 13, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
          <div>服务类型：<strong style={{ color: 'var(--text-primary)' }}>{getServiceTypeLabel(customer.service_type)}</strong></div>
          <div>签约日期：<strong style={{ color: 'var(--text-primary)' }}>{customer.signed_date}</strong></div>
          <div>预计完成：<strong style={{ color: 'var(--text-primary)' }}>{customer.expected_completion_date || '待定'}</strong></div>
          {customer.total_contract_value_pence != null && (
            <div>合同金额：<strong style={{ color: 'var(--text-primary)' }}>£{(customer.total_contract_value_pence / 100).toLocaleString()}</strong></div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {stages.length > 0 && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-lg, 12px)', padding: 24 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, margin: '0 0 16px' }}>服务进度</h2>
          <JourneyProgressBar stages={stages} progress={progress} currentStageId={customer.current_stage_id} />
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
            完成度：{progressPercent}%（{completedCount}/{stages.length}）
          </div>
        </div>
      )}

      {/* Current stage */}
      {currentStage && <CurrentStageCard stage={currentStage} />}

      {/* Two columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <QuickActionPanel />
        <UpcomingMeetings meetings={upcomingMeetings} />
      </div>
    </div>
  )
}
