import { formatPLN } from '../../utils/assistantResponseFormatter'

function safeValue(v) {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'number' && isNaN(v)) return '—'
  return v
}

function KpiCard({ label, value, color }) {
  return (
    <div
      className="rounded-2xl p-3.5 flex flex-col gap-1.5"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        minWidth: 0,
      }}
    >
      <p
        className="font-medium leading-tight uppercase tracking-widest"
        style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: '0.07em' }}
      >
        {label}
      </p>
      <p
        className="font-bold leading-tight"
        style={{
          color: color ?? 'var(--text)',
          fontFamily: 'DM Mono, monospace',
          fontSize: 17,
          wordBreak: 'break-word',
          lineHeight: 1.2,
        }}
      >
        {safeValue(value)}
      </p>
    </div>
  )
}

export default function AssistantKpiCards({ kpis, cards: cardsProp }) {
  if (cardsProp) {
    return (
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(116px, 1fr))' }}
      >
        {cardsProp.map(c => <KpiCard key={c.label} {...c} />)}
      </div>
    )
  }

  if (!kpis) return null

  const cards = [
    { label: 'Łączna wartość brutto', value: formatPLN(kpis.totalBrutto), color: '#3b82f6' },
    { label: 'Łączna wartość netto',  value: formatPLN(kpis.totalNetto),  color: '#6366f1' },
    { label: 'Liczba faktur',          value: safeValue(kpis.invoiceCount != null ? String(kpis.invoiceCount) : null), color: 'var(--text)' },
    { label: 'Liczba dostawców',       value: safeValue(kpis.supplierCount != null ? String(kpis.supplierCount) : null), color: 'var(--text)' },
    { label: 'Śr. wartość faktury',    value: formatPLN(kpis.avgInvoice),  color: 'var(--text-2)' },
    { label: 'Pozycji łącznie',        value: safeValue(kpis.lineCount != null ? String(kpis.lineCount) : null), color: 'var(--text-2)' },
  ]

  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(116px, 1fr))' }}
    >
      {cards.map(c => <KpiCard key={c.label} {...c} />)}
    </div>
  )
}
