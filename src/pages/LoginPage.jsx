import { useState } from 'react'
import { signIn, signUp, supabase } from '../lib/supabase'
import './LoginPage.css'

const RESET_REDIRECT = 'https://readii-sales.netlify.app/reset-password'

export default function LoginPage() {
  const [mode, setMode] = useState('login') // login | signup | forgot
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isSignup = mode === 'signup'
  const isForgot = mode === 'forgot'

  function switchMode(next) {
    setMode(next)
    setError('')
    setInfo('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')

    if (isForgot) {
      if (!email) return setError('请输入邮箱')
      setSubmitting(true)
      try {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: RESET_REDIRECT,
        })
        if (err) throw err
        setInfo('重置邮件已发送，请到邮箱点击链接')
      } catch (err) {
        setError(err?.message || '发送失败')
      } finally {
        setSubmitting(false)
      }
      return
    }

    if (!email || !password) {
      setError('请输入邮箱和密码')
      return
    }
    setSubmitting(true)
    try {
      if (isSignup) {
        await signUp(email, password, fullName)
        setInfo('注册成功，若开启了邮箱确认请先去邮箱验证再登录')
      } else {
        await signIn(email, password)
      }
    } catch (err) {
      setError(err?.message || '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  const title = isSignup ? '注册账号' : isForgot ? '忘记密码' : '登录'
  const submitLabel = submitting
    ? '处理中...'
    : isSignup
      ? '注册'
      : isForgot
        ? '发送重置邮件'
        : '登录'

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-brand">Readii</div>
        <div className="login-title">{title}</div>

        {isSignup && (
          <label className="login-field">
            <span>姓名</span>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="你的姓名"
            />
          </label>
        )}

        <label className="login-field">
          <span>邮箱</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </label>

        {!isForgot && (
          <label className="login-field">
            <span>密码</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 6 位"
              autoComplete={isSignup ? 'new-password' : 'current-password'}
            />
          </label>
        )}

        {error && <div className="login-error">{error}</div>}
        {info && <div className="login-info">{info}</div>}

        <button type="submit" className="login-submit" disabled={submitting}>
          {submitLabel}
        </button>

        {!isForgot && (
          <button
            type="button"
            className="login-switch"
            onClick={() => switchMode(isSignup ? 'login' : 'signup')}
          >
            {isSignup ? '已有账号？去登录' : '没有账号？去注册'}
          </button>
        )}

        {!isSignup && !isForgot && (
          <button
            type="button"
            className="login-switch"
            onClick={() => switchMode('forgot')}
          >
            忘记密码？
          </button>
        )}

        {isForgot && (
          <button
            type="button"
            className="login-switch"
            onClick={() => switchMode('login')}
          >
            返回登录
          </button>
        )}
      </form>
    </div>
  )
}
