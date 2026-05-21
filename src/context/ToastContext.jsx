import { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle2, XCircle, X } from 'lucide-react'

const ToastContext = createContext()

function ToastItem({ toast, onRemove }) {
  const ok = toast.type === 'success'
  return (
    <div
      className="flex items-start gap-3 rounded-xl px-4 py-3 shadow-2xl text-sm font-medium"
      style={{
        background: ok ? '#052e16' : '#450a0a',
        border: `1px solid ${ok ? '#166534' : '#991b1b'}`,
        color: ok ? '#86efac' : '#fca5a5',
        minWidth: 280,
        maxWidth: 420,
        animation: 'slideInToast 0.22s ease-out',
      }}
    >
      {ok
        ? <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 1 }} />
        : <XCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
      }
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
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 items-end">
        {toasts.map(t => <ToastItem key={t.id} toast={t} onRemove={removeToast} />)}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
