import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'
import { useToast } from '../../context/ToastContext'
import { useWorkspace } from '../../context/WorkspaceContext'
import { canTransitionRepair, buildRepairFromInput } from '../../domain/commands'
import BottomSheet from '../../components/ui/BottomSheet'
import Modal from '../../components/Modal'
import Spinner from '../../components/Spinner'
import { Plus, Wrench, CalendarDays, ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react'

const STATUS_COLORS = {
  zgloszone:     { bg: '#eff6ff', text: '#1e40af', label: 'Zgłoszone' },
  w_realizacji:  { bg: '#fff7ed', text: '#9a3412', label: 'W realizacji' },
  zakonczone:    { bg: '#ecfdf5', text: '#065f46', label: 'Zakończone' },
  zweryfikowane: { bg: '#f0fdf4', text: '#166534', label: 'Zweryfikowane' },
}

const PRIORITY_COLORS = {
  niski:   { bg: '#f0fdf4', text: '#166534', label: 'Niski' },
  normalny: { bg: '#f8fafc', text: '#475569', label: 'Normalny' },
  pilne:   { bg: '#fef2f2', text: '#991b1b', label: 'Pilne' },
}

const STATUS_FILTER_TABS = [
  { key: 'all',          label: 'Wszystkie' },
  { key: 'zgloszone',    label: 'Zgłoszone' },
  { key: 'w_realizacji', label: 'W realizacji' },
  { key: 'zakonczone',   label: 'Zakończone' },
]

const IS = (err) => ({
  background: 'var(--input-bg)',
  border: `1px solid ${err ? '#ef4444' : 'var(--border)'}`,
  borderRadius: 8,
  color: 'var(--text)',
  padding: '10px 12px',
  fontSize: 16,
  width: '100%',
  outline: 'none',
  minHeight: 48,
  boxSizing: 'border-box',
})

const emptyForm = {
  apartament: '',
  opis_problemu: '',
  priorytet: 'normalny',
  data_realizacji: '',
  notatka_technika: '',
  koszt_szacunkowy: '',
}

function useMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return isMobile
}

