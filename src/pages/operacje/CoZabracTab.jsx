import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useWorkspace } from '../../context/WorkspaceContext'
import Spinner from '../../components/Spinner'
import { ShoppingBag, LayoutList, Layers, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react'
import { aggregateDemand } from '../../utils/coZabracAggregation'

function isoToday() { return new Date().toISOString().split('T')[0] }

function StatusDot({ brak, wymagane, dostepne }) {
  if (brak === null) return <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>
  if (brak === 0) return <CheckCircle2 size={15} style={{ color: 'var(--c-success)', flexShrink: 0 }} />
  const tight = brak > 0 && brak <= wymagane * 0.25
  if (tight) return <AlertTriangle size={15} style={{ color: 'var(--c-attention)', flexShrink: 0 }} />
  return <AlertCircle size={15} style={{ color: 'var(--c-critical)', flexShrink: 0 }} />
}

function BrakBadge({ brak, wymagane }) {
  if (brak === null) return <span className="text-xs num" style={{ color: 'var(--muted)' }}>nd.</span>
  if (brak === 0) return <span className="text-xs font-medium num" style={{ color: 'var(--c-success)' }}>OK</span>
  const tight = brak <= wymagane * 0.25
  return (
    <span className="rounded-full px-2 py-0.5 text-xs font-medium num" style={{
      background: tight ? 'rgba(217,119,6,0.1)' : 'rgba(225,29,72,0.1)',
      color: tight ? 'var(--c-attention)' : 'var(--c-critical)',
    }}>
      brak {brak}
    </span>
  )
}

export default function CoZabracTab() {
  const { workspaceId, wsQuery, addWsFilter } = useWorkspace()

  const [zlecenia, setZlecenia] = useState([])
  const [pozycje, setPozycje] = useState([])
  const [aggregate, setAggregate] = useState([])
  const [loading, setLoading] = useState(true)
  const [tableExists, setTableExists] = useState(true)
  const [viewMode, setViewMode] = useState('aggregate') // 'aggregate' | 'per_prep'

  useEffect(() => {
    if (!workspaceId) { setLoading(false); return }
    fetchData()
  }, [workspaceId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchData() {
    setLoading(true)
    const today = isoToday()

    const { data: zl, error } = await addWsFilter(
      wsQuery('zlecenia').select('id, nazwa, status, data_realizacji')
    )
      .in('status', ['nowe', 'w_realizacji'])
      .eq('data_realizacji', today)
      .order('nazwa')

    if (error) {
      if (error.code === '42P01') { setTableExists(false); setLoading(false); return }
      setLoading(false); return
    }

    const ids = (zl || []).map(z => z.id)
    setZlecenia(zl || [])

    if (!ids.length) {
      setPozycje([])
      setAggregate([])
      setLoading(false)
      return
    }

    const [{ data: poz }, { data: towary }, { data: stany }] = await Promise.all([
      supabase.from('zlecenia_pozycje').select('*').in('zlecenie_id', ids),
      addWsFilter(wsQuery('towary').select('id, nazwa')).eq('aktywny', true),
      addWsFilter(wsQuery('stany_magazynowe').select('towar_id, ilosc')),
    ])

    const allPoz = poz || []
    setPozycje(allPoz)

    // Build stock map by product name (since zlecenia_pozycje only stores nazwa_pozycji)
    const nameToId = {}
    for (const t of towary || []) nameToId[t.nazwa] = t.id

    const stockById = {}
    for (const s of stany || []) {
      stockById[s.towar_id] = (stockById[s.towar_id] || 0) + Number(s.ilosc)
    }

    const stanyByName = {}
    for (const [name, tid] of Object.entries(nameToId)) {
      if (stockById[tid] !== undefined) stanyByName[name] = stockById[tid]
    }

    setAggregate(aggregateDemand(allPoz, stanyByName))
    setLoading(false)
  }

  if (loading) return <Spinner />

  if (!tableExists) {
    return (
      <div className="text-center py-16 rounded-xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <ShoppingBag size={40} className="mx-auto mb-3" style={{ color: 'var(--muted)', opacity: 0.4 }} />
        <p className="font-medium mb-1" style={{ color: 'var(--text)' }}>Moduł wymaga migracji</p>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Uruchom migrations/lokale_rezerwacje_migration.sql w panelu Supabase.</p>
      </div>
    )
  }

  const today = isoToday()
  const todayFmt = new Date(today).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })

  // Pozycje grouped by zlecenie
  const pozByZlecenie = {}
  for (const p of pozycje) {
    if (!pozByZlecenie[p.zlecenie_id]) pozByZlecenie[p.zlecenie_id] = []
    pozByZlecenie[p.zlecenie_id].push(p)
  }

  const hasBraki = aggregate.some(r => r.brak !== null && r.brak > 0)

  return (
    <div>
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Co zabrać</h1>
          <p className="text-sm mt-0.5 capitalize" style={{ color: 'var(--text-2)' }}>{todayFmt}</p>
        </div>
        {zlecenia.length > 0 && (
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            {[
              { key: 'aggregate', icon: Layers, label: 'Zbiorczo' },
              { key: 'per_prep', icon: LayoutList, label: 'Per przygotowanie' },
            ].map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => setViewMode(key)}
                className="flex items-center gap-1.5 px-3 text-sm font-medium"
                style={{
                  minHeight: 36,
                  background: viewMode === key ? 'var(--c-action)' : 'var(--card)',
                  color: viewMode === key ? '#fff' : 'var(--text-2)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <Icon size={13} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {zlecenia.length === 0 ? (
        <div className="text-center py-16 rounded-xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <ShoppingBag size={40} className="mx-auto mb-3" style={{ color: 'var(--muted)', opacity: 0.4 }} />
          <p className="font-medium mb-1" style={{ color: 'var(--text)' }}>Brak przygotowań na dziś</p>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Przygotowania zaplanowane na dziś pojawią się tutaj automatycznie.</p>
          <Link
            to="/operacje?tab=przygotowania"
            className="inline-flex items-center gap-2 mt-4 rounded-lg px-4 text-sm font-medium text-white"
            style={{ background: 'var(--c-action)', minHeight: 44 }}
          >
            Przejdź do Przygotowań
          </Link>
        </div>
      ) : viewMode === 'aggregate' ? (
        <div>
          {hasBraki && (
            <div className="flex items-center gap-2 rounded-lg px-4 py-3 mb-4 text-sm"
              style={{ background: 'rgba(225,29,72,0.06)', border: '1px solid rgba(225,29,72,0.2)', color: 'var(--c-critical)' }}>
              <AlertCircle size={15} />
              Brakuje towarów — sprawdź zanim wyjdziesz
            </div>
          )}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            {/* Header row — desktop */}
            <div className="hidden md:grid px-4 py-2.5 text-xs font-medium" style={{ gridTemplateColumns: '1fr 80px 80px 80px 100px', background: 'var(--table-head)', color: 'var(--text-2)', borderBottom: '1px solid var(--border)' }}>
              <span>Produkt</span>
              <span className="text-right">Wymagane</span>
              <span className="text-right">W magazynie</span>
              <span className="text-right">Brak</span>
              <span className="text-right">Status</span>
            </div>

            {aggregate.map((row, i) => (
              <div
                key={row.nazwa}
                className="px-4 py-3"
                style={{
                  borderBottom: i < aggregate.length - 1 ? '1px solid var(--border)' : 'none',
                  background: row.brak > 0 ? 'rgba(225,29,72,0.03)' : 'var(--card)',
                }}
              >
                {/* Mobile layout */}
                <div className="md:hidden flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <StatusDot brak={row.brak} wymagane={row.wymagane} dostepne={row.dostepne} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{row.nazwa}</p>
                      <p className="text-xs num" style={{ color: 'var(--text-2)' }}>
                        {row.wymagane} {row.jednostka} wymagane
                        {row.dostepne !== null && <> · {row.dostepne} w mag.</>}
                      </p>
                    </div>
                  </div>
                  <BrakBadge brak={row.brak} wymagane={row.wymagane} />
                </div>

                {/* Desktop layout */}
                <div className="hidden md:grid items-center" style={{ gridTemplateColumns: '1fr 80px 80px 80px 100px' }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <StatusDot brak={row.brak} wymagane={row.wymagane} dostepne={row.dostepne} />
                    <p className="text-sm truncate" style={{ color: 'var(--text)' }}>{row.nazwa}</p>
                  </div>
                  <p className="text-sm num text-right" style={{ color: 'var(--text)' }}>{row.wymagane} {row.jednostka}</p>
                  <p className="text-sm num text-right" style={{ color: 'var(--text-2)' }}>
                    {row.dostepne !== null ? `${row.dostepne} ${row.jednostka}` : '—'}
                  </p>
                  <p className="text-sm num text-right" style={{ color: row.brak > 0 ? 'var(--c-critical)' : 'var(--c-success)' }}>
                    {row.brak !== null ? (row.brak > 0 ? `${row.brak} ${row.jednostka}` : '—') : '—'}
                  </p>
                  <div className="flex justify-end">
                    <BrakBadge brak={row.brak} wymagane={row.wymagane} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs mt-3 text-right" style={{ color: 'var(--muted)' }}>
            {zlecenia.length} {zlecenia.length === 1 ? 'przygotowanie' : 'przygotowania'} na dziś · {aggregate.length} pozycji
          </p>
        </div>
      ) : (
        /* Per preparation view */
        <div className="space-y-4">
          {zlecenia.map(z => {
            const poz = pozByZlecenie[z.id] || []
            const wydano = poz.filter(p => p.wydano).length
            return (
              <div key={z.id} className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <div className="px-4 py-3 flex items-center justify-between gap-3" style={{ borderBottom: '1px solid var(--border)', background: 'var(--table-sub)' }}>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>{z.nazwa}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>
                      {wydano}/{poz.length} wydano
                    </p>
                  </div>
                  <Link
                    to={`/operacje/przygotowania/${z.id}`}
                    className="flex-shrink-0 text-xs font-medium rounded-lg px-3"
                    style={{ color: 'var(--c-action)', background: 'rgba(37,99,235,0.08)', minHeight: 32, display: 'flex', alignItems: 'center', textDecoration: 'none' }}
                  >
                    Otwórz
                  </Link>
                </div>
                {poz.length === 0 ? (
                  <p className="text-sm text-center py-4" style={{ color: 'var(--muted)' }}>Brak pozycji</p>
                ) : (
                  poz.map((p, i) => (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-2.5"
                      style={{ borderBottom: i < poz.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div
                        className="rounded flex-shrink-0"
                        style={{ width: 8, height: 8, background: p.wydano ? 'var(--c-success)' : 'var(--border)', borderRadius: '50%' }}
                      />
                      <p className="flex-1 text-sm" style={{ color: p.wydano ? 'var(--muted)' : 'var(--text)', textDecoration: p.wydano ? 'line-through' : 'none' }}>
                        {p.nazwa_pozycji}
                      </p>
                      <span className="text-sm num flex-shrink-0" style={{ color: 'var(--text-2)' }}>
                        {p.ilosc} {p.jednostka || 'szt.'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
