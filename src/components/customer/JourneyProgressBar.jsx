import './CustomerComponents.css'

export default function JourneyProgressBar({ stages, progress, currentStageId }) {
  const progressMap = Object.fromEntries(
    (progress || []).map(p => [p.stage_id, p.status])
  )
  const completed = (progress || []).filter(p => p.status === 'completed').length
  const pct = stages.length ? (completed / stages.length) * 100 : 0

  // Show max 8 stages inline, rest collapsed
  const visible = stages.length <= 8 ? stages : [...stages.slice(0, 7), { _overflow: true, _count: stages.length - 7 }]

  return (
    <div className="jpb">
      <div className="jpb-track">
        <div className="jpb-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="jpb-nodes">
        {visible.map((stage, idx) => {
          if (stage._overflow) {
            return <div key="overflow" className="jpb-node jpb-overflow">+{stage._count}</div>
          }
          const status = progressMap[stage.id] || 'pending'
          const isCurrent = currentStageId === stage.id
          return (
            <div key={stage.id} className={`jpb-node ${status === 'completed' ? 'done' : isCurrent ? 'current' : ''}`}>
              <div className="jpb-dot">{status === 'completed' ? '✓' : idx + 1}</div>
              <div className="jpb-label">{stage.title}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
