import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Save } from 'lucide-react'
import { recalculateInvoiceLineStatus } from '../../utils/invoicePositionValidator'

function getPosBadge(poz, fak, towary) {
  if (!poz.towar_id) return { label: 'Robocza', bg: '#fef3c7', color: '#92400e', border: '#fcd34d' }
  const status = recalculateInvoiceLineStatus(poz, { towary, fakturaDefaultMagazynId: fak?.magazyn_id || null })
  if (status.inventoryImpactStatus === 'ready') return { label: 'Gotowa', bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' }
  if (status.inventoryImpactStatus === 'blocked') return { label: 'Niekompletna', bg: '#fef3c7', color: '#92400e', border: '#fcd34d' }
  if (status.inventoryImpactStatus === 'none') return { label: 'Koszt', bg: '#f0f9ff', color: '#0369a1', border: '#bae6fd' }
  return { label: 'Robocza', bg: '#fef3c7', color: '#92400e', border: '#fcd34d' }
}

export default function InvoiceDetails({ fak, poz, towary, onAddPoz, onEditPoz, onDeletePoz, onSavePriceMode }) {
  const savedMode = fak?.price_mode ?? fak?.priceMode ?? 'net'
  const [activeMode, setActiveMode] = useState(savedMode)
  const [pendingSave, setPendingSave] = useState(false)

  useEffect(() => {
    setActiveMode(fak?.price_mode ?? fak?.priceMode ?? 'net')
    setPendingSave(false)
  }, [fak?.id, fak?.price_mode])

  function switchMode(mode) {
    setActiveMode(mode)
    setPendingSave(mode !== savedMode)
  }

  const isGross = activeMode === 'gross'

  const total = poz.reduce((s, p) => {
    const ltn = Number(p.line_total_net)
    if (ltn > 0) return s + ltn
    return s + Math.round(Number(p.ilosc) * Number(p.cena_netto) * 100) / 100
  }, 0)
  const totalBrutto = poz.reduce((s, p) => {
    const ltg = Number(p.line_total_gross)
    if (ltg > 0) return s + ltg
    const upg = Number(p.unit_price_gross ?? 0)
    if (upg > 0) return s + Math.round(upg * Number(p.ilosc) * 100) / 100
    const net = Math.round(Number(p.ilosc) * Number(p.cena_netto) * 100) / 100
    return s + Math.round(net * (1 + Number(p.vat_procent ?? 23) / 100) * 100) / 100
  }, 0)

  const mainTotal = isGross ? totalBrutto : total
  const altTotal  = isGross ? total : totalBrutto

  const btnBase = { borderRadius: 6, padding: '3px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '2px solid transparent' }
  const netActive   = { ...btnBase, background: '#16a34a', color: '#fff', border: '2px solid #16a34a' }
  const netInactive = { ...btnBase, background: 'var(--card)', color: '#16a34a', border: '2px solid #bbf7d0' }
  const grossActive   = { ...btnBase, background: '#1d4ed8', color: '#fff', border: '2px solid #1d4ed8' }
  const grossInactive = { ...btnBase, background: 'var(--card)', color: '#1d4ed8', border: '2px solid #bfdbfe' }

  return (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      {/* Interactive mode toggle */}
      <div className="px-5 py-2 flex items-center gap-3 flex-wrap" style={{ borderBottom: '1px solid var(--border)', background: 'var(--table-sub)' }}>
        <span className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>Tryb ceny:</span>
        <button type="button" onClick={() => switchMode('net')} style={activeMode === 'net' ? netActive : netInactive}>NETTO</button>
        <button type="button" onClick={() => switchMode('gross')} style={activeMode === 'gross' ? grossActive : grossInactive}>BRUTTO</button>
        {pendingSave && onSavePriceMode && (
          <button
            type="button"
            onClick={() => onSavePriceMode(fak.id, activeMode)}
            className="flex items-center gap-1.5"
            style={{ ...btnBase, background: '#f59e0b', color: '#fff', border: '2px solid #f59e0b', marginLeft: 8 }}
          >
            <Save size={11} /> Zapisz zmianę
          </button>
        )}
        {!pendingSave && (
          <span className="text-xs" style={{ color: 'var(--muted)' }}>
            {isGross ? 'Ceny brutto — wartości netto wyliczone automatycznie' : 'Ceny netto'}
          </span>
        )}
      </div>

      {poz.length > 0 ? (
        <div className="table-scroll-x">
          <table className="w-full text-sm" style={{ minWidth: 560 }}>
            <thead>
              <tr style={{ background: 'var(--table-sub)' }}>
                <th className="text-left px-5 py-2.5 font-medium" style={{ color: 'var(--muted)', fontSize: 12 }}>Towar</th>
                <th className="text-right px-5 py-2.5 font-medium" style={{ color: 'var(--muted)', fontSize: 12 }}>Ilość</th>
                <th className="text-right px-4 py-2.5 font-medium hidden sm:table-cell" style={{ color: 'var(--muted)', fontSize: 12 }}>Jednostka</th>
                <th className="text-right px-5 py-2.5 font-medium" style={{ color: isGross ? 'var(--muted)' : '#374151', fontSize: 12, opacity: isGross ? 0.6 : 1 }}>Cena netto</th>
                <th className="text-right px-5 py-2.5 font-medium hidden md:table-cell" style={{ color: isGross ? '#374151' : 'var(--muted)', fontSize: 12, opacity: isGross ? 1 : 0.6 }}>Cena brutto</th>
                <th className="text-right px-4 py-2.5 font-medium hidden sm:table-cell" style={{ color: 'var(--muted)', fontSize: 12 }}>VAT%</th>
                <th className="text-right px-5 py-2.5 font-medium" style={{ color: isGross ? 'var(--muted)' : '#374151', fontSize: 12, opacity: isGross ? 0.6 : 1 }}>Suma netto</th>
                <th className="text-right px-5 py-2.5 font-medium hidden md:table-cell" style={{ color: isGross ? '#374151' : 'var(--muted)', fontSize: 12, opacity: isGross ? 1 : 0.6 }}>Suma brutto</th>
                <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell" style={{ color: 'var(--muted)', fontSize: 12 }}>Status</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {poz.map(p => {
                const badge = getPosBadge(p, fak, towary)
                const netPrice = Number(p.cena_netto)
                const vatRate = Number(p.vat_procent ?? 23)
                const grossPrice = Number(p.unit_price_gross) || Math.round(netPrice * (1 + vatRate / 100) * 100) / 100
                const sumaNetto  = Number(p.line_total_net) || Math.round(Number(p.ilosc) * netPrice * 100) / 100
                const sumaBrutto = Number(p.line_total_gross) || Math.round(sumaNetto * (1 + vatRate / 100) * 100) / 100
                const isService = p.itemType === 'service_item' || p.shouldAffectInventory === false

                const netStyle   = { fontFamily: 'DM Mono, monospace', color: isGross ? 'var(--text-2)' : '#1d4ed8', fontWeight: isGross ? 400 : 600, opacity: isGross ? 0.6 : 1 }
                const grossStyle = { fontFamily: 'DM Mono, monospace', color: isGross ? '#1d4ed8' : 'var(--text-2)', fontWeight: isGross ? 600 : 400, opacity: isGross ? 1 : 0.6 }

                return (
                  <tr key={p.id} className="table-row" style={{ borderTop: '1px solid var(--border)' }}>
                    <td className="px-5 py-3" style={{ color: 'var(--text)' }}>
                      {(() => {
                        const productName = (p.towary?.nazwa?.length >= 2) ? p.towary.nazwa : null
                        const displayNazwa = productName || p.raw_name || p.rawName || p.nazwa || null
                        if (!displayNazwa) return <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>(brak towaru)</span>
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
                    <td className="px-5 py-3 text-right" style={netStyle}>{netPrice.toFixed(2)} zł</td>
                    <td className="px-5 py-3 text-right hidden md:table-cell" style={grossStyle}>{grossPrice.toFixed(2)} zł</td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell" style={{ color: 'var(--text-2)' }}>{p.vat_procent ?? 23}%</td>
                    <td className="px-5 py-3 text-right" style={netStyle}>{sumaNetto.toFixed(2)} zł</td>
                    <td className="px-5 py-3 text-right hidden md:table-cell" style={grossStyle}>{sumaBrutto.toFixed(2)} zł</td>
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
                <td colSpan={6} className="px-5 py-3 text-right text-sm font-semibold" style={{ color: 'var(--text-2)' }}>
                  {isGross ? 'Razem brutto:' : 'Razem netto:'}
                </td>
                <td className="px-5 py-3 text-right font-bold" style={{ fontFamily: 'DM Mono, monospace', color: isGross ? '#1d4ed8' : '#166534', fontSize: 15 }}>
                  {mainTotal.toFixed(2)} zł
                </td>
                <td className="px-5 py-3 text-right hidden md:table-cell" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-2)', opacity: 0.6, fontSize: 12 }}>
                  {isGross ? `netto: ${altTotal.toFixed(2)}` : `brutto: ${altTotal.toFixed(2)}`} zł
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
