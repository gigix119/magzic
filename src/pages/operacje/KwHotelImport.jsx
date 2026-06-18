import { useState, useRef, useEffect } from 'react'
import { supabase } from '../../supabase'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useToast } from '../../context/ToastContext'
import { parseKwHotelReport, decodeKwHotelFile, PRIORYTETY } from '../../utils/kwHotelReportParser'
import { parseKwHotelXls, isSpreadsheetMlContent } from '../../utils/kwHotelXlsParser'
import { normalizeName, matchLokal, fuzzyTopMatches } from '../../utils/fuzzyMatch'
import { LOKALIZACJE_UNIKALNE } from '../../utils/lokaleImportParser'
import { buildChecklistRows } from '../../utils/defaultChecklist'
import { calculateForecast } from '../../utils/forecastEngine'
import { planTeams, estimateWorkload, hoursPerPerson, buildPlanText } from '../../utils/teamPlanner'
import { positionBetween } from '../tablice/tablicaTokens'
import Modal from '../../components/Modal'
import BottomSheet from '../../components/ui/BottomSheet'
import Spinner from '../../components/Spinner'
import { Upload, CheckCircle, AlertTriangle, ChevronLeft, MapPin, Copy, Check, Users, LayoutGrid } from 'lucide-react'

const PRIORYTET_TO_FIELD = { 1: 'pilny', 2: 'normalny', 3: 'niski' }
const PRIORYTET_TO_TYP = { 1: 'zmiana', 2: 'przyjazd', 3: 'wyjazd' }
const PRIORYTET_BADGE = {
  1: { emoji: '🔴', bg: '#fef2f2', text: '#991b1b' },
  2: { emoji: '🟡', bg: '#fff7ed', text: '#9a3412' },
  3: { emoji: '🔵', bg: '#eff6ff', text: '#1e40af' },
}
const WORKLOAD_BADGE = {
  niskie: { emoji: '🟢', label: 'NISKIE', text: '#166534' },
  srednie: { emoji: '🟡', label: 'ŚREDNIE', text: '#9a3412' },
  wysokie: { emoji: '🔴', label: 'WYSOKIE', text: '#991b1b' },
}

