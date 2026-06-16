import { useState, useRef } from 'react'
import { supabase } from '../supabase'
import { useWorkspace } from '../context/WorkspaceContext'
import { useToast } from '../context/ToastContext'
import { parseCSV, LOKALIZACJE_UNIKALNE } from '../utils/lokaleImportParser'
import { pakietDlaPojemnosci, POJEMNOSCI } from '../utils/pakietyBazowe'
import Spinner from '../components/Spinner'
import { Upload, CheckCircle, AlertCircle, ChevronRight, Package, Building2 } from 'lucide-react'

const BATCH = 50

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

export default function ImportLokali() {
  const { workspaceId, wsData } = useWorkspace()
  const { addToast } = useToast()

  const [step, setStep] = useState(1) // 1=pakiety, 2=podgląd, 3=import
  const [csvRows, setCsvRows] = useState([])
  const [csvFileName, setCsvFileName] = useState('')
  const [towary, setTowary] = useState([])
  const [pakiety, setPakiety] = useState([])
  const [loadingTowary, setLoadingTowary] = useState(false)

  // Step 1: package element → towar mapping
  const [matchMap, setMatchMap] = useState({}) // towarName → towar_id or ''
  const [pakietNames] = useState(
    POJEMNOSCI.flatMap(n => pakietDlaPojemnosci(n).elementy.map(e => e.towar))
      .filter((v, i, a) => a.indexOf(v) === i)
  )

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

    // auto-match by name (case-insensitive)
    const auto = {}
    for (const name of pakietNames) {
      const found = (data || []).find(t => t.nazwa.toLowerCase() === name.toLowerCase())
      if (found) auto[name] = found.id
      else auto[name] = ''
    }
    setMatchMap(auto)
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
    setStep(2)
  }

  async function goToStep3() {
    setStep(3)
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

      // Check if exists
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

      // Upsert elements — delete existing and re-insert for idempotency
      const { data: existingEl } = await supabase
        .from('pakiet_elementy')
        .select('id')
        .eq('pakiet_id', pakietId)

      if (!existingEl?.length) {
        for (const el of def.elementy) {
          const towarId = matchMap[el.towar]
          if (!towarId) continue
          await supabase.from('pakiet_elementy').insert([{
            ...wsData(),
            pakiet_id: pakietId,
            towar_id: towarId,
            ilosc: el.ilosc,
          }])
        }
      }
    }

    // 2. Import lokale in batches
    const total = csvRows.length
    setProgress({ done: 0, total, errors: [] })

    for (let i = 0; i < csvRows.length; i += BATCH) {
      const batch = csvRows.slice(i, i + BATCH)
      for (const row of batch) {
        // Check existence by nazwa + workspace
        const { data: existing } = await supabase
          .from('lokale')
          .select('id')
          .eq('workspace_id', workspaceId)
          .eq('nazwa', row.nazwa)
          .maybeSingle()

        const pakietId = pakietyInserted[row.pojemnosc] || null
        const payload = {
          nazwa: row.nazwa,
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

    // Reload local pakiety list
    const { data: pak } = await supabase
      .from('pakiety_sprzatania')
      .select('id, nazwa')
      .eq('workspace_id', workspaceId)
      .order('nazwa')
    setPakiety(pak || [])

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

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Import lokali</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>Importuj lokale z pliku CSV i skonfiguruj pakiety bazowe przygotowania.</p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-3 mb-6">
        {[
          { n: 1, label: 'Dopasowanie produktów' },
          { n: 2, label: 'Podgląd' },
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
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold" style={{ color: 'var(--text)' }}>2. Dopasuj produkty do pakietów bazowych</p>
              {loadingTowary && <Spinner />}
            </div>
            {!towary.length && !loadingTowary && (
              <button onClick={loadTowary} style={{ ...CS.btn(true), minHeight: 40, fontSize: 13 }}>
                Załaduj towary z magazynu
              </button>
            )}
            {towary.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
                  {matchedCount}/{pakietNames.length} produktów dopasowanych.
                  {unmatchedNames.length > 0 && ' Nieznalezione zostaną pominięte w pakietach.'}
                </p>
                {pakietNames.map(name => (
                  <div key={name} className="flex items-center gap-3">
                    <span className="text-sm flex-1 truncate" style={{ color: 'var(--text)', minWidth: 0 }}>{name}</span>
                    <select
                      value={matchMap[name] || ''}
                      onChange={e => setMatchMap(m => ({ ...m, [name]: e.target.value }))}
                      style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '6px 8px', fontSize: 13, maxWidth: 220 }}
                    >
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

          <button
            disabled={csvRows.length === 0}
            onClick={goToStep2}
            style={CS.btn(csvRows.length > 0)}
          >
            Dalej: Podgląd →
          </button>
        </div>
      )}

      {/* ── STEP 2: Dry-run preview ── */}
      {step === 2 && (
        <div className="space-y-5">
          <div style={{ ...CS.card, padding: 20 }}>
            <p className="font-semibold mb-3" style={{ color: 'var(--text)' }}>Podgląd importu</p>

            {/* Summary by location */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                {[...LOKALIZACJE_UNIKALNE, { kod: 'inne', nazwa: 'Inne' }].map(loc => {
                const count = csvRows.filter(r => r.lokalizacja_kod === loc.kod).length
                if (loc.kod === 'inne' && count === 0) return null
                return (
                  <div key={loc.kod} style={{ background: 'var(--table-sub)', borderRadius: 8, padding: '10px 12px' }}>
                    <p className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>{loc.nazwa}</p>
                    <p className="text-xl font-bold mt-0.5" style={{ color: 'var(--text)' }}>{count}</p>
                  </div>
                )
              })}
            </div>

            {/* Packages preview */}
            <p className="font-medium text-sm mb-2" style={{ color: 'var(--text)' }}>Pakiety bazowe ({POJEMNOSCI.length})</p>
            <div className="space-y-2">
              {POJEMNOSCI.map(n => {
                const def = pakietDlaPojemnosci(n)
                const matched = def.elementy.filter(e => matchMap[e.towar])
                return (
                  <div key={n} style={{ background: 'var(--table-sub)', borderRadius: 8, padding: '8px 12px' }} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Package size={14} style={{ color: 'var(--c-action)', flexShrink: 0 }} />
                      <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{def.nazwa}</span>
                    </div>
                    <span className="text-xs" style={{ color: matched.length === def.elementy.length ? 'var(--c-success)' : 'var(--c-attention)' }}>
                      {matched.length}/{def.elementy.length} prod.
                    </span>
                  </div>
                )
              })}
            </div>

            {/* First 10 rows preview */}
            <p className="font-medium text-sm mt-4 mb-2" style={{ color: 'var(--text)' }}>Pierwsze 10 lokali</p>
            <div className="overflow-x-auto">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Nazwa', 'Lokalizacja', 'Typ', 'Os.', 'Parking'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text-2)', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvRows.slice(0, 10).map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '4px 8px', color: 'var(--text)' }}>{r.nazwa}</td>
                      <td style={{ padding: '4px 8px', color: 'var(--text-2)' }}>{r.lokalizacja}</td>
                      <td style={{ padding: '4px 8px', color: 'var(--text-2)' }}>{r.typ}</td>
                      <td style={{ padding: '4px 8px', color: 'var(--text-2)' }}>{r.pojemnosc}</td>
                      <td style={{ padding: '4px 8px', color: r.parking ? 'var(--c-success)' : 'var(--muted)' }}>{r.parking ? '✓' : '✗'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} style={{ ...CS.btn(true), background: 'var(--table-sub)', color: 'var(--text-2)' }}>
              ← Wróć
            </button>
            <button onClick={goToStep3} style={CS.btn(true)}>
              Dalej: Import →
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
                  Gotowe do importu: <strong style={{ color: 'var(--text)' }}>{csvRows.length} lokali</strong> + {POJEMNOSCI.length} pakietów bazowych.
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
                  <button onClick={() => { setStep(1); setCsvRows([]); setCsvFileName(''); setFinished(false); setProgress({ done: 0, total: 0, errors: [] }) }} style={{ ...CS.btn(true), background: 'var(--table-sub)', color: 'var(--text-2)' }}>
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
