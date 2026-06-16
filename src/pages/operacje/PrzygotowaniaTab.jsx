import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useToast } from '../../context/ToastContext'
import { useWorkspace } from '../../context/WorkspaceContext'
import { getZlecenieConfigFor } from '../../config/businessTypes'
import { getZlecenieIcon } from '../../components/ui/categoryIcon'
import Modal from '../../components/Modal'
import Spinner from '../../components/Spinner'
import { Plus, ChevronRight, CalendarDays, Users, BedDouble } from 'lucide-react'

const STATUS_COLORS = {
  nowe:         { bg: '#eff6ff', text: '#1e40af' },
  w_realizacji: { bg: '#fff7ed', text: '#9a3412' },
  gotowe:       { bg: '#ecfdf5', text: '#065f46' },
  anulowane:    { bg: '#f3f4f6', text: '#6b7280' },
}

const PRIORITY_COLORS = {
  niski:    { bg: '#f0fdf4', text: '#166534', label: 'Niski' },
  normalny: { bg: '#f8fafc', text: '#475569', label: 'Normalny' },
  pilny:    { bg: '#fef2f2', text: '#991b1b', label: 'Pilne' },
}

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
  nazwa: '',
  opis: '',
  data_realizacji: '',
  status: 'nowe',
  priorytet: 'normalny',
  kontrahent_id: '',
}

