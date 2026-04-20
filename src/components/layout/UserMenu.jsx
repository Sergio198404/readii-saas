import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../lib/useAuth'
import { signOut } from '../../lib/supabase'
import { RoleSwitcher } from '../RoleSwitcher'
import './UserMenu.css'

export default function UserMenu() {
  const { user, profile } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  if (!user) return null
  const name = profile?.full_name || user.email || ''
  const initial = (name[0] || '?').toUpperCase()

  async function handleSignOut() {
    try { await signOut() } catch (e) { console.error(e) }
  }

  return (
    <div className="user-menu" ref={ref}>
      <button
        type="button"
        className="user-menu-avatar"
        onClick={() => setOpen((v) => !v)}
        title={name}
      >
        {initial}
      </button>
      {open && (
        <div className="user-menu-dropdown">
          <div className="user-menu-name">{name}</div>
          <div className="user-menu-role">{profile?.role || ''}</div>
          <RoleSwitcher />
          <button type="button" className="user-menu-signout" onClick={handleSignOut}>
            退出登录
          </button>
        </div>
      )}
    </div>
  )
}
