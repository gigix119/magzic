import { TrendingUp, TrendingDown } from 'lucide-react'
import AssistantKpiCards from '../AssistantKpiCards'
import AssistantDataTable from '../AssistantDataTable'
import AssistantChart from '../AssistantChart'
import AssistantWarnings from '../AssistantWarnings'
import AssistantResultActions from '../AssistantResultActions'
import { fmtPct } from '../../../utils/assistantFormatters'
import { formatPLN } from '../../../utils/assistantResponseFormatter'

const PRICE_CHANGE_COLS = [
  { key: 'name',         label: 'Produkt',  color: 'var(--text)', maxWidth: 150 },
  { key: 'prevFmt',      label: 'Poprz.',   align: 'right', mono: true, hideOnMobile: true },
  { key: 'lastFmt',      label: 'Obecna',   align: 'right', mono: true },
  { key: 'diffPctFmt',   label: 'Zmiana',   align: 'right', mono: true },
]

function getBarColor(entry) {
  return entry.diffPct >= 0 ? '#ef4444' : '#22c55e'
}

export default function PriceChangesResult({ priceChanges, text }) {
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

      <AssistantWarnings warnings={warnings} />

      <AssistantResultActions summaryText={text} />

      <AssistantKpiCards cards={kpiCards} />

      {anomalies.length > 0 && (
        <AssistantDataTable
          title="Anomalie cenowe (zmiana > 15%)"
          columns={PRICE_CHANGE_COLS}
          rows={makeRows(anomalies)}
          emptyMessage="Brak anomalii"
          exportable
          exportFilename="magzic-ceny-anomalie.csv"
        />
      )}

      {increases.length > 0 && (
        <AssistantDataTable
          title={<span className="flex items-center gap-1.5"><TrendingUp size={13} style={{ color: '#ef4444' }} />Wzrosty cen</span>}
          columns={PRICE_CHANGE_COLS}
          rows={makeRows(increases.slice(0, 10))}
          emptyMessage="Brak wzrostów"
          exportable
          exportFilename="magzic-ceny-wzrosty.csv"
        />
      )}

      {decreases.length > 0 && (
        <AssistantDataTable
          title={<span className="flex items-center gap-1.5"><TrendingDown size={13} style={{ color: '#22c55e' }} />Spadki cen</span>}
          columns={PRICE_CHANGE_COLS}
          rows={makeRows(decreases.slice(0, 10))}
          emptyMessage="Brak spadków"
          exportable
          exportFilename="magzic-ceny-spadki.csv"
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
