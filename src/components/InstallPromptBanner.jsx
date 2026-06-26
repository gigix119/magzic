import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

const DISMISS_KEY = 'magzic_install_prompt_dismissed'

export default function InstallPromptBanner() {
  const [deferredEvent, setDeferredEvent] = useState(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY)) return
    function handler(e) {
      e.preventDefault()
      setDeferredEvent(e)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1')
    setVisible(false)
  }

  async function install() {
    if (!deferredEvent) return
    deferredEvent.prompt()
    await deferredEvent.userChoice
    localStorage.setItem(DISMISS_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      className="flex items-center gap-3"
      style={{
        position: 'fixed', left: 12, right: 12, bottom: 'max(12px, env(safe-area-inset-bottom, 12px))',
        zIndex: 95, padding: '12px 14px', borderRadius: 14,
        background: 'rgba(10,20,36,0.97)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.16)', boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
        maxWidth: 420, margin: '0 auto',
      }}
    >
      <Download size={18} style={{ color: '#37A0C9', flexShrink: 0 }} />
      <p style={{ flex: 1, fontSize: 13, color: '#F4F8FB', margin: 0, fontFamily: "'Inter', sans-serif" }}>
        Dodaj Magzic do ekranu głównego
      </p>
      <button
        onClick={install}
        className="flex-shrink-0 rounded-lg text-xs font-semibold text-white"
        style={{ background: '#37A0C9', padding: '7px 12px', minHeight: 32 }}
      >
        Zainstaluj
      </button>
      <button onClick={dismiss} className="flex-shrink-0" style={{ color: '#A9BBC9', width: 24, height: 24 }}>
        <X size={15} />
      </button>
    </div>
  )
}
