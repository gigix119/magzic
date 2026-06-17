import { useState, useRef } from 'react'
import { supabase } from '../supabase'
import { useWorkspace } from '../context/WorkspaceContext'
import { useToast } from '../context/ToastContext'
import { parseCSV, LOKALIZACJE_UNIKALNE } from '../utils/lokaleImportParser'
import { pakietDlaPojemnosci, POJEMNOSCI } from '../utils/pakietyBazowe'
import Spinner from '../components/Spinner'
import { Upload, CheckCircle, AlertCircle, ChevronRight, Package, Building2, Plus, Trash2 } from 'lucide-react'

const BATCH = 50

const TYP_OPTIONS = ['apartament', 'pokój', 'dom', 'willa', 'studio']

const CS = {
  card: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12 },
  btn: (active) => ({
    background: active ? 'var(--c-action)' : 'var(--table-sub)',
    color: active ? '#fff' : 'var(--text-2)',
    minHeight: 48,
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    padding: '0 20px',
    border: 'none',
    cursor: active ? 'pointer' : 'not-allowed',
    opacity: active ? 1 : 0.5,
  }),
  inputCell: {
    background: 'var(--input-bg)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    color: 'var(--text)',
    padding: '4px 6px',
    fontSize: 12,
    outline: 'none',
    width: '100%',
    minHeight: 32,
  },
}

