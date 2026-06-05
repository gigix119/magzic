import { Package } from 'lucide-react'
import AssistantDataTable from '../AssistantDataTable'

const COLS = [
  { key: 'nazwa',    label: 'Towar',    color: 'var(--text)', maxWidth: 160 },
  { key: 'kategoria', label: 'Kategoria', hideOnMobile: true },
  { key: 'stan',     label: 'Stan',      align: 'right', mono: true },
  { key: 'magazyn',  label: 'Magazyn',   hideOnMobile: true, maxWidth: 110 },
  { key: 'jednostka', label: 'Jedn.',    align: 'right', hideOnMobile: true },
]

function buildRows(results) {
  return results.map(({ product, stock }) => {
    const totalStock = stock.reduce((s, r) => s + (r.ilosc ?? 0), 0)
    const magazynName = stock.length === 1
      ? (stock[0].magazyny?.nazwa ?? '—')
      : stock.length > 1 ? `${stock.length} mag.` : '—'
    return {
      nazwa: product.nazwa ?? '—',
      kategoria: product.kategorie?.nazwa ?? '—',
      stan: totalStock,
      magazyn: magazynName,
      jednostka: product.jednostka ?? '—',
    }
  })
}

export default function ProductSearchResult({ data }) {
  const { results, query } = data

  if (!results || results.length === 0) {
    return (
      <div className="text-sm" style={{ color: 'var(--text-2)' }}>
        Nie znalazłem towaru pasującego do „{query}".
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <AssistantDataTable
        title={<span className="flex items-center gap-1.5"><Package size={12} style={{ color: '#3b82f6' }} />Wyniki wyszukiwania: {query}</span>}
        columns={COLS}
        rows={buildRows(results)}
        emptyMessage="Brak wyników"
        exportable
        exportFilename={`magzic-szukaj-${query}.csv`}
      />
    </div>
  )
}
