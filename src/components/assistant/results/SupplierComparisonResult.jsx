import { TrendingDown } from 'lucide-react'
import AssistantKpiCards from '../AssistantKpiCards'
import AssistantDataTable from '../AssistantDataTable'
import AssistantChart from '../AssistantChart'
import AssistantWarnings from '../AssistantWarnings'
import AssistantResultActions from '../AssistantResultActions'
import { formatPLN } from '../../../utils/assistantResponseFormatter'

const SUPPLIER_RANKING_COLS = [
  { key: 'supplier',                label: 'Dostawca',         color: 'var(--text)', maxWidth: 160 },
  { key: 'priceIndexFmt',           label: 'Indeks',            align: 'right', mono: true },
  { key: 'priceIndexLabel',         label: 'Ocena',             align: 'right' },
  { key: 'comparableProductCount',  label: 'Prod. por.',        align: 'right', mono: true, hideOnMobile: true },
  { key: 'purchaseCount',           label: 'Zakupów',           align: 'right', mono: true, hideOnMobile: true },
  { key: 'totalSpendFmt',           label: 'Suma',              align: 'right', mono: true, hideOnMobile: true },
  { key: 'invoiceCount',            label: 'Faktury',           align: 'right', mono: true, hideOnMobile: true },
]

const COMPARABLE_PRODUCT_COLS = [
  { key: 'name',                  label: 'Produkt',         color: 'var(--text)', maxWidth: 150 },
  { key: 'supplierCount',         label: 'Dostaw.',          align: 'right', mono: true, hideOnMobile: true },
  { key: 'cheapestSupplier',      label: 'Najtańszy',        maxWidth: 120, hideOnMobile: true },
  { key: 'mostExpensiveSupplier', label: 'Najdroższy',       maxWidth: 120, hideOnMobile: true },
  { key: 'minAvgFmt',             label: 'Min. cena',        align: 'right', mono: true },
  { key: 'maxAvgFmt',             label: 'Max. cena',        align: 'right', mono: true },
  { key: 'diffPLNFmt',            label: 'Δ PLN',            align: 'right', mono: true },
  { key: 'diffPctFmt',            label: 'Δ%',               align: 'right', mono: true },
]

const SAVINGS_COLS = [
  { key: 'name',                  label: 'Produkt',          color: 'var(--text)', maxWidth: 140 },
  { key: 'cheapestSupplier',      label: 'Kupuj u',           maxWidth: 120 },
  { key: 'mostExpensiveSupplier', label: 'Unikaj',            maxWidth: 120, hideOnMobile: true },
  { key: 'diffPLNFmt',            label: 'Δ PLN',             align: 'right', mono: true },
  { key: 'diffPctFmt',            label: 'Δ%',                align: 'right', mono: true },
]

const SPEND_BREAKDOWN_COLS = [
  { key: 'supplier',    label: 'Dostawca',   color: 'var(--text)', maxWidth: 160 },
  { key: 'totalSpendFmt', label: 'Suma',     align: 'right', mono: true },
  { key: 'invoiceCount',  label: 'Faktury',   align: 'right', mono: true, hideOnMobile: true },
  { key: 'lineCount',     label: 'Pozycje',   align: 'right', mono: true, hideOnMobile: true },
  { key: 'productCount',  label: 'Produkty',  align: 'right', mono: true, hideOnMobile: true },
]

function priceIndexLabel(pi) {
  if (pi < 0.95) return '✅ tańszy'
  if (pi > 1.05) return '🔴 droższy'
  return '🟡 średni'
}

function getPriceIndexBarColor(entry) {
  return entry.priceIndex < 1.0 ? '#22c55e' : '#ef4444'
}

