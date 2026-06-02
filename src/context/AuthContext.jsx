import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser]                       = useState(null)
  const [profile, setProfile]                 = useState(null)
  const [workspace, setWorkspace]             = useState(null)
  const [loading, setLoading]                 = useState(true)
  // workspaceLoading: true while workspace is being fetched/created after auth state changes.
  // Separate from `loading` so the full-page spinner and per-action guards can be decoupled.
  const [workspaceLoading, setWorkspaceLoading] = useState(true)

  async function loadUserData(sessionUser) {
    setWorkspaceLoading(true)
    try {
      const [{ data: prof }, { data: ws, error: wsErr }] = await Promise.all([
        supabase.from('profiles')
          .select('id, email, first_name, last_name, role, status, display_name, last_login_at, last_seen_at')
          .eq('id', sessionUser.id)
          .maybeSingle(),
        supabase.from('workspaces')
          .select('id, name, owner_user_id')
          .eq('owner_user_id', sessionUser.id)
          .maybeSingle(),
      ])

      // Auto-sign-out blocked users
      if (prof?.status === 'blocked') {
        await supabase.auth.signOut()
        return
      }

      setProfile(prof ?? null)

      if (wsErr) {
        // Query error — keep existing workspace value, log for diagnostics
        console.error('[AuthContext] workspace query error:', wsErr)
      } else if (ws) {
        setWorkspace(ws)
      } else {
        // No workspace row found — auto-create one so the user can operate immediately.
        // This handles users who registered before the handle_new_user_workspace trigger
        // was added (i.e., no workspace was ever provisioned for them).
        const { data: created, error: createErr } = await supabase
          .from('workspaces')
          .insert({ owner_user_id: sessionUser.id, name: 'Mój magazyn' })
          .select('id, name, owner_user_id')
          .single()
        if (createErr) {
          console.error('[AuthContext] auto-create workspace failed:', createErr)
          setWorkspace(null)
        } else {
          setWorkspace(created)
        }
      }
    } catch (err) {
      console.error('[AuthContext] loadUserData error:', err)
      setProfile(null)
      setWorkspace(null)
    } finally {
      setWorkspaceLoading(false)
    }
  }

  async function updateLastLogin(userId) {
    try {
      await supabase.from('profiles').update({ last_login_at: new Date().toISOString() }).eq('id', userId)
    } catch { /* ignore */ }
  }

  async function updateLastSeen(userId) {
    try {
      await supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', userId)
    } catch { /* ignore */ }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        loadUserData(u).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    }).catch((err) => {
      console.error('[AuthContext] getSession error:', err)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        loadUserData(u)
        if (event === 'SIGNED_IN') {
          updateLastLogin(u.id)
          // Track login event
          setTimeout(async () => {
            try {
              await supabase.from('app_events').insert({
                user_id: u.id,
                event_type: 'auth_login',
                action: 'user_logged_in',
                metadata: {},
              })
            } catch { /* ignore */ }
          }, 800)
        }
      } else {
        setProfile(null)
        setWorkspace(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Update last_seen_at every 5 minutes while logged in
  useEffect(() => {
    if (!user) return
    updateLastSeen(user.id)
    const interval = setInterval(() => updateLastSeen(user.id), 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [user])

  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password })

  const signUp = (email, password, firstName, lastName) =>
    supabase.auth.signUp({
      email,
      password,
      options: { data: { first_name: firstName, last_name: lastName } },
    })

  const signOut = () => supabase.auth.signOut()

  const refreshWorkspace = () => {
    if (user) return loadUserData(user)
    setWorkspaceLoading(false)
    return Promise.resolve()
  }

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
    <AuthContext.Provider value={{ user, profile, workspace, loading, workspaceLoading, signIn, signUp, signOut, refreshWorkspace }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)
