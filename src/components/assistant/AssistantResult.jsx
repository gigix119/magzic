import { Sparkles, TrendingUp, TrendingDown } from 'lucide-react'
import AssistantKpiCards from './AssistantKpiCards'
import AssistantDataTable from './AssistantDataTable'
import AssistantChart from './AssistantChart'
import { formatPLN } from '../../utils/assistantResponseFormatter'

const INTENT_LABELS = {
  purchase_dashboard: 'Dashboard zakupów',
  compare_invoices: 'Porównanie faktur',
  latest_price_changes: 'Zmiany cen',
  product_price_history: 'Historia ceny',
  compare_suppliers: 'Porównanie dostawców',
  invoices_needing_review: 'Faktury do weryfikacji',
  low_stock: 'Niskie stany',
  order_recommendation: 'Rekomendacja zamówień',
  unknown: null,
}

const SUPPLIER_COLS = [
  { key: 'name',                label: 'Dostawca',   color: 'var(--text)', maxWidth: 160 },
  { key: 'invoiceCount',        label: 'Fakt.',  align: 'right', mono: true },
  { key: 'totalNettoFormatted', label: 'Netto',  align: 'right', mono: true, hideOnMobile: true },
  { key: 'shareFormatted',      label: 'Udział', align: 'right', mono: true },
]

const PRODUCT_COLS = [
  { key: 'name',                label: 'Produkt / Pozycja', color: 'var(--text)', maxWidth: 180 },
  { key: 'totalNettoFormatted', label: 'Netto',   align: 'right', mono: true },
  { key: 'purchaseCount',       label: 'Zakupów', align: 'right', mono: true, hideOnMobile: true },
]

function PurchaseDashboardResult({ dashboard, text }) {
  const { kpis, supplierBreakdown, topProductsBySpend, purchasesOverTime, warnings } = dashboard

  const hasLines = kpis.lineCount > 0
  const chartDataKey = hasLines ? 'totalNetto' : 'invoiceCount'
  const chartTitle = hasLines ? 'Zakupy w czasie (netto)' : 'Faktury w czasie (liczba)'

  const supplierRows = (supplierBreakdown ?? []).map(s => ({
    ...s,
    totalNettoFormatted: formatPLN(s.totalNetto),
    shareFormatted: (s.share ?? 0).toFixed(1) + '%',
  }))

  const productRows = (topProductsBySpend ?? []).map(p => ({
    ...p,
    totalNettoFormatted: formatPLN(p.totalNetto),
  }))

  return (
    <div className="space-y-3" style={{ maxWidth: '100%', overflow: 'hidden' }}>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>{text}</p>

      {(warnings ?? []).map((w, i) => (
        <div
          key={i}
          className="rounded-lg px-3 py-2 text-xs"
          style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)', color: '#ca8a04' }}
        >
          {w}
        </div>
      ))}

      <AssistantKpiCards kpis={kpis} />

      {supplierRows.length > 0 && (
        <AssistantDataTable
          title="Top dostawcy"
          columns={SUPPLIER_COLS}
          rows={supplierRows}
          emptyMessage="Brak dostawców"
        />
      )}

      {productRows.length > 0 && (
        <AssistantDataTable
          title="Top produkty kosztowo"
          columns={PRODUCT_COLS}
          rows={productRows}
          emptyMessage="Brak pozycji faktur"
        />
      )}

      {(purchasesOverTime ?? []).length > 0 && (
        <AssistantChart
          data={purchasesOverTime}
          dataKey={chartDataKey}
          title={chartTitle}
        />
      )}
    </div>
  )
}

const PRICE_CHANGE_COLS = [
  { key: 'name',         label: 'Produkt',  color: 'var(--text)', maxWidth: 150 },
  { key: 'prevFmt',      label: 'Poprz.',   align: 'right', mono: true, hideOnMobile: true },
  { key: 'lastFmt',      label: 'Obecna',   align: 'right', mono: true },
  { key: 'diffPctFmt',   label: 'Zmiana',   align: 'right', mono: true },
]

