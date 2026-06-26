import { useEffect, useState } from 'react'

export default function OfflineBanner() {
  const [status, setStatus] = useState(navigator.onLine ? 'online' : 'offline')
  const [show, setShow] = useState(!navigator.onLine)

  useEffect(() => {
    function goOffline() { setStatus('offline'); setShow(true) }
    function goOnline() {
      setStatus('online')
      setShow(true)
      setTimeout(() => setShow(false), 3000)
    }
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  if (!show) return null
  return (
    <div className={`offline-banner ${status}`}>
      {status === 'offline'
        ? '📡 Brak połączenia — zmiany zostaną wysłane po powrocie online'
        : '✅ Połączono — synchronizuję…'}
    </div>
  )
}
