import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import { generateWeeklyReport } from '../utils/weeklyReportEngine'
import { getWeeklyReportTitleFor } from '../config/businessTypes'

function fmt(amount) {
  return amount.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' zł'
}

function fmtDate(d) {
  return d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })
}

function Skeleton({ w = '100%', h = 14, radius = 6 }) {
  return (
    <div
      style={{
        width: w, height: h, borderRadius: radius,
        background: 'var(--border)',
        animation: 'weeklyShimmer 1.4s ease-in-out infinite',
      }}
    />
  )
}

export default function WeeklyReport({ workspaceId, businessCategory }) {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [hasData, setHasData] = useState(false)

  const storageKey = `weekly_report_collapsed_${workspaceId}`
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(storageKey) !== 'false' } catch { return true }
  })

  function toggleCollapsed() {
    setCollapsed(v => {
      const next = !v
      try { localStorage.setItem(storageKey, String(next)) } catch { /* ignore */ }
      return next
    })
  }

  const load = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    setError(null)
    try {
      // Quick check: any products or invoices?
      const [{ count: towary }, { count: faktury }] = await Promise.all([
        supabase.from('towary').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('aktywny', true),
        supabase.from('faktury').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
      ])
      if (!towary && !faktury) { setHasData(false); setLoading(false); return }
      setHasData(true)
      const data = await generateWeeklyReport(supabase, workspaceId)
      setReport(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => { load() }, [load])

  if (!loading && !hasData) return null

  const title = getWeeklyReportTitleFor(businessCategory)

  const change = report?.spending?.changePercent
  const changeLabel = change === null || change === undefined
    ? null
    : change > 0 ? { color: '#dc2626', text: `▲ +${change}% vs poprzedni tydzień` }
    : change < 0 ? { color: '#16a34a', text: `▼ ${change}% vs poprzedni tydzień` }
    : { color: 'var(--muted)', text: '— bez zmian vs poprzedni tydzień' }

  const fromDate = report ? fmtDate(report.period.from) : ''
  const toDate = report ? fmtDate(report.period.to) : ''
  const toYear = report ? report.period.to.getFullYear() : ''

  const summaryLine = report
    ? [
        report.spending.current > 0 ? `Wydano ${fmt(report.spending.current)}` : null,
        report.orders.new > 0 ? `${report.orders.new} ${report.orders.new === 1 ? 'zlecenie' : 'zleceń'}` : null,
        report.newInvoices > 0 ? `${report.newInvoices} ${report.newInvoices === 1 ? 'faktura' : 'faktur'}` : null,
      ].filter(Boolean).join(' · ')
    : ''

  return (
    <>
      <style>{`
        @keyframes weeklyShimmer {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
      <div className="rounded-xl mb-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        {/* Header — always visible, clickable */}
        <button
          onClick={toggleCollapsed}
          className="w-full flex items-center gap-2 px-4 py-3 text-left"
          style={{ minHeight: 52 }}
        >
          <span style={{ fontSize: 16 }}>📊</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{title}</p>
            {loading ? (
              <div className="mt-1"><Skeleton w={140} h={11} /></div>
            ) : report ? (
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                {fromDate} – {toDate}.{toYear}
              </p>
            ) : null}
          </div>
          <span style={{ color: 'var(--muted)', fontSize: 13, flexShrink: 0 }}>{collapsed ? '▼' : '▲'}</span>
        </button>

        {/* Collapsed summary line */}
        {collapsed && !loading && !error && report && summaryLine && (
          <div className="px-4 pb-3" style={{ marginTop: -6 }}>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>{summaryLine}</p>
          </div>
        )}

        {/* Expanded content */}
        {!collapsed && (
          <div className="px-4 pb-4 space-y-4" style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="space-y-1.5">
                    <Skeleton w={80} h={11} />
                    <Skeleton w="60%" h={18} />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="text-sm" style={{ color: '#dc2626' }}>
                Nie udało się załadować raportu.{' '}
                <button onClick={load} className="underline" style={{ color: '#2563eb' }}>Spróbuj ponownie</button>
              </div>
            ) : report ? (
              <>
                {/* Spending */}
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted)' }}>💰 Wydatki</p>
                  <p className="font-semibold" style={{ color: 'var(--text)', fontSize: 18, fontFamily: 'DM Mono, monospace' }}>
                    {fmt(report.spending.current)}
                  </p>
                  {changeLabel && (
                    <p className="text-xs mt-0.5" style={{ color: changeLabel.color }}>{changeLabel.text}</p>
                  )}
                </div>

                {/* Invoices */}
                {report.newInvoices > 0 && (
                  <div>
                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted)' }}>📄 Faktury</p>
                    <p className="text-sm" style={{ color: 'var(--text)' }}>
                      {report.newInvoices} {report.newInvoices === 1 ? 'nowa faktura' : 'nowych faktur'} w tym tygodniu
                    </p>
                  </div>
                )}

                {/* Inventory */}
                {(report.inventory.lowStock > 0 || report.inventory.deadStock > 0) && (
                  <div>
                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted)' }}>📦 Magazyn</p>
                    {report.inventory.lowStock > 0 && (
                      <p className="text-sm" style={{ color: 'var(--text)' }}>
                        {report.inventory.lowStock} {report.inventory.lowStock === 1 ? 'produkt' : 'produktów'} z niskim stanem
                      </p>
                    )}
                    {report.inventory.deadStock > 0 && (
                      <p className="text-sm" style={{ color: 'var(--text)' }}>
                        {report.inventory.deadStock} {report.inventory.deadStock === 1 ? 'produkt' : 'produktów'} bez ruchu od 30 dni
                      </p>
                    )}
                  </div>
                )}

                {/* Orders */}
                {(report.orders.new > 0 || report.orders.completed > 0) && (
                  <div>
                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted)' }}>📋 Zlecenia</p>
                    <p className="text-sm" style={{ color: 'var(--text)' }}>
                      {[
                        report.orders.new > 0 ? `${report.orders.new} nowe` : null,
                        report.orders.completed > 0 ? `${report.orders.completed} zrealizowane` : null,
                      ].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                )}

                {/* Biggest price increase */}
                {report.biggestPriceIncrease && (
                  <div>
                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted)' }}>📈 Największa podwyżka</p>
                    <p className="text-sm" style={{ color: 'var(--text)' }}>
                      {report.biggestPriceIncrease.productName}: +{report.biggestPriceIncrease.changePercent}%
                    </p>
                  </div>
                )}

                {/* New products */}
                {report.newProducts > 0 && (
                  <div>
                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted)' }}>🆕 Nowe produkty</p>
                    <p className="text-sm" style={{ color: 'var(--text)' }}>
                      {report.newProducts} {report.newProducts === 1 ? 'produkt dodany' : 'produkty dodane'} w tym tygodniu
                    </p>
                  </div>
                )}

                {/* Refresh */}
                <button
                  onClick={load}
                  className="w-full rounded-lg text-sm"
                  style={{ color: 'var(--text-2)', border: '1px solid var(--border)', minHeight: 40, marginTop: 4 }}
                >
                  📊 Odśwież raport
                </button>
              </>
            ) : null}
          </div>
        )}
      </div>
    </>
  )
}
