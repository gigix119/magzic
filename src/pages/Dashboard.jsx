import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useWorkspace } from '../context/WorkspaceContext'
import { getWorkspaceSetting } from '../utils/workspaceSettings'
import Spinner from '../components/Spinner'
import Badge from '../components/Badge'
import FirstUseSteps from '../components/FirstUseSteps'
import BriefingCard from '../components/BriefingCard'
import WeeklyReport from '../components/WeeklyReport'
import { Package, Warehouse, Users, FileText, AlertTriangle, TrendingDown, CheckCircle2, Bell, Clock, KeyRound, DoorOpen, ClipboardList } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

function StatCard({ icon: Icon, label, value, color = 'var(--c-action)', sub }) {
  return (
    <div className="rounded-xl p-5 flex items-center gap-4 stat-card-compact" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      <div className="stat-icon rounded-lg flex items-center justify-center flex-shrink-0" style={{ width: 44, height: 44, background: color + '1a' }}>
        <Icon size={20} style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-sm truncate" style={{ color: 'var(--text-2)' }}>{label}</p>
        <p className="stat-value text-2xl font-semibold mt-0.5 num" style={{ color: 'var(--text)' }}>
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
      <p style={{ color: 'var(--c-action)' }}>Stan: {payload[0].value}</p>
    </div>
  )
}

const SEV_COLORS = { critical: '#dc2626', high: '#ea580c', medium: '#ca8a04', low: '#64748b' }
const SEV_LABELS = { critical: 'Krytyczny', high: 'Wysoki', medium: 'Średni', low: 'Niski' }
const SEV_BADGE  = { critical: 'red', high: 'red', medium: 'yellow', low: 'zinc' }

