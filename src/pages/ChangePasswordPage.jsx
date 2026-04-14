import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import './LoginPage.css'

export default function ChangePasswordPage() {
  const { user, profile, refetchProfile } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('密码至少 8 位')
      return
    }
    if (password !== confirm) {
      setError('两次输入不一致')
      return
    }
    setSubmitting(true)
    try {
      const { error: updErr } = await supabase.auth.updateUser({ password })
      if (updErr) throw updErr

      const { error: profErr } = await supabase
        .from('profiles')
        .update({ password_changed: true })
        .eq('id', user.id)
      if (profErr) throw profErr

      await refetchProfile()
      const home = profile?.role === 'admin' ? '/today' : '/partner'
      navigate(home, { replace: true })
    } catch (err) {
      setError(err.message || '更新失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-brand">Readii</div>
        <div className="login-title">首次登录，请修改临时密码</div>

        <label className="login-field">
          <span>新密码（至少 8 位）</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </label>

        <label className="login-field">
          <span>确认新密码</span>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </label>

        {error && <div className="login-error">{error}</div>}

        <button type="submit" className="login-submit" disabled={submitting}>
          {submitting ? '提交中...' : '保存新密码'}
        </button>
      </form>
    </div>
  )
}
