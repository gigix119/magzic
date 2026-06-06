import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useToast } from '../context/ToastContext'
import { useWorkspace } from '../context/WorkspaceContext'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import Spinner from '../components/Spinner'
import { Plus, Search, Users, Phone, Mail, Pencil, Trash2, AlertTriangle } from 'lucide-react'
import { isFkViolation, getContractorDeleteAction, buildFakturyCount } from '../utils/contractorDeleteLogic'

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

const empty = { nazwa: '', nip: '', email: '', telefon: '', adres: '', aktywny: true }

export default function Kontrahenci() {
  const { addToast } = useToast()
  const { workspaceId, wsQuery, addWsFilter, wsData } = useWorkspace()
  const [items, setItems] = useState([])
  const [fakturyCount, setFakturyCount] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [form, setForm] = useState(empty)
  const [deactivateTarget, setDeactivateTarget] = useState(null)
  const [deactivating, setDeactivating] = useState(false)

  async function fetchData() {
    if (!workspaceId) { setLoading(false); return }
    const [{ data: k, error: e1 }, { data: f }] = await Promise.all([
      addWsFilter(wsQuery('kontrahenci').select('*')).order('nazwa'),
      addWsFilter(wsQuery('faktury').select('kontrahent_id')),
    ])
    if (e1) { console.error(e1); addToast(e1.message, 'error') }
    setItems(k || [])
    setFakturyCount(buildFakturyCount(f))
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchData() }, [workspaceId])

  const filtered = items.filter(i => {
    const matchSearch =
      i.nazwa.toLowerCase().includes(search.toLowerCase()) ||
      (i.nip || '').includes(search) ||
      (i.email || '').toLowerCase().includes(search.toLowerCase())
    const matchStatus =
      statusFilter === 'all' ? true :
      statusFilter === 'active' ? i.aktywny !== false :
      i.aktywny === false
    return matchSearch && matchStatus
  })

  function openCreate() { setEditItem(null); setForm(empty); setErrors({}); setShowModal(true) }

  function openEdit(item) {
    setEditItem(item)
    setForm({ nazwa: item.nazwa || '', nip: item.nip || '', email: item.email || '', telefon: item.telefon || '', adres: item.adres || '', aktywny: item.aktywny })
    setErrors({})
    setShowModal(true)
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
      nazwa: form.nazwa.trim(), nip: form.nip || null, email: form.email || null,
      telefon: form.telefon || null, adres: form.adres || null, aktywny: form.aktywny,
    }
    let error
    if (editItem) {
      ({ error } = await supabase.from('kontrahenci').update(payload).eq('id', editItem.id))
    } else {
      ({ error } = await supabase.from('kontrahenci').insert([{ ...payload, ...wsData() }]))
    }
    if (error) { console.error(error); addToast(error.message, 'error') }
    else { addToast(editItem ? 'Kontrahent zaktualizowany' : 'Kontrahent dodany', 'success'); setShowModal(false); fetchData() }
    setSaving(false)
  }

  async function handleDelete(item) {
    const count = fakturyCount[item.id] || 0
    if (getContractorDeleteAction(count) === 'deactivate_only') {
      setDeactivateTarget({ item, count, reason: 'has_invoices' })
      return
    }
    if (!window.confirm(`Czy na pewno usunąć kontrahenta „${item.nazwa}"?`)) return
    const { error } = await supabase.from('kontrahenci').delete().eq('id', item.id)
    if (error) {
      console.error(error)
      if (isFkViolation(error)) {
        setDeactivateTarget({ item, count: null, reason: 'fk_error' })
      } else {
        addToast(error.message, 'error')
      }
    } else {
      addToast('Kontrahent został usunięty.', 'success')
      fetchData()
    }
  }

  async function handleDeactivate() {
    if (!deactivateTarget) return
    setDeactivating(true)
    const { error } = await supabase
      .from('kontrahenci')
      .update({ aktywny: false })
      .eq('id', deactivateTarget.item.id)
    setDeactivating(false)
    if (error) {
      console.error(error)
      addToast(error.message, 'error')
    } else {
      addToast('Kontrahent został dezaktywowany. Powiązane faktury zostały zachowane.', 'success')
      setDeactivateTarget(null)
      fetchData()
    }
  }

  if (loading) return <Spinner />

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3 page-header">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Kontrahenci</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>{items.length} kontrahentów</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg px-4 text-sm font-medium text-white page-header-btn w-full sm:w-auto justify-center"
          style={{ background: '#3b82f6', minHeight: 48 }}
        >
          <Plus size={16} /> Dodaj kontrahenta
        </button>
      </div>

      {/* Search + status filter */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1" style={{ minWidth: 180 }}>
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
          <input
            style={{ ...IS(), paddingLeft: 36 }}
            placeholder="Szukaj po nazwie, NIP, email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{ ...IS(), width: 'auto', minWidth: 130, cursor: 'pointer' }}
        >
          <option value="all">Wszyscy</option>
          <option value="active">Aktywni</option>
          <option value="inactive">Nieaktywni</option>
        </select>
      </div>

      {/* ── Mobile card list ── */}
      <div className="md:hidden space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-12 rounded-xl" style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
            <Users size={32} className="mx-auto mb-2 opacity-30" />
            <p>Brak kontrahentów</p>
          </div>
        ) : (
          filtered.map(item => (
            <div key={item.id} className="rounded-xl px-4 py-3" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium break-words" style={{ color: item.aktywny !== false ? 'var(--text)' : 'var(--muted)' }}>
                    {item.nazwa}
                  </p>
                  {item.nip && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>NIP: {item.nip}</p>
                  )}
                  {item.adres && (
                    <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-2)' }}>{item.adres}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <Badge variant={fakturyCount[item.id] ? 'blue' : 'zinc'}>{fakturyCount[item.id] || 0} {fakturyCount[item.id] === 1 ? 'faktura' : 'faktur'}</Badge>
                    <Badge variant={item.aktywny !== false ? 'green' : 'zinc'}>{item.aktywny !== false ? 'Aktywny' : 'Nieaktywny'}</Badge>
                  </div>
                </div>
                <div className="flex items-center flex-shrink-0">
                  <button onClick={() => openEdit(item)} className="flex items-center justify-center rounded-lg" style={{ color: 'var(--text-2)', minWidth: 44, minHeight: 44 }} title="Edytuj"><Pencil size={14} /></button>
                  <button onClick={() => handleDelete(item)} className="flex items-center justify-center rounded-lg" style={{ color: '#dc2626', minWidth: 44, minHeight: 44 }} title="Usuń"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Desktop table ── */}
      <div className="hidden md:block rounded-xl overflow-hidden table-scroll-x" style={{ border: '1px solid var(--border)' }}>
        <table className="w-full text-sm" style={{ minWidth: 480 }}>
          <thead>
            <tr style={{ background: 'var(--table-head)', borderBottom: '1px solid var(--border)' }}>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-2)' }}>Nazwa</th>
              <th className="text-left px-4 py-3 font-medium hidden sm:table-cell" style={{ color: 'var(--text-2)' }}>NIP</th>
              <th className="text-left px-4 py-3 font-medium hidden lg:table-cell" style={{ color: 'var(--text-2)' }}>Email</th>
              <th className="text-left px-4 py-3 font-medium hidden lg:table-cell" style={{ color: 'var(--text-2)' }}>Telefon</th>
              <th className="text-center px-4 py-3 font-medium" style={{ color: 'var(--text-2)' }}>Faktury</th>
              <th className="text-center px-4 py-3 font-medium" style={{ color: 'var(--text-2)' }}>Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12" style={{ color: 'var(--muted)', background: 'var(--table-even)' }}>
                  <Users size={32} className="mx-auto mb-2 opacity-30" />
                  <p>Brak kontrahentów</p>
                </td>
              </tr>
            ) : (
              filtered.map((item, idx) => (
                <tr
                  key={item.id}
                  className="table-row"
                  style={{ background: idx % 2 === 0 ? 'var(--table-even)' : 'var(--table-odd)', borderBottom: '1px solid var(--border)' }}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium" style={{ color: 'var(--text)', opacity: item.aktywny === false ? 0.5 : 1 }}>
                      {item.nazwa}
                    </p>
                    {item.adres && <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{item.adres}</p>}
                    {item.nip && (
                      <p className="text-xs mt-0.5 sm:hidden" style={{ color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
                        {item.nip}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell" style={{ color: 'var(--text-2)', fontFamily: 'DM Mono, monospace', fontSize: 13 }}>
                    {item.nip || '—'}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {item.email
                      ? <a href={`mailto:${item.email}`} className="flex items-center gap-1.5 hover:underline" style={{ fontSize: 13, color: '#2563eb' }}><Mail size={13} /> {item.email}</a>
                      : <span style={{ color: 'var(--muted)' }}>—</span>}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell" style={{ color: 'var(--text-2)', fontSize: 13 }}>
                    {item.telefon
                      ? <span className="flex items-center gap-1.5"><Phone size={13} /> {item.telefon}</span>
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={fakturyCount[item.id] ? 'blue' : 'zinc'}>{fakturyCount[item.id] || 0}</Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={item.aktywny !== false ? 'green' : 'zinc'}>
                      {item.aktywny !== false ? 'Aktywny' : 'Nieaktywny'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(item)}
                        className="p-1.5 rounded-lg table-action-btn"
                        style={{ color: 'var(--text-2)' }}
                        title="Edytuj"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        className="p-1.5 rounded-lg table-action-btn"
                        style={{ color: '#dc2626' }}
                        title="Usuń"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit / create modal */}
      {showModal && (
        <Modal title={editItem ? 'Edytuj kontrahenta' : 'Nowy kontrahent'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Nazwa *</label>
              <input
                style={IS(errors.nazwa)}
                value={form.nazwa}
                onChange={e => setForm(f => ({ ...f, nazwa: e.target.value }))}
                placeholder="np. Firma ABC Sp. z o.o."
              />
              {errors.nazwa && <p className="text-xs mt-1" style={{ color: '#dc2626' }}>Pole wymagane</p>}
            </div>
            <div className="grid grid-cols-2 gap-3 modal-2col">
              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>NIP</label>
                <input style={IS()} value={form.nip} onChange={e => setForm(f => ({ ...f, nip: e.target.value }))} placeholder="1234567890" />
              </div>
              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Telefon</label>
                <input style={IS()} value={form.telefon} onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))} placeholder="+48 000 000 000" />
              </div>
            </div>
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Email</label>
              <input type="email" style={IS()} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="kontakt@firma.pl" />
            </div>
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Adres</label>
              <input style={IS()} value={form.adres} onChange={e => setForm(f => ({ ...f, adres: e.target.value }))} placeholder="ul. Przykładowa 1, 00-000 Miasto" />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="k_a"
                checked={form.aktywny}
                onChange={e => setForm(f => ({ ...f, aktywny: e.target.checked }))}
                style={{ accentColor: '#3b82f6' }}
              />
              <label htmlFor="k_a" className="text-sm" style={{ color: 'var(--text-2)' }}>Aktywny</label>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 rounded-lg text-sm font-medium"
                style={{ background: 'var(--table-sub)', color: 'var(--text-2)', minHeight: 48 }}
              >
                Anuluj
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-lg text-sm font-medium text-white"
                style={{ background: '#3b82f6', minHeight: 48, opacity: saving ? 0.7 : 1 }}
              >
                {saving ? 'Zapisywanie…' : editItem ? 'Zapisz zmiany' : 'Dodaj kontrahenta'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Deactivation modal — shown when delete is blocked by linked invoices */}
      {deactivateTarget && (
        <Modal
          title="Nie można usunąć kontrahenta"
          onClose={() => setDeactivateTarget(null)}
          maxWidth={440}
        >
          <div className="space-y-4">
            <div
              className="flex items-start gap-3"
              style={{ padding: '12px', background: '#fffbeb', borderRadius: 8, border: '1px solid #fde68a' }}
            >
              <AlertTriangle size={18} style={{ color: '#d97706', flexShrink: 0, marginTop: 1 }} />
              <div>
                <p className="text-sm font-medium" style={{ color: '#92400e' }}>
                  {deactivateTarget.reason === 'fk_error'
                    ? 'Nie można usunąć kontrahenta, ponieważ ma przypisane faktury. Możesz go dezaktywować.'
                    : `Nie można usunąć kontrahenta, ponieważ ma przypisane faktury (${deactivateTarget.count}). Możesz go dezaktywować.`}
                </p>
                <p className="text-xs mt-1" style={{ color: '#a16207' }}>
                  Kontrahent: <strong>{deactivateTarget.item.nazwa}</strong>
                </p>
              </div>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-2)' }}>
              Dezaktywacja ukryje kontrahenta z list wyboru przy nowych fakturach, ale zachowa wszystkie istniejące powiązania.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeactivateTarget(null)}
                className="flex-1 rounded-lg text-sm font-medium"
                style={{ background: 'var(--table-sub)', color: 'var(--text-2)', minHeight: 48 }}
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={handleDeactivate}
                disabled={deactivating}
                className="flex-1 rounded-lg text-sm font-medium text-white"
                style={{ background: '#d97706', minHeight: 48, opacity: deactivating ? 0.7 : 1 }}
              >
                {deactivating ? 'Dezaktywuję…' : 'Dezaktywuj kontrahenta'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
