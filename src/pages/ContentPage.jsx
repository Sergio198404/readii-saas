import { useState, useEffect } from 'react'
import Sidebar from '../components/layout/Sidebar'
import { supabase } from '../lib/supabase'
import { useLeads } from '../lib/useLeads'
import { useExperts } from '../lib/useExperts'
import ContentGenModal from '../components/modals/ContentGenModal'
import './ContentPage.css'

const PLATFORMS = ['抖音', '视频号', '小红书']
const EMPTY_TOPIC = { topic: '', source_count: 1, platform: '抖音', angle: '', status: '待创作' }

// ============================================================
// 选题库 Tab
// ============================================================
function TopicsTab({ leads, experts = [] }) {
  const [topics, setTopics] = useState([])
  const [loading, setLoading] = useState(true)
  const [extracting, setExtracting] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(EMPTY_TOPIC)
  const [saving, setSaving] = useState(false)
  const [genTopic, setGenTopic] = useState(null)

  useEffect(() => { fetchTopics() }, [])

  useEffect(() => {
    const channel = supabase
      .channel('topics-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'content_topics' }, (payload) => {
        if (payload.eventType === 'INSERT') setTopics(prev => [payload.new, ...prev])
        else if (payload.eventType === 'UPDATE') setTopics(prev => prev.map(t => t.id === payload.new.id ? payload.new : t))
        else if (payload.eventType === 'DELETE') setTopics(prev => prev.filter(t => t.id !== payload.old.id))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function fetchTopics() {
    setLoading(true)
    const { data } = await supabase.from('content_topics').select('*').order('created_at', { ascending: false })
    setTopics(data || [])
    setLoading(false)
  }

  async function handleAdd() {
    if (!form.topic.trim()) return
    setSaving(true)
    await supabase.from('content_topics').insert({
      topic: form.topic.trim(), source_count: form.source_count || 1,
      platform: form.platform, angle: form.angle.trim() || null, status: form.status,
    })
    setSaving(false)
    setForm(EMPTY_TOPIC)
    setShowAdd(false)
  }

  async function toggleStatus(topic) {
    await supabase.from('content_topics').update({ status: topic.status === '待创作' ? '已发布' : '待创作' }).eq('id', topic.id)
  }

  async function deleteTopic(id) {
    await supabase.from('content_topics').delete().eq('id', id)
  }

  async function handleExtract() {
    if (leads.length === 0) return
    setExtracting(true)
    try {
      const res = await fetch('/.netlify/functions/extract-topics', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads }),
      })
      const data = await res.json()
      if (data.topics?.length > 0) {
        const rows = data.topics.map(t => ({
          topic: t.topic || '未命名选题', source_count: t.source_count || 1,
          platform: PLATFORMS.includes(t.platform) ? t.platform : '抖音',
          angle: t.angle || null, status: '待创作',
        }))
        await supabase.from('content_topics').insert(rows)
      }
    } catch (err) { console.error('Extract failed:', err) }
    finally { setExtracting(false) }
  }

  function set(field) {
    return (e) => setForm(prev => ({ ...prev, [field]: e.target.value }))
  }

  const pendingCount = topics.filter(t => t.status === '待创作').length
  const publishedCount = topics.filter(t => t.status === '已发布').length

  return (
    <>
      <div className="content-tab-toolbar">
        <span className="topbar-date">{topics.length} 个选题 · {pendingCount} 待创作 · {publishedCount} 已发布</span>
        <button className="btn btn-coach" onClick={handleExtract} disabled={extracting || leads.length === 0}>
          {extracting ? '🧠 提取中...' : '🧠 从客户备注提取选题'}
        </button>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ 新增选题</button>
      </div>

      {showAdd && (
        <div className="content-add-form">
          <div className="form-grid" style={{ padding: 0, gap: 10 }}>
            <div className="form-row" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">选题标题</label>
              <input className="form-input" placeholder="例：PSW签证到期前，你必须知道的3条出路" value={form.topic} onChange={set('topic')} />
            </div>
            <div className="form-row">
              <label className="form-label">平台</label>
              <select className="form-select" value={form.platform} onChange={set('platform')}>
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label className="form-label">来源客户数</label>
              <input className="form-input" type="number" min="1" value={form.source_count} onChange={set('source_count')} />
            </div>
            <div className="form-row" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">内容角度</label>
              <input className="form-input" placeholder="例：从创始人亲历视角，不是科普" value={form.angle} onChange={set('angle')} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary" onClick={handleAdd} disabled={saving || !form.topic.trim()}>
              {saving ? '保存中...' : '保存选题'}
            </button>
            <button className="btn btn-ghost" onClick={() => { setShowAdd(false); setForm(EMPTY_TOPIC) }}>取消</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>加载中...</div>
      ) : topics.length === 0 ? (
        <div className="today-empty">还没有选题，点击「从客户备注提取选题」让 AI 帮你分析，或手动新增</div>
      ) : (
        <div className="content-list">
          {topics.map(t => (
            <div className={`content-card ${t.status === '已发布' ? 'content-card--published' : ''}`} key={t.id}>
              <div className="content-card-main">
                <div className="content-card-title">{t.topic}</div>
                <div className="content-card-meta">
                  <span className={`badge ${t.platform === '抖音' ? 'badge-p1' : t.platform === '视频号' ? 'badge-p2' : 'badge-prod'}`}>{t.platform}</span>
                  <span className="badge badge-date">{t.source_count} 个客户问过</span>
                  <span className={`badge ${t.status === '已发布' ? 'badge-stage won' : 'badge-topic-pending'}`}>{t.status}</span>
                </div>
                {t.angle && <div className="content-card-angle">💡 {t.angle}</div>}
              </div>
              <div className="content-card-actions">
                <button className="btn-action ai-btn" onClick={() => setGenTopic(t)}>🧠 AI</button>
                <button className="btn-action" onClick={() => toggleStatus(t)}>
                  {t.status === '待创作' ? '✓ 已发布' : '↩ 待创作'}
                </button>
                <button className="btn-action" onClick={() => deleteTopic(t.id)} style={{ color: 'var(--danger-text)' }}>删除</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ContentGenModal
        open={!!genTopic}
        onClose={() => setGenTopic(null)}
        topic={genTopic?.topic}
        angle={genTopic?.angle}
        experts={experts}
      />
    </>
  )
}

// ============================================================
// 朋友圈 Tab
// ============================================================
const MOMENT_TYPES = [
  { type: '生活', icon: '🌿', desc: '轻松自然，展示创始人真实生活状态' },
  { type: '价值观', icon: '💡', desc: '对移民、创业、人生选择的真实判断' },
  { type: '案例', icon: '🏆', desc: '脱敏后的真实客户案例或反馈' },
]

function todayDateStr() {
  const d = new Date()
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`
}

function MomentsTab({ leads, experts = [] }) {
  const [moments, setMoments] = useState([null, null, null]) // 三条对应三种类型
  const [generating, setGenerating] = useState(false)
  const [regeneratingIdx, setRegeneratingIdx] = useState(-1)
  const [selectedCaseLead, setSelectedCaseLead] = useState('')
  const [selectedExpert, setSelectedExpert] = useState('') // 全局（用于批量生成）
  const [cardExperts, setCardExperts] = useState(['', '', '']) // 每张卡片独立专家
  const [copied, setCopied] = useState(-1)
  const [userInput, setUserInput] = useState('')
  const [inputExpert, setInputExpert] = useState('')
  const [inputGenerating, setInputGenerating] = useState(false)

  const caseLeads = leads.filter(l => l.s === 'S3' || l.s === 'S4')
  const recentNotes = leads.slice(0, 3).map(l => l.note).filter(Boolean)

  function buildCaseInfo() {
    if (!selectedCaseLead) return null
    const lead = leads.find(l => l.id === selectedCaseLead)
    if (!lead) return null
    const parts = [`客户（脱敏）: ${lead.prod || '?'}产品, ${lead.s}, 预算${lead.b || '?'}`]
    if (lead.note) parts.push(`情况: ${lead.note}`)
    if (lead.updates?.length) {
      parts.push(`跟进: ${lead.updates.map(u => `${u.date} ${u.note}`).join(' | ')}`)
    }
    return parts.join('\n')
  }

  async function generateAll() {
    setGenerating(true)
    try {
      const res = await fetch('/.netlify/functions/moments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: todayDateStr(),
          caseLeadInfo: buildCaseInfo(),
          recentNotes,
          expertStyle: experts.find(e => e.id === selectedExpert)?.style_prompt || null,
        }),
      })
      const data = await res.json()
      if (data.moments?.length >= 3) {
        setMoments(MOMENT_TYPES.map(mt => {
          const found = data.moments.find(m => m.type === mt.type)
          return found ? found.content : data.moments[MOMENT_TYPES.indexOf(mt)]?.content || ''
        }))
      } else if (data.moments?.length > 0) {
        setMoments(data.moments.map(m => m.content || ''))
      }
    } catch (err) { console.error('Generate failed:', err) }
    finally { setGenerating(false) }
  }

  async function regenerateOne(idx) {
    setRegeneratingIdx(idx)
    try {
      const res = await fetch('/.netlify/functions/moments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: todayDateStr(),
          caseLeadInfo: MOMENT_TYPES[idx].type === '案例' ? buildCaseInfo() : null,
          recentNotes,
          regenerateType: MOMENT_TYPES[idx].type,
          expertStyle: experts.find(e => e.id === (cardExperts[idx] || selectedExpert))?.style_prompt || null,
        }),
      })
      const data = await res.json()
      if (data.moments?.length > 0) {
        setMoments(prev => {
          const next = [...prev]
          next[idx] = data.moments[0].content || ''
          return next
        })
      }
    } catch (err) { console.error('Regenerate failed:', err) }
    finally { setRegeneratingIdx(-1) }
  }

  function copyToClipboard(text, idx) {
    navigator.clipboard.writeText(text)
    setCopied(idx)
    setTimeout(() => setCopied(-1), 2000)
  }

  async function generateFromInput() {
    if (!userInput.trim()) return
    setInputGenerating(true)
    try {
      const res = await fetch('/.netlify/functions/moments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: todayDateStr(),
          userPrompt: userInput.trim(),
          expertStyle: experts.find(e => e.id === inputExpert)?.style_prompt || null,
        }),
      })
      const data = await res.json()
      if (data.moments?.length >= 3) {
        setMoments(MOMENT_TYPES.map(mt => {
          const found = data.moments.find(m => m.type === mt.type)
          return found ? found.content : data.moments[MOMENT_TYPES.indexOf(mt)]?.content || ''
        }))
      } else if (data.moments?.length > 0) {
        setMoments(data.moments.map(m => m.content || ''))
      }
    } catch (err) { console.error('Generate from input failed:', err) }
    finally { setInputGenerating(false) }
  }

  return (
    <>
      <div className="content-tab-toolbar">
        <span className="topbar-date">每日三条朋友圈 · {todayDateStr()}</span>
        <button className="btn btn-primary" onClick={generateAll} disabled={generating}>
          {generating ? '🧠 生成中...' : '🧠 生成今日三条朋友圈'}
        </button>
      </div>

      {/* 自定义内容输入区块 */}
      <div className="moments-input-block">
        <textarea
          placeholder="描述你想写的内容，例如：今天陪客户看了创新签方案，聊到一个很有意思的问题..."
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
        />
        <div className="moments-input-row">
          <label>选择专家</label>
          <select className="form-select" value={inputExpert} onChange={(e) => setInputExpert(e.target.value)} style={{ maxWidth: 200 }}>
            <option value="">Readii 默认</option>
            {experts.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <button
            className="btn btn-primary"
            onClick={generateFromInput}
            disabled={inputGenerating || !userInput.trim()}
            style={{ marginLeft: 'auto' }}
          >
            {inputGenerating ? '🧠 生成中...' : '🧠 生成三条朋友圈'}
          </button>
        </div>
      </div>

      {/* 选项栏 */}
      <div className="moments-case-select">
        <label className="form-label" style={{ marginRight: 8 }}>案例素材客户</label>
        <select className="form-select" value={selectedCaseLead} onChange={(e) => setSelectedCaseLead(e.target.value)} style={{ maxWidth: 220 }}>
          <option value="">不指定</option>
          {caseLeads.map(l => (
            <option key={l.id} value={l.id}>{l.name}（{l.prod}, {l.s}）</option>
          ))}
        </select>
        <label className="form-label" style={{ marginLeft: 16, marginRight: 8 }}>专家风格</label>
        <select className="form-select" value={selectedExpert} onChange={(e) => setSelectedExpert(e.target.value)} style={{ maxWidth: 200 }}>
          <option value="">默认风格</option>
          {experts.map(e => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
      </div>

      {/* 三张卡片 */}
      <div className="moments-grid">
        {MOMENT_TYPES.map((mt, idx) => (
          <div className="moment-card" key={mt.type}>
            <div className="moment-card-header">
              <span className="moment-card-icon">{mt.icon}</span>
              <div>
                <div className="moment-card-type">{mt.type}</div>
                <div className="moment-card-desc">{mt.desc}</div>
              </div>
            </div>
            <div className="moment-card-expert">
              <select className="form-select" value={cardExperts[idx]} onChange={e => {
                const next = [...cardExperts]; next[idx] = e.target.value; setCardExperts(next)
              }} style={{ fontSize: 11, padding: '3px 8px' }}>
                <option value="">Readii默认</option>
                {experts.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div className="moment-card-body">
              {regeneratingIdx === idx ? (
                <div className="moment-loading">重新生成中...</div>
              ) : moments[idx] ? (
                <div className="moment-content">{moments[idx]}</div>
              ) : (
                <div className="moment-placeholder">点击上方按钮生成</div>
              )}
            </div>
            {moments[idx] && regeneratingIdx !== idx && (
              <div className="moment-card-footer">
                <button className="btn-action" onClick={() => copyToClipboard(moments[idx], idx)}>
                  {copied === idx ? '✓ 已复制' : '📋 复制'}
                </button>
                <button className="btn-action" onClick={() => regenerateOne(idx)} disabled={regeneratingIdx >= 0}>
                  🔄 重新生成
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}

// ============================================================
// 每日简报 Tab
// ============================================================
const BRIEF_CATEGORIES = [
  { key: '英国签证动态', icon: '🇬🇧', color: 'badge-p2' },
  { key: '国内热点结合点', icon: '🔥', color: 'badge-p1' },
  { key: '平台爆款参考', icon: '💎', color: 'badge-prod' },
]

function todayDateISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function BriefTab() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [expanded, setExpanded] = useState({})
  const [addedIds, setAddedIds] = useState(new Set())

  const today = todayDateISO()

  // 首次加载：检查缓存
  useEffect(() => { loadFromCache() }, [])

  async function loadFromCache() {
    setLoading(true)
    const { data } = await supabase
      .from('daily_brief')
      .select('*')
      .eq('date', today)
      .order('created_at', { ascending: true })

    if (data && data.length > 0) {
      setItems(data)
    } else {
      // 首次打开，自动触发
      await fetchBrief()
    }
    setLoading(false)
  }

  async function fetchBrief() {
    setFetching(true)
    try {
      // 先清除今日旧数据
      await supabase.from('daily_brief').delete().eq('date', today)
      setItems([])

      const categories = ['英国签证动态', '国内热点结合点', '平台爆款参考']

      // 逐个分类请求，避免超时
      for (const category of categories) {
        try {
          const res = await fetch('/.netlify/functions/daily-brief', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: todayDateStr(), category }),
          })
          const data = await res.json()

          if (data.items?.length > 0) {
            const rows = data.items.map(item => ({
              date: today,
              category: item.category || category,
              title: item.title || '',
              summary: item.summary || '',
              url: item.url || null,
              angle: item.angle || null,
            }))
            await supabase.from('daily_brief').insert(rows)

            // 逐步更新 UI（每个分类完成后立即显示）
            const { data: saved } = await supabase
              .from('daily_brief')
              .select('*')
              .eq('date', today)
              .order('created_at', { ascending: true })
            setItems(saved || [])
          }
        } catch (err) {
          console.error(`Category ${category} failed:`, err)
        }
      }
    } catch (err) {
      console.error('Brief fetch failed:', err)
    } finally {
      setFetching(false)
    }
  }

  async function addToTopics(item) {
    await supabase.from('content_topics').insert({
      topic: item.angle || item.title,
      source_count: 1,
      platform: '抖音',
      angle: item.summary || null,
      status: '待创作',
    })
    setAddedIds(prev => new Set([...prev, item.id]))
  }

  function toggleExpand(cat) {
    setExpanded(prev => ({ ...prev, [cat]: !prev[cat] }))
  }

  const grouped = BRIEF_CATEGORIES.map(cat => ({
    ...cat,
    items: items.filter(i => i.category === cat.key),
  }))

  return (
    <>
      <div className="content-tab-toolbar">
        <span className="topbar-date">每日简报 · {todayDateStr()}</span>
        <button className="btn btn-coach" onClick={fetchBrief} disabled={fetching}>
          {fetching ? '🔍 搜索中...' : '🔍 刷新今日简报'}
        </button>
      </div>

      {loading && !fetching ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>加载中...</div>
      ) : fetching && items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--coach-accent)' }}>
          🔍 正在搜索最新资讯，逐个分类加载中（每个约10秒）...
        </div>
      ) : !loading && !fetching && items.length === 0 ? (
        <div className="today-empty">暂无简报数据，点击「刷新今日简报」获取</div>
      ) : (
        <div className="brief-sections">
          {grouped.map(cat => (
            <div className="brief-section" key={cat.key}>
              <div className="brief-section-header" onClick={() => toggleExpand(cat.key)}>
                <span className="brief-section-icon">{cat.icon}</span>
                <span className="brief-section-title">{cat.key}</span>
                <span className={`badge ${cat.color}`} style={{ marginLeft: 8 }}>{cat.items.length} 条</span>
                <span className="brief-expand-icon">{expanded[cat.key] === false ? '▸' : '▾'}</span>
              </div>

              {expanded[cat.key] !== false && (
                <div className="brief-items">
                  {cat.items.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>暂无内容</div>
                  ) : cat.items.map(item => (
                    <div className="brief-item" key={item.id}>
                      <div className="brief-item-main">
                        <div className="brief-item-title">{item.title}</div>
                        {item.summary && <div className="brief-item-summary">{item.summary}</div>}
                        {item.angle && <div className="brief-item-angle">💡 {item.angle}</div>}
                        {item.url && (
                          <a href={item.url} target="_blank" rel="noreferrer" className="brief-item-link">查看原文 →</a>
                        )}
                      </div>
                      <button
                        className="btn-action"
                        onClick={() => addToTopics(item)}
                        disabled={addedIds.has(item.id)}
                        style={{ flexShrink: 0 }}
                      >
                        {addedIds.has(item.id) ? '✓ 已加入' : '+ 加入选题库'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// ============================================================
// 主页面
// ============================================================
export default function ContentPage() {
  const [tab, setTab] = useState('topics')
  const [currentFilter, setCurrentFilter] = useState('all')
  const { leads, badgeCounts } = useLeads('all', '')
  const { experts } = useExperts()

  return (
    <div className="app-layout">
      <Sidebar
        currentFilter={currentFilter}
        onFilterChange={setCurrentFilter}
        badgeCounts={badgeCounts}
      />

      <main className="main">
        <header className="content-header">
          <div className="content-header-left">
            <h1 className="today-title">内容中心</h1>
            <div className="content-tabs">
              <button className={`content-tab ${tab === 'topics' ? 'active' : ''}`} onClick={() => setTab('topics')}>
                选题库
              </button>
              <button className={`content-tab ${tab === 'moments' ? 'active' : ''}`} onClick={() => setTab('moments')}>
                朋友圈
              </button>
              <button className={`content-tab ${tab === 'brief' ? 'active' : ''}`} onClick={() => setTab('brief')}>
                每日简报
              </button>
            </div>
          </div>
        </header>

        <div className="board-area">
          {tab === 'topics' && <TopicsTab leads={leads} experts={experts} />}
          {tab === 'moments' && <MomentsTab leads={leads} experts={experts} />}
          {tab === 'brief' && <BriefTab />}
        </div>
      </main>
    </div>
  )
}
