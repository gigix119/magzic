import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useWorkspace } from '../../context/WorkspaceContext'
import Spinner from '../../components/Spinner'
import { calculateForecast } from '../../utils/forecastEngine'
import { TrendingDown, CheckCircle2, AlertTriangle, AlertCircle, Copy, Check } from 'lucide-react'

const RANGES = [
  { key: 3,  label: '3 dni' },
  { key: 7,  label: '7 dni' },
  { key: 14, label: '14 dni' },
  { key: 30, label: '30 dni' },
]

function addDays(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function isoToday() { return new Date().toISOString().split('T')[0] }

function StatusIcon({ row }) {
  if (row.doZamowienia > 0) return <AlertCircle size={15} style={{ color: 'var(--c-critical)', flexShrink: 0 }} />
  if (row.potrzebne > row.dostepne * 0.8 && row.dostepne > 0)
    return <AlertTriangle size={15} style={{ color: 'var(--c-attention)', flexShrink: 0 }} />
  return <CheckCircle2 size={15} style={{ color: 'var(--c-success)', flexShrink: 0 }} />
}

export default function PrognozaTab() {
  const { workspaceId, wsQuery, addWsFilter } = useWorkspace()
  const [rangeDays, setRangeDays] = useState(7)
  const [result, setResult] = useState([])
  const [totalPreps, setTotalPreps] = useState(0)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const fetchForecast = useCallback(async (days) => {
    if (!workspaceId) return
    setLoading(true)
    const today = isoToday()
    const endDate = addDays(days)

    const [
      { data: rezerwacje },
      { data: lokale },
      { data: towary },
      { data: stany },
    ] = await Promise.all([
      addWsFilter(wsQuery('rezerwacje').select('id, lokal_id, przygotowanie_id'))
        .gte('checkin_at', today).lte('checkin_at', endDate)
        .in('status', ['potwierdzona', 'zameldowana']),
      addWsFilter(wsQuery('lokale').select('id, domyslny_pakiet_id')).eq('aktywny', true),
      addWsFilter(wsQuery('towary').select('id, nazwa, jednostka')).eq('aktywny', true),
      addWsFilter(wsQuery('stany_magazynowe').select('towar_id, ilosc')),
    ])

    setTotalPreps((rezerwacje || []).length)

    if (!(rezerwacje || []).length) {
      setResult([])
      setLoading(false)
      return
    }

    // Unikalne pakiet_ids z lokali
    const lokaleMap = {}
    const pakietIds = new Set()
    for (const l of lokale || []) {
      lokaleMap[l.id] = l
      if (l.domyslny_pakiet_id) pakietIds.add(l.domyslny_pakiet_id)
    }

    // Elementy pakietów dla lokali bez przygotowania
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

    // Pozycje z istniejących przygotowań
    const zleceniePozycjeMap = {}
    const rezWithPrep = (rezerwacje || []).filter(r => r.przygotowanie_id)
    if (rezWithPrep.length) {
      const { data: pozycje } = await supabase
        .from('zlecenia_pozycje')
        .select('zlecenie_id, nazwa_pozycji, ilosc')
        .in('zlecenie_id', rezWithPrep.map(r => r.przygotowanie_id))
      for (const p of pozycje || []) {
        if (!zleceniePozycjeMap[p.zlecenie_id]) zleceniePozycjeMap[p.zlecenie_id] = []
        zleceniePozycjeMap[p.zlecenie_id].push(p)
      }
    }

    // Mapy towarów
    const towaryMap = {}
    const towaryByName = {}
    for (const t of towary || []) {
      towaryMap[t.id] = t
      towaryByName[t.nazwa.toLowerCase().trim()] = t.id
    }

    const stanyMap = {}
    for (const s of stany || []) {
      stanyMap[s.towar_id] = (stanyMap[s.towar_id] || 0) + Number(s.ilosc)
    }

    const forecast = calculateForecast({
      rezerwacje: rezerwacje || [],
      lokaleMap,
      pakietyMap,
      stanyMap,
      towaryMap,
      zleceniePozycjeMap,
      towaryByName,
    })

    setResult(forecast)
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId])

  useEffect(() => { fetchForecast(rangeDays) }, [fetchForecast, rangeDays])

  function handleCopy() {
    const braki = result.filter(r => r.doZamowienia > 0)
    if (!braki.length) return
    const text = braki.map(r => `${r.nazwa}: ${r.doZamowienia} ${r.jednostka}`).join('\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const braki = result.filter(r => r.doZamowienia > 0)
  const ok = result.filter(r => r.doZamowienia === 0)

  return (
    <div>
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Prognoza zapotrzebowania</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>
            {totalPreps} {totalPreps === 1 ? 'przygotowanie' : 'przygotowań'} w wybranym okresie
          </p>
        </div>
        {braki.length > 0 && (
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 rounded-lg px-4 text-sm font-medium"
            style={{ minHeight: 40, border: '1px solid var(--border)', color: 'var(--text-2)', background: 'var(--card)' }}
          >
            {copied ? <Check size={14} style={{ color: 'var(--c-success)' }} /> : <Copy size={14} />}
            {copied ? 'Skopiowano!' : 'Kopiuj listę zakupów'}
          </button>
        )}
      </div>

      {/* Selektor zakresu */}
      <div className="flex rounded-lg overflow-hidden mb-5" style={{ border: '1px solid var(--border)', alignSelf: 'flex-start', display: 'inline-flex' }}>
        {RANGES.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setRangeDays(key)}
            className="px-4 text-sm font-medium"
            style={{
              minHeight: 40,
              background: rangeDays === key ? 'var(--c-action)' : 'var(--card)',
              color: rangeDays === key ? '#fff' : 'var(--text-2)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? <Spinner /> : result.length === 0 ? (
        <div className="text-center py-16 rounded-xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <TrendingDown size={40} className="mx-auto mb-3" style={{ color: 'var(--muted)', opacity: 0.4 }} />
          <p className="font-medium mb-1" style={{ color: 'var(--text)' }}>
            {totalPreps === 0 ? 'Brak rezerwacji w tym okresie' : 'Brak towarów do prognozy'}
          </p>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            {totalPreps === 0
              ? 'Dodaj rezerwacje lub wybierz inny zakres.'
              : 'Ustaw domyślny pakiet dla lokali, aby obliczać prognozę.'}
          </p>
          <Link to="/operacje?tab=rezerwacje" className="inline-flex items-center gap-2 mt-4 rounded-lg px-4 text-sm font-medium text-white"
            style={{ background: 'var(--c-action)', minHeight: 44 }}>
            Przejdź do Rezerwacji
          </Link>
        </div>
      ) : (
        <>
          {/* Braki */}
          {braki.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 rounded-lg px-4 py-3 mb-3 text-sm"
                style={{ background: 'rgba(225,29,72,0.06)', border: '1px solid rgba(225,29,72,0.2)', color: 'var(--c-critical)' }}>
                <AlertCircle size={15} />
                {braki.length} {braki.length === 1 ? 'produkt wymaga' : 'produktów wymaga'} zamówienia
              </div>
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                {/* Nagłówek desktop */}
                <div className="hidden md:grid px-4 py-2.5 text-xs font-medium"
                  style={{ gridTemplateColumns: '1fr 90px 90px 100px 80px', background: 'var(--table-head)', color: 'var(--text-2)', borderBottom: '1px solid var(--border)' }}>
                  <span>Produkt</span>
                  <span className="text-right">Potrzeba</span>
                  <span className="text-right">Dostępne</span>
                  <span className="text-right">Do zamówienia</span>
                  <span className="text-right">Status</span>
                </div>
                {braki.map((row, i) => (
                  <ForecastRow key={row.towar_id} row={row} last={i === braki.length - 1} />
                ))}
              </div>
            </div>
          )}

          {/* OK / wystarczy */}
          {ok.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-2)' }}>
                <CheckCircle2 size={14} style={{ display: 'inline', color: 'var(--c-success)', marginRight: 6 }} />
                Wystarczające stany ({ok.length} {ok.length === 1 ? 'produkt' : 'produktów'})
              </p>
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                {ok.map((row, i) => (
                  <ForecastRow key={row.towar_id} row={row} last={i === ok.length - 1} />
                ))}
              </div>
            </div>
          )}

          <p className="text-xs mt-4 text-right" style={{ color: 'var(--muted)' }}>
            Łącznie: {result.length} produktów · {totalPreps} rezerwacji w {rangeDays} dniach
          </p>
        </>
      )}
    </div>
  )
}