export default function SupplierComparisonResult({ comparison, text }) {
  const { kpis, supplierRanking, comparableProducts, savingsOpportunities, supplierSpendBreakdown, chartData, warnings } = comparison

  const kpiCards = [
    { label: 'Dostawców',            value: String(kpis.supplierCount),      color: 'var(--text)' },
    { label: 'Prod. porównywalnych', value: String(kpis.comparableProductCount), color: kpis.comparableProductCount > 0 ? '#3b82f6' : 'var(--text-2)' },
    { label: 'Najtańszy dostawca',   value: kpis.cheapestSupplier ?? '—',    color: '#22c55e' },
    { label: 'Indeks najtan.',       value: kpis.cheapestPriceIndex != null ? kpis.cheapestPriceIndex.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—', color: '#22c55e' },
    { label: 'Najdroższy dostawca',  value: kpis.mostExpensiveSupplier ?? '—', color: kpis.mostExpensiveSupplier !== kpis.cheapestSupplier ? '#ef4444' : 'var(--text-2)' },
    { label: 'Indeks najdroż.',      value: kpis.mostExpensivePriceIndex != null ? kpis.mostExpensivePriceIndex.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—', color: '#ef4444' },
    { label: 'Okazji oszczędności',  value: String(kpis.savingsCount),       color: kpis.savingsCount > 0 ? '#f59e0b' : 'var(--text-2)' },
    { label: 'Suma zakupów',         value: formatPLN(kpis.totalSpend),      color: 'var(--text-2)' },
  ]

  const rankingRows = (supplierRanking ?? []).map(s => ({
    ...s,
    priceIndexFmt: s.priceIndex.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    priceIndexLabel: priceIndexLabel(s.priceIndex),
    totalSpendFmt: formatPLN(s.totalSpend),
  }))

  const comparableRows = (comparableProducts ?? []).map(p => ({
    ...p,
    minAvgFmt: formatPLN(p.minAvgPrice),
    maxAvgFmt: formatPLN(p.maxAvgPrice),
    diffPLNFmt: formatPLN(p.diffPLN),
    diffPctFmt: '+' + p.diffPct.toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%',
  }))

  const savingsRows = (savingsOpportunities ?? []).map(p => ({
    ...p,
    diffPLNFmt: formatPLN(p.diffPLN),
    diffPctFmt: '+' + p.diffPct.toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%',
  }))

  const spendRows = (supplierSpendBreakdown ?? []).map(s => ({
    ...s,
    totalSpendFmt: formatPLN(s.totalSpend),
  }))

  return (
    <div className="space-y-4" style={{ maxWidth: '100%', overflow: 'hidden' }}>
      {text && <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>{text}</p>}

      <AssistantWarnings warnings={warnings} />

      <AssistantResultActions summaryText={text} />

      <AssistantKpiCards cards={kpiCards} />

      {chartData.length > 1 && (
        <AssistantChart
          data={chartData}
          dataKey="priceIndex"
          xAxisKey="name"
          title="Indeks cenowy dostawców (< 1,00 = tańszy od mediany)"
          getBarColor={getPriceIndexBarColor}
          tooltipSuffix=""
          tooltipDecimals={3}
          yAxisDomain={['auto', 'auto']}
        />
      )}

      {rankingRows.length > 0 && (
        <AssistantDataTable
          title="Ranking dostawców wg indeksu cenowego"
          columns={SUPPLIER_RANKING_COLS}
          rows={rankingRows}
          emptyMessage="Brak danych do rankingu"
          exportable
          exportFilename="magzic-dostawcy-ranking.csv"
        />
      )}

      {comparableRows.length > 0 && (
        <AssistantDataTable
          title="Produkty porównywalne (min. 2 dostawców)"
          columns={COMPARABLE_PRODUCT_COLS}
          rows={comparableRows}
          emptyMessage="Brak produktów porównywalnych"
          exportable
          exportFilename="magzic-dostawcy-produkty-porownywalne.csv"
        />
      )}

      {savingsRows.length > 0 && (
        <AssistantDataTable
          title={<span className="flex items-center gap-1.5"><TrendingDown size={12} style={{ color: '#22c55e' }} />Okazje do oszczędności</span>}
          columns={SAVINGS_COLS}
          rows={savingsRows}
          emptyMessage="Brak okazji do oszczędności"
          exportable
          exportFilename="magzic-dostawcy-oszczednosci.csv"
        />
      )}

      {spendRows.length > 0 && (
        <AssistantDataTable
          title="Wydatki wg dostawców"
          columns={SPEND_BREAKDOWN_COLS}
          rows={spendRows}
          emptyMessage="Brak danych"
          exportable
          exportFilename="magzic-dostawcy-wydatki.csv"
        />
      )}
    </div>
  )
}
