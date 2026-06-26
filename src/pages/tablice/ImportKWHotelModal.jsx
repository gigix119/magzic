import { useRef, useState } from 'react'
import { Upload, CheckCircle, AlertTriangle, ChevronLeft } from 'lucide-react'
import { supabase } from '../../supabase'
import { useToast } from '../../context/ToastContext'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useAuth } from '../../context/AuthContext'
import Modal from '../../components/Modal'
import Spinner from '../../components/Spinner'
import { parseKwHotelReport, decodeKwHotelFile } from '../../utils/kwHotelReportParser'
import { parseKwHotelXls, isSpreadsheetMlContent } from '../../utils/kwHotelXlsParser'
import { positionBetween, STATUS_COLORS, STATUS_LABELS } from './tablicaTokens'
import { logActivity } from './activityLog'

const PRIORYTET_TO_KEY = { 1: 'zmiana', 2: 'przyjazd', 3: 'wyjazd' }

const inputStyle = {
  background: 'var(--input-bg)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-control)',
  color: 'var(--text)',
  padding: '10px 12px',
  fontSize: 16,
  width: '100%',
  outline: 'none',
  minHeight: 44,
  boxSizing: 'border-box',
}

function stripPl(s) {
  return (s || '').toLowerCase()
    .replace(/ą/g, 'a').replace(/ć/g, 'c').replace(/ę/g, 'e').replace(/ł/g, 'l')
    .replace(/ń/g, 'n').replace(/ó/g, 'o').replace(/ś/g, 's').replace(/ź/g, 'z').replace(/ż/g, 'z')
}

function guessListId(lists, keyword) {
  return lists.find(l => stripPl(l.nazwa).includes(keyword))?.id || ''
}

