import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useWorkspace } from '../context/WorkspaceContext'
import Spinner from '../components/Spinner'
import Badge from '../components/Badge'
import { Package, Warehouse, Users, FileText, AlertTriangle, TrendingDown, CheckCircle2, Bell, Clock } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

function StatCard({ icon: Icon, label, value, color = '#3b82f6', sub }) {
  return (
    <div className="rounded-xl p-5 flex items-center gap-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      <div className="rounded-lg flex items-center justify-center" style={{ width: 44, height: 44, background: color + '1a' }}>
        <Icon size={20} style={{ color }} />
      </div>
      <div>
        <p className="text-sm" style={{ color: 'var(--text-2)' }}>{label}</p>
        <p className="text-2xl font-semibold mt-0.5" style={{ color: 'var(--text)', fontFamily: 'DM Mono, monospace' }}>
          {value ?? '—'}
        </p>
        {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{sub}</p>}
      </div>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)' }}>
      <p className="font-medium">{label}</p>
      <p style={{ color: '#3b82f6' }}>Stan: {payload[0].value}</p>
    </div>
  )
}

const SEV_COLORS = { critical: '#dc2626', high: '#ea580c', medium: '#ca8a04', low: '#64748b' }
const SEV_LABELS = { critical: 'Krytyczny', high: 'Wysoki', medium: 'Średni', low: 'Niski' }
const SEV_BADGE  = { critical: 'red', high: 'red', medium: 'yellow', low: 'zinc' }

