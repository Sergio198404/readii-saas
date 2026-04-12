export default function PartnerPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: 12,
      background: 'var(--bg-page)',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-body)',
    }}>
      <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>
        渠道伙伴中心
      </div>
      <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
        即将上线
      </div>
    </div>
  )
}