export default function ImportKWHotelModal({ tablicaId, lists, cardsByList, onClose, onImported }) {
  const { addToast } = useToast()
  const { workspaceId, wsData } = useWorkspace()
  const { user, profile } = useAuth()
  const fileRef = useRef()

  const [step, setStep] = useState(1)
  const [fileName, setFileName] = useState('')
  const [detectedFormat, setDetectedFormat] = useState('')
  const [parsed, setParsed] = useState(null)
  const [parseError, setParseError] = useState('')
  const [forceImport, setForceImport] = useState(false)

  const [localLists, setLocalLists] = useState(lists)
  const [rows, setRows] = useState([])
  const [targetLists, setTargetLists] = useState({
    zmiana: guessListId(lists, 'zmiana'),
    przyjazd: guessListId(lists, 'przyjazd'),
    wyjazd: guessListId(lists, 'wyjazd'),
  })
  const [autoLabel, setAutoLabel] = useState(true)
  const [autoTermin, setAutoTermin] = useState(true)

  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [finished, setFinished] = useState(false)
  const [creatingLists, setCreatingLists] = useState(false)

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setParseError('')
    setForceImport(false)
    try {
      const buffer = await file.arrayBuffer()
      const utf8Text = new TextDecoder('utf-8').decode(buffer)
      let result, format
      if (isSpreadsheetMlContent(utf8Text)) {
        result = parseKwHotelXls(utf8Text)
        format = 'XLS'
      } else {
        result = parseKwHotelReport(decodeKwHotelFile(buffer))
        format = 'CSV'
      }
      if (!result.records.length) {
        setParseError('Nie znaleziono żadnych wierszy z wyjazdem/przyjazdem — sprawdź czy to właściwy raport.')
        setParsed(null)
        setDetectedFormat('')
        return
      }
      setParsed(result)
      setDetectedFormat(format)
    } catch (err) {
      setParseError(`Błąd odczytu pliku: ${err.message}`)
      setParsed(null)
      setDetectedFormat('')
    }
  }

  function goToPreview() {
    setRows(parsed.records.map((r, i) => ({
      _id: i,
      nazwa: r.nazwa,
      typ: PRIORYTET_TO_KEY[r.priorytet],
      include: true,
    })))
    setStep(2)
  }

  function toggleRow(id) {
    setRows(rs => rs.map(r => (r._id === id ? { ...r, include: !r.include } : r)))
  }

  async function createMissingLists() {
    const missing = Object.entries(targetLists).filter(([, id]) => !id).map(([key]) => key)
    if (!missing.length) return
    setCreatingLists(true)
    const lastPos = localLists.length ? localLists[localLists.length - 1].pozycja : null
    let pos = lastPos
    const toInsert = missing.map(key => {
      pos = positionBetween(pos, null)
      return { nazwa: STATUS_LABELS[key].toUpperCase(), tablica_id: tablicaId, pozycja: pos, ...wsData() }
    })
    const { data, error } = await supabase.from('listy').insert(toInsert).select()
    setCreatingLists(false)
    if (error) { addToast(error.message, 'error'); return }
    const next = { ...targetLists }
    data.forEach((l, i) => { next[missing[i]] = l.id })
    setTargetLists(next)
    setLocalLists(prev => [...prev, ...data])
    addToast(`Utworzono ${data.length} ${data.length === 1 ? 'listę' : 'listy'}`, 'success')
  }

  async function runImport() {
    const included = rows.filter(r => r.include && targetLists[r.typ])
    if (!included.length) return
    setStep(3)
    setImporting(true)
    setFinished(false)
    setProgress({ done: 0, total: included.length })

    const terminIso = autoTermin && parsed.date ? new Date(`${parsed.date}T12:00:00`).toISOString() : null
    const lastPosByList = {}
    for (const l of localLists) {
      const cards = cardsByList?.[l.id] || []
      lastPosByList[l.id] = cards.length ? cards[cards.length - 1].pozycja : null
    }

    const toInsert = []
    for (const row of included) {
      const listaId = targetLists[row.typ]
      const newPos = positionBetween(lastPosByList[listaId] ?? null, null)
      lastPosByList[listaId] = newPos
      toInsert.push({
        workspace_id: workspaceId,
        tablica_id: tablicaId,
        lista_id: listaId,
        tytul: row.nazwa,
        pozycja: newPos,
        termin: terminIso,
        etykiety: autoLabel ? [{ color: STATUS_COLORS[row.typ], nazwa: STATUS_LABELS[row.typ] }] : [],
        meta: { zrodlo: 'kw_hotel', priorytet: row.typ },
      })
    }

    const { data, error } = await supabase.from('karty').insert(toInsert).select('id, tytul, tablica_id')
    setImporting(false)
    if (error) {
      addToast(error.message, 'error')
      setFinished(true)
      return
    }
    setProgress({ done: data.length, total: included.length })
    setFinished(true)
    for (const karta of data) {
      logActivity({ workspaceId, kartaId: karta.id, tablicaId: karta.tablica_id, user, profile, typ: 'import_kwhotel', opis: 'zaimportowano z raportu KW Hotel' })
    }
    addToast(`✅ Zaimportowano ${data.length} kart`, 'success')
    onImported?.()
  }

  const includedCount = rows.filter(r => r.include).length
  const counts = { zmiana: 0, przyjazd: 0, wyjazd: 0 }
  for (const r of rows) counts[r.typ] += 1
  const missingListsCount = Object.values(targetLists).filter(v => !v).length

  const title = step === 1 ? 'Import z KW Hotel' : step === 2 ? 'Podgląd importu' : 'Import kart'

  return (
    <Modal title={title} onClose={onClose} maxWidth={620}>
      <div className="space-y-4">
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--text-2)' }}>
              W KW Hotel: Raporty → Wykaz sprzątania → szablon „In Out 1" → Generuj → Save → CSV lub XLS.
              Karty zostaną utworzone na tej tablicy, z etykietą i kolorem wg klasyfikacji ZMIANA/PRZYJAZD/WYJAZD.
            </p>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 rounded-lg px-4 text-sm font-medium w-full justify-center"
              style={{ background: 'var(--table-sub)', color: 'var(--text-2)', minHeight: 48, border: '1px dashed var(--border)' }}
            >
              <Upload size={15} />
              {fileName || 'Przeciągnij raport KW Hotel lub kliknij aby wybrać plik (.csv, .xls)'}
            </button>
            <input ref={fileRef} type="file" accept=".csv,.xls,text/csv" style={{ display: 'none' }} onChange={handleFileChange} />

            {parseError && (
              <div className="flex items-start gap-2 rounded-lg p-3" style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.25)' }}>
                <AlertTriangle size={15} style={{ color: '#dc2626', flexShrink: 0, marginTop: 2 }} />
                <p className="text-sm" style={{ color: '#dc2626' }}>{parseError}</p>
              </div>
            )}

            {parsed && (
              <div className="space-y-3">
                <p className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>
                  Wykryto format: <strong style={{ color: 'var(--text)' }}>{detectedFormat}</strong>
                  {parsed.date && <> · data raportu: <strong style={{ color: 'var(--text)' }}>{parsed.date}</strong></>}
                </p>

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
                        Niezgodność sumy kontrolnej — sprawdź plik przed importem.
                      </p>
                    </div>
                    <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
                      <input type="checkbox" checked={forceImport} onChange={e => setForceImport(e.target.checked)} style={{ accentColor: 'var(--c-action)' }} />
                      Rozumiem ryzyko, kontynuuj mimo niezgodności
                    </label>
                  </div>
                )}

                <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                  Znaleziono <strong style={{ color: 'var(--text)' }}>{parsed.summary.total}</strong> rezerwacji:
                  {' '}{parsed.summary.zmiana} zmian, {parsed.summary.tylkoPrzyjazd} przyjazdów, {parsed.summary.tylkoWyjazd} wyjazdów.
                </p>

                <button
                  onClick={goToPreview}
                  disabled={!parsed.checksumOk && !forceImport}
                  className="w-full rounded-lg text-sm font-medium text-white"
                  style={{ background: 'var(--c-action)', minHeight: 48, opacity: (!parsed.checksumOk && !forceImport) ? 0.5 : 1 }}
                >
                  Dalej: podgląd i konfiguracja →
                </button>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--text-2)' }}>
              Znaleziono {rows.length} rezerwacji: {counts.zmiana} zmian, {counts.przyjazd} przyjazdów, {counts.wyjazd} wyjazdów.
            </p>

            <div className="space-y-2.5 rounded-xl p-3" style={{ border: '1px solid var(--border)' }}>
              <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Listy docelowe</p>
              {(['zmiana', 'przyjazd', 'wyjazd']).map(key => (
                <div key={key} className="flex items-center gap-2">
                  <span
                    className="text-xs font-medium rounded-full flex-shrink-0"
                    style={{ width: 78, padding: '3px 0', textAlign: 'center', color: STATUS_COLORS[key], background: `${STATUS_COLORS[key]}22`, border: `1px solid ${STATUS_COLORS[key]}55` }}
                  >
                    {STATUS_LABELS[key]} ({counts[key]})
                  </span>
                  <select
                    style={{ ...inputStyle, minHeight: 38, padding: '6px 10px' }}
                    value={targetLists[key]}
                    onChange={e => setTargetLists(prev => ({ ...prev, [key]: e.target.value }))}
                  >
                    <option value="">— wybierz listę —</option>
                    {localLists.map(l => <option key={l.id} value={l.id}>{l.nazwa}</option>)}
                  </select>
                </div>
              ))}
              {missingListsCount > 0 && (
                <button
                  type="button"
                  onClick={createMissingLists}
                  disabled={creatingLists}
                  className="text-xs font-medium"
                  style={{ color: 'var(--c-action)' }}
                >
                  {creatingLists ? 'Tworzenie…' : `+ Utwórz brakujące listy (${missingListsCount})`}
                </button>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
                <input type="checkbox" checked={autoLabel} onChange={e => setAutoLabel(e.target.checked)} style={{ accentColor: 'var(--c-action)' }} />
                Auto-klasyfikuj etykiety (kolor + nazwa wg typu)
              </label>
              <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
                <input type="checkbox" checked={autoTermin} onChange={e => setAutoTermin(e.target.checked)} style={{ accentColor: 'var(--c-action)' }} />
                Ustaw termin z daty raportu{parsed?.date ? ` (${parsed.date})` : ''}
              </label>
            </div>

            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', maxHeight: 280, overflowY: 'auto' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--table-sub)' }}>
                    <th className="text-left px-3 py-2" style={{ width: 36 }}></th>
                    <th className="text-left px-3 py-2" style={{ color: 'var(--text-2)' }}>Lokal</th>
                    <th className="text-left px-3 py-2" style={{ color: 'var(--text-2)' }}>Typ</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row._id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td className="px-3 py-1.5">
                        <input type="checkbox" checked={row.include} onChange={() => toggleRow(row._id)} style={{ accentColor: 'var(--c-action)' }} />
                      </td>
                      <td className="px-3 py-1.5" style={{ color: 'var(--text)' }}>{row.nazwa}</td>
                      <td className="px-3 py-1.5">
                        <span style={{ fontSize: 11, fontWeight: 600, color: STATUS_COLORS[row.typ] }}>{STATUS_LABELS[row.typ]}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => setStep(1)} className="flex items-center gap-1 rounded-lg text-sm font-medium" style={{ background: 'var(--table-sub)', color: 'var(--text-2)', minHeight: 48, padding: '0 16px' }}>
                <ChevronLeft size={14} /> Wróć
              </button>
              <button
                onClick={runImport}
                disabled={includedCount === 0 || missingListsCount > 0}
                className="flex-1 rounded-lg text-sm font-medium text-white"
                style={{ background: 'var(--c-action)', minHeight: 48, opacity: (includedCount === 0 || missingListsCount > 0) ? 0.5 : 1 }}
              >
                Importuj {includedCount} {includedCount === 1 ? 'kartę' : 'kart'} →
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            {importing && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Spinner />
                  <p className="text-sm" style={{ color: 'var(--text)' }}>Importowanie kart…</p>
                </div>
              </div>
            )}
            {finished && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle size={20} style={{ color: 'var(--c-success)' }} />
                  <p className="font-semibold" style={{ color: 'var(--text)' }}>
                    Zaimportowano {progress.done} z {progress.total} kart
                  </p>
                </div>
                <button onClick={onClose} className="w-full rounded-lg text-sm font-medium text-white" style={{ background: 'var(--c-action)', minHeight: 48 }}>
                  Zamknij
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
