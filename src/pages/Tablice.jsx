import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useToast } from '../context/ToastContext'
import { useWorkspace } from '../context/WorkspaceContext'
import Modal from '../components/Modal'
import Spinner from '../components/Spinner'
import EmptyState from '../components/ui/EmptyState'
import { Kanban, Plus, LayoutGrid } from 'lucide-react'
import { TABLICA_COLORS, TYP_OPTIONS, TYP_LABELS } from './tablice/tablicaTokens'

const inputStyle = {
  background: 'var(--input-bg)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-control)',
  color: 'var(--text)',
  padding: '10px 12px',
  fontSize: 16,
  width: '100%',
  outline: 'none',
  minHeight: 48,
  boxSizing: 'border-box',
}

export default function Tablice() {
  const { addToast } = useToast()
  const { workspaceId, wsQuery, addWsFilter } = useWorkspace()
  const navigate = useNavigate()

  const [boards, setBoards] = useState([])
  const [cardCounts, setCardCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ nazwa: '', typ: 'ogolna', kolor: TABLICA_COLORS[0].value })

  async function fetchData() {
    if (!workspaceId) { setLoading(false); return }
    const [{ data: tablice, error }, { data: karty }] = await Promise.all([
      addWsFilter(wsQuery('tablice').select('*')).eq('archiwum', false).order('pozycja'),
      addWsFilter(wsQuery('karty').select('tablica_id')).eq('archiwum', false),
    ])
    if (error) {
      addToast(error.message, 'error')
    } else {
      setBoards(tablice || [])
      const counts = {}
      for (const k of karty || []) counts[k.tablica_id] = (counts[k.tablica_id] || 0) + 1
      setCardCounts(counts)
    }
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData() }, [workspaceId])

  function openCreate() {
    setForm({ nazwa: '', typ: 'ogolna', kolor: TABLICA_COLORS[Math.floor(Math.random() * TABLICA_COLORS.length)].value })
    setShowCreate(true)
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.nazwa.trim()) return
    setSaving(true)
    const { data: newId, error } = await supabase.rpc('utworz_tablice_z_szablonu', {
      p_workspace_id: workspaceId,
      p_typ: form.typ,
      p_nazwa: form.nazwa.trim(),
    })
    if (error) {
      addToast(error.message, 'error')
      setSaving(false)
      return
    }
    await supabase.from('tablice').update({ kolor_tla: form.kolor }).eq('id', newId)
    setSaving(false)
    setShowCreate(false)
    navigate(`/tablice/${newId}`)
  }

  const sortedBoards = useMemo(() => [...boards].sort((a, b) => a.pozycja - b.pozycja), [boards])

  if (loading) return <Spinner />

  return (
    <div>
      <div className="flex items-center justify-between mb-5 page-header">
        <div className="flex items-center gap-2">
          <Kanban size={20} style={{ color: 'var(--c-action)' }} />
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Tablice</h1>
        </div>
      </div>

      {sortedBoards.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="Brak tablic"
          description="Utwórz pierwszą tablicę, by zacząć organizować zadania w stylu Kanban."
          action={
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-4 rounded-[var(--radius-control)] text-sm font-medium text-white"
              style={{ background: 'var(--c-action)', minHeight: 44 }}
            >
              <Plus size={16} /> Nowa tablica
            </button>
          }
        />
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
          {sortedBoards.map(board => (
            <button
              key={board.id}
              onClick={() => navigate(`/tablice/${board.id}`)}
              className="text-left rounded-[var(--radius-card)] p-4 flex flex-col justify-between transition-transform"
              style={{
                background: board.kolor_tla || '#5B8DEF',
                minHeight: 120,
                boxShadow: 'var(--shadow-sm)',
                color: '#fff',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = 'var(--shadow-sm)' }}
            >
              <div>
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium mb-2"
                  style={{ background: 'rgba(255,255,255,0.22)' }}
                >
                  {TYP_LABELS[board.typ] || board.typ}
                </span>
                <h3 className="font-semibold text-[15px] leading-snug">{board.nazwa}</h3>
              </div>
              <div className="text-xs opacity-90 mt-3">
                {cardCounts[board.id] || 0} {(cardCounts[board.id] || 0) === 1 ? 'karta' : 'kart'}
              </div>
            </button>
          ))}

          <button
            onClick={openCreate}
            className="rounded-[var(--radius-card)] flex flex-col items-center justify-center gap-1.5 transition-colors"
            style={{
              minHeight: 120,
              border: '1.5px dashed var(--border)',
              color: 'var(--muted)',
              background: 'var(--hover-bg)',
            }}
          >
            <Plus size={20} />
            <span className="text-sm font-medium">Nowa tablica</span>
          </button>
        </div>
      )}

      {showCreate && (
        <Modal title="Nowa tablica" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Nazwa</label>
              <input
                autoFocus
                style={inputStyle}
                value={form.nazwa}
                onChange={e => setForm(f => ({ ...f, nazwa: e.target.value }))}
                placeholder="np. Sprzątanie — czerwiec"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Typ</label>
              <div className="flex gap-2 flex-wrap">
                {TYP_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, typ: opt.value }))}
                    className="px-3 rounded-[var(--radius-control)] text-sm font-medium transition-colors"
                    style={{
                      minHeight: 40,
                      background: form.typ === opt.value ? 'var(--c-action)' : 'var(--hover-bg)',
                      color: form.typ === opt.value ? '#fff' : 'var(--text-2)',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Kolor</label>
              <div className="flex gap-2 flex-wrap">
                {TABLICA_COLORS.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.label}
                    onClick={() => setForm(f => ({ ...f, kolor: c.value }))}
                    className="rounded-full transition-transform"
                    style={{
                      width: 32, height: 32,
                      background: c.value,
                      outline: form.kolor === c.value ? '2px solid var(--text)' : 'none',
                      outlineOffset: 2,
                      transform: form.kolor === c.value ? 'scale(1.1)' : 'none',
                    }}
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={saving || !form.nazwa.trim()}
              className="rounded-[var(--radius-control)] text-sm font-medium text-white mt-1"
              style={{ background: 'var(--c-action)', minHeight: 44, opacity: saving ? 0.6 : 1 }}
            >
              {saving ? 'Tworzenie…' : 'Utwórz tablicę'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}