export default function NaprawyTab() {
  const { addToast } = useToast()
  const { workspaceId, wsQuery, addWsFilter, wsData } = useWorkspace()
  const isMobile = useMobile()

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [tableExists, setTableExists] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  async function fetchData() {
    if (!workspaceId) { setLoading(false); return }
    const { data, error } = await addWsFilter(
      wsQuery('naprawy').select('*')
    ).order('data_zgloszenia', { ascending: false })

    if (error) {
      if (error.code === '42P01') { setTableExists(false); setLoading(false); return }
      console.error(error)
      addToast(error.message, 'error')
    } else {
      setItems(data || [])
      setTableExists(true)
    }
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData() }, [workspaceId])

  const filtered = statusFilter === 'all' ? items : items.filter(i => i.status === statusFilter)

  function openCreate() {
    setEditItem(null)
    setForm(emptyForm)
    setErrors({})
    setShowForm(true)
  }

  function openEdit(ev, item) {
    ev.stopPropagation()
    setEditItem(item)
    setForm({
      apartament: item.apartament || '',
      opis_problemu: item.opis_problemu || '',
      priorytet: item.priorytet || 'normalny',
      data_realizacji: item.data_realizacji || '',
      notatka_technika: item.notatka_technika || '',
      koszt_szacunkowy: item.koszt_szacunkowy != null ? String(item.koszt_szacunkowy) : '',
    })
    setErrors({})
    setShowForm(true)
  }

  function validate() {
    const e = {}
    if (!form.apartament.trim()) e.apartament = true
    if (!form.opis_problemu.trim()) e.opis_problemu = true
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSave(ev) {
    ev.preventDefault()
    if (!validate()) return
    setSaving(true)

    if (editItem) {
      const payload = {
        apartament: form.apartament.trim(),
        opis_problemu: form.opis_problemu.trim(),
        priorytet: form.priorytet,
        data_realizacji: form.data_realizacji || null,
        notatka_technika: form.notatka_technika || null,
        koszt_szacunkowy: form.koszt_szacunkowy ? Number(form.koszt_szacunkowy) : null,
        updated_at: new Date().toISOString(),
      }
      const { error } = await supabase.from('naprawy').update(payload).eq('id', editItem.id)
      if (error) { addToast(error.message, 'error') }
      else { addToast('Zaktualizowano naprawę', 'success'); setShowForm(false); fetchData() }
    } else {
      const draft = buildRepairFromInput(form)
      const { error } = await supabase.from('naprawy').insert([{ ...draft, ...wsData() }])
      if (error) { addToast(error.message, 'error') }
      else { addToast('Zgłoszono naprawę', 'success'); setShowForm(false); fetchData() }
    }
    setSaving(false)
  }

  async function changeStatus(item, newStatus) {
    if (!canTransitionRepair(item.status, newStatus)) {
      addToast('Niedozwolone przejście statusu', 'error')
      return
    }
    const { error } = await supabase
      .from('naprawy')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', item.id)
    if (error) { addToast(error.message, 'error') }
    else { setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: newStatus } : i)) }
  }

  async function handleDelete(item) {
    if (!window.confirm('Usunąć zgłoszenie naprawy?')) return
    const { error } = await supabase.from('naprawy').delete().eq('id', item.id)
    if (error) { addToast(error.message, 'error') }
    else { addToast('Usunięto', 'success'); fetchData() }
  }

  if (loading) return <Spinner />

  if (!tableExists) {
    return (
      <div className="text-center py-16 rounded-xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <Wrench size={40} className="mx-auto mb-3" style={{ color: 'var(--muted)', opacity: 0.4 }} />
        <p className="font-medium mb-1" style={{ color: 'var(--text)' }}>Moduł Naprawy — wymaga migracji</p>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Uruchom migrations/naprawy_migration.sql w panelu Supabase, aby aktywować ten moduł.</p>
      </div>
    )
  }

  const RepairForm = (
    <form onSubmit={handleSave} className="space-y-4">
      <div>
        <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Apartament / obiekt *</label>
        <input
          style={IS(errors.apartament)}
          value={form.apartament}
          onChange={e => setForm(f => ({ ...f, apartament: e.target.value }))}
          placeholder='np. Apartament 3B'
        />
        {errors.apartament && <p className="text-xs mt-1" style={{ color: '#dc2626' }}>Pole wymagane</p>}
      </div>
      <div>
        <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Opis problemu *</label>
        <textarea
          style={{ ...IS(errors.opis_problemu), minHeight: 80, resize: 'vertical' }}
          value={form.opis_problemu}
          onChange={e => setForm(f => ({ ...f, opis_problemu: e.target.value }))}
          placeholder='Opisz usterki lub prace do wykonania…'
        />
        {errors.opis_problemu && <p className="text-xs mt-1" style={{ color: '#dc2626' }}>Pole wymagane</p>}
      </div>
      <div>
        <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Priorytet</label>
        <div className="flex gap-2">
          {['niski', 'normalny', 'pilne'].map(p => {
            const pc = PRIORITY_COLORS[p]
            const active = form.priorytet === p
            return (
              <button
                key={p}
                type="button"
                onClick={() => setForm(f => ({ ...f, priorytet: p }))}
                className="flex-1 rounded-lg text-sm font-medium transition-colors"
                style={{ minHeight: 44, background: active ? pc.bg : 'var(--card)', color: active ? pc.text : 'var(--text-2)', border: `1px solid ${active ? pc.text : 'var(--border)'}` }}
              >
                {pc.label}
              </button>
            )
          })}
        </div>
      </div>
      <div>
        <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Planowana data realizacji</label>
        <input type="date" style={IS()} value={form.data_realizacji} onChange={e => setForm(f => ({ ...f, data_realizacji: e.target.value }))} />
      </div>
      <div>
        <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Notatka technika</label>
        <textarea
          style={{ ...IS(), minHeight: 60, resize: 'vertical' }}
          value={form.notatka_technika}
          onChange={e => setForm(f => ({ ...f, notatka_technika: e.target.value }))}
          placeholder='Co zrobiono, co wymieniono…'
        />
      </div>
      <div>
        <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Koszt szacunkowy (zł)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          style={IS()}
          value={form.koszt_szacunkowy}
          onChange={e => setForm(f => ({ ...f, koszt_szacunkowy: e.target.value }))}
          placeholder='np. 250.00'
        />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={() => setShowForm(false)} className="flex-1 rounded-lg text-sm font-medium" style={{ background: 'var(--table-sub)', color: 'var(--text-2)', minHeight: 48 }}>
          Anuluj
        </button>
        <button type="submit" disabled={saving} className="flex-1 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--c-action)', minHeight: 48, opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Zapisywanie…' : editItem ? 'Zapisz zmiany' : 'Zgłoś naprawę'}
        </button>
      </div>
    </form>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Naprawy</h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg px-4 text-sm font-medium text-white w-full sm:w-auto justify-center"
          style={{ background: 'var(--c-action)', minHeight: 48 }}
        >
          <Plus size={16} /> Nowa naprawa
        </button>
      </div>

      {/* Status filter chips */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {STATUS_FILTER_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className="rounded-full px-4 text-sm font-medium flex-shrink-0 transition-colors"
            style={{
              minHeight: 44,
              background: statusFilter === tab.key ? 'var(--c-action)' : 'var(--card)',
              color: statusFilter === tab.key ? '#fff' : 'var(--text-2)',
              border: `1px solid ${statusFilter === tab.key ? 'var(--c-action)' : 'var(--border)'}`,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List / empty state */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 rounded-xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <Wrench size={40} className="mx-auto mb-3" style={{ color: 'var(--muted)', opacity: 0.4 }} />
          <p className="font-medium mb-1" style={{ color: 'var(--text)' }}>Brak zgłoszeń</p>
          <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>Dodaj naprawę, aby śledzić prace techniczne w apartamentach.</p>
          <button onClick={openCreate} className="rounded-lg px-4 text-sm font-medium text-white" style={{ background: 'var(--c-action)', minHeight: 44 }}>
            + Nowa naprawa
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => {
            const sc = STATUS_COLORS[item.status] || STATUS_COLORS.zgloszone
            const pc = PRIORITY_COLORS[item.priorytet] || PRIORITY_COLORS.normalny
            const isOpen = expanded === item.id
            const nextStatuses = {
              zgloszone:     ['w_realizacji'],
              w_realizacji:  ['zakonczone'],
              zakonczone:    ['zweryfikowane', 'w_realizacji'],
              zweryfikowane: [],
            }[item.status] || []

            return (
              <div key={item.id} className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <div
                  className="px-4 py-4 cursor-pointer"
                  onClick={() => setExpanded(isOpen ? null : item.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg flex-shrink-0 flex items-center justify-center" style={{ width: 40, height: 40, background: 'rgba(239,68,68,0.08)' }}>
                      <Wrench size={18} style={{ color: 'var(--c-critical)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold" style={{ color: 'var(--text)', fontSize: 15 }}>{item.apartament}</p>
                      <p className="text-sm mt-0.5 line-clamp-2" style={{ color: 'var(--text-2)' }}>{item.opis_problemu}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: sc.bg, color: sc.text }}>{sc.label}</span>
                        {item.priorytet !== 'normalny' && (
                          <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: pc.bg, color: pc.text }}>{pc.label}</span>
                        )}
                        {item.data_realizacji && (
                          <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--muted)' }}>
                            <CalendarDays size={11} />
                            {new Date(item.data_realizacji).toLocaleDateString('pl-PL')}
                          </span>
                        )}
                        {item.koszt_szacunkowy != null && (
                          <span className="text-xs" style={{ color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
                            {Number(item.koszt_szacunkowy).toFixed(2)} zł
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={ev => openEdit(ev, item)}
                        className="flex items-center justify-center rounded-lg"
                        style={{ color: 'var(--text-2)', minWidth: 38, minHeight: 38 }}
                        title="Edytuj"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={ev => { ev.stopPropagation(); handleDelete(item) }}
                        className="flex items-center justify-center rounded-lg"
                        style={{ color: '#dc2626', minWidth: 38, minHeight: 38 }}
                        title="Usuń"
                      >
                        <Trash2 size={13} />
                      </button>
                      <div style={{ color: 'var(--muted)' }}>
                        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>
                  </div>
                </div>

                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--border)', background: 'var(--table-sub)' }} className="px-4 py-3 space-y-3">
                    {item.notatka_technika && (
                      <div>
                        <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-2)' }}>Notatka technika</p>
                        <p className="text-sm" style={{ color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{item.notatka_technika}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-2)' }}>Zmień status</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(STATUS_COLORS).map(([key, col]) => {
                          const isActive = item.status === key
                          const isAllowed = nextStatuses.includes(key)
                          if (!isActive && !isAllowed) return null
                          return (
                            <button
                              key={key}
                              onClick={() => !isActive && changeStatus(item, key)}
                              disabled={isActive}
                              className="rounded-lg text-xs font-medium px-3"
                              style={{
                                minHeight: 36,
                                background: isActive ? col.bg : 'var(--card)',
                                color: isActive ? col.text : 'var(--text-2)',
                                border: `2px solid ${isActive ? col.text : 'var(--border)'}`,
                                opacity: isActive ? 1 : 0.9,
                                cursor: isActive ? 'default' : 'pointer',
                              }}
                            >
                              {col.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Form — BottomSheet on mobile, Modal on desktop */}
      {isMobile ? (
        <BottomSheet
          open={showForm}
          onClose={() => setShowForm(false)}
          title={editItem ? 'Edytuj naprawę' : 'Nowa naprawa'}
        >
          {RepairForm}
        </BottomSheet>
      ) : (
        showForm && (
          <Modal title={editItem ? 'Edytuj naprawę' : 'Nowa naprawa'} onClose={() => setShowForm(false)}>
            {RepairForm}
          </Modal>
        )
      )}
    </div>
  )
}
