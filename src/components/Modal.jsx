import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Modal({ title, onClose, children, maxWidth = 560 }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-mobile-overlay"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="relative w-full rounded-xl shadow-2xl flex flex-col modal-inner modal-mobile-sheet"
        style={{ maxWidth, background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <h3 className="font-semibold" style={{ fontSize: 15, color: 'var(--text)' }}>{title}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg transition-colors"
            style={{ color: 'var(--muted)' }}
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto flex-1 min-h-0">{children}</div>
      </div>
    </div>
  )
}
