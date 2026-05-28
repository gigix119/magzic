import AssistantKpiCards from '../AssistantKpiCards'
import AssistantDataTable from '../AssistantDataTable'
import AssistantChart from '../AssistantChart'
import AssistantWarnings from '../AssistantWarnings'
import AssistantResultActions from '../AssistantResultActions'
import { fmtNum, formatDatePL } from '../../../utils/assistantFormatters'
import { formatPLN } from '../../../utils/assistantResponseFormatter'

const PRICE_HISTORY_COLS = [
  { key: 'dateFmt',      label: 'Data',      align: 'right', mono: true },
  { key: 'name',        label: 'Produkt',   color: 'var(--text)', maxWidth: 130, hideOnMobile: true },
  { key: 'numer',       label: 'Faktura',   maxWidth: 110, hideOnMobile: true },
  { key: 'contractor',  label: 'Dostawca',  maxWidth: 120, hideOnMobile: true },
  { key: 'qtyFmt',      label: 'Ilość',     align: 'right', mono: true, hideOnMobile: true },
  { key: 'priceFmt',    label: 'Cena jedn.', align: 'right', mono: true },
  { key: 'totalFmt',    label: 'Wartość',   align: 'right', mono: true, hideOnMobile: true },
]

const PRICE_SUPPLIER_COLS = [
  { key: 'supplier',    label: 'Dostawca',    color: 'var(--text)', maxWidth: 160 },
  { key: 'count',       label: 'Zakupów',     align: 'right', mono: true },
  { key: 'avgFmt',      label: 'Śr. cena',    align: 'right', mono: true },
  { key: 'minFmt',      label: 'Min',         align: 'right', mono: true, hideOnMobile: true },
  { key: 'maxFmt',      label: 'Max',         align: 'right', mono: true, hideOnMobile: true },
  { key: 'lastFmt',     label: 'Ost. cena',   align: 'right', mono: true },
]

export default function ProductPriceHistoryResult({ history, text }) {
  const { kpis, priceHistory, supplierBreakdown, chartData, warnings } = history

  const diffColor = (kpis.diffPLN ?? 0) > 0.005 ? '#ef4444' : (kpis.diffPLN ?? 0) < -0.005 ? '#22c55e' : 'var(--text)'
  const diffSign = (kpis.diffPLN ?? 0) > 0.005 ? '+' : ''

  const kpiCards = [
    { label: 'Zakupów',       value: String(kpis.purchaseCount),   color: 'var(--text)' },
    { label: 'Pierwsza cena', value: kpis.firstPrice != null ? formatPLN(kpis.firstPrice) : '—', color: 'var(--text-2)' },
    { label: 'Ostatnia cena', value: kpis.lastPrice != null ? formatPLN(kpis.lastPrice) : '—', color: '#3b82f6' },
    { label: 'Zmiana PLN',    value: kpis.diffPLN != null ? `${diffSign}${formatPLN(kpis.diffPLN)}` : '—', color: diffColor },
    { label: 'Zmiana %',      value: kpis.diffPct != null ? `${diffSign}${kpis.diffPct.toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` : '—', color: diffColor },
    { label: 'Śr. cena',      value: kpis.avgPrice != null ? formatPLN(kpis.avgPrice) : '—', color: 'var(--text-2)' },
    { label: 'Najniższa',     value: kpis.minPrice != null ? formatPLN(kpis.minPrice) : '—', color: '#22c55e' },
    { label: 'Najwyższa',     value: kpis.maxPrice != null ? formatPLN(kpis.maxPrice) : '—', color: '#ef4444' },
  ]

  const historyRows = (priceHistory ?? []).map(l => ({
    ...l,
    dateFmt: formatDatePL(l.date),
    contractor: l.contractor ?? '—',
    numer: l.numer ?? '—',
    qtyFmt: fmtNum(l.qty),
    priceFmt: formatPLN(l.price),
    totalFmt: formatPLN(l.totalNetto),
  }))

  const supplierRows = (supplierBreakdown ?? []).map(s => ({
    ...s,
    count: String(s.count),
    avgFmt: formatPLN(s.avgPrice),
    minFmt: formatPLN(s.minPrice),
    maxFmt: formatPLN(s.maxPrice),
    lastFmt: formatPLN(s.lastPrice),
  }))

  return (
    <div className="space-y-3" style={{ maxWidth: '100%', overflow: 'hidden' }}>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>{text}</p>

      <AssistantWarnings warnings={warnings} />

      <AssistantResultActions summaryText={text} />

      <AssistantKpiCards cards={kpiCards} />

      {chartData.length > 1 && (
        <AssistantChart
          data={chartData}
          dataKey="price"
          xAxisKey="date"
          title={`Historia ceny — ${history.matchedProductName ?? history.productQuery}`}
          type="line"
          tooltipSuffix=" zł"
          tooltipDecimals={2}
        />
      )}

      {historyRows.length > 0 && (
        <AssistantDataTable
          title="Historia zakupów"
          columns={PRICE_HISTORY_COLS}
          rows={historyRows}
          emptyMessage="Brak historii zakupów"
          exportable
          exportFilename="magzic-historia-ceny-zakupy.csv"
        />
      )}

      {supplierRows.length > 0 && (
        <AssistantDataTable
          title="Dostawcy"
          columns={PRICE_SUPPLIER_COLS}
          rows={supplierRows}
          emptyMessage="Brak dostawców"
          exportable
          exportFilename="magzic-historia-ceny-dostawcy.csv"
        />
      )}
    </div>
  )
}
