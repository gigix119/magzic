import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../supabase'
import { useWorkspace } from '../../context/WorkspaceContext'
import Spinner from '../../components/Spinner'
import { analyzePlannedVsActual } from '../../utils/plannedVsActual'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'
import { TrendingUp, TrendingDown, Package, LayoutList, Layers, AlertTriangle } from 'lucide-react'

const PERIODS = [
  { key: 'week',   label: 'Ten tydzień' },
  { key: 'month',  label: 'Ten miesiąc' },
  { key: 'last30', label: 'Ostatnie 30 dni' },
]

function isoToday() { return new Date().toISOString().split('T')[0] }

function getPeriodDates(key) {
  const today = new Date()
  const todayStr = isoToday()
  if (key === 'week') {
    const dow = today.getDay() || 7
    const mon = new Date(today)
    mon.setDate(today.getDate() - dow + 1)
    return { start: mon.toISOString().split('T')[0], end: todayStr }
  }
  if (key === 'month') {
    return { start: todayStr.slice(0, 8) + '01', end: todayStr }
  }
  // last30
  const d = new Date(today); d.setDate(d.getDate() - 30)
  return { start: d.toISOString().split('T')[0], end: todayStr }
}

function EfficiencyBadge({ pct }) {
  if (pct === null) return <span style={{ color: 'var(--muted)' }}>—</span>
  const color = pct <= 100 ? 'var(--c-success)' : pct <= 110 ? 'var(--c-attention)' : 'var(--c-critical)'
  const Icon = pct <= 100 ? TrendingDown : TrendingUp
  return (
    <span className="flex items-center gap-1 num" style={{ color }}>
      <Icon size={12} />
      {pct}%
    </span>
  )
}

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}>
      <p className="font-medium mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.dataKey === 'planned' ? 'Plan' : 'Wydano'}: {p.value}
        </p>
      ))}
    </div>
  )
}

