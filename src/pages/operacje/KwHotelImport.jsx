import { useState, useRef, useEffect } from 'react'
import { supabase } from '../../supabase'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useToast } from '../../context/ToastContext'
import { parseKwHotelReport, decodeKwHotelFile, PRIORYTETY } from '../../utils/kwHotelReportParser'
import { LOKALIZACJE_UNIKALNE } from '../../utils/lokaleImportParser'
import { buildChecklistRows } from '../../utils/defaultChecklist'
import Modal from '../../components/Modal'
import BottomSheet from '../../components/ui/BottomSheet'
import Spinner from '../../components/Spinner'
import { Upload, CheckCircle, AlertTriangle, ChevronLeft, MapPin } from 'lucide-react'

const PRIORYTET_TO_FIELD = { 1: 'pilny', 2: 'normalny', 3: 'niski' }
const PRIORYTET_TO_TYP = { 1: 'zmiana', 2: 'przyjazd', 3: 'wyjazd' }
const PRIORYTET_BADGE = {
  1: { emoji: '🔴', bg: '#fef2f2', text: '#991b1b' },
  2: { emoji: '🟡', bg: '#fff7ed', text: '#9a3412' },
  3: { emoji: '🔵', bg: '#eff6ff', text: '#1e40af' },
}

function isoToday() { return new Date().toISOString().split('T')[0] }

function useMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return isMobile
}

