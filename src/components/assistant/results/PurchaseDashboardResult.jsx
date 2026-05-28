import AssistantKpiCards from '../AssistantKpiCards'
import AssistantDataTable from '../AssistantDataTable'
import AssistantChart from '../AssistantChart'
import AssistantWarnings from '../AssistantWarnings'
import AssistantResultActions from '../AssistantResultActions'
import { formatPLN } from '../../../utils/assistantResponseFormatter'

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

export default function PurchaseDashboardResult({ dashboard, text }) {
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
    <div className="space-y-4" style={{ maxWidth: '100%', overflow: 'hidden' }}>
      {text && <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>{text}</p>}

      <AssistantWarnings warnings={warnings} />

      <AssistantResultActions summaryText={text} />

      <AssistantKpiCards kpis={kpis} />

      {(purchasesOverTime ?? []).length > 0 && (
        <AssistantChart
          data={purchasesOverTime}
          dataKey={chartDataKey}
          title={chartTitle}
        />
      )}

      {supplierRows.length > 0 && (
        <AssistantDataTable
          title="Top dostawcy"
          columns={SUPPLIER_COLS}
          rows={supplierRows}
          emptyMessage="Brak dostawców"
          exportable
          exportFilename="magzic-dashboard-top-dostawcy.csv"
        />
      )}

      {productRows.length > 0 && (
        <AssistantDataTable
          title="Top produkty kosztowo"
          columns={PRODUCT_COLS}
          rows={productRows}
          emptyMessage="Brak pozycji faktur"
          exportable
          exportFilename="magzic-dashboard-top-produkty.csv"
        />
      )}
    </div>
  )
}
