import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './LoginPage.css'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Supabase 的 recovery link 会把 session 带到页面；等 auth 就绪再放行
  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      if (data.session) setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      if (event === 'PASSWORD_RECOVERY' || session) setReady(true)
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    if (password.length < 8) return setError('密码至少 8 位')
    if (password !== confirm) return setError('两次输入不一致')

    setSubmitting(true)
    try {
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) throw err
      setInfo('密码重置成功，即将跳转登录')
      setTimeout(async () => {
        await supabase.auth.signOut()
        navigate('/login', { replace: true })
      }, 1200)
    } catch (err) {
      setError(err?.message || '更新失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-brand">Readii</div>
        <div className="login-title">重置密码</div>

        {!ready ? (
          <div className="login-info">正在验证重置链接...</div>
        ) : (
          <>
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
            {info && <div className="login-info">{info}</div>}

            <button type="submit" className="login-submit" disabled={submitting}>
              {submitting ? '提交中...' : '保存新密码'}
            </button>
          </>
        )}
      </form>
    </div>
  )
}
