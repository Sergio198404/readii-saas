import { useState, useEffect, useRef } from 'react'
import './ContentGenModal.css'

const CONTENT_TYPES = ['朋友圈', '口播稿（600-900字）', '文章（1500字）']

export default function ContentGenModal({ open, onClose, topic, angle, experts = [] }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedExpert, setSelectedExpert] = useState('')
  const [contentType, setContentType] = useState('朋友圈')
  const [copied, setCopied] = useState(false)
  const messagesEndRef = useRef(null)
  const generated = useRef(false)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (open) {
      setMessages([])
      setInput('')
      setCopied(false)
      generated.current = false
      // 默认选 Readii默认
      const defaultExpert = experts.find(e => e.name === 'Readii默认')
      if (defaultExpert) setSelectedExpert(defaultExpert.id)
    }
  }, [open, experts])

  async function generate() {
    if (loading) return
    generated.current = true
    setLoading(true)

    const expertStyle = experts.find(e => e.id === selectedExpert)?.style_prompt || null

    try {
      const res = await fetch('/.netlify/functions/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, angle, contentType, expertStyle }),
      })
      const data = await res.json()
      const reply = data.reply || data.error || '生成失败'
      setMessages([
        { role: 'user', content: `生成${contentType}：${topic}` },
        { role: 'assistant', content: reply },
      ])
    } catch (err) {
      setMessages([{ role: 'assistant', content: '网络错误：' + err.message }])
    } finally {
      setLoading(false)
    }
  }

  async function sendFollowUp() {
    if (!input.trim() || loading) return
    const userMsg = { role: 'user', content: input.trim() }
    const newMsgs = [...messages, userMsg]
    setMessages(newMsgs)
    setInput('')
    setLoading(true)

    const expertStyle = experts.find(e => e.id === selectedExpert)?.style_prompt || null

    try {
      const res = await fetch('/.netlify/functions/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMsgs.map(m => ({ role: m.role, content: m.content })),
          expertStyle,
        }),
      })
      const data = await res.json()
      setMessages([...newMsgs, { role: 'assistant', content: data.reply || '生成失败' }])
    } catch (err) {
      setMessages([...newMsgs, { role: 'assistant', content: '网络错误：' + err.message }])
    } finally {
      setLoading(false)
    }
  }

  function copyLast() {
    const last = [...messages].reverse().find(m => m.role === 'assistant')
    if (last) {
      navigator.clipboard.writeText(last.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (!open) return null

  return (
    <div className="overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal cg-modal">
        <div className="modal-header">
          <span style={{ fontSize: 18 }}>🧠</span>
          <span className="modal-title" style={{ flex: 1 }}>AI 内容生成</span>
          {messages.some(m => m.role === 'assistant') && (
            <button className="btn-action" onClick={copyLast} style={{ marginRight: 8 }}>
              {copied ? '✓ 已复制' : '📋 复制'}
            </button>
          )}
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* 选项栏 */}
        {!generated.current && (
          <div className="cg-options">
            <div className="cg-topic">
              <span className="form-label">选题：</span>
              <span style={{ fontSize: 13 }}>{topic}</span>
            </div>
            <div className="cg-selects">
              <div className="form-row">
                <label className="form-label">专家风格</label>
                <select className="form-select" value={selectedExpert} onChange={e => setSelectedExpert(e.target.value)}>
                  <option value="">默认</option>
                  {experts.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">内容类型</label>
                <select className="form-select" value={contentType} onChange={e => setContentType(e.target.value)}>
                  {CONTENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <button className="btn btn-primary" onClick={generate} disabled={loading} style={{ alignSelf: 'flex-end' }}>
                {loading ? '生成中...' : '生成'}
              </button>
            </div>
          </div>
        )}

        {/* 对话区 */}
        <div className="cg-messages">
          {messages.map((msg, i) => (
            <div className={`dankoe-msg ${msg.role === 'user' ? 'dankoe-msg--user' : ''}`} key={i}>
              <div className="dankoe-msg-avatar">{msg.role === 'user' ? '👤' : '🧠'}</div>
              <div className="dankoe-msg-bubble">
                {msg.content.split('\n').map((line, j) => <span key={j}>{line}<br /></span>)}
              </div>
            </div>
          ))}
          {loading && (
            <div className="dankoe-msg">
              <div className="dankoe-msg-avatar">🧠</div>
              <div className="dankoe-msg-bubble dankoe-typing">生成中...</div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 追问输入框 */}
        {generated.current && (
          <div className="dankoe-input-area">
            <input
              className="form-input dankoe-input"
              placeholder="继续追问修改，例如：语气再口语化一些"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendFollowUp() } }}
              disabled={loading}
            />
            <button className="btn btn-primary" onClick={sendFollowUp} disabled={loading || !input.trim()} style={{ fontSize: 12, padding: '7px 14px' }}>
              发送
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
