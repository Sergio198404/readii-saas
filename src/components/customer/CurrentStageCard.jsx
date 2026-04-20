import './CustomerComponents.css'

export default function CurrentStageCard({ stage }) {
  if (!stage) return null

  return (
    <div className="csc">
      <div className="csc-header">
        <div>
          <div className="csc-meta">第 {stage.stage_number} 步 · 预计 {stage.estimated_duration_days || '—'} 天</div>
          <h2 className="csc-title">{stage.title}</h2>
          {stage.title_en && <div className="csc-title-en">{stage.title_en}</div>}
        </div>
        <span className="csc-badge">进行中</span>
      </div>

      <div className="csc-grid">
        <div className="csc-card csc-card-why">
          <div className="csc-card-label">💡 为什么重要</div>
          <div className="csc-card-text">{stage.description_why}</div>
        </div>
        <div className="csc-card csc-card-you">
          <div className="csc-card-label">✅ 你需要做什么</div>
          <div className="csc-card-text">{stage.description_customer_action}</div>
        </div>
        <div className="csc-card csc-card-readii">
          <div className="csc-card-label">🔧 Readii 在做什么</div>
          <div className="csc-card-text">{stage.description_readii_action}</div>
        </div>
      </div>

      {stage.deliverables?.length > 0 && (
        <div className="csc-deliverables">
          <div className="csc-card-label">📦 本阶段交付物</div>
          <ul>{stage.deliverables.map((d, i) => <li key={i}>{d}</li>)}</ul>
        </div>
      )}
    </div>
  )
}
