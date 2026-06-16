import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { useToast } from '../context/ToastContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { useAuth } from '../context/AuthContext'
import { isOwner } from '../utils/adminHelpers'
import BottomSheet from '../components/ui/BottomSheet'
import Modal from '../components/Modal'
import Spinner from '../components/Spinner'
import { Building2, Plus, Pencil, Trash2, Home, ChevronRight, MapPin, Upload } from 'lucide-react'
import { LOKALIZACJE_UNIKALNE } from '../utils/lokaleImportParser'

const TYPY = [
  { value: 'apartament', label: 'Apartament' },
  { value: 'pokoj', label: 'Pokój' },
  { value: 'studio', label: 'Studio' },
  { value: 'dom', label: 'Dom' },
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
  nazwa: '',
  adres: '',
  typ: 'apartament',
  pojemnosc: '2',
  lokalizacja_kod: '',
  domyslny_pakiet_id: '',
  notatki: '',
  aktywny: true,
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

export default function Lokale() {
  const { addToast } = useToast()
  const { workspaceId, wsQuery, addWsFilter, wsData } = useWorkspace()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const isMobile = useMobile()
  const ownerAccess = isOwner(profile)

  const [items, setItems] = useState([])
  const [pakiety, setPakiety] = useState([])
  const [loading, setLoading] = useState(true)
  const [tableExists, setTableExists] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [lokFilter, setLokFilter] = useState('')

  async function fetchData() {
    if (!workspaceId) { setLoading(false); return }
    const [{ data: lok, error }, { data: pak }] = await Promise.all([
      addWsFilter(wsQuery('lokale').select('*')).order('nazwa'),
      addWsFilter(wsQuery('pakiety_sprzatania').select('id, nazwa')).eq('aktywny', true).order('nazwa'),
    ])
    if (error) {
      if (error.code === '42P01') { setTableExists(false); setLoading(false); return }
      addToast(error.message, 'error')
    } else {
      setItems(lok || [])
      setTableExists(true)
    }
    setPakiety(pak || [])
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData() }, [workspaceId])

  function openCreate() {
    setEditItem(null)
    setForm(emptyForm)
    setErrors({})
    setShowForm(true)
  }

  function openEdit(item) {
    setEditItem(item)
    setForm({
      nazwa: item.nazwa || '',
      adres: item.adres || '',
      typ: item.typ || 'apartament',
      pojemnosc: item.pojemnosc != null ? String(item.pojemnosc) : '2',
      lokalizacja_kod: item.lokalizacja_kod || '',
      domyslny_pakiet_id: item.domyslny_pakiet_id || '',
      notatki: item.notatki || '',
      aktywny: item.aktywny !== false,
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

    const lokFound = LOKALIZACJE_UNIKALNE.find(l => l.kod === form.lokalizacja_kod)
    const payload = {
      nazwa: form.nazwa.trim(),
      adres: form.adres.trim() || null,
      typ: form.typ || 'apartament',
      pojemnosc: parseInt(form.pojemnosc, 10) || 2,
      lokalizacja_kod: form.lokalizacja_kod || null,
      lokalizacja: lokFound?.nazwa || null,
      domyslny_pakiet_id: form.domyslny_pakiet_id || null,
      notatki: form.notatki.trim() || null,
      aktywny: form.aktywny,
    }

    if (editItem) {
      const { error } = await supabase.from('lokale').update(payload).eq('id', editItem.id)
      if (error) { addToast(error.message, 'error') }
      else { addToast('Zaktualizowano lokal', 'success'); setShowForm(false); fetchData() }
    } else {
      const { error } = await supabase.from('lokale').insert([{ ...payload, ...wsData() }])
      if (error) { addToast(error.message, 'error') }
      else { addToast('Dodano lokal', 'success'); setShowForm(false); fetchData() }
    }
    setSaving(false)
  }

  async function handleDelete(item) {
    if (!window.confirm(`Usunąć lokal "${item.nazwa}"?`)) return
    const { error } = await supabase.from('lokale').delete().eq('id', item.id)
    if (error) { addToast(error.message, 'error') }
    else { addToast('Usunięto lokal', 'success'); fetchData() }
  }

  if (loading) return <Spinner />

  if (!tableExists) {
    return (
      <div className="text-center py-16 rounded-xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <Building2 size={40} className="mx-auto mb-3" style={{ color: 'var(--muted)', opacity: 0.4 }} />
        <p className="font-medium mb-1" style={{ color: 'var(--text)' }}>Moduł Lokale — wymaga migracji</p>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Uruchom migrations/lokale_rezerwacje_migration.sql w panelu Supabase, aby aktywować ten moduł.</p>
      </div>
    )
  }

  const pakietMap = Object.fromEntries(pakiety.map(p => [p.id, p.nazwa]))
  const hasLokalizacja = items.some(i => i.lokalizacja_kod)
  const filteredItems = lokFilter ? items.filter(i => i.lokalizacja_kod === lokFilter) : items

  const LokalForm = (
    <form onSubmit={handleSave} className="space-y-4">
      <div>
        <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Nazwa *</label>
        <input
          style={IS(errors.nazwa)}
          value={form.nazwa}
          onChange={e => setForm(f => ({ ...f, nazwa: e.target.value }))}
          placeholder="np. Apartament 3B"
        />
        {errors.nazwa && <p className="text-xs mt-1" style={{ color: '#dc2626' }}>Pole wymagane</p>}
      </div>

      <div>
        <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Adres</label>
        <input style={IS()} value={form.adres} onChange={e => setForm(f => ({ ...f, adres: e.target.value }))} placeholder="ul. Przykładowa 1/3" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Typ</label>
          <select style={IS()} value={form.typ} onChange={e => setForm(f => ({ ...f, typ: e.target.value }))}>
            {TYPY.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Pojemność (os.)</label>
          <input type="number" min="1" step="1" style={IS()} value={form.pojemnosc} onChange={e => setForm(f => ({ ...f, pojemnosc: e.target.value }))} />
        </div>
      </div>

      <div>
        <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Lokalizacja</label>
        <select style={IS()} value={form.lokalizacja_kod} onChange={e => setForm(f => ({ ...f, lokalizacja_kod: e.target.value }))}>
          <option value="">— brak —</option>
          {LOKALIZACJE_UNIKALNE.map(l => <option key={l.kod} value={l.kod}>{l.nazwa}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Domyślny pakiet sprzątania</label>
        <select style={IS()} value={form.domyslny_pakiet_id} onChange={e => setForm(f => ({ ...f, domyslny_pakiet_id: e.target.value }))}>
          <option value="">— brak —</option>
          {pakiety.map(p => <option key={p.id} value={p.id}>{p.nazwa}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Notatki</label>
        <textarea style={{ ...IS(), minHeight: 72, resize: 'vertical' }} value={form.notatki} onChange={e => setForm(f => ({ ...f, notatki: e.target.value }))} placeholder="Opcjonalne uwagi o lokalu…" />
      </div>

      <div className="flex items-center gap-2">
        <input type="checkbox" id="lok_aktywny" checked={form.aktywny} onChange={e => setForm(f => ({ ...f, aktywny: e.target.checked }))} style={{ accentColor: 'var(--c-action)', width: 16, height: 16 }} />
        <label htmlFor="lok_aktywny" className="text-sm" style={{ color: 'var(--text-2)' }}>Aktywny</label>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={() => setShowForm(false)} className="flex-1 rounded-lg text-sm font-medium" style={{ background: 'var(--table-sub)', color: 'var(--text-2)', minHeight: 48 }}>Anuluj</button>
        <button type="submit" disabled={saving} className="flex-1 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--c-action)', minHeight: 48, opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Zapisywanie…' : editItem ? 'Zapisz zmiany' : 'Dodaj lokal'}
        </button>
      </div>
    </form>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Lokale</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>{filteredItems.length} {filteredItems.length === 1 ? 'lokal' : 'lokale'}</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto flex-wrap">
          {hasLokalizacja && (
            <select
              value={lokFilter}
              onChange={e => setLokFilter(e.target.value)}
              style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', padding: '0 12px', fontSize: 13, minHeight: 44, flex: '1 1 auto' }}
            >
              <option value="">Wszystkie lokalizacje</option>
              {LOKALIZACJE_UNIKALNE.map(l => (
                <option key={l.kod} value={l.kod}>{l.nazwa}</option>
              ))}
            </select>
          )}
          {ownerAccess && (
            <Link
              to="/import-lokali"
              className="flex items-center gap-2 rounded-lg px-4 text-sm font-medium flex-shrink-0"
              style={{ background: 'var(--table-sub)', color: 'var(--text-2)', minHeight: 44, textDecoration: 'none' }}
            >
              <Upload size={15} /> Import CSV
            </Link>
          )}
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-lg px-4 text-sm font-medium text-white flex-shrink-0"
            style={{ background: 'var(--c-action)', minHeight: 44 }}
          >
            <Plus size={16} /> Nowy lokal
          </button>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="text-center py-16 rounded-xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <Building2 size={40} className="mx-auto mb-3" style={{ color: 'var(--muted)', opacity: 0.4 }} />
          <p className="font-medium mb-1" style={{ color: 'var(--text)' }}>{lokFilter ? 'Brak lokali w tej lokalizacji' : 'Brak lokali'}</p>
          <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>Dodaj apartament, pokój lub dom, aby śledzić rezerwacje i przygotowania.</p>
          <button onClick={openCreate} className="rounded-lg px-4 text-sm font-medium text-white" style={{ background: 'var(--c-action)', minHeight: 44 }}>
            + Nowy lokal
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map(item => {
            const pakietNazwa = item.domyslny_pakiet_id ? pakietMap[item.domyslny_pakiet_id] : null
            return (
              <div
                key={item.id}
                className="rounded-xl p-4 cursor-pointer"
                style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                onClick={() => navigate(`/lokale/${item.id}`)}
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-lg flex-shrink-0 flex items-center justify-center" style={{ width: 40, height: 40, background: 'rgba(59,130,246,0.1)' }}>
                    <Home size={18} style={{ color: 'var(--c-action)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate" style={{ color: 'var(--text)', fontSize: 15 }}>{item.nazwa}</p>
                    {item.adres && <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-2)' }}>{item.adres}</p>}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: 'var(--table-sub)', color: 'var(--text-2)' }}>
                        {TYPY.find(t => t.value === item.typ)?.label || item.typ}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--muted)' }}>{item.pojemnosc} os.</span>
                      {item.lokalizacja && (
                        <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: 'rgba(59,130,246,0.08)', color: 'var(--c-action)' }}>
                          <MapPin size={10} />{item.lokalizacja}
                        </span>
                      )}
                      {!item.aktywny && (
                        <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: '#fee2e2', color: '#991b1b' }}>Nieaktywny</span>
                      )}
                    </div>
                    {pakietNazwa && (
                      <p className="text-xs mt-1.5" style={{ color: 'var(--muted)' }}>
                        Pakiet: <span style={{ color: 'var(--text-2)' }}>{pakietNazwa}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0 items-center">
                    <button onClick={e => { e.stopPropagation(); openEdit(item) }} className="flex items-center justify-center rounded-lg" style={{ color: 'var(--text-2)', minWidth: 38, minHeight: 38 }} title="Edytuj">
                      <Pencil size={13} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); handleDelete(item) }} className="flex items-center justify-center rounded-lg" style={{ color: '#dc2626', minWidth: 38, minHeight: 38 }} title="Usuń">
                      <Trash2 size={13} />
                    </button>
                    <ChevronRight size={16} style={{ color: 'var(--muted)' }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {isMobile ? (
        <BottomSheet open={showForm} onClose={() => setShowForm(false)} title={editItem ? 'Edytuj lokal' : 'Nowy lokal'}>
          {LokalForm}
        </BottomSheet>
      ) : (
        showForm && (
          <Modal title={editItem ? 'Edytuj lokal' : 'Nowy lokal'} onClose={() => setShowForm(false)}>
            {LokalForm}
          </Modal>
        )
      )}
    </div>
  )
}
