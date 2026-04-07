import { useState } from 'react'
import Sidebar from '../components/layout/Sidebar'
import UpdateLeadModal from '../components/modals/UpdateLeadModal'
import DanKoeModal from '../components/modals/DanKoeModal'
import CoachDrawer from '../components/coach/CoachDrawer'
import { useLeads } from '../lib/useLeads'
import './TodayView.css'

function todayMMDD() {
  const d = new Date()
  return String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0')
}

function todayLabel() {
  const d = new Date()
  const days = ['日','一','二','三','四','五','六']
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日 · 周${days[d.getDay()]}`
}

const P_ORDER = { P1: 0, P2: 1, P3: 2 }
function sortByPriority(a, b) {
  return (P_ORDER[a.p] ?? 9) - (P_ORDER[b.p] ?? 9)
}

function MiniCard({ lead, onUpdate, onDanKoe, overdue }) {
  const initials = lead.name
    ? [...lead.name].length >= 2
      ? [...lead.name][0] + [...lead.name].at(-1)
      : [...lead.name][0]
    : '?'

  return (
    <div className={`today-card ${overdue ? 'today-card--overdue' : ''}`}>
      <div className="today-card-left">
        <div className="today-card-avatar">{initials}</div>
        <div className="today-card-info">
          <div className="today-card-name">
            {lead.name}
            <span className={`badge badge-${lead.p?.toLowerCase()}`} style={{ marginLeft: 6 }}>{lead.p}</span>
            <span className="badge badge-stage" style={{ marginLeft: 4 }}>{lead.s}</span>
          </div>
          <div className="today-card-meta">
            {lead.next && <span>下一步: {lead.next}</span>}
            {lead.follow && <span> · 跟进: {lead.follow}</span>}
            {overdue && <span className="today-overdue-tag">逾期</span>}
          </div>
          {lead.note && <div className="today-card-note">{lead.note}</div>}
        </div>
      </div>
      <div className="today-card-actions">
        <button className="btn-action ai-btn today-card-btn" onClick={() => onDanKoe(lead)}>
          🧠 Dan Koe
        </button>
        <button className="btn btn-primary today-card-btn" onClick={() => onUpdate(lead)}>
          已跟进 ↑
        </button>
      </div>
    </div>
  )
}

export default function TodayView() {
  const [currentFilter, setCurrentFilter] = useState('all')
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [updatingLead, setUpdatingLead] = useState(null)
  const [showCoach, setShowCoach] = useState(false)
  const [coachPrompt, setCoachPrompt] = useState(null)
  const [showDanKoe, setShowDanKoe] = useState(false)
  const [danKoeLead, setDanKoeLead] = useState(null)

  const { leads, badgeCounts, loading } = useLeads('all', '')
  const today = todayMMDD()

  // ① 今日必跟进
  const todayLeads = leads
    .filter(l => l.follow === today)
    .sort(sortByPriority)

  // ② 逾期未跟进
  const overdueLeads = leads
    .filter(l => l.follow && l.follow < today && l.s !== 'S4' && l.s !== 'S5')
    .sort(sortByPriority)

  // ③ P1 雷达（排除已在上面两组出现的）
  const shownIds = new Set([...todayLeads, ...overdueLeads].map(l => l.id))
  const p1Leads = leads
    .filter(l => l.p === 'P1' && !shownIds.has(l.id) && l.s !== 'S4' && l.s !== 'S5')
    .sort((a, b) => (a.follow || 'zz').localeCompare(b.follow || 'zz'))

  function handleUpdate(lead) {
    setUpdatingLead(lead)
    setShowUpdateModal(true)
  }

  function handleDanKoe(lead) {
    setDanKoeLead(lead)
    setShowDanKoe(true)
  }

  function handleAIOpener() {
    const allTodayNames = [...todayLeads, ...overdueLeads]
      .map(l => `${l.name}（${l.prod || '?'}, ${l.s}, ${l.next || '?'}${l.note ? ', ' + l.note : ''}）`)
      .join('\n')

    const prompt = allTodayNames
      ? `针对今日需要跟进的每个客户，各给一句具体的微信开场白建议。以下是今日客户清单：\n\n${allTodayNames}`
      : '今天没有需要跟进的客户，请分析我的线索库，给出今天最应该主动联系的3个客户和开场白。'

    setCoachPrompt(prompt)
    setShowCoach(true)
  }

  return (
    <div className="app-layout">
      <Sidebar
        currentFilter={currentFilter}
        onFilterChange={setCurrentFilter}
        badgeCounts={badgeCounts}
      />

      <main className="main">
        <header className="today-header">
          <div className="today-header-left">
            <h1 className="today-title">今日工作台</h1>
            <span className="topbar-date">{todayLabel()}</span>
          </div>
          <div className="today-header-right">
            <button className="btn btn-coach" onClick={handleAIOpener}>🧠 让 AI 生成今日开场白</button>
            <a href="/board" className="btn btn-ghost">📋 完整看板</a>
          </div>
        </header>

        {/* 统计条 */}
        <div className="today-stats">
          <div className="today-stat">
            <span className="today-stat-num">{todayLeads.length}</span>
            <span className="today-stat-label">今日跟进</span>
          </div>
          <div className="today-stat today-stat--danger">
            <span className="today-stat-num">{overdueLeads.length}</span>
            <span className="today-stat-label">逾期未跟</span>
          </div>
          <div className="today-stat today-stat--p1">
            <span className="today-stat-num">{p1Leads.length + todayLeads.filter(l => l.p === 'P1').length + overdueLeads.filter(l => l.p === 'P1').length}</span>
            <span className="today-stat-label">P1 总数</span>
          </div>
        </div>

        <div className="board-area">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>加载中...</div>
          ) : (
            <>
              {/* ② 逾期 — 最紧急放最上面 */}
              {overdueLeads.length > 0 && (
                <section className="today-section">
                  <h2 className="today-section-title today-section-title--danger">
                    🚨 逾期未跟进 <span className="today-section-count">{overdueLeads.length}</span>
                  </h2>
                  {overdueLeads.map(l => (
                    <MiniCard key={l.id} lead={l} onUpdate={handleUpdate} onDanKoe={handleDanKoe} overdue />
                  ))}
                </section>
              )}

              {/* ① 今日必跟 */}
              <section className="today-section">
                <h2 className="today-section-title">
                  📅 今日必跟进 <span className="today-section-count">{todayLeads.length}</span>
                </h2>
                {todayLeads.length > 0 ? todayLeads.map(l => (
                  <MiniCard key={l.id} lead={l} onUpdate={handleUpdate} onDanKoe={handleDanKoe} />
                )) : (
                  <div className="today-empty">今日没有到期跟进，干得漂亮 ✓</div>
                )}
              </section>

              {/* ③ P1 雷达 */}
              {p1Leads.length > 0 && (
                <section className="today-section">
                  <h2 className="today-section-title today-section-title--p1">
                    🔴 P1 雷达 <span className="today-section-count">{p1Leads.length}</span>
                  </h2>
                  {p1Leads.map(l => (
                    <MiniCard key={l.id} lead={l} onUpdate={handleUpdate} onDanKoe={handleDanKoe} />
                  ))}
                </section>
              )}
            </>
          )}
        </div>
      </main>

      <UpdateLeadModal
        open={showUpdateModal}
        onClose={() => { setShowUpdateModal(false); setUpdatingLead(null) }}
        lead={updatingLead}
      />

      <DanKoeModal
        open={showDanKoe}
        onClose={() => { setShowDanKoe(false); setDanKoeLead(null) }}
        lead={danKoeLead}
      />

      <CoachDrawer
        open={showCoach}
        onClose={() => { setShowCoach(false); setCoachPrompt(null) }}
        leads={leads}
        initialPrompt={coachPrompt}
      />
    </div>
  )
}