function isoToday() { return new Date().toISOString().split('T')[0] }
function dmyDate(iso) {
  if (!iso) return iso
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
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

function rememberAlias(workspaceId, nazwaKw, lokalId) {
  supabase.from('kwhotel_aliasy')
    .upsert({ workspace_id: workspaceId, nazwa_kw: nazwaKw, lokal_id: lokalId }, { onConflict: 'workspace_id,nazwa_kw' })
    .then(() => {})
}

export default function KwHotelImport({ onClose, onCreated }) {
  const { workspaceId } = useWorkspace()
  const { addToast } = useToast()
  const isMobile = useMobile()
  const fileRef = useRef()

  const [step, setStep] = useState(1)
  const [fileName, setFileName] = useState('')
  const [detectedFormat, setDetectedFormat] = useState('')
  const [parsed, setParsed] = useState(null)
  const [parseError, setParseError] = useState('')
  const [forceImport, setForceImport] = useState(false)
  const [date, setDate] = useState(isoToday())

  const [loadingLokale, setLoadingLokale] = useState(false)
  const [lokale, setLokale] = useState([])
  const [rows, setRows] = useState([])
  const [stockMaps, setStockMaps] = useState({ pakietyMap: {}, towaryMap: {}, stanyMap: {}, towaryByName: {} })
  const [headcount, setHeadcount] = useState(6)
  const [copied, setCopied] = useState(false)

  const [boards, setBoards] = useState([])
  const [selectedBoardId, setSelectedBoardId] = useState('')
  const [generatingCards, setGeneratingCards] = useState(false)

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
      setDate(result.date || isoToday())
    } catch (err) {
      setParseError(`Błąd odczytu pliku: ${err.message}`)
      setParsed(null)
      setDetectedFormat('')
    }
  }

  async function goToPreview() {
    setLoadingLokale(true)
    const [{ data: lok }, { data: aliasy }, { data: towary }, { data: stany }, { data: tabliceLokale }] = await Promise.all([
      supabase.from('lokale').select('id, nazwa, lokalizacja, domyslny_pakiet_id').eq('workspace_id', workspaceId).eq('aktywny', true).order('nazwa'),
      supabase.from('kwhotel_aliasy').select('nazwa_kw, lokal_id').eq('workspace_id', workspaceId),
      supabase.from('towary').select('id, nazwa, jednostka').eq('aktywny', true),
      supabase.from('stany_magazynowe').select('towar_id, ilosc'),
      supabase.from('tablice').select('id, nazwa').eq('workspace_id', workspaceId).eq('typ', 'lokale').eq('archiwum', false).order('nazwa'),
    ])
    const lokaleList = lok || []
    setLokale(lokaleList)
    setBoards(tabliceLokale || [])
    setSelectedBoardId(tabliceLokale?.[0]?.id || '')

    const lokaleById = {}
    for (const l of lokaleList) lokaleById[l.id] = l

    const aliasMap = {}
    for (const a of aliasy || []) aliasMap[normalizeName(a.nazwa_kw)] = a.lokal_id

    const pakietIds = new Set(lokaleList.filter(l => l.domyslny_pakiet_id).map(l => l.domyslny_pakiet_id))
    const pakietyMap = {}
    if (pakietIds.size > 0) {
      const { data: elementy } = await supabase
        .from('elementy_pakietu')
        .select('pakiet_id, towar_id, ilosc')
        .in('pakiet_id', [...pakietIds])
      for (const e of elementy || []) {
        if (!pakietyMap[e.pakiet_id]) pakietyMap[e.pakiet_id] = []
        pakietyMap[e.pakiet_id].push({ towar_id: e.towar_id, ilosc: e.ilosc })
      }
    }

    const towaryMap = {}
    const towaryByName = {}
    for (const t of towary || []) {
      towaryMap[t.id] = t
      towaryByName[t.nazwa.toLowerCase().trim()] = t.id
    }
    const stanyMap = {}
    for (const s of stany || []) stanyMap[s.towar_id] = (stanyMap[s.towar_id] || 0) + Number(s.ilosc)
    setStockMaps({ pakietyMap, towaryMap, stanyMap, towaryByName })

    setRows(parsed.records.map((r, i) => {
      const aliasLokalId = aliasMap[normalizeName(r.nazwa)] && lokaleById[aliasMap[normalizeName(r.nazwa)]] ? aliasMap[normalizeName(r.nazwa)] : null
      const matched = (aliasLokalId && lokaleById[aliasLokalId]) || matchLokal(r.nazwa, lokaleList)
      return {
        _id: i,
        ...r,
        include: true,
        matchedLokalId: matched?.id || aliasLokalId || null,
      }
    }))
    setLoadingLokale(false)
    setStep(2)
  }

  function updateRow(id, changes) {
    setRows(rs => rs.map(r => r._id === id ? { ...r, ...changes } : r))
    if (changes.matchedLokalId) {
      const row = rows.find(r => r._id === id)
      if (row) rememberAlias(workspaceId, row.nazwa, changes.matchedLokalId)
    }
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

  async function generateBoardCards() {
    if (!selectedBoardId) return
    setGeneratingCards(true)

    const [{ data: lists }, { data: existingCards }] = await Promise.all([
      supabase.from('listy').select('id, nazwa, pozycja').eq('tablica_id', selectedBoardId).eq('archiwum', false).order('pozycja'),
      supabase.from('karty').select('lista_id, pozycja, meta').eq('tablica_id', selectedBoardId).eq('archiwum', false),
    ])
    const targetList = (lists || []).find(l => l.nazwa === 'Do przygotowania') || (lists || [])[0]
    if (!targetList) {
      addToast('Wybrana tablica nie ma żadnej listy', 'error')
      setGeneratingCards(false)
      return
    }

    const existingKeys = new Set((existingCards || []).map(c => c.meta?.dedupe_key).filter(Boolean))
    let lastPos = (existingCards || [])
      .filter(c => c.lista_id === targetList.id)
      .reduce((max, c) => (max == null || c.pozycja > max ? c.pozycja : max), null)

    const lokaleById = {}
    for (const l of lokale) lokaleById[l.id] = l

    const toInsert = []
    for (const row of rows.filter(r => r.include)) {
      const dedupeKey = `${row.nazwa}|${date}|${row.priorytet}`
      if (existingKeys.has(dedupeKey)) continue
      const lokal = row.matchedLokalId ? lokaleById[row.matchedLokalId] : null
      const displayName = lokal ? lokal.nazwa : row.nazwa
      lastPos = positionBetween(lastPos, null)
      toInsert.push({
        workspace_id: workspaceId,
        tablica_id: selectedBoardId,
        lista_id: targetList.id,
        tytul: `${displayName} – ${dmyDate(date)}`,
        pozycja: lastPos,
        lokal_id: row.matchedLokalId || null,
        meta: { priorytet: PRIORYTET_TO_TYP[row.priorytet], zrodlo: 'kw_hotel', dedupe_key: dedupeKey },
      })
    }

    if (toInsert.length === 0) {
      addToast('Wszystkie karty z tego importu już istnieją na tablicy', 'info')
      setGeneratingCards(false)
      return
    }

    const { error } = await supabase.from('karty').insert(toInsert)
    setGeneratingCards(false)
    if (error) addToast(error.message, 'error')
    else addToast(`Wygenerowano ${toInsert.length} kart na tablicy`, 'success')
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

  const teamPlan = planTeams(includedRows)
  const workload = estimateWorkload(includedRows)
  const perPerson = hoursPerPerson(workload.totalHours, headcount)

  const stockForecast = (() => {
    const lokaleMap = {}
    for (const l of lokale) lokaleMap[l.id] = l
    const rezerwacje = includedRows
      .filter(r => r.matchedLokalId)
      .map(r => ({ lokal_id: r.matchedLokalId, przygotowanie_id: null }))
    if (!rezerwacje.length) return []
    return calculateForecast({
      rezerwacje,
      lokaleMap,
      pakietyMap: stockMaps.pakietyMap,
      stanyMap: stockMaps.stanyMap,
      towaryMap: stockMaps.towaryMap,
      towaryByName: stockMaps.towaryByName,
    }).filter(line => line.doZamowienia > 0)
  })()

  function handleCopyPlan() {
    const text = buildPlanText(dmyDate(date), includedRows, teamPlan)
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const title = step === 1 ? 'Import z KW Hotel' : step === 2 ? 'Podgląd i priorytety' : 'Tworzenie przygotowań'

  const content = (
    <div className="space-y-4">
      {/* ── STEP 1: upload ── */}
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>
            W KW Hotel: Raporty → Wykaz sprzątania → szablon „In Out 1" → Generuj → Save → CSV lub XLS.
          </p>
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 rounded-lg px-4 text-sm font-medium w-full justify-center"
            style={{ background: 'var(--table-sub)', color: 'var(--text-2)', minHeight: 48, border: '1px dashed var(--border)' }}
          >
            <Upload size={15} />
            {fileName || 'Wgraj raport „Rozkład dnia" (.csv lub .xls z KW Hotel)'}
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

          {/* Plan dnia wg stref + sugerowane ekipy */}
          {teamPlan.strefy.length > 0 && (
            <div className="rounded-xl p-3 space-y-2" style={{ border: '1px solid var(--border)' }}>
              <p className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--text)' }}>
                <Users size={14} /> Plan dnia wg lokalizacji
              </p>
              {teamPlan.strefy.map(s => (
                <p key={s.key} className="text-xs" style={{ color: 'var(--text-2)' }}>
                  <strong style={{ color: 'var(--text)' }}>{s.nazwa}</strong> — {s.total} przygotowań · {s.zmiany} zmian (pilne) · sugerowane ekipy: {s.sugerowaneEkipy}
                </p>
              ))}
              {teamPlan.strefy.length > 1 && (
                <p className="text-xs" style={{ color: 'var(--c-attention)' }}>
                  ⚠️ Sugestia: {teamPlan.totalSugerowaneEkipy} ekip łącznie — strefy są od siebie oddalone, nie łącz trasy.
                </p>
              )}
            </div>
          )}

          {/* Obciążenie dnia */}
          <div className="rounded-xl p-3 space-y-2" style={{ border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold" style={{ color: WORKLOAD_BADGE[workload.level].text }}>
                {WORKLOAD_BADGE[workload.level].emoji} Obciążenie dnia: {WORKLOAD_BADGE[workload.level].label}
              </p>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-2)' }}>
              {workload.breakdown.zmiana} zmian · {workload.breakdown.przyjazd} przyjazdów · {workload.breakdown.wyjazd} wyjazdów —
              {' '}szac. <strong style={{ color: 'var(--text)' }}>~{workload.totalHours.toFixed(1)}h</strong>
            </p>
            <div className="flex items-center gap-2">
              <label className="text-xs" style={{ color: 'var(--text-2)' }}>Liczba osób:</label>
              <input
                type="number"
                min={1}
                value={headcount}
                onChange={e => setHeadcount(Math.max(1, Number(e.target.value) || 1))}
                style={{ width: 56, background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '4px 6px', fontSize: 13 }}
              />
              {perPerson != null && (
                <span className="text-xs" style={{ color: 'var(--text-2)' }}>≈ {perPerson.toFixed(1)}h / osobę</span>
              )}
            </div>
          </div>

          {/* Braki magazynowe */}
          {stockForecast.length > 0 && (
            <div className="space-y-1.5 rounded-lg p-3" style={{ background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.2)' }}>
              <p className="text-sm font-medium" style={{ color: '#dc2626' }}>⚠️ Może zabraknąć materiałów:</p>
              {stockForecast.map(line => (
                <p key={line.towar_id} className="text-xs" style={{ color: '#dc2626' }}>
                  {line.nazwa}: potrzeba {line.potrzebne}, masz {line.dostepne} {line.jednostka} — brak {line.doZamowienia}
                </p>
              ))}
            </div>
          )}

          <button
            onClick={handleCopyPlan}
            className="flex items-center gap-2 rounded-lg text-sm font-medium w-full justify-center"
            style={{ background: 'var(--table-sub)', color: 'var(--text-2)', minHeight: 44, border: '1px solid var(--border)' }}
          >
            {copied ? <Check size={14} style={{ color: 'var(--c-success)' }} /> : <Copy size={14} />}
            {copied ? 'Skopiowano!' : 'Kopiuj plan dnia (WhatsApp/SMS)'}
          </button>

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
                          <div key={row._id} className="flex items-center gap-2 flex-wrap">
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
                              <div className="flex items-center gap-1 flex-wrap">
                                {fuzzyTopMatches(row.nazwa, lokale, 3).map(cand => (
                                  <button
                                    key={cand.id}
                                    onClick={() => updateRow(row._id, { matchedLokalId: cand.id })}
                                    className="text-xs px-1.5 py-0.5 rounded"
                                    style={{ background: 'var(--table-sub)', border: '1px solid var(--border)', color: 'var(--text)' }}
                                  >
                                    {cand.nazwa}
                                  </button>
                                ))}
                                <select
                                  value=""
                                  onChange={e => updateRow(row._id, { matchedLokalId: e.target.value || null })}
                                  style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12, padding: '4px 6px', maxWidth: 110 }}
                                >
                                  <option value="">⚠️ inne…</option>
                                  {lokale.map(l => <option key={l.id} value={l.id}>{l.nazwa}</option>)}
                                </select>
                              </div>
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

          {boards.length > 0 && (
            <div className="rounded-xl p-3 space-y-2" style={{ border: '1px solid var(--border)' }}>
              <p className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--text)' }}>
                <LayoutGrid size={14} /> Wygeneruj karty na tablicy
              </p>
              <select
                value={selectedBoardId}
                onChange={e => setSelectedBoardId(e.target.value)}
                style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', padding: '8px 10px', fontSize: 14, minHeight: 40 }}
              >
                {boards.map(b => <option key={b.id} value={b.id}>{b.nazwa}</option>)}
              </select>
              <button
                onClick={generateBoardCards}
                disabled={generatingCards || includedRows.length === 0}
                className="w-full rounded-lg text-sm font-medium"
                style={{ background: 'var(--table-sub)', color: 'var(--text)', minHeight: 44, border: '1px solid var(--border)', opacity: includedRows.length === 0 ? 0.5 : 1 }}
              >
                {generatingCards ? 'Generowanie…' : `Wygeneruj ${includedRows.length} kart na tablicy`}
              </button>
            </div>
          )}

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
