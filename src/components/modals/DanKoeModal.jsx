import { useState, useEffect, useRef } from 'react'
import './DanKoeModal.css'

function buildInitialPrompt(lead) {
  const fields = [
    `姓名: ${lead.name}`,
    `渠道: ${lead.channel || '未知'}`,
    `优先级: ${lead.p}`,
    `阶段: ${lead.s}`,
    `产品: ${lead.prod || '未确定'}`,
    `预算: ${lead.b || '未知'}`,
    lead.exp ? `签证到期: ${lead.exp}` : null,
    lead.goal ? `目标月份: ${lead.goal}` : null,
    `下一步动作: ${lead.next || '未定'}`,
    lead.follow ? `跟进日期: ${lead.follow}` : null,
    lead.note ? `一句话进度: ${lead.note}` : null,
  ].filter(Boolean).join('\n')

  const history = Array.isArray(lead.updates) && lead.updates.length > 0
    ? lead.updates.map(u => `${u.date} ${u.note}`).join('\n')
    : '暂无跟进历史'

  return `针对以下客户给出具体的下一步跟进建议，包括：1）这个客户当前最大的障碍是什么 2）最优的下一步行动，给出一句可以直接发微信的开场白 3）成交概率判断 4）风险提示

客户信息：
${fields}

跟进历史：
${history}`
}

export default function DanKoeModal({ open, onClose, lead, experts = [] }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedExpert, setSelectedExpert] = useState('')
  const messagesEndRef = useRef(null)
  const initialSent = useRef(false)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (open && lead) {
      setMessages([])
      setInput('')
      initialSent.current = false
      // 默认选 Dan Koe
      const danKoe = experts.find(e => e.name === 'Dan Koe')
      setSelectedExpert(danKoe?.id || '')
    }
  }, [open, lead, experts])

  // 选好专家后自动发送（仅首次打开）
  useEffect(() => {
    if (open && lead && !initialSent.current && selectedExpert !== undefined) {
      // 小延迟确保 selectedExpert 设置完成
      const timer = setTimeout(() => {
        if (!initialSent.current) {
          initialSent.current = true
          const prompt = buildInitialPrompt(lead)
          sendMessage(prompt, [])
        }
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [open, lead, selectedExpert])

  async function sendMessage(text, existingMessages) {
    if (!text.trim() || loading) return

    const userMsg = { role: 'user', content: text.trim() }
    const msgs = existingMessages !== undefined ? existingMessages : messages
    const newMessages = [...msgs, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    const expertStyle = experts.find(e => e.id === selectedExpert)?.style_prompt || null

    try {
      const res = await fetch('/.netlify/functions/dan-koe-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          expertStyle,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMessages([...newMessages, { role: 'assistant', content: `错误：${data.error || '请求失败'}` }])
      } else {
        setMessages([...newMessages, { role: 'assistant', content: data.reply }])
      }
    } catch (err) {
      setMessages([...newMessages, { role: 'assistant', content: `网络错误：${err.message}` }])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  if (!open || !lead) return null

  const expertName = experts.find(e => e.id === selectedExpert)?.name || 'AI'

  return (
    <div className="overlay open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal dankoe-modal">
        <div className="modal-header dankoe-header">
          <span style={{ fontSize: 18 }}>🧠</span>
          <span className="modal-title">AI 教练 · {lead.name}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* 专家选择器 */}
        <div style={{ padding: '10px 22px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <label className="form-label" style={{ margin: 0 }}>专家风格</label>
          <select className="form-select" value={selectedExpert} onChange={e => setSelectedExpert(e.target.value)} style={{ maxWidth: 200 }}>
            <option value="">默认</option>
            {experts.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>当前：{expertName}</span>
        </div>

        <div className="dankoe-messages">
          {messages.map((msg, i) => (
            <div className={`dankoe-msg ${msg.role === 'user' ? 'dankoe-msg--user' : ''}`} key={i}>
              <div className="dankoe-msg-avatar">{msg.role === 'user' ? '👤' : '🧠'}</div>
              <div className="dankoe-msg-bubble">
                {msg.role === 'user' && i === 0
                  ? <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>正在分析 {lead.name} ...</span>
                  : msg.content.split('\n').map((line, j) => (
                      <span key={j}>{line}<br /></span>
                    ))
                }
              </div>
            </div>
          ))}

          {loading && (
            <div className="dankoe-msg">
              <div className="dankoe-msg-avatar">🧠</div>
              <div className="dankoe-msg-bubble dankoe-typing">分析中...</div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="dankoe-input-area">
          <input
            className="form-input dankoe-input"
            placeholder="继续追问，例如：如果他说价格贵怎么办？"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
          <button className="btn btn-primary" onClick={() => sendMessage(input)} disabled={loading || !input.trim()} style={{ fontSize: 12, padding: '7px 14px' }}>
            发送
          </button>
        </div>
      </div>
    </div>
  )
}