function StepBadge({ n, active, done }) {
  const bg = done ? 'var(--c-success)' : active ? 'var(--c-action)' : 'var(--border)'
  return (
    <div style={{ width: 28, height: 28, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {done
        ? <CheckCircle size={14} color="#fff" />
        : <span style={{ color: active ? '#fff' : 'var(--text-2)', fontSize: 13, fontWeight: 700 }}>{n}</span>
      }
    </div>
  )
}

function Toggle({ value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        minWidth: 44, minHeight: 32,
        background: value ? 'rgba(22,163,74,0.12)' : 'var(--table-sub)',
        color: value ? 'var(--c-success)' : 'var(--muted)',
        border: `1px solid ${value ? '#16a34a' : 'var(--border)'}`,
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {value ? '✓' : '✗'}
    </button>
  )
}

export default function ImportLokali() {
  const { workspaceId, wsData } = useWorkspace()
  const { addToast } = useToast()

  const [step, setStep] = useState(1)
  const [csvRows, setCsvRows] = useState([])
  const [csvFileName, setCsvFileName] = useState('')
  const [towary, setTowary] = useState([])
  const [loadingTowary, setLoadingTowary] = useState(false)
  const [creatingAll, setCreatingAll] = useState(false)

  // Step 1: package element → towar mapping
  const [matchMap, setMatchMap] = useState({})
  const [pakietNames] = useState(
    POJEMNOSCI.flatMap(n => pakietDlaPojemnosci(n).elementy.map(e => e.towar))
      .filter((v, i, a) => a.indexOf(v) === i)
  )

  // Step 2: editable preview rows
  const [previewRows, setPreviewRows] = useState([])

  // Step 3: progress
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0, errors: [] })
  const [finished, setFinished] = useState(false)

  const fileRef = useRef()

  async function loadTowary() {
    if (towary.length) return
    setLoadingTowary(true)
    const { data } = await supabase
      .from('towary')
      .select('id, nazwa')
      .eq('workspace_id', workspaceId)
      .eq('aktywny', true)
      .order('nazwa')
    setTowary(data || [])
    setLoadingTowary(false)

    const auto = {}
    for (const name of pakietNames) {
      const found = (data || []).find(t => t.nazwa.toLowerCase() === name.toLowerCase())
      auto[name] = found ? found.id : ''
    }
    setMatchMap(auto)
  }

  // Create a single towar by name
  async function createTowarByName(name) {
    const sku = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '') || `towar-${Date.now()}`
    const { data, error } = await supabase
      .from('towary')
      .insert([{ ...wsData(), nazwa: name, typ: 'towar', sku, jednostka: 'szt.', aktywny: true }])
      .select('id, nazwa')
      .single()
    if (error) { addToast(`Błąd tworzenia "${name}": ${error.message}`, 'error'); return null }
    return data
  }

  async function handleDropdownChange(name, value) {
    if (value === '__create__') {
      const t = await createTowarByName(name)
      if (t) {
        setTowary(prev => {
          const ids = new Set(prev.map(x => x.id))
          if (ids.has(t.id)) return prev
          return [...prev, t].sort((a, b) => a.nazwa.localeCompare(b.nazwa))
        })
        setMatchMap(m => ({ ...m, [name]: t.id }))
        addToast(`Utworzono towar: ${name}`, 'success')
      }
    } else {
      setMatchMap(m => ({ ...m, [name]: value }))
    }
  }

  async function createAllMissing() {
    const missing = pakietNames.filter(n => !matchMap[n])
    if (!missing.length) return
    if (!window.confirm(`Utworzyć ${missing.length} nowych towarów?\n\n${missing.join(', ')}`)) return
    setCreatingAll(true)
    const created = []
    for (const name of missing) {
      const t = await createTowarByName(name)
      if (t) created.push(t)
    }
    if (created.length) {
      setTowary(prev => {
        const ids = new Set(prev.map(x => x.id))
        const newOnes = created.filter(t => !ids.has(t.id))
        return [...prev, ...newOnes].sort((a, b) => a.nazwa.localeCompare(b.nazwa))
      })
      const newMatches = {}
      for (const t of created) newMatches[t.nazwa] = t.id
      setMatchMap(m => ({ ...m, ...newMatches }))
      addToast(`Utworzono ${created.length} towarów`, 'success')
    }
    setCreatingAll(false)
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvFileName(file.name)
    const reader = new FileReader()
    reader.onload = ev => {
      const rows = parseCSV(ev.target.result)
      setCsvRows(rows)
    }
    reader.readAsText(file, 'utf-8')
  }

  async function goToStep2() {
    await loadTowary()
    // Initialize editable preview from CSV rows
    setPreviewRows(csvRows.map((r, i) => ({ ...r, _include: true, _id: i })))
    setStep(2)
  }

  async function goToStep3() {
    setStep(3)
  }

  // Preview row edit helpers
  function updateRow(id, changes) {
    setPreviewRows(rows => rows.map(r => r._id === id ? { ...r, ...changes } : r))
  }

  function removeRow(id) {
    setPreviewRows(rows => rows.filter(r => r._id !== id))
  }

  function addManualRow() {
    setPreviewRows(rows => [...rows, {
      nazwa: '',
      lokalizacja: '',
      lokalizacja_kod: '',
      typ: 'apartament',
      pojemnosc: 4,
      zwierzeta_ok: false,
      parking: true,
      adres: '',
      notatki: '',
      _include: true,
      _id: Date.now(),
      _manual: true,
    }])
  }

  // ── Import logic ──────────────────────────────────────────────────────────────

  async function runImport() {
    if (!workspaceId || importing) return
    setImporting(true)
    setFinished(false)
    const errors = []
    let done = 0

    // 1. Upsert pakiety bazowe
    const pakietyInserted = {}
    for (const n of POJEMNOSCI) {
      const def = pakietDlaPojemnosci(n)

      const { data: existing } = await supabase
        .from('pakiety_sprzatania')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('nazwa', def.nazwa)
        .maybeSingle()

      let pakietId = existing?.id

      if (!pakietId) {
        const { data: ins, error } = await supabase
          .from('pakiety_sprzatania')
          .insert([{ ...wsData(), nazwa: def.nazwa, opis: def.opis, aktywny: true }])
          .select('id')
          .single()
        if (error) { errors.push(`Pakiet ${def.nazwa}: ${error.message}`); continue }
        pakietId = ins.id
      }
      pakietyInserted[n] = pakietId

      const { data: existingEl } = await supabase
        .from('elementy_pakietu')
        .select('id')
        .eq('pakiet_id', pakietId)

      if (!existingEl?.length) {
        for (const el of def.elementy) {
          const towarId = matchMap[el.towar]
          if (!towarId) continue
          const { error: elErr } = await supabase.from('elementy_pakietu').insert([{
            ...wsData(),
            pakiet_id: pakietId,
            towar_id: towarId,
            ilosc: el.ilosc,
          }])
          if (elErr) errors.push(`Element pakietu ${def.nazwa} – ${el.towar}: ${elErr.message}`)
        }
      }
    }

    // 2. Import lokale — use previewRows filtered by _include
    const rowsToImport = previewRows.filter(r => r._include !== false && r.nazwa?.trim())
    const total = rowsToImport.length
    setProgress({ done: 0, total, errors: [] })

    for (let i = 0; i < rowsToImport.length; i += BATCH) {
      const batch = rowsToImport.slice(i, i + BATCH)
      for (const row of batch) {
        const { data: existing } = await supabase
          .from('lokale')
          .select('id')
          .eq('workspace_id', workspaceId)
          .eq('nazwa', row.nazwa)
          .maybeSingle()

        const pakietId = pakietyInserted[row.pojemnosc] || null
        const payload = {
          nazwa: row.nazwa.trim(),
          adres: row.adres || null,
          typ: row.typ || 'apartament',
          pojemnosc: row.pojemnosc || 4,
          notatki: row.notatki || null,
          aktywny: true,
          lokalizacja: row.lokalizacja || null,
          lokalizacja_kod: row.lokalizacja_kod || null,
          metraz: row.metraz || null,
          zwierzeta_ok: row.zwierzeta_ok || false,
          parking: row.parking !== false,
          domyslny_pakiet_id: pakietId,
        }

        if (existing) {
          await supabase.from('lokale').update(payload).eq('id', existing.id)
        } else {
          const { error } = await supabase.from('lokale').insert([{ ...payload, ...wsData() }])
          if (error) errors.push(`${row.nazwa}: ${error.message}`)
        }
        done++
        setProgress(p => ({ ...p, done, errors: [...errors] }))
      }
    }

    setImporting(false)
    setFinished(true)
    if (errors.length === 0) {
      addToast(`Import zakończony: ${done} lokali`, 'success')
    } else {
      addToast(`Import zakończony z ${errors.length} błędami`, 'warning')
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const matchedCount = Object.values(matchMap).filter(Boolean).length
  const unmatchedNames = pakietNames.filter(n => !matchMap[n])
  const includedRows = previewRows.filter(r => r._include !== false)

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Import lokali</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>Importuj lokale z pliku CSV i skonfiguruj pakiety bazowe przygotowania.</p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-3 mb-6">
        {[
          { n: 1, label: 'Dopasowanie produktów' },
          { n: 2, label: 'Podgląd i edycja' },
          { n: 3, label: 'Import' },
        ].map(({ n, label }, i, arr) => (
          <div key={n} className="flex items-center gap-2">
            <StepBadge n={n} active={step === n} done={step > n} />
            <span className="text-sm font-medium hidden sm:block" style={{ color: step === n ? 'var(--text)' : 'var(--muted)' }}>{label}</span>
            {i < arr.length - 1 && <ChevronRight size={14} style={{ color: 'var(--muted)', marginLeft: 4 }} />}
          </div>
        ))}
      </div>

      {/* ── STEP 1: CSV + product matching ── */}
      {step === 1 && (
        <div className="space-y-5">
          {/* CSV Upload */}
          <div style={{ ...CS.card, padding: 20 }}>
            <p className="font-semibold mb-3" style={{ color: 'var(--text)' }}>1. Wybierz plik CSV</p>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 rounded-lg px-4 text-sm font-medium"
              style={{ background: 'var(--table-sub)', color: 'var(--text-2)', minHeight: 44, border: '1px dashed var(--border)' }}
            >
              <Upload size={15} />
              {csvFileName ? csvFileName : 'Wybierz plik .csv (UTF-8)'}
            </button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={handleFileChange} />
            {csvRows.length > 0 && (
              <p className="text-xs mt-2" style={{ color: 'var(--c-success)' }}>
                <CheckCircle size={12} className="inline mr-1" />
                Wczytano {csvRows.length} wierszy
              </p>
            )}
          </div>

          {/* Product matching */}
          <div style={{ ...CS.card, padding: 20 }}>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <p className="font-semibold" style={{ color: 'var(--text)' }}>2. Dopasuj produkty do pakietów bazowych</p>
              <div className="flex items-center gap-2">
                {loadingTowary && <Spinner />}
                {creatingAll && <Spinner />}
              </div>
            </div>

            {!towary.length && !loadingTowary && (
              <button onClick={loadTowary} style={{ ...CS.btn(true), minHeight: 40, fontSize: 13 }}>
                Załaduj towary z magazynu
              </button>
            )}

            {towary.length > 0 && (
              <div className="space-y-3">
                {/* Summary + create all */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>
                    Dopasowano <strong style={{ color: 'var(--text)' }}>{matchedCount}/{pakietNames.length}</strong> produktów.
                    {unmatchedNames.length > 0 && (
                      <> {unmatchedNames.length} pominięte: <span style={{ color: 'var(--c-attention)' }}>{unmatchedNames.join(', ')}</span></>
                    )}
                  </p>
                  {unmatchedNames.length > 0 && (
                    <button
                      onClick={createAllMissing}
                      disabled={creatingAll}
                      className="flex items-center gap-1.5 rounded-lg text-xs font-medium"
                      style={{ background: 'var(--c-action)', color: '#fff', minHeight: 36, padding: '0 12px', opacity: creatingAll ? 0.7 : 1, cursor: creatingAll ? 'not-allowed' : 'pointer' }}
                    >
                      <Plus size={12} />
                      Utwórz wszystkie brakujące ({unmatchedNames.length})
                    </button>
                  )}
                </div>

                {pakietNames.map(name => (
                  <div key={name} className="flex items-center gap-3">
                    <span className="text-sm flex-1 truncate" style={{ color: 'var(--text)', minWidth: 0 }}>{name}</span>
                    <select
                      value={matchMap[name] || ''}
                      onChange={e => handleDropdownChange(name, e.target.value)}
                      style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '6px 8px', fontSize: 13, maxWidth: 240 }}
                    >
                      <option value="__create__">+ Utwórz: {name}</option>
                      <option value="">— pomiń —</option>
                      {towary.map(t => <option key={t.id} value={t.id}>{t.nazwa}</option>)}
                    </select>
                    {matchMap[name]
                      ? <CheckCircle size={14} style={{ color: 'var(--c-success)', flexShrink: 0 }} />
                      : <AlertCircle size={14} style={{ color: 'var(--c-attention)', flexShrink: 0 }} />
                    }
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            {unmatchedNames.length > 0 && (
              <p className="text-xs px-1" style={{ color: 'var(--muted)' }}>
                Możesz przejść dalej bez dopasowania wszystkich produktów — pozycje bez dopasowania zostaną pominięte w pakietach.
              </p>
            )}
            <button
              disabled={csvRows.length === 0}
              onClick={goToStep2}
              style={CS.btn(csvRows.length > 0)}
            >
              Dalej: Podgląd i edycja →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Editable preview ── */}
      {step === 2 && (
        <div className="space-y-5">
          {/* Summary by location */}
          <div style={{ ...CS.card, padding: 20 }}>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <p className="font-semibold" style={{ color: 'var(--text)' }}>Podgląd i edycja importu</p>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                Do importu: <strong style={{ color: 'var(--text)' }}>{includedRows.length}</strong> lokali
                {previewRows.length - includedRows.length > 0 && (
                  <> · <span style={{ color: 'var(--c-attention)' }}>{previewRows.length - includedRows.length} pominiętych</span></>
                )}
              </p>
            </div>

            {/* Location summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
              {LOKALIZACJE_UNIKALNE.map(loc => {
                const count = includedRows.filter(r => r.lokalizacja_kod === loc.kod).length
                if (!count) return null
                return (
                  <div key={loc.kod} style={{ background: 'var(--table-sub)', borderRadius: 8, padding: '8px 12px' }}>
                    <p className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>{loc.nazwa}</p>
                    <p className="text-xl font-bold mt-0.5" style={{ color: 'var(--text)' }}>{count}</p>
                  </div>
                )
              })}
            </div>

            {/* Mobile: card list */}
            <div className="md:hidden space-y-3">
              {previewRows.map(r => (
                <div key={r._id} style={{ background: r._include ? 'var(--card)' : 'var(--table-sub)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', opacity: r._include ? 1 : 0.5 }}>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" checked={!!r._include} onChange={e => updateRow(r._id, { _include: e.target.checked })} style={{ marginTop: 3, accentColor: 'var(--c-action)', width: 16, height: 16 }} />
                    <div className="flex-1 min-w-0 space-y-2">
                      <input
                        style={{ ...CS.inputCell, fontSize: 14, fontWeight: 600 }}
                        value={r.nazwa || ''}
                        onChange={e => updateRow(r._id, { nazwa: e.target.value })}
                        placeholder="Nazwa lokalu"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <select style={CS.inputCell} value={r.lokalizacja_kod || ''} onChange={e => {
                          const loc = LOKALIZACJE_UNIKALNE.find(l => l.kod === e.target.value)
                          updateRow(r._id, { lokalizacja_kod: e.target.value, lokalizacja: loc?.nazwa || r.lokalizacja })
                        }}>
                          <option value="">Inne</option>
                          {LOKALIZACJE_UNIKALNE.map(l => <option key={l.kod} value={l.kod}>{l.nazwa}</option>)}
                        </select>
                        <input type="number" min="1" max="20" style={CS.inputCell} value={r.pojemnosc || ''} onChange={e => updateRow(r._id, { pojemnosc: parseInt(e.target.value, 10) || 1 })} placeholder="Osoby" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <select style={CS.inputCell} value={r.typ || 'apartament'} onChange={e => updateRow(r._id, { typ: e.target.value })}>
                          {TYP_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <div className="flex items-center gap-2">
                          <span className="text-xs" style={{ color: 'var(--text-2)' }}>Zw.</span>
                          <Toggle value={!!r.zwierzeta_ok} onChange={v => updateRow(r._id, { zwierzeta_ok: v })} />
                          <span className="text-xs" style={{ color: 'var(--text-2)' }}>Park.</span>
                          <Toggle value={r.parking !== false} onChange={v => updateRow(r._id, { parking: v })} />
                        </div>
                      </div>
                    </div>
                    <button onClick={() => removeRow(r._id)} style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: editable table */}
            <div className="hidden md:block overflow-x-auto">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 760 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--table-head)' }}>
                    {['', 'Nazwa', 'Lokalizacja', 'Os.', 'Typ', 'Zw.', 'Park.', ''].map((h, i) => (
                      <th key={i} style={{ textAlign: i === 0 || i >= 5 ? 'center' : 'left', padding: '6px 8px', color: 'var(--text-2)', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map(r => (
                    <tr key={r._id} style={{ borderBottom: '1px solid var(--border)', opacity: r._include ? 1 : 0.4, background: r._include ? 'var(--card)' : 'var(--table-sub)' }}>
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                        <input type="checkbox" checked={!!r._include} onChange={e => updateRow(r._id, { _include: e.target.checked })} style={{ accentColor: 'var(--c-action)' }} />
                      </td>
                      <td style={{ padding: '4px 6px', minWidth: 160 }}>
                        <input style={CS.inputCell} value={r.nazwa || ''} onChange={e => updateRow(r._id, { nazwa: e.target.value })} placeholder="Nazwa" />
                      </td>
                      <td style={{ padding: '4px 6px', minWidth: 110 }}>
                        <select style={CS.inputCell} value={r.lokalizacja_kod || ''} onChange={e => {
                          const loc = LOKALIZACJE_UNIKALNE.find(l => l.kod === e.target.value)
                          updateRow(r._id, { lokalizacja_kod: e.target.value, lokalizacja: loc?.nazwa || '' })
                        }}>
                          <option value="">Inne</option>
                          {LOKALIZACJE_UNIKALNE.map(l => <option key={l.kod} value={l.kod}>{l.nazwa}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '4px 6px', minWidth: 60 }}>
                        <input type="number" min="1" max="20" style={{ ...CS.inputCell, width: 52 }} value={r.pojemnosc || ''} onChange={e => updateRow(r._id, { pojemnosc: parseInt(e.target.value, 10) || 1 })} />
                      </td>
                      <td style={{ padding: '4px 6px', minWidth: 100 }}>
                        <select style={CS.inputCell} value={r.typ || 'apartament'} onChange={e => updateRow(r._id, { typ: e.target.value })}>
                          {TYP_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                        <Toggle value={!!r.zwierzeta_ok} onChange={v => updateRow(r._id, { zwierzeta_ok: v })} />
                      </td>
                      <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                        <Toggle value={r.parking !== false} onChange={v => updateRow(r._id, { parking: v })} />
                      </td>
                      <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                        <button onClick={() => removeRow(r._id)} style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Add row */}
            <button
              onClick={addManualRow}
              className="flex items-center gap-2 mt-4 rounded-lg px-4 text-sm font-medium"
              style={{ background: 'var(--table-sub)', color: 'var(--text-2)', minHeight: 44, border: '1px dashed var(--border)' }}
            >
              <Plus size={14} /> + Dodaj lokal ręcznie
            </button>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} style={{ ...CS.btn(true), background: 'var(--table-sub)', color: 'var(--text-2)' }}>
              ← Wróć
            </button>
            <button onClick={goToStep3} disabled={includedRows.length === 0} style={CS.btn(includedRows.length > 0)}>
              Dalej: Import ({includedRows.length} lokali) →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Import ── */}
      {step === 3 && (
        <div className="space-y-5">
          <div style={{ ...CS.card, padding: 24 }}>
            <p className="font-semibold mb-4" style={{ color: 'var(--text)' }}>Import danych</p>

            {!importing && !finished && (
              <div className="space-y-3">
                <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                  Gotowe do importu: <strong style={{ color: 'var(--text)' }}>{includedRows.length} lokali</strong> + {POJEMNOSCI.length} pakietów bazowych.
                  {matchedCount < pakietNames.length && (
                    <> <span style={{ color: 'var(--c-attention)' }}>({pakietNames.length - matchedCount} produktów pominiętych w pakietach)</span></>
                  )}
                </p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  Import jest idempotentny — można uruchomić wiele razy. Istniejące lokale (ta sama nazwa) zostaną zaktualizowane.
                </p>
                <button onClick={runImport} style={CS.btn(true)}>
                  <Building2 size={15} className="inline mr-2" />
                  Uruchom import
                </button>
              </div>
            )}

            {importing && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Spinner />
                  <p className="text-sm" style={{ color: 'var(--text)' }}>
                    Importuję… {progress.done}/{progress.total}
                  </p>
                </div>
                <div style={{ background: 'var(--table-sub)', borderRadius: 8, height: 8, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      background: 'var(--c-action)',
                      width: progress.total ? `${(progress.done / progress.total) * 100}%` : '0%',
                      transition: 'width 0.2s',
                    }}
                  />
                </div>
              </div>
            )}

            {finished && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle size={20} style={{ color: 'var(--c-success)' }} />
                  <p className="font-semibold" style={{ color: 'var(--text)' }}>
                    Import zakończony: {progress.done} lokali
                  </p>
                </div>
                {progress.errors.length > 0 && (
                  <div style={{ background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 8, padding: 12 }}>
                    <p className="text-sm font-medium mb-2" style={{ color: '#dc2626' }}>
                      {progress.errors.length} błędów:
                    </p>
                    <ul className="space-y-1">
                      {progress.errors.map((e, i) => (
                        <li key={i} className="text-xs" style={{ color: '#dc2626' }}>{e}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <button onClick={() => { setStep(1); setCsvRows([]); setCsvFileName(''); setPreviewRows([]); setFinished(false); setProgress({ done: 0, total: 0, errors: [] }) }} style={{ ...CS.btn(true), background: 'var(--table-sub)', color: 'var(--text-2)' }}>
                    Nowy import
                  </button>
                  <a href="/lokale" style={{ ...CS.btn(true), textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                    Przejdź do lokali →
                  </a>
                </div>
              </div>
            )}
          </div>

          {!finished && (
            <button onClick={() => setStep(2)} style={{ ...CS.btn(true), background: 'var(--table-sub)', color: 'var(--text-2)' }}>
              ← Wróć
            </button>
          )}
        </div>
      )}
    </div>
  )
}
