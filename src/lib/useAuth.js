import { useEffect, useState, useCallback } from 'react'
import { supabase, ADMIN_EMAILS } from './supabase'

async function ensureProfile(user) {
  if (!user) return null

  const { data: existing, error: selectErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (selectErr) {
    console.error('[useAuth] load profile failed:', selectErr)
    return null
  }
  if (existing) return existing

  const isAdminEmail = ADMIN_EMAILS.includes(user.email)
  const role = isAdminEmail ? 'admin' : 'partner'
  const fullName = user.user_metadata?.full_name || user.email?.split('@')[0] || null

  const { data: inserted, error: insertErr } = await supabase
    .from('profiles')
    .insert({
      id: user.id,
      full_name: fullName,
      role,
      role_admin: isAdminEmail,
      role_partner: !isAdminEmail,
      password_changed: true,
    })
    .select()
    .single()

  if (insertErr) {
    console.error('[useAuth] create profile failed:', insertErr)
    return null
  }
  return inserted
}

export function useAuth() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const hydrate = useCallback(async (sessionUser) => {
    setLoading(true)
    setUser(sessionUser ?? null)
    if (sessionUser) {
      const p = await ensureProfile(sessionUser)
      console.log('[useAuth] hydrate profile:', {
        email: sessionUser.email,
        id: sessionUser.id,
        role: p?.role,
        password_changed: p?.password_changed,
        full: p,
      })
      setProfile(p)
    } else {
      setProfile(null)
    }
    setLoading(false)
  }, [])

  const refetchProfile = useCallback(async () => {
    if (!user) return null
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()
    if (error) {
      console.error('[useAuth] refetch profile failed:', error)
      return null
    }
    setProfile(data)
    return data
  }, [user])

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      hydrate(data.session?.user ?? null)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      hydrate(session?.user ?? null)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [hydrate])

  return { user, profile, loading, refetchProfile }
}
