import { AlertTriangle, Package } from 'lucide-react'
import AssistantKpiCards from '../AssistantKpiCards'
import AssistantDataTable from '../AssistantDataTable'
import AssistantChart from '../AssistantChart'
import AssistantWarnings from '../AssistantWarnings'
import AssistantResultActions from '../AssistantResultActions'
import { formatDatePL } from '../../../utils/assistantFormatters'

const REVIEW_INVOICE_COLS = [
  { key: 'numer',           label: 'Numer',         color: 'var(--text)', maxWidth: 120, noWrap: true },
  { key: 'date',            label: 'Data',           align: 'right', mono: true, hideOnMobile: true },
  { key: 'contractor',      label: 'Kontrahent',     maxWidth: 120, hideOnMobile: true },
  { key: 'issueCountFmt',   label: 'Problemów',      align: 'right', mono: true },
  { key: 'severityFmt',     label: 'Pilność',        align: 'right' },
  { key: 'suggestedAction', label: 'Zalecenie',      maxWidth: 180, hideOnMobile: true },
]

const ISSUE_BREAKDOWN_COLS = [
  { key: 'label', label: 'Problem',      color: 'var(--text)', maxWidth: 200 },
  { key: 'count', label: 'Wystąpień',    align: 'right', mono: true },
]

function severityFmt(severity) {
  if (severity === 'critical') return '🔴 krytyczna'
  if (severity === 'warning') return '🟠 ostrzeżenie'
  return '🟡 info'
}

function makeReviewRows(list) {
  return list.map(inv => ({
    ...inv,
    date: inv.date ? formatDatePL(inv.date) : '—',
    contractor: inv.contractor ?? '—',
    issueCountFmt: String(inv.issueCount),
    severityFmt: severityFmt(inv.severity),
    suggestedAction: inv.suggestedAction ?? '—',
  }))
}

export default function InvoicesNeedingReviewResult({ review, text }) {
  const { kpis, invoicesToReview, criticalInvoices, issueBreakdown, chartData, warnings } = review

  const kpiCards = [
    { label: 'Przeanalizowanych', value: String(kpis.reviewedCount),   color: 'var(--text)' },
    { label: 'Do weryfikacji',    value: String(kpis.reviewCount),      color: kpis.reviewCount > 0 ? '#f59e0b' : 'var(--text-2)' },
    { label: 'Krytyczne',         value: String(kpis.criticalCount),    color: kpis.criticalCount > 0 ? '#dc2626' : 'var(--text-2)' },
    { label: 'Problemów łącznie', value: String(kpis.totalIssues),      color: kpis.totalIssues > 0 ? '#ef4444' : 'var(--text-2)' },
    { label: 'Bez towaru',        value: String(kpis.unmatchedLinesCount), color: kpis.unmatchedLinesCount > 0 ? '#f59e0b' : 'var(--text-2)' },
    { label: 'Bez ceny',          value: String(kpis.noPriceCount),     color: kpis.noPriceCount > 0 ? '#f59e0b' : 'var(--text-2)' },
  ]

  return (
    <div className="space-y-4" style={{ maxWidth: '100%', overflow: 'hidden' }}>
      {text && <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>{text}</p>}

      <AssistantWarnings warnings={warnings} />

      <AssistantResultActions summaryText={text} />

      <AssistantKpiCards cards={kpiCards} />

      {chartData.length > 0 && (
        <AssistantChart
          data={chartData}
          dataKey="value"
          xAxisKey="name"
          title="Faktury wg pilności"
          getBarColor={entry => {
            if (entry.name === 'Krytyczne') return '#dc2626'
            if (entry.name === 'Ostrzeżenia') return '#f59e0b'
            return '#6366f1'
          }}
          tooltipSuffix=" faktur"
          tooltipDecimals={0}
        />
      )}

      {criticalInvoices.length > 0 && (
        <AssistantDataTable
          title={<span className="flex items-center gap-1.5"><AlertTriangle size={12} style={{ color: '#dc2626' }} />Krytyczne — wymagają natychmiastowej uwagi</span>}
          columns={REVIEW_INVOICE_COLS}
          rows={makeReviewRows(criticalInvoices)}
          emptyMessage="Brak"
          exportable
          exportFilename="magzic-weryfikacja-krytyczne.csv"
        />
      )}

      {invoicesToReview.length > 0 && (
        <AssistantDataTable
          title={<span className="flex items-center gap-1.5"><Package size={12} style={{ color: '#f59e0b' }} />Wszystkie faktury do weryfikacji</span>}
          columns={REVIEW_INVOICE_COLS}
          rows={makeReviewRows(invoicesToReview)}
          emptyMessage="Brak faktur do weryfikacji"
          exportable
          exportFilename="magzic-weryfikacja-faktury.csv"
        />
      )}

      {issueBreakdown.length > 0 && (
        <AssistantDataTable
          title="Najczęstsze problemy"
          columns={ISSUE_BREAKDOWN_COLS}
          rows={issueBreakdown}
          emptyMessage="Brak problemów"
          exportable
          exportFilename="magzic-weryfikacja-problemy.csv"
        />
      )}
    </div>
  )
}