export default function PrzygotowaniaTab() {
  const { addToast } = useToast()
  const { workspaceId, wsQuery, addWsFilter, wsData, getBusinessCategory } = useWorkspace()
  const navigate = useNavigate()
  const businessCategory = getBusinessCategory()
  const config = getZlecenieConfigFor(businessCategory)
  const ZlecenieIcon = getZlecenieIcon(businessCategory)

  const [items, setItems] = useState([])
  const [kontrahenci, setKontrahenci] = useState([])
  const [rezMap, setRezMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  async function fetchData() {
    if (!workspaceId) { setLoading(false); return }
    const [{ data: z }, { data: k }] = await Promise.all([
      addWsFilter(wsQuery('zlecenia').select('*, zlecenia_pozycje(id, wydano)')).order('data_realizacji', { ascending: true, nullsFirst: false }),
      addWsFilter(wsQuery('kontrahenci').select('id, nazwa').eq('aktywny', true)).order('nazwa'),
    ])
    const zl = z || []
    setItems(zl)
    setKontrahenci(k || [])

    // Fetch linked rezerwacje for these zlecenia
    const ids = zl.map(i => i.id)
    if (ids.length > 0) {
      const { data: rez } = await supabase
        .from('rezerwacje')
        .select('przygotowanie_id, lokal_id, checkin_at, checkout_at, gosc_nazwa, liczba_gosci, lokale(nazwa)')
        .in('przygotowanie_id', ids)
      const map = {}
      for (const r of rez || []) {
        if (r.przygotowanie_id) map[r.przygotowanie_id] = r
      }
      setRezMap(map)
    } else {
      setRezMap({})
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
      nazwa: item.nazwa || '',
      opis: item.opis || '',
      data_realizacji: item.data_realizacji || '',
      status: item.status || 'nowe',
      priorytet: item.priorytet || 'normalny',
      kontrahent_id: item.kontrahent_id || '',
    })
    setErrors({})
    setShowForm(true)
  }

  function validate() {
    const e = {}
    if (!form.nazwa.trim()) e.nazwa = true
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSave(ev) {
    ev.preventDefault()
    if (!validate()) return
    setSaving(true)
    const payload = {
      nazwa: form.nazwa.trim(),
      opis: form.opis || null,
      data_realizacji: form.data_realizacji || null,
      status: form.status,
      priorytet: form.priorytet,
      kontrahent_id: form.kontrahent_id || null,
      updated_at: new Date().toISOString(),
    }
    let error
    if (editItem) {
      ({ error } = await supabase.from('zlecenia').update(payload).eq('id', editItem.id))
    } else {
      const { updated_at: _u, ...insertPayload } = payload
      ;({ error } = await supabase.from('zlecenia').insert([{ ...insertPayload, ...wsData() }]))
    }
    if (error) { addToast(error.message, 'error') }
    else {
      addToast(editItem ? 'Zaktualizowano' : 'Dodano', 'success')
      setShowForm(false)
      fetchData()
    }
    setSaving(false)
  }

  const statusTabs = [
    { key: 'all', label: 'Wszystkie' },
    { key: 'nowe', label: config.statusLabels.nowe },
    { key: 'w_realizacji', label: config.statusLabels.w_realizacji },
    { key: 'gotowe', label: config.statusLabels.gotowe },
  ]

  const namePlaceholder = businessCategory === 'hospitality'
    ? 'np. Apartament 3B — checkout 15.06, check-in 16.06'
    : config.namePlaceholder

  if (loading) return <Spinner />

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>
          {config.moduleLabel}
        </h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg px-4 text-sm font-medium text-white w-full sm:w-auto justify-center"
          style={{ background: 'var(--c-action)', minHeight: 48 }}
        >
          <Plus size={16} /> {config.createLabel}
        </button>
      </div>

      {/* Status filter chips */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {statusTabs.map(tab => (
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
          <ZlecenieIcon size={40} className="mx-auto mb-3" style={{ color: 'var(--muted)', opacity: 0.4 }} />
          <p className="font-medium mb-1" style={{ color: 'var(--text)' }}>
            {businessCategory === 'hospitality' ? 'Brak przygotowań' : config.emptyTitle}
          </p>
          <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
            {businessCategory === 'hospitality'
              ? 'Utwórz przygotowanie obiektu, aby zaplanować wydanie materiałów i kontrolę.'
              : config.emptyDescription}
          </p>
          <button onClick={openCreate} className="rounded-lg px-4 text-sm font-medium text-white" style={{ background: 'var(--c-action)', minHeight: 44 }}>
            + {config.createLabel}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => {
            const sc = STATUS_COLORS[item.status] || STATUS_COLORS.nowe
            const pc = PRIORITY_COLORS[item.priorytet] || PRIORITY_COLORS.normalny
            const pozycje = item.zlecenia_pozycje || []
            const total = pozycje.length
            const wydano = pozycje.filter(p => p.wydano).length
            const progressPct = total > 0 ? Math.round((wydano / total) * 100) : 0
            const rez = rezMap[item.id]

            return (
              <div
                key={item.id}
                className="rounded-xl overflow-hidden cursor-pointer"
                style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                onClick={() => navigate(`/operacje/przygotowania/${item.id}`)}
              >
                <div className="px-4 py-4">
                  {/* Reservation context row */}
                  {rez && (
                    <div className="flex items-center gap-2 mb-2">
                      <BedDouble size={13} style={{ color: 'var(--c-success)', flexShrink: 0 }} />
                      <p className="text-xs truncate" style={{ color: 'var(--text-2)' }}>
                        {rez.lokale?.nazwa || '—'}
                        {rez.gosc_nazwa && <> · {rez.gosc_nazwa}</>}
                        {rez.liczba_gosci != null && <> · <Users size={10} className="inline" /> {rez.liczba_gosci} os.</>}
                        {rez.checkin_at && <> · {rez.checkin_at}–{rez.checkout_at}</>}
                      </p>
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold" style={{ color: 'var(--text)', fontSize: 16 }}>{item.nazwa}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap" style={{ fontSize: 13 }}>
                        {item.data_realizacji && (
                          <span className="flex items-center gap-1" style={{ color: 'var(--muted)' }}>
                            <CalendarDays size={12} />
                            {new Date(item.data_realizacji).toLocaleDateString('pl-PL')}
                          </span>
                        )}
                        {item.priorytet === 'pilny' && (
                          <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: pc.bg, color: pc.text }}>
                            {pc.label}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: sc.bg, color: sc.text }}>
                          {config.statusLabels[item.status] || item.status}
                        </span>
                        {total > 0 && (
                          <span className="text-xs num" style={{ color: 'var(--muted)' }}>
                            {wydano}/{total} wydano
                          </span>
                        )}
                      </div>

                      {/* Progress bar */}
                      {total > 0 && (
                        <div className="mt-2" style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', maxWidth: 200 }}>
                          <div style={{ width: `${progressPct}%`, height: '100%', background: progressPct === 100 ? 'var(--c-success)' : 'var(--c-action)', borderRadius: 2, transition: 'width 0.3s' }} />
                        </div>
                      )}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/operacje/przygotowania/${item.id}`) }}
                      className="flex items-center gap-1 rounded-lg px-2 text-sm font-medium flex-shrink-0"
                      style={{ color: 'var(--c-action)', minHeight: 44 }}
                    >
                      Otwórz <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create / Edit modal */}
      {showForm && (
        <Modal
          title={editItem ? `Edytuj ${config.singularLabel.toLowerCase()}` : config.createLabel}
          onClose={() => setShowForm(false)}
        >
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>{config.nameLabel} *</label>
              <input
                style={IS(errors.nazwa)}
                value={form.nazwa}
                onChange={e => setForm(f => ({ ...f, nazwa: e.target.value }))}
                placeholder={namePlaceholder}
              />
              {errors.nazwa && <p className="text-xs mt-1" style={{ color: '#dc2626' }}>Pole wymagane</p>}
            </div>
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>{config.descriptionLabel}</label>
              <textarea
                style={{ ...IS(), minHeight: 72, height: 72, resize: 'vertical' }}
                value={form.opis}
                onChange={e => setForm(f => ({ ...f, opis: e.target.value }))}
                placeholder="Opcjonalne notatki..."
              />
            </div>
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>{config.dateLabel}</label>
              <input
                type="date"
                style={IS()}
                value={form.data_realizacji}
                onChange={e => setForm(f => ({ ...f, data_realizacji: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Priorytet</label>
              <div className="flex gap-2">
                {['niski', 'normalny', 'pilny'].map(p => {
                  const pc2 = PRIORITY_COLORS[p]
                  const active = form.priorytet === p
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, priorytet: p }))}
                      className="flex-1 rounded-lg text-sm font-medium transition-colors"
                      style={{
                        minHeight: 44,
                        background: active ? pc2.bg : 'var(--card)',
                        color: active ? pc2.text : 'var(--text-2)',
                        border: `1px solid ${active ? pc2.text : 'var(--border)'}`,
                      }}
                    >
                      {pc2.label}
                    </button>
                  )
                })}
              </div>
            </div>
            {kontrahenci.length > 0 && (
              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Kontrahent (opcjonalnie)</label>
                <select
                  style={{ ...IS(), cursor: 'pointer' }}
                  value={form.kontrahent_id}
                  onChange={e => setForm(f => ({ ...f, kontrahent_id: e.target.value }))}
                >
                  <option value="">— brak —</option>
                  {kontrahenci.map(k => <option key={k.id} value={k.id}>{k.nazwa}</option>)}
                </select>
              </div>
            )}
            {editItem && (
              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Status</label>
                <select
                  style={{ ...IS(), cursor: 'pointer' }}
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                >
                  {Object.entries(config.statusLabels).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 rounded-lg text-sm font-medium"
                style={{ background: 'var(--table-sub)', color: 'var(--text-2)', minHeight: 48 }}
              >
                Anuluj
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-lg text-sm font-medium text-white"
                style={{ background: 'var(--c-action)', minHeight: 48, opacity: saving ? 0.7 : 1 }}
              >
                {saving ? 'Zapisywanie…' : 'Zapisz'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
