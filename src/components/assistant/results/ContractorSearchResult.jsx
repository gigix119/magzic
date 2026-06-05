import { Building2 } from 'lucide-react'
import AssistantDataTable from '../AssistantDataTable'

const COLS = [
  { key: 'nazwa',     label: 'Kontrahent',   color: 'var(--text)', maxWidth: 160 },
  { key: 'nip',       label: 'NIP',           hideOnMobile: true },
  { key: 'faktury',   label: 'Faktur',        align: 'right', mono: true },
  { key: 'wydano',    label: 'Wydano netto',  align: 'right', mono: true },
  { key: 'ostatnia',  label: 'Ostatnia',      hideOnMobile: true },
]

function fmtPLN(value) {
  if (!value && value !== 0) return '—'
  return value.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' zł'
}

function buildRows(results) {
  return results.map(({ contractor, invoiceCount, totalSpent, lastInvoice }) => ({
    nazwa: contractor.nazwa ?? '—',
    nip: contractor.nip ?? '—',
    faktury: invoiceCount,
    wydano: fmtPLN(totalSpent),
    ostatnia: lastInvoice?.data_zakupu ?? '—',
  }))
}

export default function ContractorSearchResult({ data }) {
  const { results, query } = data

  if (!results || results.length === 0) {
    return (
      <div className="text-sm" style={{ color: 'var(--text-2)' }}>
        Nie znalazłem kontrahenta pasującego do „{query}".
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <AssistantDataTable
        title={<span className="flex items-center gap-1.5"><Building2 size={12} style={{ color: '#0d9488' }} />Kontrahenci: {query}</span>}
        columns={COLS}
        rows={buildRows(results)}
        emptyMessage="Brak wyników"
        exportable
        exportFilename={`magzic-kontrahent-${query}.csv`}
      />
    </div>
  )
}
