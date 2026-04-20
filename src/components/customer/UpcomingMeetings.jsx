import './CustomerComponents.css'

export default function UpcomingMeetings({ meetings }) {
  return (
    <div className="um">
      <h2 className="um-title">即将到来的会议</h2>
      {(!meetings || meetings.length === 0) ? (
        <div className="um-empty">暂无预约的会议</div>
      ) : (
        <div className="um-list">
          {meetings.map(m => (
            <div key={m.id} className="um-card">
              <div className="um-card-title">{m.title}</div>
              <div className="um-card-time">{new Date(m.scheduled_at).toLocaleString('zh-CN')}</div>
              {m.meeting_link && (
                <a href={m.meeting_link} target="_blank" rel="noreferrer" className="um-link">加入会议 →</a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
