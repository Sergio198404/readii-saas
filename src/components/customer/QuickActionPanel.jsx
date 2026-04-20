import { Link } from 'react-router-dom'
import './CustomerComponents.css'

const ACTIONS = [
  { to: '/customer/qa', icon: '💬', title: '问一个问题', sub: '24小时内回复' },
  { to: '/customer/meetings', icon: '🗓️', title: '约一次会议', sub: '视频或电话' },
  { to: '/customer/documents', icon: '📎', title: '上传文档', sub: 'PDF、图片' },
  { to: '/customer/journey', icon: '🗺️', title: '查看完整路径', sub: '全流程一览' },
]

export default function QuickActionPanel() {
  return (
    <div className="qap">
      <h2 className="qap-title">快捷操作</h2>
      <div className="qap-grid">
        {ACTIONS.map(a => (
          <Link key={a.to} to={a.to} className="qap-card">
            <span className="qap-icon">{a.icon}</span>
            <div>
              <div className="qap-card-title">{a.title}</div>
              <div className="qap-card-sub">{a.sub}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