function ForecastRow({ row, last }) {
  const critColor = row.doZamowienia > 0 ? 'rgba(225,29,72,0.03)' : 'var(--card)'
  return (
    <div className="px-4 py-3" style={{ borderBottom: last ? 'none' : '1px solid var(--border)', background: critColor }}>
      {/* Mobile */}
      <div className="md:hidden flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <StatusIcon row={row} />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{row.nazwa}</p>
            <p className="text-xs num" style={{ color: 'var(--text-2)' }}>
              {row.potrzebne} {row.jednostka} potrzeba · {row.dostepne} dostępne
            </p>
          </div>
        </div>
        {row.doZamowienia > 0 && (
          <span className="rounded-full px-2.5 py-1 text-xs font-semibold num flex-shrink-0"
            style={{ background: 'rgba(225,29,72,0.1)', color: 'var(--c-critical)', whiteSpace: 'nowrap' }}>
            zamów {row.doZamowienia}
          </span>
        )}
      </div>

      {/* Desktop */}
      <div className="hidden md:grid items-center" style={{ gridTemplateColumns: '1fr 90px 90px 100px 80px' }}>
        <div className="flex items-center gap-2 min-w-0">
          <StatusIcon row={row} />
          <p className="text-sm truncate" style={{ color: 'var(--text)' }}>{row.nazwa}</p>
        </div>
        <p className="text-sm num text-right" style={{ color: 'var(--text)' }}>{row.potrzebne} {row.jednostka}</p>
        <p className="text-sm num text-right" style={{ color: 'var(--text-2)' }}>{row.dostepne} {row.jednostka}</p>
        <p className="text-sm num font-semibold text-right" style={{ color: row.doZamowienia > 0 ? 'var(--c-critical)' : 'var(--c-success)' }}>
          {row.doZamowienia > 0 ? `${row.doZamowienia} ${row.jednostka}` : '—'}
        </p>
        <div className="flex justify-end">
          <StatusIcon row={row} />
        </div>
      </div>
    </div>
  )
}