function OnboardingScreen() {
  return (
    <div style={{ textAlign: 'center', padding: 'clamp(32px, 8vw, 60px) 16px' }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20, background: 'var(--c-action-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px',
      }}>
        <Warehouse size={32} style={{ color: 'var(--c-action)' }} />
      </div>
      <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--text)' }}>Witaj w Magzic!</h2>
      <p className="text-sm mb-8 mx-auto" style={{ color: 'var(--text-2)', maxWidth: 400, lineHeight: 1.6 }}>
        Twój magazyn jest pusty. Zacznij od dodania produktów, dostawców lub wgrania pierwszej faktury.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        {[
          { label: 'Dodaj magazyn', to: '/magazyny', color: 'var(--c-automation)', icon: Warehouse },
          { label: 'Dodaj produkt', to: '/towary', color: 'var(--c-action)', icon: Package },
          { label: 'Dodaj dostawcę', to: '/kontrahenci', color: 'var(--c-success)', icon: Users },
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

function isoToday() { return new Date().toISOString().split('T')[0] }

function DzisPanel({ workspaceId, wsQuery, addWsFilter }) {
  const [checkins, setCheckins] = useState([])
  const [checkouts, setCheckouts] = useState([])
  const [preps, setPreps] = useState([])
  const [loading, setLoading] = useState(true)
  const [hasLokale, setHasLokale] = useState(false)

  useEffect(() => {
    if (!workspaceId) return
    fetchDzis()
  }, [workspaceId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchDzis() {
    const today = isoToday()
    const [
      { count: lokaleCount },
      { data: cin },
      { data: cout },
      { data: prep },
    ] = await Promise.all([
      addWsFilter(wsQuery('lokale').select('*', { count: 'exact', head: true })).eq('aktywny', true),
      addWsFilter(wsQuery('rezerwacje').select('id, gosc_nazwa, checkin_at, lokal_id, lokale(nazwa)'))
        .eq('checkin_at', today).eq('status', 'potwierdzona').order('checkin_at'),
      addWsFilter(wsQuery('rezerwacje').select('id, gosc_nazwa, checkout_at, lokal_id, lokale(nazwa)'))
        .eq('checkout_at', today).eq('status', 'zameldowana').order('checkout_at'),
      addWsFilter(wsQuery('zlecenia').select('id, nazwa, status, data_realizacji'))
        .eq('data_realizacji', today).neq('status', 'gotowe').order('nazwa'),
    ])
    setHasLokale((lokaleCount || 0) > 0)
    setCheckins(cin || [])
    setCheckouts(cout || [])
    setPreps(prep || [])
    setLoading(false)
  }

  if (loading || !hasLokale) return null

  const CARDS = [
    {
      title: 'Przyjazdy',
      icon: KeyRound,
      color: 'var(--c-action)',
      items: checkins,
      count: checkins.length,
      renderItem: r => `${r.lokale?.nazwa || '—'}`,
      link: '/operacje?tab=rezerwacje',
      linkLabel: 'Rezerwacje',
    },
    {
      title: 'Wyjazdy',
      icon: DoorOpen,
      color: 'var(--c-attention)',
      items: checkouts,
      count: checkouts.length,
      renderItem: r => `${r.lokale?.nazwa || '—'}`,
      link: '/operacje?tab=rezerwacje',
      linkLabel: 'Rezerwacje',
    },
    {
      title: 'Do zrobienia',
      icon: ClipboardList,
      color: preps.length > 0 ? 'var(--c-critical)' : 'var(--c-success)',
      items: preps,
      count: preps.length,
      renderItem: z => z.nazwa,
      link: '/operacje?tab=przygotowania',
      linkLabel: 'Przygotowania',
    },
  ]

  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-2)' }}>Dziś w obiektach</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {CARDS.map(card => {
          const Icon = card.icon
          const visible = card.items.slice(0, 4)
          const extra = card.items.length - visible.length
          return (
            <div key={card.title} className="rounded-xl p-4 flex flex-col gap-3" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2">
                <div className="rounded-lg flex items-center justify-center flex-shrink-0" style={{ width: 32, height: 32, background: card.color + '1a' }}>
                  <Icon size={16} style={{ color: card.color }} />
                </div>
                <div>
                  <p className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>{card.title}</p>
                  <p className="text-xl font-bold num leading-tight" style={{ color: 'var(--text)' }}>{card.count}</p>
                </div>
              </div>
              {visible.length > 0 ? (
                <div className="space-y-1">
                  {visible.map(item => (
                    <p key={item.id} className="text-xs truncate" style={{ color: 'var(--text-2)' }}>
                      {card.renderItem(item)}
                    </p>
                  ))}
                  {extra > 0 && (
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>i {extra} więcej…</p>
                  )}
                </div>
              ) : (
                <p className="text-xs" style={{ color: 'var(--muted)' }}>Brak na dziś</p>
              )}
              <Link
                to={card.link}
                className="mt-auto text-xs font-medium"
                style={{ color: card.color, textDecoration: 'none' }}
              >
                → {card.linkLabel}
              </Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { workspaceId, workspace, wsQuery, addWsFilter, getBusinessCategory } = useWorkspace()
  const showBriefing      = getWorkspaceSetting(workspace, 'briefing_on_dashboard')
  const showWeeklyReport  = getWorkspaceSetting(workspace, 'weekly_report_on_dashboard')
  const showStatCards     = getWorkspaceSetting(workspace, 'show_stat_cards')
  const showChart         = getWorkspaceSetting(workspace, 'show_chart')
  const showAttentionList = getWorkspaceSetting(workspace, 'show_attention_list')
  const [stats, setStats] = useState({})
  const [stockStatus, setStockStatus] = useState({ ok: 0, low: 0, empty: 0 })
  const [topAlerts, setTopAlerts] = useState([])
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isEmpty, setIsEmpty] = useState(false)
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
          addWsFilter(wsQuery('towary').select('*', { count: 'exact', head: true })).eq('aktywny', true),
          addWsFilter(wsQuery('magazyny').select('*', { count: 'exact', head: true })).eq('aktywny', true),
          addWsFilter(wsQuery('kontrahenci').select('*', { count: 'exact', head: true })).eq('aktywny', true),
          addWsFilter(wsQuery('faktury').select('*', { count: 'exact', head: true })),
          addWsFilter(wsQuery('faktury').select('*', { count: 'exact', head: true })).eq('status', 'robocza'),
          addWsFilter(wsQuery('stany_magazynowe').select('towar_id, ilosc')),
          addWsFilter(wsQuery('towary').select('id, nazwa, stan_minimalny, jednostka')).eq('aktywny', true),
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
        <FirstUseSteps />
        {showBriefing && <BriefingCard />}
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

      <FirstUseSteps />
      <DzisPanel workspaceId={workspaceId} wsQuery={wsQuery} addWsFilter={addWsFilter} />
      {showBriefing && <BriefingCard />}
      {showWeeklyReport && <WeeklyReport workspaceId={workspaceId} businessCategory={getBusinessCategory()} />}

      {error && (
        <div className="mb-4 rounded-lg px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#dc2626' }}>
          Błąd ładowania danych: {error}
        </div>
      )}

      {/* Row 1 + 2: stat cards */}
      {showStatCards && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <StatCard icon={Package}   label="Towary"       value={stats.towary}      color="var(--c-action)" />
            <StatCard icon={Warehouse} label="Magazyny"     value={stats.magazyny}    color="var(--c-automation)" />
            <StatCard icon={Users}     label="Kontrahenci"  value={stats.kontrahenci} color="var(--c-success)" />
            <StatCard icon={FileText}  label="Faktury"      value={stats.faktury}     color="var(--c-attention)"
              sub={stats.fakturyRobocze ? `${stats.fakturyRobocze} oczekuje` : undefined} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <StatCard icon={CheckCircle2}  label="Stany OK"     value={stockStatus.ok}    color="var(--c-success)" />
            <StatCard icon={TrendingDown}  label="Stany Niskie" value={stockStatus.low}   color="var(--c-attention)" />
            <StatCard icon={AlertTriangle} label="Brak stanu"   value={stockStatus.empty} color="var(--c-critical)" />
          </div>
        </>
      )}

      {/* Row 3: chart + urgent alerts */}
      {(showChart || showAttentionList) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {showChart && (
            <div className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <h2 className="font-medium mb-4" style={{ fontSize: 14, color: 'var(--text)' }}>Stan magazynowy — top 8 towarów</h2>
              {chartData.length > 0 ? (
                isMobile ? (
                  /* Mobile: horizontal bar chart — labels on Y axis, no overlap */
                  <ResponsiveContainer width="100%" height={chartData.length * 32 + 16}>
                    <BarChart data={chartData} layout="vertical" barCategoryGap="20%" margin={{ left: 0, right: 24, top: 4, bottom: 4 }}>
                      <XAxis type="number" tick={{ fill: 'var(--text-2)', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis
                        type="category" dataKey="name" width={110}
                        tick={{ fill: 'var(--text-2)', fontSize: 10 }}
                        axisLine={false} tickLine={false}
                        tickFormatter={v => v.length > 14 ? v.slice(0, 13) + '…' : v}
                      />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(59,130,246,0.06)' }} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {chartData.map((_, i) => <Cell key={i} fill={i === 0 ? 'var(--c-action)' : 'var(--border)'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  /* Desktop: vertical bar chart */
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData} barCategoryGap="30%">
                      <XAxis
                        dataKey="name"
                        tick={{ fill: 'var(--text-2)', fontSize: 10 }}
                        axisLine={false} tickLine={false}
                        height={30}
                      />
                      <YAxis tick={{ fill: 'var(--text-2)', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(59,130,246,0.06)' }} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {chartData.map((_, i) => <Cell key={i} fill={i === 0 ? 'var(--c-action)' : 'var(--border)'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )
              ) : (
                <p className="text-sm py-8 text-center" style={{ color: 'var(--muted)' }}>Brak danych</p>
              )}
            </div>
          )}

          {showAttentionList && (
            <div className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2 mb-4">
                <Bell size={16} style={{ color: alertCount > 0 ? '#f59e0b' : '#22c55e' }} />
                <h2 className="font-medium" style={{ fontSize: 14, color: 'var(--text)' }}>Wymagają uwagi</h2>
                {alertCount > 0 && <Badge variant="yellow">{alertCount}</Badge>}
              </div>
              {topAlerts.length === 0 ? (
                <p className="text-sm py-8 text-center" style={{ color: 'var(--muted)' }}>Brak alertów — wszystko OK</p>
              ) : (
                <>
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
                  {alertCount > 0 && (
                    <Link
                      to="/alerty"
                      className="md:hidden mt-2 flex items-center justify-center gap-1.5 w-full rounded-lg text-sm font-medium"
                      style={{ color: 'var(--c-action)', background: 'var(--c-action-subtle)', border: '1px solid rgba(37,99,235,0.2)', minHeight: 44 }}
                    >
                      Zobacz wszystkie alerty ({alertCount}) →
                    </Link>
                  )}
                </>
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
          )}
        </div>
      )}
    </div>
  )
}
