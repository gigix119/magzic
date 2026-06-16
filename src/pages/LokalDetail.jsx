import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { useWorkspace } from '../context/WorkspaceContext'
import { useToast } from '../context/ToastContext'
import Modal from '../components/Modal'
import Spinner from '../components/Spinner'
import { LOKALIZACJE_UNIKALNE } from '../utils/lokaleImportParser'
import {
  ArrowLeft, Home, MapPin, Users, Package2, BedDouble,
  ClipboardList, Wrench, Pencil, CalendarDays, ExternalLink,
} from 'lucide-react'

const TYPY_LABELS = {
  apartament: 'Apartament',
  pokoj: 'Pokój',
  studio: 'Studio',
  dom: 'Dom',
}

const STATUS_REZ_COLORS = {
  wstepna:     { bg: '#f3f4f6', text: '#6b7280', label: 'Wstępna' },
  potwierdzona:{ bg: '#eff6ff', text: '#1e40af', label: 'Potwierdzona' },
  zameldowana: { bg: '#ecfdf5', text: '#065f46', label: 'Zameldowana' },
  wymeldowana: { bg: '#f0fdf4', text: '#166534', label: 'Wymeldowana' },
  anulowana:   { bg: '#fef2f2', text: '#991b1b', label: 'Anulowana' },
}

const STATUS_ZL_COLORS = {
  nowe:         { bg: '#eff6ff', text: '#1e40af', label: 'Nowe' },
  w_realizacji: { bg: '#fff7ed', text: '#9a3412', label: 'W realizacji' },
  gotowe:       { bg: '#ecfdf5', text: '#065f46', label: 'Gotowe' },
  anulowane:    { bg: '#f3f4f6', text: '#6b7280', label: 'Anulowane' },
}

const STATUS_NAP_COLORS = {
  zgloszone:     { bg: '#eff6ff', text: '#1e40af', label: 'Zgłoszone' },
  w_realizacji:  { bg: '#fff7ed', text: '#9a3412', label: 'W realizacji' },
  zakonczone:    { bg: '#ecfdf5', text: '#065f46', label: 'Zakończone' },
  zweryfikowane: { bg: '#f0fdf4', text: '#166534', label: 'Zweryfikowane' },
}

const IS = (err) => ({
  background: 'var(--input-bg)',
  border: `1px solid ${err ? '#ef4444' : 'var(--border)'}`,
  borderRadius: 8, color: 'var(--text)',
  padding: '10px 12px', fontSize: 16, width: '100%',
  outline: 'none', minHeight: 48, boxSizing: 'border-box',
})

