import { useEffect, useRef } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isOwner, trackEvent } from '../utils/adminHelpers'

export default function OwnerRoute({ children }) {
  const { user, profile } = useAuth()
  const location = useLocation()
  const logged = useRef(false)

  useEffect(() => {
    if (user && profile && !isOwner(profile) && !logged.current) {
      logged.current = true
      trackEvent({
        eventType: 'permission_denied',
        moduleKey: 'backend',
        action: 'backend_access_denied',
        metadata: { path: location.pathname },
      })
    }
  }, [user, profile, location.pathname])

  if (!user) return <Navigate to="/login" replace />

  // Profile may still be loading — wait until it's available
  if (user && !profile) return null

  if (!isOwner(profile)) return <Navigate to="/dashboard" replace />

  return children
}
