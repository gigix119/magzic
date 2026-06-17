import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'
import { useWorkspace } from '../../context/WorkspaceContext'
import Spinner from '../../components/Spinner'
import { aggregateDemand } from '../../utils/coZabracAggregation'
import { Package, Layers, LayoutList, AlertCircle } from 'lucide-react'

function isoToday() { return new Date().toISOString().split('T')[0] }

function StatusLabel({ brak }) {
  if (brak === null) return <span className="text-xs num" style={{ color: 'var(--muted)' }}>nd.</span>
  if (brak === 0) return <span className="text-xs font-semibold num" style={{ color: 'var(--c-success)' }}>OK</span>
  return <span className="text-xs font-semibold num" style={{ color: 'var(--c-critical)' }}>⚠️ brak {brak}</span>
}

export default function WorkerZabrac() {
  const { workspaceId, wsQuery, addWsFilter } = useWorkspace()

  const [zlecenia, setZlecenia] = useState([])
  const [pozycje, setPozycje] = useState([])
  const [aggregate, setAggregate] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('aggregate')

  useEffect(() => {
    if (!workspaceId) { setLoading(false); return }
    fetchData()
  }, [workspaceId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchData() {
    setLoading(true)
    const today = isoToday()

    const { data: zl } = await addWsFilter(
      wsQuery('zlecenia').select('id, nazwa, status')
    ).in('status', ['nowe', 'w_realizacji']).eq('data_realizacji', today).order('nazwa')

    const all = zl || []
    setZlecenia(all)

    const ids = all.map(z => z.id)
    if (!ids.length) {
      setPozycje([]); setAggregate([]); setLoading(false)
      return
    }

    const [{ data: poz }, { data: towary }, { data: stany }] = await Promise.all([
      supabase.from('zlecenia_pozycje').select('*').in('zlecenie_id', ids),
      addWsFilter(wsQuery('towary').select('id, nazwa')).eq('aktywny', true),
      addWsFilter(wsQuery('stany_magazynowe').select('towar_id, ilosc')),
    ])

    const allPoz = poz || []
    setPozycje(allPoz)

    const nameToId = {}
    for (const t of towary || []) nameToId[t.nazwa] = t.id
    const stockById = {}
    for (const s of stany || []) stockById[s.towar_id] = (stockById[s.towar_id] || 0) + Number(s.ilosc)
    const stanyByName = {}
    for (const [name, tid] of Object.entries(nameToId)) {
      if (stockById[tid] !== undefined) stanyByName[name] = stockById[tid]
    }

    setAggregate(aggregateDemand(allPoz, stanyByName))
    setLoading(false)
  }

  if (loading) return <Spinner />

  const pozByZlecenie = {}
  for (const p of pozycje) {
    if (!pozByZlecenie[p.zlecenie_id]) pozByZlecenie[p.zlecenie_id] = []
    pozByZlecenie[p.zlecenie_id].push(p)
  }

  const totalQty = aggregate.reduce((s, r) => s + r.wymagane, 0)
  const hasBraki = aggregate.some(r => r.brak !== null && r.brak > 0)

  return (
    <div>
      <h1 className="font-bold mb-1" style={{ fontSize: 20, color: 'var(--text)' }}>Co zabrać — Dziś</h1>
      <p className="text-sm mb-4" style={{ color: 'var(--text-2)' }}>
        {zlecenia.length} {zlecenia.length === 1 ? 'zadanie' : 'zadania'} na dziś
      </p>

      {zlecenia.length > 1 && (
        <div className="flex rounded-lg overflow-hidden mb-4" style={{ border: '1px solid var(--border)' }}>
          {[
            { key: 'aggregate', icon: Layers, label: 'Zbiorczo' },
            { key: 'per_prep', icon: LayoutList, label: 'Per zadanie' },
          ].map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setViewMode(key)}
              className="flex-1 flex items-center justify-center gap-1.5 text-sm font-medium"
              style={{ minHeight: 44, background: viewMode === key ? 'var(--c-action)' : 'var(--c-surface)', color: viewMode === key ? '#fff' : 'var(--text-2)', border: 'none' }}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      )}

      {zlecenia.length === 0 ? (
        <div className="text-center py-16 rounded-xl" style={{ background: 'var(--c-surface)', border: '1px solid var(--border)' }}>
          <Package size={40} className="mx-auto mb-3" style={{ color: 'var(--muted)', opacity: 0.4 }} />
          <p className="font-medium" style={{ color: 'var(--text)' }}>Brak zadań na dziś</p>
        </div>
      ) : viewMode === 'aggregate' ? (
        <div>
          {hasBraki && (
            <div className="flex items-center gap-2 rounded-lg px-4 py-3 mb-3 text-sm font-medium"
              style={{ background: 'rgba(225,29,72,0.08)', border: '1px solid rgba(225,29,72,0.2)', color: 'var(--c-critical)' }}>
              <AlertCircle size={15} /> Brakuje towarów — sprawdź zanim wyjedziesz
            </div>
          )}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            {aggregate.map((row, i) => (
              <div key={row.nazwa} className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: i < aggregate.length - 1 ? '1px solid var(--border)' : 'none', background: row.brak > 0 ? 'rgba(225,29,72,0.04)' : 'var(--c-surface)' }}>
                <p className="text-sm flex-1 min-w-0 truncate" style={{ color: 'var(--text)' }}>{row.nazwa}</p>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="num font-bold" style={{ fontSize: 18, color: 'var(--text)' }}>× {row.wymagane}</span>
                  <StatusLabel brak={row.brak} />
                </div>
              </div>
            ))}
          </div>
          <p className="text-sm text-right mt-3 font-medium" style={{ color: 'var(--text-2)' }}>
            Łącznie: {totalQty} szt. · {zlecenia.length} {zlecenia.length === 1 ? 'zadanie' : 'zadania'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {zlecenia.map(z => {
            const poz = pozByZlecenie[z.id] || []
            return (
              <div key={z.id} className="rounded-xl overflow-hidden" style={{ background: 'var(--c-surface)', border: '1px solid var(--border)' }}>
                <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                  <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{z.nazwa}</p>
                </div>
                {poz.length === 0 ? (
                  <p className="text-sm text-center py-4" style={{ color: 'var(--muted)' }}>Brak pozycji</p>
                ) : (
                  poz.map((p, i) => (
                    <div key={p.id} className="flex items-center justify-between px-4 py-2.5"
                      style={{ borderBottom: i < poz.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <p className="text-sm" style={{ color: 'var(--text)' }}>{p.nazwa_pozycji}</p>
                      <span className="text-sm num font-medium" style={{ color: 'var(--text-2)' }}>× {p.ilosc}</span>
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
