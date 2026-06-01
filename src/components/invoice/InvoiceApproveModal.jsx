import Modal from '../Modal'
import { recalculateInvoiceLineStatus } from '../../utils/invoicePositionValidator'

export default function InvoiceApproveModal({
  show, onClose,
  fak, pozycje, towary, magazyny,
  onApprove,
}) {
  if (!show || !fak) return null

  const poz = pozycje[fak.id] || []
  const ctx = { towary, fakturaDefaultMagazynId: fak.magazyn_id || null }
  const withTowar = poz.filter(p => p.towar_id)
  const bezTowaru = poz.filter(p => !p.towar_id)
  const readyTowar = withTowar.filter(p => recalculateInvoiceLineStatus(p, ctx).inventoryImpactStatus === 'ready')
  const blockedTowar = withTowar.filter(p => recalculateInvoiceLineStatus(p, ctx).inventoryImpactStatus === 'blocked')
  const mag = magazyny.find(m => m.id === fak.magazyn_id)

  return (
    <Modal
      title={`Zatwierdź fakturę ${fak.numer}`}
      onClose={onClose}
      maxWidth={520}
    >
      <div className="space-y-4">
        <p className="text-sm" style={{ color: 'var(--text-2)' }}>
          Zatwierdzenie zaktualizuje stany magazynowe dla pozycji towarowych z kompletymi danymi.
        </p>

        {readyTowar.length > 0 && (
          <div className="rounded-lg p-3 space-y-1.5" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
            <p className="text-xs font-semibold" style={{ color: '#166534' }}>
              ✅ Do przyjęcia na magazyn ({readyTowar.length} poz.):
            </p>
            {readyTowar.map(p => {
              const m = magazyny.find(x => x.id === (p.magazyn_id || fak.magazyn_id))
              return (
                <div key={p.id} className="text-xs" style={{ color: '#166534' }}>
                  · {p.towary?.nazwa || '—'} × {p.ilosc} {p.towary?.jednostka || 'szt.'} → {m?.nazwa || mag?.nazwa || '?'}
                </div>
              )
            })}
          </div>
        )}

        {blockedTowar.length > 0 && (
          <div className="rounded-lg p-3" style={{ background: '#fef3c7', border: '1px solid #fcd34d' }}>
            <p className="text-xs font-semibold mb-1" style={{ color: '#92400e' }}>
              ⚠ {blockedTowar.length} poz. z towarem ale niekompletne — nie trafią do magazynu:
            </p>
            {blockedTowar.map(p => {
              const s = recalculateInvoiceLineStatus(p, ctx)
              const displayName = p.towary?.nazwa && p.towary.nazwa.length >= 2
                ? p.towary.nazwa
                : (p.raw_name || p.towary?.nazwa || '—')
              return (
                <div key={p.id} className="text-xs mt-0.5" style={{ color: '#92400e' }}>
                  · {displayName} — {s.errors.join(', ')}
                </div>
              )
            })}
          </div>
        )}

        {bezTowaru.length > 0 && (
          <div className="rounded-lg p-3" style={{ background: '#fef3c7', border: '1px solid #fcd34d' }}>
            <p className="text-xs font-semibold" style={{ color: '#92400e' }}>
              ⚠ {bezTowaru.length} poz. robocze (bez towaru) — nie trafią do magazynu
            </p>
            {bezTowaru.map(p => (
              <div key={p.id} className="text-xs mt-0.5" style={{ color: '#92400e' }}>
                · {p.raw_name || p.towary?.nazwa || '(brak nazwy)'} × {p.ilosc} — brak dopasowanego towaru
              </div>
            ))}
          </div>
        )}

        {readyTowar.length === 0 && (
          <div className="rounded-lg p-3" style={{ background: '#fef2f2', border: '1px solid #fca5a5' }}>
            <p className="text-xs" style={{ color: '#991b1b' }}>
              ❌ Brak gotowych pozycji towarowych — żadna pozycja nie trafi do magazynu. Faktura zostanie oznaczona jako zatwierdzona.
            </p>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg py-2 text-sm font-medium"
            style={{ background: 'var(--table-sub)', color: 'var(--text-2)' }}
          >
            Anuluj
          </button>
          <button
            type="button"
            onClick={onApprove}
            className="flex-1 rounded-lg py-2 text-sm font-semibold text-white"
            style={{ background: '#22c55e' }}
          >
            Zatwierdź fakturę
          </button>
        </div>
      </div>
    </Modal>
  )
}
