import { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'

const ToastContext = createContext()

const TOAST_STYLES = {
  success: {
    bg: '#052e16', border: '#166534', color: '#86efac',
    Icon: CheckCircle2,
  },
  error: {
    bg: '#450a0a', border: '#991b1b', color: '#fca5a5',
    Icon: XCircle,
  },
  warning: {
    bg: '#451a03', border: '#92400e', color: '#fcd34d',
    Icon: AlertTriangle,
  },
  info: {
    bg: '#0c1a2e', border: '#1d4ed8', color: '#93c5fd',
    Icon: Info,
  },
}

function ToastItem({ toast, onRemove }) {
  const style = TOAST_STYLES[toast.type] || TOAST_STYLES.info
  const { Icon } = style
  return (
    <div
      className="toast-item flex items-start gap-3 rounded-xl px-4 py-3 shadow-2xl text-sm font-medium"
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
        color: style.color,
        minWidth: 280,
        maxWidth: 420,
        animation: 'slideInToast 0.22s ease-out',
      }}
    >
      <Icon size={16} style={{ flexShrink: 0, marginTop: 1 }} />
      <span className="flex-1 leading-snug">{toast.message}</span>
      <button onClick={() => onRemove(toast.id)} style={{ opacity: 0.7, flexShrink: 0 }}>
        <X size={14} />
      </button>
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="toast-container fixed bottom-5 right-5 z-50 flex flex-col gap-2 items-end">
        {toasts.map(t => <ToastItem key={t.id} toast={t} onRemove={removeToast} />)}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
