import { useState } from 'react'
import './NewPartnerModal.css'

export default function NewPartnerModal({ onClose, onCreated }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [englishName, setEnglishName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!fullName.trim() || !email.trim() || !englishName.trim()) {
      setError('请完整填写姓名、邮箱、英文名')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/.netlify/functions/create-partner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim(),
          english_name: englishName.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        throw new Error(data.error || '创建失败')
      }
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  function handleDone() {
    onCreated?.()
  }

  return (
    <div className="np-backdrop" onClick={onClose}>
      <div className="np-modal" onClick={(e) => e.stopPropagation()}>
        <div className="np-head">
          <h2>新增伙伴</h2>
          <button className="np-close" onClick={onClose}>×</button>
        </div>

        {result ? (
          <div className="np-body">
            <div className="np-success">✓ 伙伴创建成功</div>
            <div className="np-field">
              <label>推广码</label>
              <div className="np-readonly">{result.partner.referral_code}</div>
            </div>
            <div className="np-field">
              <label>推广链接</label>
              <div className="np-readonly">{result.partner.referral_url}</div>
            </div>
            <div className="np-field">
              <label>临时密码（请告知伙伴首次登录后修改）</label>
              <div className="np-readonly">{result.temp_password}</div>
            </div>
            <button className="np-submit" onClick={handleDone}>完成</button>
          </div>
        ) : (
          <form className="np-body" onSubmit={handleSubmit}>
            <div className="np-field">
              <label>姓名</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="张三"
              />
            </div>
            <div className="np-field">
              <label>邮箱</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="partner@example.com"
              />
            </div>
            <div className="np-field">
              <label>英文名（用于生成推广码）</label>
              <input
                type="text"
                value={englishName}
                onChange={(e) => setEnglishName(e.target.value)}
                placeholder="e.g. alex"
              />
              {englishName && (
                <div className="np-preview">
                  推广码：READII-{englishName.toUpperCase().replace(/[^A-Z0-9]/g, '')}-2025
                </div>
              )}
            </div>

            {error && <div className="np-error">{error}</div>}

            <button type="submit" className="np-submit" disabled={submitting}>
              {submitting ? '创建中...' : '创建伙伴'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
