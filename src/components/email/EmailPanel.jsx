import { useState, useEffect } from 'react'
import emailjs from '@emailjs/browser'
import { supabase } from '../../lib/supabase'
import './EmailPanel.css'

const CONFIG_KEY = 'email_config'

function todayMMDD() {
  const d = new Date()
  return String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0')
}

function todayLabel() {
  const d = new Date()
  const days = ['日','一','二','三','四','五','六']
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日 周${days[d.getDay()]}`
}

export default function EmailPanel({ open, onClose, leads = [] }) {
  const [config, setConfig] = useState({ email: '', serviceId: '', templateId: '', publicKey: '' })
  const [status, setStatus] = useState('')
  const [sending, setSending] = useState(false)

  // 从 Supabase 加载已保存的配置
  useEffect(() => {
    loadConfig()
  }, [])

  async function loadConfig() {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', CONFIG_KEY)
      .single()

    if (data?.value) {
      setConfig(data.value)
    }
  }

  async function saveConfig() {
    const { error } = await supabase
      .from('settings')
      .upsert({ key: CONFIG_KEY, value: config }, { onConflict: 'key' })

    if (error) {
      setStatus('保存失败：' + error.message)
    } else {
      setStatus('配置已保存 ✓')
    }
  }

  async function sendDailyEmail() {
    if (!config.email || !config.serviceId || !config.templateId || !config.publicKey) {
      setStatus('请先填写并保存所有 EmailJS 配置项')
      return
    }

    setSending(true)
    setStatus('正在生成报告...')

    // 筛选今日需跟进的线索
    const today = todayMMDD()
    const todayLeads = leads.filter(l => l.follow === today || (l.follow && l.follow < today))

    // 调用后端生成 AI 建议
    let aiSummary = ''
    try {
      const res = await fetch('/.netlify/functions/daily-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads: todayLeads.length > 0 ? todayLeads : leads.slice(0, 5) }),
      })
      const data = await res.json()
      aiSummary = data.summary || data.error || ''
    } catch {
      aiSummary = '（AI 建议生成失败，以下为线索列表）'
    }

    // 构建邮件内容
    const leadsList = todayLeads.length > 0
      ? todayLeads.map(l => `• ${l.name}（${l.channel || '?'}）${l.p}/${l.s} — ${l.next || '?'} — ${l.note || ''}`).join('\n')
      : '今日无到期跟进线索'

    const body = [
      `Readii 销售日报 — ${todayLabel()}`,
      '',
      `==== 今日跟进（${todayLeads.length} 条） ====`,
      leadsList,
      '',
      `==== AI 跟进建议 ====`,
      aiSummary,
      '',
      `总线索数: ${leads.length} | P1: ${leads.filter(l => l.p === 'P1').length} | 已成交: ${leads.filter(l => l.s === 'S4').length}`,
    ].join('\n')

    setStatus('正在发送邮件...')

    try {
      await emailjs.send(config.serviceId, config.templateId, {
        to_email: config.email,
        subject: `Readii 日报 — ${todayLabel()} — ${todayLeads.length} 条跟进`,
        message: body,
      }, config.publicKey)

      setStatus('邮件发送成功 ✓')
    } catch (err) {
      setStatus('发送失败：' + (err?.text || err?.message || '未知错误'))
    } finally {
      setSending(false)
    }
  }

  function set(field) {
    return (e) => setConfig(prev => ({ ...prev, [field]: e.target.value }))
  }

  if (!open) return null

  return (
    <div className="email-panel">
      <div className="email-panel-header">
        <span>📧</span>
        <span className="email-panel-title">每日跟进提醒邮件配置</span>
        <a href="https://www.emailjs.com" target="_blank" rel="noreferrer" style={{ color: '#1A5C3A', fontSize: 12, marginLeft: 'auto' }}>获取 EmailJS 配置 →</a>
        <button className="btn-action" style={{ marginLeft: 8, fontSize: 11 }} onClick={onClose}>收起</button>
      </div>
      <div className="form-grid" style={{ gap: 10, padding: '0 16px' }}>
        <div className="form-row">
          <label className="form-label">收件邮箱</label>
          <input className="form-input" placeholder="your@email.com" type="email" value={config.email} onChange={set('email')} />
        </div>
        <div className="form-row">
          <label className="form-label">EmailJS Service ID</label>
          <input className="form-input" placeholder="service_xxxxxxx" value={config.serviceId} onChange={set('serviceId')} />
        </div>
        <div className="form-row">
          <label className="form-label">EmailJS Template ID</label>
          <input className="form-input" placeholder="template_xxxxxxx" value={config.templateId} onChange={set('templateId')} />
        </div>
        <div className="form-row">
          <label className="form-label">EmailJS Public Key</label>
          <input className="form-input" placeholder="xxxxxxxxxxxxxx" value={config.publicKey} onChange={set('publicKey')} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, padding: '0 16px', alignItems: 'center' }}>
        <button className="btn btn-email" onClick={sendDailyEmail} disabled={sending}>
          {sending ? '发送中...' : '立即发送今日报告'}
        </button>
        <button className="btn btn-ghost" onClick={saveConfig}>保存配置</button>
      </div>
      {status && (
        <div className="email-status" style={{ padding: '8px 16px', fontSize: 12, color: status.includes('失败') ? 'var(--danger-text)' : '#1A5C3A' }}>
          {status}
        </div>
      )}
      <p style={{ fontSize: 11, color: '#5A9070', margin: '10px 16px 4px', lineHeight: 1.6 }}>
        ⓘ 每天打开后点一次"立即发送"，邮件包含今日跟进清单 + AI建议。EmailJS 免费版每月200封。
      </p>
    </div>
  )
}