function OnboardingScreen() {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20, background: 'rgba(59,130,246,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px',
      }}>
        <Warehouse size={32} style={{ color: '#3b82f6' }} />
      </div>
      <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--text)' }}>Witaj w Magzic!</h2>
      <p className="text-sm mb-8 mx-auto" style={{ color: 'var(--text-2)', maxWidth: 400, lineHeight: 1.6 }}>
        Twój magazyn jest pusty. Zacznij od dodania produktów, dostawców lub wgrania pierwszej faktury.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        {[
          { label: 'Dodaj magazyn', to: '/magazyny', color: '#8b5cf6', icon: Warehouse },
          { label: 'Dodaj produkt', to: '/towary', color: '#3b82f6', icon: Package },
          { label: 'Dodaj dostawcę', to: '/kontrahenci', color: '#10b981', icon: Users },
        ].map(({ label, to, color, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', borderRadius: 10,
              background: color + '1a', color, border: `1px solid ${color}33`,
              fontWeight: 600, fontSize: 14, textDecoration: 'none',
              transition: 'background 0.15s',
            }}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { workspaceId, wsQuery } = useWorkspace()
  const [stats, setStats] = useState({})
  const [stockStatus, setStockStatus] = useState({ ok: 0, low: 0, empty: 0 })
  const [topAlerts, setTopAlerts] = useState([])
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isEmpty, setIsEmpty] = useState(false)

  useEffect(() => {
    if (!workspaceId) { setLoading(false); return }

    async function fetchAll() {
      try {
        const [
          { count: towary, error: e1 },
          { count: magazyny, error: e2 },
          { count: kontrahenci, error: e3 },
          { count: faktury, error: e4 },
          { count: fakturyRobocze, error: e7 },
          { data: stany, error: e5 },
          { data: towarList, error: e6 },
        ] = await Promise.all([
          wsQuery('towary').select('*', { count: 'exact', head: true }).eq('aktywny', true),
          wsQuery('magazyny').select('*', { count: 'exact', head: true }).eq('aktywny', true),
          wsQuery('kontrahenci').select('*', { count: 'exact', head: true }).eq('aktywny', true),
          wsQuery('faktury').select('*', { count: 'exact', head: true }),
          wsQuery('faktury').select('*', { count: 'exact', head: true }).eq('status', 'robocza'),
          wsQuery('stany_magazynowe').select('towar_id, ilosc'),
          wsQuery('towary').select('id, nazwa, stan_minimalny, jednostka').eq('aktywny', true),
        ])

        for (const e of [e1, e2, e3, e4, e5, e6, e7]) {
          if (e) { console.error(e); setError(e.message) }
        }

        setStats({ towary, magazyny, kontrahenci, faktury, fakturyRobocze })

        if (!towary && !magazyny && !kontrahenci && !faktury) {
          setIsEmpty(true)
          setLoading(false)
          return
        }
        setIsEmpty(false)

        const stockMap = {}
        for (const s of stany || []) {
          stockMap[s.towar_id] = (stockMap[s.towar_id] || 0) + Number(s.ilosc)
        }

        let ok = 0, low = 0, empty = 0
        const alerts = []
        for (const t of towarList || []) {
          const stan = stockMap[t.id] || 0
          const min  = t.stan_minimalny
          if (min != null && stan === 0) {
            empty++
            alerts.push({ severity: 'critical', towar: t, stan, msg: `Stan: 0 — brak towaru` })
          } else if (min != null && stan > 0 && stan < min) {
            low++
            alerts.push({ severity: 'high', towar: t, stan, msg: `Stan: ${stan} / min. ${min} ${t.jednostka || 'szt.'}` })
          } else {
            ok++
          }
        }
        alerts.sort((a, b) => (a.severity === 'critical' ? 0 : 1) - (b.severity === 'critical' ? 0 : 1))
        setStockStatus({ ok, low, empty })
        setTopAlerts(alerts.slice(0, 5))

        setChartData(
          (towarList || [])
            .map(t => ({ name: t.nazwa.slice(0, 18), value: stockMap[t.id] || 0 }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8)
        )
      } catch (err) {
        console.error(err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [workspaceId, wsQuery])

  if (loading) return <Spinner />

  const alertCount = stockStatus.low + stockStatus.empty

  if (isEmpty) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Dashboard</h1>
        </div>
        <div className="rounded-xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <OnboardingScreen />
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Dashboard</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>Przegląd stanu magazynu</p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#dc2626' }}>
          Błąd ładowania danych: {error}
        </div>
      )}

      {/* Row 1: main counts */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard icon={Package}   label="Towary"       value={stats.towary}      color="#3b82f6" />
        <StatCard icon={Warehouse} label="Magazyny"     value={stats.magazyny}    color="#8b5cf6" />
        <StatCard icon={Users}     label="Kontrahenci"  value={stats.kontrahenci} color="#10b981" />
        <StatCard icon={FileText}  label="Faktury"      value={stats.faktury}     color="#f59e0b"
          sub={stats.fakturyRobocze ? `${stats.fakturyRobocze} oczekuje` : undefined} />
      </div>

      {/* Row 2: stock status */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard icon={CheckCircle2}  label="Stany OK"       value={stockStatus.ok}    color="#22c55e" />
        <StatCard icon={TrendingDown}  label="Stany Niskie"   value={stockStatus.low}   color="#f59e0b" />
        <StatCard icon={AlertTriangle} label="Brak stanu"     value={stockStatus.empty} color="#ef4444" />
      </div>

      {/* Row 3: chart + urgent alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <h2 className="font-medium mb-4" style={{ fontSize: 14, color: 'var(--text)' }}>Stan magazynowy — top 8 towarów</h2>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barCategoryGap="30%">
                <XAxis dataKey="name" tick={{ fill: 'var(--text-2)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-2)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(59,130,246,0.06)' }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartData.map((_, i) => <Cell key={i} fill={i === 0 ? '#3b82f6' : 'var(--border)'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm py-8 text-center" style={{ color: 'var(--muted)' }}>Brak danych</p>
          )}
        </div>

        <div className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Bell size={16} style={{ color: alertCount > 0 ? '#f59e0b' : '#22c55e' }} />
            <h2 className="font-medium" style={{ fontSize: 14, color: 'var(--text)' }}>Wymagają uwagi</h2>
            {alertCount > 0 && <Badge variant="yellow">{alertCount}</Badge>}
          </div>
          {topAlerts.length === 0 ? (
            <p className="text-sm py-8 text-center" style={{ color: 'var(--muted)' }}>Brak alertów — wszystko OK</p>
          ) : (
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {topAlerts.map((a, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg px-3 py-2.5"
                  style={{ background: a.severity === 'critical' ? 'rgba(239,68,68,0.06)' : 'rgba(234,88,12,0.06)' }}>
                  <div className="flex items-center gap-2 min-w-0">
                    {a.severity === 'critical'
                      ? <AlertTriangle size={14} style={{ color: SEV_COLORS.critical, flexShrink: 0 }} />
                      : <TrendingDown  size={14} style={{ color: SEV_COLORS.high, flexShrink: 0 }} />
                    }
                    <div className="min-w-0">
                      <p className="text-sm truncate" style={{ color: 'var(--text)' }}>{a.towar.nazwa}</p>
                      <p className="text-xs" style={{ color: 'var(--text-2)' }}>{a.msg}</p>
                    </div>
                  </div>
                  <Badge variant={SEV_BADGE[a.severity]} style={{ flexShrink: 0, marginLeft: 8 }}>
                    {SEV_LABELS[a.severity]}
                  </Badge>
                </div>
              ))}
            </div>
          )}

          {stats.fakturyRobocze > 0 && (
            <div className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2.5" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <Clock size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />
              <p className="text-sm" style={{ color: '#f59e0b' }}>
                {stats.fakturyRobocze} {stats.fakturyRobocze === 1 ? 'faktura oczekuje' : 'faktury oczekują'} na zatwierdzenie
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
