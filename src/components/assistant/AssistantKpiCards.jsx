import { formatPLN } from '../../utils/assistantResponseFormatter'

function KpiCard({ label, value, color }) {
  return (
    <div
      className="rounded-xl p-3.5"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
    >
      <p className="text-xs leading-tight mb-1.5" style={{ color: 'var(--text-2)' }}>{label}</p>
      <p
        className="text-sm font-semibold leading-tight"
        style={{ color: color ?? 'var(--text)', fontFamily: 'DM Mono, monospace', wordBreak: 'break-all' }}
      >
        {value}
      </p>
    </div>
  )
}

export default function AssistantKpiCards({ kpis }) {
  if (!kpis) return null

  const cards = [
    { label: 'Łączna wartość brutto', value: formatPLN(kpis.totalBrutto), color: '#3b82f6' },
    { label: 'Łączna wartość netto',  value: formatPLN(kpis.totalNetto),  color: '#6366f1' },
    { label: 'Liczba faktur',          value: String(kpis.invoiceCount),   color: 'var(--text)' },
    { label: 'Liczba dostawców',       value: String(kpis.supplierCount),  color: 'var(--text)' },
    { label: 'Śr. wartość faktury',    value: formatPLN(kpis.avgInvoice),  color: 'var(--text-2)' },
    { label: 'Pozycji łącznie',        value: String(kpis.lineCount),      color: 'var(--text-2)' },
  ]

  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}
    >
      {cards.map(c => <KpiCard key={c.label} {...c} />)}
    </div>
  )
}