function fmtPct(v) {
  const sign = v > 0 ? '+' : ''
  return sign + v.toFixed(1) + '%'
}

function getBarColor(entry) {
  return entry.diffPct >= 0 ? '#ef4444' : '#22c55e'
}

function PriceChangesResult({ priceChanges, text }) {
  const { kpis, increases, decreases, anomalies, chartData, warnings } = priceChanges

  const kpiCards = [
    { label: 'Śledzonych produktów', value: String(kpis.totalTracked),      color: 'var(--text)' },
    { label: 'Wzrosty cen',          value: String(kpis.increaseCount),      color: '#ef4444' },
    { label: 'Spadki cen',           value: String(kpis.decreaseCount),      color: '#22c55e' },
    { label: 'Anomalie (>15%)',       value: String(kpis.anomalyCount),       color: '#f59e0b' },
    { label: 'Śr. zmiana',           value: fmtPct(kpis.avgChangePct),       color: kpis.avgChangePct >= 0 ? '#ef4444' : '#22c55e' },
    { label: 'Max. wzrost',          value: '+' + kpis.maxIncreasePct.toFixed(1) + '%', color: '#ef4444' },
  ]

  function makeRows(list) {
    return list.map(e => ({
      ...e,
      prevFmt: formatPLN(e.prevPrice),
      lastFmt: formatPLN(e.lastPrice),
      diffPctFmt: fmtPct(e.diffPct),
    }))
  }

  return (
    <div className="space-y-3" style={{ maxWidth: '100%', overflow: 'hidden' }}>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>{text}</p>

      {(warnings ?? []).map((w, i) => (
        <div
          key={i}
          className="rounded-lg px-3 py-2 text-xs"
          style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)', color: '#ca8a04' }}
        >
          {w}
        </div>
      ))}

      <AssistantKpiCards cards={kpiCards} />

      {anomalies.length > 0 && (
        <AssistantDataTable
          title="Anomalie cenowe (zmiana > 15%)"
          columns={PRICE_CHANGE_COLS}
          rows={makeRows(anomalies)}
          emptyMessage="Brak anomalii"
        />
      )}

      {increases.length > 0 && (
        <AssistantDataTable
          title={<span className="flex items-center gap-1.5"><TrendingUp size={13} style={{ color: '#ef4444' }} />Wzrosty cen</span>}
          columns={PRICE_CHANGE_COLS}
          rows={makeRows(increases.slice(0, 10))}
          emptyMessage="Brak wzrostów"
        />
      )}

      {decreases.length > 0 && (
        <AssistantDataTable
          title={<span className="flex items-center gap-1.5"><TrendingDown size={13} style={{ color: '#22c55e' }} />Spadki cen</span>}
          columns={PRICE_CHANGE_COLS}
          rows={makeRows(decreases.slice(0, 10))}
          emptyMessage="Brak spadków"
        />
      )}

      {chartData.length > 0 && (
        <AssistantChart
          data={chartData}
          dataKey="diffPct"
          xAxisKey="name"
          title="Zmiany cen (%) — top produkty"
          getBarColor={getBarColor}
          tooltipSuffix="%"
          tooltipDecimals={1}
        />
      )}
    </div>
  )
}

export default function AssistantResult({ intent, text, structuredData }) {
  if (structuredData && intent === 'purchase_dashboard') {
    return <PurchaseDashboardResult dashboard={structuredData} text={text} />
  }

  if (structuredData && intent === 'latest_price_changes') {
    return <PriceChangesResult priceChanges={structuredData} text={text} />
  }

  const label = INTENT_LABELS[intent]
  return (
    <div className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>
      {label && (
        <div className="flex items-center gap-1.5 mb-1.5">
          <Sparkles size={11} style={{ color: '#f59e0b', flexShrink: 0 }} />
          <span className="text-xs font-medium" style={{ color: '#f59e0b' }}>{label}</span>
        </div>
      )}
      <span>{text}</span>
    </div>
  )
}
