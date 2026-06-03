import { Plus, Pencil, Trash2 } from 'lucide-react'
import { recalculateInvoiceLineStatus } from '../../utils/invoicePositionValidator'

function getPosBadge(poz, fak, towary) {
  if (!poz.towar_id) return { label: 'Robocza', bg: '#fef3c7', color: '#92400e', border: '#fcd34d' }
  const status = recalculateInvoiceLineStatus(poz, { towary, fakturaDefaultMagazynId: fak?.magazyn_id || null })
  if (status.inventoryImpactStatus === 'ready') return { label: 'Gotowa', bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' }
  if (status.inventoryImpactStatus === 'blocked') return { label: 'Niekompletna', bg: '#fef3c7', color: '#92400e', border: '#fcd34d' }
  if (status.inventoryImpactStatus === 'none') return { label: 'Koszt', bg: '#f0f9ff', color: '#0369a1', border: '#bae6fd' }
  return { label: 'Robocza', bg: '#fef3c7', color: '#92400e', border: '#fcd34d' }
}

const PRICE_MODE_BADGE = {
  net:     { label: 'NETTO',    bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' },
  gross:   { label: 'BRUTTO',   bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  mixed:   { label: 'MIESZANA', bg: '#fefce8', color: '#854d0e', border: '#fde68a' },
  unknown: { label: 'NIEPEWNA', bg: '#fef2f2', color: '#991b1b', border: '#fecaca' },
}

export default function InvoiceDetails({ fak, poz, towary, onAddPoz, onEditPoz, onDeletePoz }) {
  const total = poz.reduce((s, p) => s + Number(p.ilosc) * Number(p.cena_netto), 0)
  const totalBrutto = poz.reduce((s, p) => {
    const net = Number(p.ilosc) * Number(p.cena_netto)
    const vat = net * (Number(p.vat_procent ?? 23) / 100)
    return s + net + vat
  }, 0)

  // price_mode = saved mode (from DB), priceMode = parser-detected (from extraction)
  const priceMode = fak?.price_mode ?? fak?.priceMode ?? null
  const modeBadge = PRICE_MODE_BADGE[priceMode] || null

  return (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      {priceMode && priceMode !== 'unknown' && modeBadge && (
        <div className="px-5 py-2 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ background: modeBadge.bg, color: modeBadge.color, border: `1px solid ${modeBadge.border}` }}>
            Zapisano: {modeBadge.label}
          </span>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>
            {priceMode === 'net' && 'Ceny netto'}
            {priceMode === 'gross' && 'Ceny brutto — wartości netto wyliczone automatycznie'}
            {priceMode === 'mixed' && 'Ceny mieszane'}
          </span>
        </div>
      )}
      {poz.length > 0 ? (
        <div className="table-scroll-x">
          <table className="w-full text-sm" style={{ minWidth: 560 }}>
            <thead>
              <tr style={{ background: 'var(--table-sub)' }}>
                <th className="text-left px-5 py-2.5 font-medium" style={{ color: 'var(--muted)', fontSize: 12 }}>Towar</th>
                <th className="text-right px-5 py-2.5 font-medium" style={{ color: 'var(--muted)', fontSize: 12 }}>Ilość</th>
                <th className="text-right px-4 py-2.5 font-medium hidden sm:table-cell" style={{ color: 'var(--muted)', fontSize: 12 }}>Jednostka</th>
                <th className="text-right px-5 py-2.5 font-medium" style={{ color: 'var(--muted)', fontSize: 12 }}>Cena netto</th>
                <th className="text-right px-5 py-2.5 font-medium hidden md:table-cell" style={{ color: 'var(--muted)', fontSize: 12 }}>Cena brutto</th>
                <th className="text-right px-4 py-2.5 font-medium hidden sm:table-cell" style={{ color: 'var(--muted)', fontSize: 12 }}>VAT%</th>
                <th className="text-right px-5 py-2.5 font-medium" style={{ color: 'var(--muted)', fontSize: 12 }}>Suma netto</th>
                <th className="text-right px-5 py-2.5 font-medium hidden md:table-cell" style={{ color: 'var(--muted)', fontSize: 12 }}>Suma brutto</th>
                <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell" style={{ color: 'var(--muted)', fontSize: 12 }}>Status</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {poz.map(p => {
                const badge = getPosBadge(p, fak, towary)
                const netPrice = Number(p.cena_netto)
                const vatRate = Number(p.vat_procent ?? 23)
                const grossPrice = netPrice * (1 + vatRate / 100)
                const sumaNetto = Number(p.ilosc) * netPrice
                const sumaBrutto = sumaNetto * (1 + vatRate / 100)
                const isService = p.itemType === 'service_item' || p.shouldAffectInventory === false

                return (
                  <tr key={p.id} className="table-row" style={{ borderTop: '1px solid var(--border)' }}>
                    <td className="px-5 py-3" style={{ color: 'var(--text)' }}>
                      {(() => {
                        const productName = (p.towary?.nazwa?.length >= 2) ? p.towary.nazwa : null
                        const displayNazwa = productName || p.raw_name || p.rawName || p.nazwa || null
                        if (!displayNazwa) {
                          return <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>(brak towaru)</span>
                        }
                        return (
                          <div>
                            <div style={{ fontWeight: 500, fontSize: 13 }}>{displayNazwa}</div>
                            {productName && (p.raw_name || p.rawName) && productName !== (p.raw_name || p.rawName) && (
                              <div style={{ fontSize: 10, color: 'var(--text-2)' }}>PDF: {p.raw_name || p.rawName}</div>
                            )}
                            {isService && (
                              <span className="text-xs font-medium px-1 py-0.5 rounded" style={{ background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd', fontSize: 10 }}>Usługa</span>
                            )}
                            {(p.indeks || p.sku) && (
                              <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-2)', marginTop: 1 }}>{p.indeks || p.sku}</div>
                            )}
                          </div>
                        )
                      })()}
                    </td>
                    <td className="px-5 py-3 text-right" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-2)' }}>{p.ilosc}</td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell" style={{ color: 'var(--text-2)' }}>
                      {p.jednostka || (p.towary?.nazwa?.length >= 2 ? p.towary?.jednostka : null) || '—'}
                    </td>
                    <td className="px-5 py-3 text-right" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-2)' }}>{netPrice.toFixed(2)} zł</td>
                    <td className="px-5 py-3 text-right hidden md:table-cell" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-2)', opacity: 0.7 }}>{grossPrice.toFixed(2)} zł</td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell" style={{ color: 'var(--text-2)' }}>{p.vat_procent ?? 23}%</td>
                    <td className="px-5 py-3 text-right font-medium" style={{ fontFamily: 'DM Mono, monospace', color: '#3b82f6' }}>{sumaNetto.toFixed(2)} zł</td>
                    <td className="px-5 py-3 text-right hidden md:table-cell" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-2)', opacity: 0.7 }}>{sumaBrutto.toFixed(2)} zł</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      {fak.status === 'robocza' && (
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => onEditPoz(p, fak)} className="p-1 rounded" style={{ color: 'var(--text-2)' }} title="Edytuj pozycję"><Pencil size={12} /></button>
                          <button onClick={() => onDeletePoz(p)} className="p-1 rounded" style={{ color: '#dc2626' }} title="Usuń pozycję"><Trash2 size={12} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--border)' }}>
                <td colSpan={6} className="px-5 py-3 text-right text-sm font-medium" style={{ color: 'var(--text-2)' }}>
                  {priceMode === 'gross' ? 'Razem brutto:' : 'Razem netto:'}
                </td>
                <td className="px-5 py-3 text-right font-semibold" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text)' }}>
                  {priceMode === 'gross' ? totalBrutto.toFixed(2) : total.toFixed(2)} zł
                </td>
                <td className="px-5 py-3 text-right hidden md:table-cell" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-2)', opacity: 0.7 }}>
                  {priceMode === 'gross' ? `netto: ${total.toFixed(2)}` : `brutto: ${totalBrutto.toFixed(2)}`} zł
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p className="text-sm text-center py-4" style={{ color: 'var(--muted)' }}>Brak pozycji</p>
      )}
      <div className="px-5 py-3" style={{ borderTop: '1px solid var(--border)' }}>
        <button onClick={() => onAddPoz(fak)} className="flex items-center gap-1.5 text-xs rounded-lg px-3 py-1.5 font-medium" style={{ background: 'var(--table-sub)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
          <Plus size={12} /> Dodaj pozycję
        </button>
      </div>
      {fak.notatki && (
        <div className="px-5 py-3 text-sm" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-2)' }}>
          <span className="font-medium" style={{ color: 'var(--muted)' }}>Notatki: </span>{fak.notatki}
        </div>
      )}
    </div>
  )
}
