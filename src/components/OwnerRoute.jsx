import { useEffect, useRef } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isOwner, trackEvent } from '../utils/adminHelpers'

export default function OwnerRoute({ children }) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()
  const logged = useRef(false)

  const ownerCheck = isOwner(profile)

  useEffect(() => {
    if (import.meta.env.DEV && user) {
      console.log('[OwnerRoute]', {
        userEmail:   user?.email,
        profileEmail: profile?.email,
        role:        profile?.role,
        status:      profile?.status,
        isOwner:     ownerCheck,
        loading,
      })
    }
  }, [user, profile, ownerCheck, loading])

  useEffect(() => {
    if (user && profile && !ownerCheck && !logged.current) {
      logged.current = true
      trackEvent({
        eventType: 'permission_denied',
        moduleKey: 'backend',
        action:    'backend_access_denied',
        metadata:  { path: location.pathname },
      })
    }
  }, [user, profile, ownerCheck, location.pathname])

  // Wait for AuthContext initial load — avoids redirect before session resolves
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40vh' }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          border: '3px solid rgba(124,58,237,0.2)',
          borderTopColor: '#7c3aed',
          animation: 'spin 0.7s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  // Profile still being fetched after auth confirmed — show spinner, not blank
  if (!profile) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40vh' }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          border: '3px solid rgba(124,58,237,0.2)',
          borderTopColor: '#7c3aed',
          animation: 'spin 0.7s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!ownerCheck) return <Navigate to="/dashboard" replace />

  return children
}
