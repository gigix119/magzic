import { AlertTriangle, Package, TrendingDown } from 'lucide-react'
import AssistantKpiCards from '../AssistantKpiCards'
import AssistantDataTable from '../AssistantDataTable'
import AssistantChart from '../AssistantChart'
import AssistantWarnings from '../AssistantWarnings'
import { fmtNum } from '../../../utils/assistantFormatters'
import { formatPLN } from '../../../utils/assistantResponseFormatter'

const ORDER_ITEM_COLS = [
  { key: 'name',          label: 'Towar',       color: 'var(--text)', maxWidth: 130 },
  { key: 'priorityFmt',   label: 'Priorytet',   align: 'right' },
  { key: 'stanFmt',       label: 'Stan',         align: 'right', mono: true, hideOnMobile: true },
  { key: 'missingFmt',    label: 'Brakuje',      align: 'right', mono: true },
  { key: 'unit',          label: 'Jedn.',        align: 'right', hideOnMobile: true },
  { key: 'lastPriceFmt',  label: 'Cena zakupu',  align: 'right', mono: true, hideOnMobile: true },
  { key: 'costFmt',       label: 'Koszt uzup.',  align: 'right', mono: true, hideOnMobile: true },
  { key: 'lastSupplier',  label: 'Dostawca',     maxWidth: 110,  hideOnMobile: true },
]

const ORDER_SUPPLIER_COLS = [
  { key: 'supplier',        label: 'Dostawca',       color: 'var(--text)', maxWidth: 160 },
  { key: 'countFmt',        label: 'Pozycji',         align: 'right', mono: true },
  { key: 'totalCostFmt',    label: 'Koszt szac.',     align: 'right', mono: true },
]

const ORDER_WATCH_COLS = [
  { key: 'name',    label: 'Towar',  color: 'var(--text)', maxWidth: 160 },
  { key: 'stanFmt', label: 'Stan',    align: 'right', mono: true },
  { key: 'minFmt',  label: 'Min.',    align: 'right', mono: true },
  { key: 'unit',    label: 'Jedn.',   align: 'right', hideOnMobile: true },
]

function makeStockRows(list) {
  return list.map(p => ({
    ...p,
    stanFmt: fmtNum(p.stan),
    minFmt: fmtNum(p.min),
    missingFmt: fmtNum(p.missing),
    lastPriceFmt: p.lastPrice != null ? formatPLN(p.lastPrice) : '—',
    costFmt: p.estimatedCost != null ? formatPLN(p.estimatedCost) : '—',
    lastSupplier: p.lastSupplier ?? '—',
    magazyn: p.magazyn ?? '—',
  }))
}

function makeOrderItemRows(list) {
  return list.map(p => ({
    ...p,
    priorityFmt: p.priority === 'critical' ? '🔴 krytyczny' : p.priority === 'high' ? '🟠 wysoki' : '🟡 normalny',
    stanFmt: fmtNum(p.stan),
    minFmt: fmtNum(p.min),
    missingFmt: fmtNum(p.missing),
    lastPriceFmt: p.lastPrice != null ? formatPLN(p.lastPrice) : '—',
    costFmt: p.estimatedCost != null ? formatPLN(p.estimatedCost) : '—',
    lastSupplier: p.lastSupplier ?? '—',
  }))
}

export default function OrderRecommendationResult({ recommendations, text }) {
  const { kpis, orderItems, criticalItems, supplierGroups, watchList, chartData, warnings } = recommendations

  const kpiCards = [
    { label: 'Do zamówienia',      value: String(kpis.orderCount),   color: kpis.orderCount > 0 ? '#3b82f6' : 'var(--text-2)' },
    { label: 'Krytyczne',          value: String(kpis.criticalCount), color: kpis.criticalCount > 0 ? '#dc2626' : 'var(--text-2)' },
    { label: 'Obserwuj',           value: String(kpis.watchCount),    color: kpis.watchCount > 0 ? '#f59e0b' : 'var(--text-2)' },
    { label: 'Szac. koszt zamów.', value: kpis.estimatedOrderCost != null ? formatPLN(kpis.estimatedOrderCost) : '—', color: '#3b82f6' },
    { label: 'Brak ceny',          value: String(kpis.noPriceCount),  color: kpis.noPriceCount > 0 ? '#f59e0b' : 'var(--text-2)' },
    { label: 'Brak dostawcy',      value: String(kpis.noSupplierCount), color: kpis.noSupplierCount > 0 ? '#f59e0b' : 'var(--text-2)' },
  ]

  const supplierRows = (supplierGroups ?? []).map(g => ({
    ...g,
    countFmt: String(g.count),
    totalCostFmt: g.totalCost > 0 ? formatPLN(g.totalCost) : '—',
  }))

  return (
    <div className="space-y-3" style={{ maxWidth: '100%', overflow: 'hidden' }}>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>{text}</p>

      <AssistantWarnings warnings={warnings} />

      <AssistantKpiCards cards={kpiCards} />

      {chartData.length > 0 && (
        <AssistantChart
          data={chartData}
          dataKey="value"
          xAxisKey="name"
          title="Top produkty do zamówienia"
          getBarColor={() => '#3b82f6'}
          tooltipSuffix=""
          tooltipDecimals={0}
        />
      )}

      {criticalItems.length > 0 && (
        <AssistantDataTable
          title={<span className="flex items-center gap-1.5"><AlertTriangle size={12} style={{ color: '#dc2626' }} />Krytyczne — zamów natychmiast</span>}
          columns={ORDER_ITEM_COLS}
          rows={makeOrderItemRows(criticalItems)}
          emptyMessage="Brak"
        />
      )}

      {orderItems.filter(p => p.priority !== 'critical').length > 0 && (
        <AssistantDataTable
          title={<span className="flex items-center gap-1.5"><Package size={12} style={{ color: '#3b82f6' }} />Lista zamówień</span>}
          columns={ORDER_ITEM_COLS}
          rows={makeOrderItemRows(orderItems.filter(p => p.priority !== 'critical'))}
          emptyMessage="Brak"
        />
      )}

      {supplierRows.length > 0 && (
        <AssistantDataTable
          title="Zamówienia według dostawcy"
          columns={ORDER_SUPPLIER_COLS}
          rows={supplierRows}
          emptyMessage="Brak dostawców"
        />
      )}

      {watchList.length > 0 && (
        <AssistantDataTable
          title={<span className="flex items-center gap-1.5"><TrendingDown size={12} style={{ color: '#f59e0b' }} />Obserwuj — blisko minimum</span>}
          columns={ORDER_WATCH_COLS}
          rows={makeStockRows(watchList)}
          emptyMessage="Brak"
        />
      )}
    </div>
  )
}
