import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [workspace, setWorkspace] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfileAndWorkspace = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null)
      setWorkspace(null)
      return
    }
    const [{ data: prof }, { data: ws }] = await Promise.all([
      supabase.from('profiles').select('id, email, first_name, last_name, role').eq('id', userId).maybeSingle(),
      supabase.from('workspaces').select('id, name, owner_user_id').eq('owner_user_id', userId).maybeSingle(),
    ])
    setProfile(prof ?? null)
    setWorkspace(ws ?? null)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u)
      setLoading(false)
      if (u?.id) loadProfileAndWorkspace(u.id)
    }).catch((err) => {
      console.error('[AuthContext] getSession failed:', err)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (u?.id) loadProfileAndWorkspace(u.id)
      else { setProfile(null); setWorkspace(null) }
    })

    return () => subscription.unsubscribe()
  }, [loadProfileAndWorkspace])

  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password })

  const signUp = (email, password, firstName, lastName) =>
    supabase.auth.signUp({
      email,
      password,
      options: { data: { first_name: firstName, last_name: lastName } },
    })

  const signOut = () => supabase.auth.signOut()

  const refreshWorkspace = useCallback(() => loadProfileAndWorkspace(user?.id ?? null), [user, loadProfileAndWorkspace])

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#0f172a',
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          border: '3px solid rgba(59,130,246,0.2)',
          borderTopColor: '#3b82f6',
          animation: 'spin 0.7s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ user, profile, workspace, loading, signIn, signUp, signOut, refreshWorkspace }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