export default function LokalDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { workspaceId, wsQuery, addWsFilter } = useWorkspace()

  const [lokal, setLokal] = useState(null)
  const [pakiet, setPakiet] = useState(null)
  const [rezerwacje, setRezerwacje] = useState([])
  const [zlecenia, setZlecenia] = useState([])
  const [naprawy, setNaprawy] = useState([])
  const [stats, setStats] = useState({ total: 0, avgNights: 0, occupancy: 0 })
  const [loading, setLoading] = useState(true)
  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [pakiety, setPakiety] = useState([])
  const [editSaving, setEditSaving] = useState(false)

  useEffect(() => { if (workspaceId) fetchData() }, [id, workspaceId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchData() {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]
    const monthStart = today.slice(0, 8) + '01'
    const nextMonth = new Date()
    nextMonth.setMonth(nextMonth.getMonth() + 1, 1)
    const monthEnd = nextMonth.toISOString().split('T')[0]

    const daysInMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 0).getDate()

    const [
      { data: lok },
      { data: upcomingRez },
      { data: monthRez },
      { data: zl },
      { data: nap },
      { data: pak },
    ] = await Promise.all([
      supabase.from('lokale').select('*').eq('id', id).single(),
      addWsFilter(wsQuery('rezerwacje').select('*'))
        .eq('lokal_id', id)
        .gte('checkin_at', today)
        .not('status', 'eq', 'anulowana')
        .order('checkin_at')
        .limit(3),
      addWsFilter(wsQuery('rezerwacje').select('checkin_at, checkout_at'))
        .eq('lokal_id', id)
        .gte('checkin_at', monthStart)
        .lt('checkin_at', monthEnd)
        .not('status', 'eq', 'anulowana'),
      addWsFilter(wsQuery('zlecenia').select('id, nazwa, status, data_realizacji'))
        .in('status', ['nowe', 'w_realizacji'])
        .order('data_realizacji')
        .limit(5),
      addWsFilter(wsQuery('naprawy').select('*'))
        .order('data_zgloszenia', { ascending: false })
        .limit(3),
      addWsFilter(wsQuery('pakiety_sprzatania').select('id, nazwa')).eq('aktywny', true).order('nazwa'),
    ])

    if (!lok) { navigate('/lokale'); return }
    setLokal(lok)
    setPakiety(pak || [])

    if (lok.domyslny_pakiet_id) {
      const found = (pak || []).find(p => p.id === lok.domyslny_pakiet_id)
      setPakiet(found || null)
    }

    setRezerwacje(upcomingRez || [])

    // Filter zlecenia linked to this lokal via rezerwacje
    const rezIds = [...(upcomingRez || []), ...(monthRez || [])].map(r => r.id)
    const lokNazwa = lok.nazwa
    // For active preps: look for those linked via rezerwacje by lokal_id
    // (join done in memory since we already have the data structure)
    const linkedPrzygIds = new Set()
    for (const r of [...(upcomingRez || [])]) {
      if (r.przygotowanie_id) linkedPrzygIds.add(r.przygotowanie_id)
    }
    setZlecenia((zl || []).filter(z => linkedPrzygIds.has(z.id)))

    // Naprawy: match by lokal name (naprawy.apartament is text)
    setNaprawy((nap || []).filter(n => n.apartament === lokNazwa))

    // Stats
    const allMonthRez = monthRez || []
    let totalDays = 0
    for (const r of allMonthRez) {
      const ci = new Date(r.checkin_at)
      const co = new Date(r.checkout_at)
      totalDays += Math.max(0, (co - ci) / 86400000)
    }
    const avgNights = allMonthRez.length > 0 ? (totalDays / allMonthRez.length).toFixed(1) : 0
    const occupancy = daysInMonth > 0 ? Math.min(100, Math.round((totalDays / daysInMonth) * 100)) : 0
    setStats({ total: allMonthRez.length, avgNights, occupancy })

    setLoading(false)
  }

  function openEdit() {
    setEditForm({
      nazwa: lokal.nazwa || '',
      adres: lokal.adres || '',
      typ: lokal.typ || 'apartament',
      pojemnosc: lokal.pojemnosc != null ? String(lokal.pojemnosc) : '2',
      lokalizacja_kod: lokal.lokalizacja_kod || '',
      domyslny_pakiet_id: lokal.domyslny_pakiet_id || '',
      notatki: lokal.notatki || '',
      aktywny: lokal.aktywny !== false,
    })
    setShowEdit(true)
  }

  async function handleEditSave(ev) {
    ev.preventDefault()
    if (!editForm.nazwa.trim()) return
    setEditSaving(true)
    const lokFound = LOKALIZACJE_UNIKALNE.find(l => l.kod === editForm.lokalizacja_kod)
    const payload = {
      nazwa: editForm.nazwa.trim(),
      adres: editForm.adres.trim() || null,
      typ: editForm.typ || 'apartament',
      pojemnosc: parseInt(editForm.pojemnosc, 10) || 2,
      lokalizacja_kod: editForm.lokalizacja_kod || null,
      lokalizacja: lokFound?.nazwa || null,
      domyslny_pakiet_id: editForm.domyslny_pakiet_id || null,
      notatki: editForm.notatki.trim() || null,
      aktywny: editForm.aktywny,
    }
    const { error } = await supabase.from('lokale').update(payload).eq('id', id)
    if (error) { addToast(error.message, 'error') }
    else { addToast('Zaktualizowano lokal', 'success'); setShowEdit(false); fetchData() }
    setEditSaving(false)
  }

  if (loading) return <Spinner />
  if (!lokal) return null

  const typLabel = TYPY_LABELS[lokal.typ] || lokal.typ

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <button
        onClick={() => navigate('/lokale')}
        className="flex items-center gap-1 text-sm mb-4"
        style={{ color: 'var(--text-2)', minHeight: 44, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        <ArrowLeft size={15} /> Wróć do Lokali
      </button>

      {/* Header card */}
      <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-start gap-3">
          <div className="rounded-lg flex-shrink-0 flex items-center justify-center" style={{ width: 48, height: 48, background: 'rgba(59,130,246,0.1)' }}>
            <Home size={22} style={{ color: 'var(--c-action)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold" style={{ fontSize: 20, color: 'var(--text)' }}>{lokal.nazwa}</h1>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: 'var(--table-sub)', color: 'var(--text-2)' }}>
                {typLabel}
              </span>
              <span className="flex items-center gap-1 text-sm" style={{ color: 'var(--text-2)' }}>
                <Users size={13} />{lokal.pojemnosc} os.
              </span>
              {!lokal.aktywny && (
                <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: '#fee2e2', color: '#991b1b' }}>Nieaktywny</span>
              )}
            </div>
            {lokal.adres && (
              <p className="flex items-center gap-1.5 text-sm mt-1.5" style={{ color: 'var(--text-2)' }}>
                <MapPin size={13} />{lokal.adres}
              </p>
            )}
            {lokal.lokalizacja && (
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium mt-1.5" style={{ background: 'rgba(59,130,246,0.08)', color: 'var(--c-action)' }}>
                <MapPin size={10} />{lokal.lokalizacja}
              </span>
            )}
            {pakiet && (
              <p className="flex items-center gap-1.5 text-sm mt-1" style={{ color: 'var(--text-2)' }}>
                <Package2 size={13} />
                Pakiet: <span style={{ color: 'var(--text)' }}>{pakiet.nazwa}</span>
              </p>
            )}
            {lokal.notatki && (
              <p className="text-sm mt-2" style={{ color: 'var(--text-2)', whiteSpace: 'pre-wrap' }}>{lokal.notatki}</p>
            )}
          </div>
          <button
            onClick={openEdit}
            className="flex-shrink-0 flex items-center gap-1 rounded-lg px-3 text-sm"
            style={{ color: 'var(--text-2)', minHeight: 44, border: '1px solid var(--border)', background: 'none', cursor: 'pointer' }}
          >
            <Pencil size={14} /> Edytuj
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Upcoming reservations */}
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)', background: 'var(--table-sub)' }}>
            <div className="flex items-center gap-2">
              <BedDouble size={15} style={{ color: 'var(--c-action)' }} />
              <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>Nadchodzące rezerwacje</p>
            </div>
            <Link
              to={`/operacje?tab=rezerwacje`}
              className="text-xs font-medium flex items-center gap-1"
              style={{ color: 'var(--c-action)', textDecoration: 'none' }}
            >
              Wszystkie <ExternalLink size={11} />
            </Link>
          </div>
          {rezerwacje.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: 'var(--muted)' }}>Brak nadchodzących rezerwacji</p>
          ) : (
            rezerwacje.map((r, i) => {
              const sc = STATUS_REZ_COLORS[r.status] || STATUS_REZ_COLORS.wstepna
              return (
                <div key={r.id} className="px-4 py-3" style={{ borderBottom: i < rezerwacje.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                        {r.gosc_nazwa || 'Gość'}
                        {r.liczba_gosci != null && <span style={{ color: 'var(--text-2)', fontWeight: 400 }}> · {r.liczba_gosci} os.</span>}
                      </p>
                      <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'var(--text-2)' }}>
                        <CalendarDays size={11} />
                        {r.checkin_at} – {r.checkout_at}
                      </p>
                    </div>
                    <span className="rounded-full px-2.5 py-0.5 text-xs font-medium flex-shrink-0" style={{ background: sc.bg, color: sc.text }}>
                      {sc.label}
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Active preparations */}
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)', background: 'var(--table-sub)' }}>
            <div className="flex items-center gap-2">
              <ClipboardList size={15} style={{ color: 'var(--c-attention)' }} />
              <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>Aktywne przygotowania</p>
            </div>
            <Link
              to="/operacje?tab=przygotowania"
              className="text-xs font-medium flex items-center gap-1"
              style={{ color: 'var(--c-action)', textDecoration: 'none' }}
            >
              Wszystkie <ExternalLink size={11} />
            </Link>
          </div>
          {zlecenia.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: 'var(--muted)' }}>Brak aktywnych przygotowań</p>
          ) : (
            zlecenia.map((z, i) => {
              const sc = STATUS_ZL_COLORS[z.status] || STATUS_ZL_COLORS.nowe
              return (
                <Link
                  key={z.id}
                  to={`/operacje/przygotowania/${z.id}`}
                  className="block px-4 py-3"
                  style={{ borderBottom: i < zlecenia.length - 1 ? '1px solid var(--border)' : 'none', textDecoration: 'none' }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm truncate" style={{ color: 'var(--text)' }}>{z.nazwa}</p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {z.data_realizacji && (
                        <span className="text-xs" style={{ color: 'var(--muted)' }}>{z.data_realizacji}</span>
                      )}
                      <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: sc.bg, color: sc.text }}>
                        {sc.label}
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })
          )}
        </div>

        {/* Recent repairs */}
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)', background: 'var(--table-sub)' }}>
            <div className="flex items-center gap-2">
              <Wrench size={15} style={{ color: 'var(--c-critical)' }} />
              <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>Ostatnie naprawy</p>
            </div>
            <Link
              to="/operacje?tab=naprawy"
              className="text-xs font-medium flex items-center gap-1"
              style={{ color: 'var(--c-action)', textDecoration: 'none' }}
            >
              Wszystkie <ExternalLink size={11} />
            </Link>
          </div>
          {naprawy.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: 'var(--muted)' }}>Brak zgłoszeń napraw</p>
          ) : (
            naprawy.map((n, i) => {
              const sc = STATUS_NAP_COLORS[n.status] || STATUS_NAP_COLORS.zgloszone
              return (
                <div key={n.id} className="px-4 py-3" style={{ borderBottom: i < naprawy.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm truncate" style={{ color: 'var(--text)' }}>{n.opis_problemu}</p>
                      {n.data_zgloszenia && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{n.data_zgloszenia}</p>
                      )}
                    </div>
                    <span className="rounded-full px-2.5 py-0.5 text-xs font-medium flex-shrink-0" style={{ background: sc.bg, color: sc.text }}>
                      {sc.label}
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Stats */}
        <div className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <p className="font-medium text-sm mb-3" style={{ color: 'var(--text)' }}>Ten miesiąc</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Rezerwacje', value: stats.total },
              { label: 'Śr. pobyt', value: stats.avgNights > 0 ? `${stats.avgNights} n.` : '—' },
              { label: 'Obłożenie', value: stats.occupancy > 0 ? `${stats.occupancy}%` : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="text-center rounded-lg p-3" style={{ background: 'var(--table-sub)' }}>
                <p className="text-xl font-semibold num" style={{ color: 'var(--text)' }}>{value}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>{label}</p>
              </div>
            ))}
          </div>
          {stats.occupancy > 0 && (
            <div className="mt-3">
              <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${stats.occupancy}%`, height: '100%', background: 'var(--c-action)', borderRadius: 3, transition: 'width 0.4s' }} />
              </div>
              <p className="text-xs mt-1 text-right" style={{ color: 'var(--muted)' }}>obłożenie</p>
            </div>
          )}
        </div>
      </div>

      {/* Edit modal */}
      {showEdit && (
        <Modal title="Edytuj lokal" onClose={() => setShowEdit(false)}>
          <form onSubmit={handleEditSave} className="space-y-4">
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Nazwa *</label>
              <input style={IS()} value={editForm.nazwa} onChange={e => setEditForm(f => ({ ...f, nazwa: e.target.value }))} placeholder="np. Apartament 3B" />
            </div>
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Adres</label>
              <input style={IS()} value={editForm.adres} onChange={e => setEditForm(f => ({ ...f, adres: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Typ</label>
                <select style={IS()} value={editForm.typ} onChange={e => setEditForm(f => ({ ...f, typ: e.target.value }))}>
                  {Object.entries(TYPY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Pojemność (os.)</label>
                <input type="number" min="1" style={IS()} value={editForm.pojemnosc} onChange={e => setEditForm(f => ({ ...f, pojemnosc: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Lokalizacja</label>
              <select style={IS()} value={editForm.lokalizacja_kod} onChange={e => setEditForm(f => ({ ...f, lokalizacja_kod: e.target.value }))}>
                <option value="">— brak —</option>
                {LOKALIZACJE_UNIKALNE.map(l => <option key={l.kod} value={l.kod}>{l.nazwa}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Domyślny pakiet</label>
              <select style={IS()} value={editForm.domyslny_pakiet_id} onChange={e => setEditForm(f => ({ ...f, domyslny_pakiet_id: e.target.value }))}>
                <option value="">— brak —</option>
                {pakiety.map(p => <option key={p.id} value={p.id}>{p.nazwa}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Notatki</label>
              <textarea style={{ ...IS(), minHeight: 72, resize: 'vertical' }} value={editForm.notatki} onChange={e => setEditForm(f => ({ ...f, notatki: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="ld_aktywny" checked={editForm.aktywny} onChange={e => setEditForm(f => ({ ...f, aktywny: e.target.checked }))} style={{ accentColor: 'var(--c-action)', width: 16, height: 16 }} />
              <label htmlFor="ld_aktywny" className="text-sm" style={{ color: 'var(--text-2)' }}>Aktywny</label>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowEdit(false)} className="flex-1 rounded-lg text-sm font-medium" style={{ background: 'var(--table-sub)', color: 'var(--text-2)', minHeight: 48 }}>Anuluj</button>
              <button type="submit" disabled={editSaving} className="flex-1 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--c-action)', minHeight: 48, opacity: editSaving ? 0.7 : 1 }}>
                {editSaving ? 'Zapisywanie…' : 'Zapisz zmiany'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
