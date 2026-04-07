import { useState, useRef, useEffect } from 'react'
import './CoachDrawer.css'

const QUICK_CHIPS = [
  { icon: '📊', label: '健康度分析', prompt: '分析我当前线索库的整体健康度，哪些P1客户需要立刻行动？' },
  { icon: '📅', label: '今日计划',   prompt: '今天我应该优先跟进哪些客户？给出具体话术建议' },
  { icon: '⚠️', label: '风险预警',   prompt: '哪些客户有流失风险？如何挽救？' },
  { icon: '🎯', label: '产品策略',   prompt: '针对IFV/SW/PlanB各产品客户，最有效的推进策略是什么？' },
  { icon: '🔓', label: '卡点突破',   prompt: '从线索数据看，最常见的卡点在哪里？给出突破方法' },
]

export default function CoachDrawer({ open, onClose, leads = [], initialPrompt }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)
  const initialPromptSent = useRef(false)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // 支持外部传入 initialPrompt，打开时自动发送一次
  useEffect(() => {
    if (open && initialPrompt && !initialPromptSent.current) {
      initialPromptSent.current = true
      sendMessage(initialPrompt)
    }
    if (!open) {
      initialPromptSent.current = false
    }
  }, [open, initialPrompt])

  async function sendMessage(text) {
    if (!text.trim() || loading) return

    const userMsg = { role: 'user', content: text.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/.netlify/functions/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          leads,
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

  if (!open) return null

  return (
    <div className="coach-overlay open">
      <div className="coach-backdrop" onClick={onClose} />
      <div className="coach-drawer">
        <div className="coach-drawer-header">
          <div className="coach-avatar-lg">🧠</div>
          <div>
            <div className="coach-title">Readii 销售教练</div>
            <div className="coach-subtitle">基于你的线索库实时分析 · {leads.length} 条线索</div>
          </div>
          <button className="btn-action" style={{ marginLeft: 'auto', fontSize: 12 }} onClick={onClose}>✕ 关闭</button>
        </div>

        <div className="coach-quick-chips">
          {QUICK_CHIPS.map(chip => (
            <span
              className="coach-chip"
              key={chip.label}
              onClick={() => sendMessage(chip.prompt)}
            >
              {chip.icon} {chip.label}
            </span>
          ))}
        </div>

        <div className="coach-messages">
          {/* 欢迎消息 */}
          <div className="coach-msg">
            <div className="coach-msg-avatar">🧠</div>
            <div className="coach-msg-bubble">
              你好！我已读取你的线索库（{leads.length} 条）。<br /><br />
              点击上方快捷问题，或直接问我任何关于客户的销售策略。
            </div>
          </div>

          {/* 对话消息 */}
          {messages.map((msg, i) => (
            <div className={`coach-msg ${msg.role === 'user' ? 'user' : ''}`} key={i}>
              <div className="coach-msg-avatar">{msg.role === 'user' ? '👤' : '🧠'}</div>
              <div className="coach-msg-bubble">
                {msg.content.split('\n').map((line, j) => (
                  <span key={j}>{line}<br /></span>
                ))}
              </div>
            </div>
          ))}

          {/* loading 指示器 */}
          {loading && (
            <div className="coach-msg">
              <div className="coach-msg-avatar">🧠</div>
              <div className="coach-msg-bubble coach-typing">思考中...</div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="coach-input-area">
          <input
            className="coach-input"
            placeholder="问 AI 教练，例如：王芳下一步应该怎么跟进？"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
          <button className="btn btn-coach" onClick={() => sendMessage(input)} disabled={loading || !input.trim()}>
            发送 ↗
          </button>
        </div>
      </div>
    </div>
  )
}
