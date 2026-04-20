import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getUserRoles } from '../lib/roles'

const RoleContext = createContext(null)

export function RoleProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [currentRole, setCurrentRole] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          await loadProfile(session.user.id)
        } else {
          setProfile(null)
          setCurrentRole(null)
          setLoading(false)
        }
      }
    )

    return () => authListener.subscription.unsubscribe()
  }, [])

  async function loadProfile(userId) {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (data) {
      setProfile(data)
      const savedRole = localStorage.getItem(`readii_role_${userId}`)
      const userRoles = getUserRoles(data)
      if (savedRole && userRoles.includes(savedRole)) {
        setCurrentRole(savedRole)
      } else if (userRoles.length > 0) {
        setCurrentRole(userRoles[0])
      }
    }
    setLoading(false)
  }

  function switchRole(role) {
    const userRoles = getUserRoles(profile)
    if (!userRoles.includes(role)) return
    setCurrentRole(role)
    if (user?.id) localStorage.setItem(`readii_role_${user.id}`, role)
  }

  return (
    <RoleContext.Provider value={{
      user, profile, currentRole, loading,
      roles: getUserRoles(profile),
      switchRole,
      reload: () => user && loadProfile(user.id),
    }}>
      {children}
    </RoleContext.Provider>
  )
}

export function useRole() {
  const ctx = useContext(RoleContext)
  if (!ctx) throw new Error('useRole must be used inside RoleProvider')
  return ctx
}
