import { useState } from 'react'
import { Bell, Check } from 'lucide-react'
import { supabase } from '../../../supabase'

export default function CreatePriceAlertResult({ data }) {
  const { matchedProduct, threshold, workspaceId } = data
  const [status, setStatus] = useState('idle') // idle | loading | done | error

  async function handleCreate() {
    if (status !== 'idle') return
    setStatus('loading')
    try {
      const { error } = await supabase
        .from('alerty_cenowe')
        .insert([{
          towar_id: matchedProduct.id,
          workspace_id: workspaceId,
          prog_procentowy: threshold,
          aktywny: true,
        }])
      if (error) throw error
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  if (!matchedProduct) return null

  return (
    <div
      className="rounded-xl px-4 py-3 flex flex-col gap-2"
      style={{ background: 'var(--table-sub)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-2">
        <Bell size={13} style={{ color: '#f59e0b', flexShrink: 0 }} />
        <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          Nowy alert cenowy
        </span>
      </div>
      <div className="text-sm" style={{ color: 'var(--text-2)' }}>
        Towar: <span style={{ color: 'var(--text)', fontWeight: 500 }}>{matchedProduct.nazwa}</span>
        &nbsp;·&nbsp;próg: <span style={{ color: 'var(--text)', fontWeight: 500 }}>{threshold}%</span>
      </div>
      <button
        onClick={handleCreate}
        disabled={status !== 'idle'}
        className="self-start flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-60"
        style={{
          background: status === 'done' ? 'rgba(34,197,94,0.12)' : status === 'error' ? 'rgba(239,68,68,0.10)' : 'rgba(59,130,246,0.12)',
          border: `1px solid ${status === 'done' ? 'rgba(34,197,94,0.3)' : status === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(59,130,246,0.25)'}`,
          color: status === 'done' ? '#16a34a' : status === 'error' ? '#dc2626' : '#3b82f6',
          cursor: status !== 'idle' ? 'default' : 'pointer',
        }}
      >
        {status === 'done'
          ? <><Check size={11} />Alert utworzony</>
          : status === 'error'
          ? 'Błąd — spróbuj ponownie'
          : status === 'loading'
          ? 'Tworzę…'
          : <><Bell size={11} />Utwórz alert</>
        }
      </button>
    </div>
  )
}