function normalizeName(s) {
  return (s || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function matchLokal(nazwa, lokale) {
  const n = normalizeName(nazwa)
  const exact = lokale.find(l => normalizeName(l.nazwa) === n)
  if (exact) return exact
  const fuzzy = lokale.find(l => {
    const ln = normalizeName(l.nazwa)
    return ln.includes(n) || n.includes(ln)
  })
  return fuzzy || null
}

async function insertZlecenieRow(payload) {
  let { data, error } = await supabase.from('zlecenia').insert([payload]).select('id').single()
  if (error && /column|schema cache/i.test(error.message || '')) {
    const fallback = { ...payload }
    delete fallback.priorytet_typ
    delete fallback.zrodlo_importu
    ;({ data, error } = await supabase.from('zlecenia').insert([fallback]).select('id').single())
  }
  return { data, error }
}

export default function KwHotelImport({ onClose, onCreated }) {
  const { workspaceId } = useWorkspace()
  const { addToast } = useToast()
  const isMobile = useMobile()
  const fileRef = useRef()

  const [step, setStep] = useState(1)
  const [fileName, setFileName] = useState('')
  const [parsed, setParsed] = useState(null)
  const [parseError, setParseError] = useState('')
  const [forceImport, setForceImport] = useState(false)
  const [date, setDate] = useState(isoToday())

  const [loadingLokale, setLoadingLokale] = useState(false)
  const [lokale, setLokale] = useState([])
  const [rows, setRows] = useState([])

  const [creating, setCreating] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0, skipped: 0, errors: [] })
  const [finished, setFinished] = useState(false)

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setParseError('')
    setForceImport(false)
    try {
      const buffer = await file.arrayBuffer()
      const text = decodeKwHotelFile(buffer)
      const result = parseKwHotelReport(text)
      if (!result.records.length) {
        setParseError('Nie znaleziono żadnych wierszy z wyjazdem/przyjazdem — sprawdź czy to właściwy raport.')
        setParsed(null)
        return
      }
      setParsed(result)
      setDate(result.date || isoToday())
    } catch (err) {
      setParseError(`Błąd odczytu pliku: ${err.message}`)
      setParsed(null)
    }
  }

  async function goToPreview() {
    setLoadingLokale(true)
    const { data: lok } = await supabase
      .from('lokale')
      .select('id, nazwa, lokalizacja, domyslny_pakiet_id')
      .eq('workspace_id', workspaceId)
      .eq('aktywny', true)
      .order('nazwa')
    const lokaleList = lok || []
    setLokale(lokaleList)

    setRows(parsed.records.map((r, i) => {
      const matched = matchLokal(r.nazwa, lokaleList)
      return {
        _id: i,
        ...r,
        include: true,
        matchedLokalId: matched?.id || null,
      }
    }))
    setLoadingLokale(false)
    setStep(2)
  }

  function updateRow(id, changes) {
    setRows(rs => rs.map(r => r._id === id ? { ...r, ...changes } : r))
  }

  async function runCreate() {
    setStep(3)
    setCreating(true)
    setFinished(false)
    const included = rows.filter(r => r.include)
    const errors = []
    let done = 0
    let skipped = 0
    setProgress({ done: 0, total: included.length, skipped: 0, errors: [] })

    const { data: existing } = await supabase
      .from('zlecenia')
      .select('nazwa')
      .eq('workspace_id', workspaceId)
      .eq('data_realizacji', date)
    const existingNames = new Set((existing || []).map(z => z.nazwa))

    const lokaleById = {}
    for (const l of lokale) lokaleById[l.id] = l

    for (const row of included) {
      const lokal = row.matchedLokalId ? lokaleById[row.matchedLokalId] : null
      const displayName = lokal ? lokal.nazwa : row.nazwa
      const nazwaZlecenia = `${displayName} – ${date}`

      if (existingNames.has(nazwaZlecenia)) {
        skipped++
        setProgress(p => ({ ...p, skipped }))
        continue
      }

      const { data: zlecenie, error } = await insertZlecenieRow({
        workspace_id: workspaceId,
        nazwa: nazwaZlecenia,
        opis: `Import KW Hotel: ${PRIORYTETY[row.priorytet].label.toLowerCase()}`,
        data_realizacji: date,
        status: 'nowe',
        priorytet: PRIORYTET_TO_FIELD[row.priorytet],
        priorytet_typ: PRIORYTET_TO_TYP[row.priorytet],
        zrodlo_importu: 'kwhotel',
      })

      if (error) {
        errors.push(`${displayName}: ${error.message}`)
        setProgress(p => ({ ...p, errors: [...errors] }))
        continue
      }

      if (lokal?.domyslny_pakiet_id) {
        const { data: elementy } = await supabase
          .from('elementy_pakietu')
          .select('towar_id, ilosc, towary(nazwa, jednostka)')
          .eq('pakiet_id', lokal.domyslny_pakiet_id)
        if (elementy?.length) {
          await supabase.from('zlecenia_pozycje').insert(elementy.map(e => ({
            zlecenie_id: zlecenie.id,
            nazwa_pozycji: e.towary?.nazwa || '',
            ilosc: e.ilosc,
            jednostka: e.towary?.jednostka || 'szt.',
            notatka: 'Z pakietu (auto)',
            wydano: false,
          })))
        }
      }

      await supabase.from('checklist_items').insert(buildChecklistRows(zlecenie.id, workspaceId))

      done++
      existingNames.add(nazwaZlecenia)
      setProgress(p => ({ ...p, done }))
    }

    setCreating(false)
    setFinished(true)
    if (errors.length === 0) {
      addToast(`Utworzono ${done} przygotowań (pominięto ${skipped} istniejących)`, 'success')
    } else {
      addToast(`Utworzono ${done} przygotowań, ${errors.length} błędów`, 'warning')
    }
    onCreated?.()
  }

  const includedRows = rows.filter(r => r.include)
  const unmatchedRows = rows.filter(r => !r.matchedLokalId)

  const grouped = [1, 2, 3].map(priorytet => {
    const rowsForP = rows.filter(r => r.priorytet === priorytet)
    const byLoc = {}
    for (const r of rowsForP) {
      const kod = r.lokalizacjaKod
      if (!byLoc[kod]) byLoc[kod] = []
      byLoc[kod].push(r)
    }
    return { priorytet, rowsForP, byLoc }
  })

  const lokalizacjaSummary = LOKALIZACJE_UNIKALNE
    .map(loc => ({ ...loc, count: includedRows.filter(r => r.lokalizacjaKod === loc.kod).length }))
    .filter(l => l.count > 0)

  function lokLabel(kod) {
    return LOKALIZACJE_UNIKALNE.find(l => l.kod === kod)?.nazwa || 'Inne'
  }

  const title = step === 1 ? 'Import z KW Hotel' : step === 2 ? 'Podgląd i priorytety' : 'Tworzenie przygotowań'

  const content = (
    <div className="space-y-4">
      {/* ── STEP 1: upload ── */}
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>
            W KW Hotel: Raporty → Wykaz sprzątania → szablon „In Out 1" → Generuj → Save → CSV.
          </p>
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 rounded-lg px-4 text-sm font-medium w-full justify-center"
            style={{ background: 'var(--table-sub)', color: 'var(--text-2)', minHeight: 48, border: '1px dashed var(--border)' }}
          >
            <Upload size={15} />
            {fileName || 'Wgraj raport „Rozkład dnia" (.csv z KW Hotel)'}
          </button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={handleFileChange} />

          {parseError && (
            <div className="flex items-start gap-2 rounded-lg p-3" style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.25)' }}>
              <AlertTriangle size={15} style={{ color: '#dc2626', flexShrink: 0, marginTop: 2 }} />
              <p className="text-sm" style={{ color: '#dc2626' }}>{parseError}</p>
            </div>
          )}

          {parsed && (
            <div className="space-y-3">
              {parsed.checksumOk ? (
                <div className="flex items-center gap-2 rounded-lg p-3" style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.25)' }}>
                  <CheckCircle size={15} style={{ color: 'var(--c-success)', flexShrink: 0 }} />
                  <p className="text-sm" style={{ color: 'var(--text)' }}>
                    Suma kontrolna OK: {parsed.summary.sumaWyjazdow} wyjazdy, {parsed.summary.sumaPrzyjazdow} przyjazdy — zgodne z raportem.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 rounded-lg p-3" style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.25)' }}>
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={15} style={{ color: '#dc2626', flexShrink: 0, marginTop: 2 }} />
                    <p className="text-sm" style={{ color: '#dc2626' }}>
                      Niezgodność sumy kontrolnej: policzono {parsed.summary.sumaWyjazdow} wyjazdy / {parsed.summary.sumaPrzyjazdow} przyjazdy,
                      {parsed.reportChecksum ? ` raport podaje ${parsed.reportChecksum.wyjazdy} / ${parsed.reportChecksum.przyjazdy}.` : ' nie znaleziono wiersza „Podsumowanie" w pliku.'}
                      {' '}Sprawdź plik przed importem!
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
                    <input type="checkbox" checked={forceImport} onChange={e => setForceImport(e.target.checked)} style={{ accentColor: 'var(--c-action)' }} />
                    Rozumiem ryzyko, kontynuuj mimo niezgodności
                  </label>
                </div>
              )}

              <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                Znaleziono <strong style={{ color: 'var(--text)' }}>{parsed.summary.total}</strong> lokali z aktywnością:
                {' '}{parsed.summary.zmiana} zmian, {parsed.summary.tylkoPrzyjazd} tylko przyjazd, {parsed.summary.tylkoWyjazd} tylko wyjazd.
              </p>

              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Data realizacji</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', padding: '10px 12px', fontSize: 16, minHeight: 48 }}
                />
              </div>

              <button
                onClick={goToPreview}
                disabled={(!parsed.checksumOk && !forceImport) || loadingLokale}
                className="w-full rounded-lg text-sm font-medium text-white"
                style={{ background: 'var(--c-action)', minHeight: 48, opacity: (!parsed.checksumOk && !forceImport) ? 0.5 : 1 }}
              >
                {loadingLokale ? <Spinner /> : 'Dalej: Podgląd i priorytety →'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 2: grouped preview ── */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="rounded-lg p-3" style={{ background: 'var(--table-sub)', border: '1px solid var(--border)' }}>
            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
              Lokalizacje dziś: {lokalizacjaSummary.map(l => `${l.nazwa} ${l.count}`).join(' · ')}
            </p>
            {unmatchedRows.length > 0 && (
              <p className="text-xs mt-1.5" style={{ color: 'var(--c-attention)' }}>
                ⚠️ {unmatchedRows.length} lokali nie znaleziono w bazie — przypisz ręcznie lub odznacz.
              </p>
            )}
          </div>

          {grouped.map(({ priorytet, rowsForP, byLoc }) => {
            if (!rowsForP.length) return null
            const badge = PRIORYTET_BADGE[priorytet]
            const info = PRIORYTETY[priorytet]
            return (
              <div key={priorytet} className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: badge.bg }}>
                  <span style={{ fontSize: 14 }}>{badge.emoji}</span>
                  <p className="text-sm font-semibold" style={{ color: badge.text }}>
                    PRIORYTET {priorytet} — {info.label} ({rowsForP.length})
                  </p>
                  <span className="text-xs" style={{ color: badge.text, opacity: 0.8 }}>{info.opis}</span>
                </div>
                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {Object.entries(byLoc).map(([kod, locRows]) => (
                    <div key={kod} className="px-4 py-2.5" style={{ borderTop: '1px solid var(--border)' }}>
                      <p className="flex items-center gap-1.5 text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>
                        <MapPin size={11} /> {lokLabel(kod)} ({locRows.length})
                      </p>
                      <div className="space-y-1.5">
                        {locRows.map(row => (
                          <div key={row._id} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={row.include}
                              onChange={e => updateRow(row._id, { include: e.target.checked })}
                              style={{ accentColor: 'var(--c-action)', width: 16, height: 16 }}
                            />
                            <span className="text-sm flex-1 truncate" style={{ color: 'var(--text)' }}>{row.nazwa}</span>
                            {row.matchedLokalId ? (
                              <CheckCircle size={13} style={{ color: 'var(--c-success)', flexShrink: 0 }} />
                            ) : (
                              <select
                                value=""
                                onChange={e => updateRow(row._id, { matchedLokalId: e.target.value || null })}
                                style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12, padding: '4px 6px', maxWidth: 140 }}
                              >
                                <option value="">⚠️ nie znaleziono</option>
                                {lokale.map(l => <option key={l.id} value={l.id}>{l.nazwa}</option>)}
                              </select>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          <div className="flex gap-3 pt-2">
            <button onClick={() => setStep(1)} className="flex items-center gap-1 rounded-lg text-sm font-medium" style={{ background: 'var(--table-sub)', color: 'var(--text-2)', minHeight: 48, padding: '0 16px' }}>
              <ChevronLeft size={14} /> Wróć
            </button>
            <button
              onClick={runCreate}
              disabled={includedRows.length === 0}
              className="flex-1 rounded-lg text-sm font-medium text-white"
              style={{ background: 'var(--c-action)', minHeight: 48, opacity: includedRows.length === 0 ? 0.5 : 1 }}
            >
              Utwórz {includedRows.length} przygotowań →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: progress / done ── */}
      {step === 3 && (
        <div className="space-y-4">
          {creating && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Spinner />
                <p className="text-sm" style={{ color: 'var(--text)' }}>Tworzę… {progress.done}/{progress.total}</p>
              </div>
              <div style={{ background: 'var(--table-sub)', borderRadius: 8, height: 8, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: 'var(--c-action)', width: progress.total ? `${(progress.done / progress.total) * 100}%` : '0%', transition: 'width 0.2s' }} />
              </div>
            </div>
          )}

          {finished && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle size={20} style={{ color: 'var(--c-success)' }} />
                <p className="font-semibold" style={{ color: 'var(--text)' }}>
                  Utworzono {progress.done} przygotowań{progress.skipped > 0 && ` (pominięto ${progress.skipped} istniejących)`}
                </p>
              </div>
              {progress.errors.length > 0 && (
                <div style={{ background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 8, padding: 12 }}>
                  <p className="text-sm font-medium mb-2" style={{ color: '#dc2626' }}>{progress.errors.length} błędów:</p>
                  <ul className="space-y-1">
                    {progress.errors.map((e, i) => <li key={i} className="text-xs" style={{ color: '#dc2626' }}>{e}</li>)}
                  </ul>
                </div>
              )}
              <button onClick={onClose} className="w-full rounded-lg text-sm font-medium text-white" style={{ background: 'var(--c-action)', minHeight: 48 }}>
                Zamknij
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )

  return isMobile ? (
    <BottomSheet open onClose={onClose} title={title}>{content}</BottomSheet>
  ) : (
    <Modal title={title} onClose={onClose} maxWidth={640}>{content}</Modal>
  )
}
