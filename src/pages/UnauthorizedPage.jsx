import { useNavigate } from 'react-router-dom'

export default function UnauthorizedPage() {
  const navigate = useNavigate()
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, fontFamily: 'var(--font-body)', color: 'var(--text-primary)' }}>
      <div style={{ fontSize: 48 }}>🔒</div>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>没有访问权限</h1>
      <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>您的账号没有访问此页面的权限。</p>
      <button onClick={() => navigate(-1)} style={{ padding: '8px 20px', border: '1px solid var(--border-subtle)', borderRadius: 8, background: 'var(--bg-card)', cursor: 'pointer', fontSize: 13 }}>返回</button>
    </div>
  )
}
