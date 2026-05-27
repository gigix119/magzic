import { AlertTriangle, Package, TrendingDown } from 'lucide-react'
import AssistantKpiCards from '../AssistantKpiCards'
import AssistantDataTable from '../AssistantDataTable'
import AssistantChart from '../AssistantChart'
import AssistantWarnings from '../AssistantWarnings'
import { fmtNum } from '../../../utils/assistantFormatters'
import { formatPLN } from '../../../utils/assistantResponseFormatter'

const STOCK_BELOW_COLS = [
  { key: 'name',          label: 'Towar',      color: 'var(--text)', maxWidth: 130 },
  { key: 'stanFmt',       label: 'Stan',        align: 'right', mono: true },
  { key: 'minFmt',        label: 'Min.',        align: 'right', mono: true, hideOnMobile: true },
  { key: 'missingFmt',    label: 'Brakuje',     align: 'right', mono: true },
  { key: 'unit',          label: 'Jedn.',       align: 'right', hideOnMobile: true },
  { key: 'lastPriceFmt',  label: 'Cena zakupu', align: 'right', mono: true, hideOnMobile: true },
  { key: 'costFmt',       label: 'Koszt uzup.', align: 'right', mono: true, hideOnMobile: true },
  { key: 'lastSupplier',  label: 'Dostawca',    maxWidth: 110,  hideOnMobile: true },
]

const STOCK_NEAR_COLS = [
  { key: 'name',      label: 'Towar',  color: 'var(--text)', maxWidth: 160 },
  { key: 'stanFmt',   label: 'Stan',    align: 'right', mono: true },
  { key: 'minFmt',    label: 'Min.',    align: 'right', mono: true },
  { key: 'unit',      label: 'Jedn.',   align: 'right', hideOnMobile: true },
  { key: 'magazyn',   label: 'Magazyn', hideOnMobile: true, maxWidth: 100 },
]

export function makeStockRows(list) {
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

export default function LowStockResult({ analysis, text }) {
  const { kpis, belowMinimum, nearMinimum, criticalItems, chartData, warnings } = analysis

  const kpiCards = [
    { label: 'Poniżej minimum',   value: String(kpis.belowCount),   color: kpis.belowCount > 0 ? '#ef4444' : 'var(--text-2)' },
    { label: 'Krytyczne',         value: String(kpis.criticalCount), color: kpis.criticalCount > 0 ? '#dc2626' : 'var(--text-2)' },
    { label: 'Blisko minimum',    value: String(kpis.nearCount),     color: kpis.nearCount > 0 ? '#f59e0b' : 'var(--text-2)' },
    { label: 'Łączny brak [szt.]',value: fmtNum(kpis.totalMissing), color: 'var(--text)' },
    { label: 'Koszt uzupełnienia',value: kpis.estimatedRestockCost != null ? formatPLN(kpis.estimatedRestockCost) : '—', color: '#3b82f6' },
    { label: 'Największy brak',   value: kpis.topMissingName ?? '—', color: 'var(--text-2)' },
  ]

  return (
    <div className="space-y-3" style={{ maxWidth: '100%', overflow: 'hidden' }}>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>{text}</p>

      <AssistantWarnings warnings={warnings} />

      <AssistantKpiCards cards={kpiCards} />

      {chartData.length > 0 && (
        <AssistantChart
          data={chartData}
          dataKey="missing"
          xAxisKey="name"
          title="Braki ilościowe — top produkty"
          getBarColor={() => '#ef4444'}
          tooltipSuffix=" szt."
          tooltipDecimals={0}
        />
      )}

      {criticalItems.length > 0 && (
        <AssistantDataTable
          title={<span className="flex items-center gap-1.5"><AlertTriangle size={12} style={{ color: '#dc2626' }} />Krytyczne — brakuje natychmiast</span>}
          columns={STOCK_BELOW_COLS}
          rows={makeStockRows(criticalItems)}
          emptyMessage="Brak"
        />
      )}

      {belowMinimum.length > 0 && (
        <AssistantDataTable
          title={<span className="flex items-center gap-1.5"><Package size={12} style={{ color: '#ef4444' }} />Poniżej minimum</span>}
          columns={STOCK_BELOW_COLS}
          rows={makeStockRows(belowMinimum)}
          emptyMessage="Brak produktów poniżej minimum"
        />
      )}

      {nearMinimum.length > 0 && (
        <AssistantDataTable
          title={<span className="flex items-center gap-1.5"><TrendingDown size={12} style={{ color: '#f59e0b' }} />Blisko minimum</span>}
          columns={STOCK_NEAR_COLS}
          rows={makeStockRows(nearMinimum)}
          emptyMessage="Brak"
        />
      )}
    </div>
  )
}
