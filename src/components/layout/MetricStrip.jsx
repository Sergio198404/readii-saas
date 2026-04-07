import './MetricStrip.css'

const METRICS = [
  { id: 'p1',    icon: '🔴', label: 'P1 紧急',   colorClass: 'red' },
  { id: 'p2',    icon: '🔵', label: 'P2 跟进中',  colorClass: 'blue' },
  { id: 'today', icon: '⏰', label: '今日跟进',   colorClass: 'amber' },
  { id: 'won',   icon: '✅', label: 'S4 已成交',  colorClass: 'green' },
  { id: 'total', icon: '📋', label: '总线索',     colorClass: 'gray' },
]

export default function MetricStrip({ counts = {} }) {
  return (
    <div className="metric-strip">
      {METRICS.map(m => (
        <div className="metric-card" key={m.id}>
          <div className={`metric-icon ${m.colorClass}`}>{m.icon}</div>
          <div className="metric-body">
            <div className="metric-value">{counts[m.id] ?? '–'}</div>
            <div className="metric-label">{m.label}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
