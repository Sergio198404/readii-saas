import { useEffect, useState, useCallback } from 'react'
import { supabase, ADMIN_EMAILS } from './supabase'

function hasAnyRoleFlag(p) {
  return !!(p.role || p.role_admin || p.role_partner || p.role_customer || p.role_consultant || p.role_staff)
}

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

  const isAdminEmail = ADMIN_EMAILS.includes(user.email)
  const defaultRole = isAdminEmail ? 'admin' : 'partner'
  const fullName = user.user_metadata?.full_name || user.email?.split('@')[0] || null

  if (existing) {
    // The handle_new_user trigger (migration 000022) creates a skeleton row
    // with only (id, full_name). If no role flag is set we treat it as a
    // self-signup and backfill sensible defaults. Admin-provisioned rows
    // (create-partner.mjs / create-staff.mjs) always set a role, so they
    // skip this branch and keep their intended password_changed=false.
    if (!hasAnyRoleFlag(existing)) {
      const patch = {
        role: defaultRole,
        role_admin: isAdminEmail,
        role_partner: !isAdminEmail,
        password_changed: true,
      }
      if (!existing.full_name && fullName) patch.full_name = fullName

      const { data: updated, error: updErr } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', user.id)
        .select()
        .single()
      if (updErr) {
        console.error('[useAuth] backfill bare profile failed:', updErr)
        return existing
      }
      return updated
    }
    return existing
  }

  // No row at all (e.g. user predates the handle_new_user trigger). Insert
  // via RLS — requires an insert policy on profiles for authenticated users.
  const { data: inserted, error: insertErr } = await supabase
    .from('profiles')
    .insert({
      id: user.id,
      full_name: fullName,
      role: defaultRole,
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
      let p = null
      try {
        p = await ensureProfile(sessionUser)
      } catch (err) {
        console.error('[useAuth] ensureProfile threw:', err)
      }
      console.log('[useAuth] hydrate profile:', {
        email: sessionUser.email,
        id: sessionUser.id,
        role: p?.role,
        role_partner: p?.role_partner,
        role_staff: p?.role_staff,
        role_customer: p?.role_customer,
        role_admin: p?.role_admin,
        password_changed: p?.password_changed,
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