export default function RaportTab() {
  const { workspaceId, wsQuery, addWsFilter } = useWorkspace()
  const [period, setPeriod] = useState('month')
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('produkty')

  const fetchReport = useCallback(async (per) => {
    if (!workspaceId) return
    setLoading(true)
    const { start, end } = getPeriodDates(per)

    const { data: zlecenia } = await addWsFilter(
      wsQuery('zlecenia').select('id, nazwa, data_realizacji, zlecenia_pozycje(id, nazwa_pozycji, ilosc, jednostka, wydano)')
    ).eq('status', 'gotowe')
      .gte('data_realizacji', start)
      .lte('data_realizacji', end)
      .order('data_realizacji')

    if (!(zlecenia || []).length) {
      setAnalysis({ perProdukt: [], perLokal: [], summary: { przygotowan: 0, totalPlanned: 0, totalActual: 0, efficiency: null } })
      setLoading(false)
      return
    }

    const ids = zlecenia.map(z => z.id)
    const { data: rezerwacje } = await supabase
      .from('rezerwacje')
      .select('przygotowanie_id, lokal_id, lokale(nazwa)')
      .in('przygotowanie_id', ids)

    const lokalByZlecenieId = {}
    for (const rez of rezerwacje || []) {
      if (rez.przygotowanie_id) {
        lokalByZlecenieId[rez.przygotowanie_id] = rez.lokale?.nazwa || '—'
      }
    }

    const przygotowania = (zlecenia || []).map(z => ({
      id: z.id,
      _lokal: lokalByZlecenieId[z.id] || '—',
      pozycje: z.zlecenia_pozycje || [],
    }))

    setAnalysis(analyzePlannedVsActual(przygotowania))
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId])

  useEffect(() => { fetchReport(period) }, [fetchReport, period])

  const chartData = analysis
    ? analysis.perProdukt
        .slice()
        .sort((a, b) => Math.abs(a.diff) > Math.abs(b.diff) ? -1 : 1)
        .slice(0, 10)
        .map(r => ({
          name: r.nazwa.length > 16 ? r.nazwa.slice(0, 15) + '…' : r.nazwa,
          planned: r.planned,
          actual: r.actual,
        }))
    : []

  const { start, end } = getPeriodDates(period)

  return (
    <div>
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Raport: plan vs wykonanie</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>{start} – {end}</p>
        </div>
        {analysis && analysis.perProdukt.length > 0 && (
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            {[
              { key: 'produkty', icon: Package,    label: 'Produkty' },
              { key: 'lokale',   icon: Layers,     label: 'Lokale' },
            ].map(({ key, icon: Icon, label }) => (
              <button key={key} onClick={() => setViewMode(key)}
                className="flex items-center gap-1.5 px-3 text-sm font-medium"
                style={{ minHeight: 36, background: viewMode === key ? 'var(--c-action)' : 'var(--card)', color: viewMode === key ? '#fff' : 'var(--text-2)', border: 'none', cursor: 'pointer' }}>
                <Icon size={13} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selektor okresu */}
      <div className="flex rounded-lg overflow-hidden mb-5" style={{ border: '1px solid var(--border)', display: 'inline-flex' }}>
        {PERIODS.map(({ key, label }) => (
          <button key={key} onClick={() => setPeriod(key)}
            className="px-4 text-sm font-medium"
            style={{ minHeight: 40, background: period === key ? 'var(--c-action)' : 'var(--card)', color: period === key ? '#fff' : 'var(--text-2)', border: 'none', cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>

      {loading ? <Spinner /> : !analysis || analysis.summary.przygotowan === 0 ? (
        <div className="text-center py-16 rounded-xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <LayoutList size={40} className="mx-auto mb-3" style={{ color: 'var(--muted)', opacity: 0.4 }} />
          <p className="font-medium mb-1" style={{ color: 'var(--text)' }}>Brak zakończonych przygotowań w tym okresie</p>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Raport pojawi się gdy przygotowania zmienią status na "gotowe".</p>
        </div>
      ) : (
        <>
          {/* Karta summary */}
          <div className="rounded-xl p-4 mb-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs mb-1" style={{ color: 'var(--text-2)' }}>Przygotowań</p>
                <p className="text-2xl font-bold num" style={{ color: 'var(--text)' }}>{analysis.summary.przygotowan}</p>
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: 'var(--text-2)' }}>Planowano</p>
                <p className="text-2xl font-bold num" style={{ color: 'var(--text)' }}>{analysis.summary.totalPlanned}</p>
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: 'var(--text-2)' }}>Wydano</p>
                <p className="text-2xl font-bold num" style={{ color: 'var(--text)' }}>{analysis.summary.totalActual}</p>
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: 'var(--text-2)' }}>Efektywność</p>
                <div className="text-2xl font-bold">
                  <EfficiencyBadge pct={analysis.summary.efficiency} />
                </div>
              </div>
            </div>
          </div>

          {/* Wykres top 10 */}
          {chartData.length > 0 && (
            <div className="rounded-xl p-4 mb-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <p className="text-sm font-medium mb-4" style={{ color: 'var(--text)' }}>Plan vs wydano — top 10 produktów</p>
              <ResponsiveContainer width="100%" height={chartData.length * 36 + 20}>
                <BarChart data={chartData} layout="vertical" barCategoryGap="25%" margin={{ left: 0, right: 50, top: 4, bottom: 4 }}>
                  <XAxis type="number" tick={{ fill: 'var(--text-2)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fill: 'var(--text-2)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(59,130,246,0.06)' }} />
                  <Bar dataKey="planned" name="Plan" radius={[0, 4, 4, 0]} fill="var(--border)" />
                  <Bar dataKey="actual"  name="Wydano" radius={[0, 4, 4, 0]}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={d.actual > d.planned ? 'var(--c-critical)' : d.actual === d.planned ? 'var(--c-success)' : 'var(--c-action)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-2 text-xs" style={{ color: 'var(--text-2)' }}>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--border)', borderRadius: 2, marginRight: 4 }} />Plan</span>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--c-action)', borderRadius: 2, marginRight: 4 }} />Wydano</span>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--c-critical)', borderRadius: 2, marginRight: 4 }} />Nadużycie</span>
              </div>
            </div>
          )}

          {/* Tabela per produkt */}
          {viewMode === 'produkty' && (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              <div className="hidden md:grid px-4 py-2.5 text-xs font-medium"
                style={{ gridTemplateColumns: '1fr 80px 80px 80px 100px', background: 'var(--table-head)', color: 'var(--text-2)', borderBottom: '1px solid var(--border)' }}>
                <span>Produkt</span>
                <span className="text-right">Planowano</span>
                <span className="text-right">Wydano</span>
                <span className="text-right">Różnica</span>
                <span className="text-right">Efektywność</span>
              </div>
              {analysis.perProdukt.map((row, i) => (
                <div key={row.nazwa} className="px-4 py-3"
                  style={{ borderBottom: i < analysis.perProdukt.length - 1 ? '1px solid var(--border)' : 'none', background: row.diff < 0 ? 'rgba(225,29,72,0.03)' : 'var(--card)' }}>
                  {/* Mobile */}
                  <div className="md:hidden">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{row.nazwa}</p>
                      <EfficiencyBadge pct={row.diffPercent} />
                    </div>
                    <p className="text-xs mt-0.5 num" style={{ color: 'var(--text-2)' }}>
                      Plan: {row.planned} · Wydano: {row.actual} · Różnica: {row.diff > 0 ? '+' : ''}{row.diff} {row.jednostka}
                    </p>
                  </div>
                  {/* Desktop */}
                  <div className="hidden md:grid items-center" style={{ gridTemplateColumns: '1fr 80px 80px 80px 100px' }}>
                    <div className="flex items-center gap-2 min-w-0">
                      {row.diff < 0 && <AlertTriangle size={13} style={{ color: 'var(--c-attention)', flexShrink: 0 }} />}
                      <p className="text-sm truncate" style={{ color: 'var(--text)' }}>{row.nazwa}</p>
                    </div>
                    <p className="text-sm num text-right" style={{ color: 'var(--text)' }}>{row.planned} {row.jednostka}</p>
                    <p className="text-sm num text-right" style={{ color: 'var(--text-2)' }}>{row.actual} {row.jednostka}</p>
                    <p className="text-sm num font-medium text-right" style={{ color: row.diff >= 0 ? 'var(--c-success)' : 'var(--c-critical)' }}>
                      {row.diff > 0 ? '+' : ''}{row.diff} {row.jednostka}
                    </p>
                    <div className="flex justify-end">
                      <EfficiencyBadge pct={row.diffPercent} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tabela per lokal */}
          {viewMode === 'lokale' && (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              <div className="hidden md:grid px-4 py-2.5 text-xs font-medium"
                style={{ gridTemplateColumns: '1fr 80px 80px 80px 100px', background: 'var(--table-head)', color: 'var(--text-2)', borderBottom: '1px solid var(--border)' }}>
                <span>Lokal</span>
                <span className="text-right">Przygotowań</span>
                <span className="text-right">Plan</span>
                <span className="text-right">Wydano</span>
                <span className="text-right">Efektywność</span>
              </div>
              {analysis.perLokal.map((row, i) => (
                <div key={row.lokal} className="px-4 py-3"
                  style={{ borderBottom: i < analysis.perLokal.length - 1 ? '1px solid var(--border)' : 'none', background: 'var(--card)' }}>
                  <div className="md:hidden">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{row.lokal}</p>
                      <EfficiencyBadge pct={row.efficiency} />
                    </div>
                    <p className="text-xs mt-0.5 num" style={{ color: 'var(--text-2)' }}>
                      {row.przygotowan} przygotowań · Plan {row.planned} · Wydano {row.actual}
                    </p>
                  </div>
                  <div className="hidden md:grid items-center" style={{ gridTemplateColumns: '1fr 80px 80px 80px 100px' }}>
                    <p className="text-sm truncate" style={{ color: 'var(--text)' }}>{row.lokal}</p>
                    <p className="text-sm num text-right" style={{ color: 'var(--text-2)' }}>{row.przygotowan}</p>
                    <p className="text-sm num text-right" style={{ color: 'var(--text)' }}>{row.planned}</p>
                    <p className="text-sm num text-right" style={{ color: 'var(--text-2)' }}>{row.actual}</p>
                    <div className="flex justify-end">
                      <EfficiencyBadge pct={row.efficiency} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
