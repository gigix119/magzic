import { FileText, ChevronDown, ChevronUp, Trash2, Pencil, Plus, Download, CheckCircle2 } from 'lucide-react'
import InvoiceDetails from './InvoiceDetails'
import { fileIcon, typBadge, statusBadge } from './invoiceShared'

export default function InvoiceList({
  faktury, pozycje, expanded, towary, magazyny,
  onToggleExpand, onZatwierdz, onCofnij,
  onDeleteFak, onEditFak, onAddPoz,
  onEditPoz, onDeletePoz, onSavePriceMode,
}) {
  if (faktury.length === 0) {
    return (
      <div className="text-center py-16 rounded-xl" style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
        <FileText size={40} className="mx-auto mb-3 opacity-30" />
        <p>Brak faktur</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {faktury.map(fak => {
        const isOpen = expanded === fak.id
        const poz = pozycje[fak.id] || []
        const totalNetto = poz.reduce((s, p) => {
          const ltn = Number(p.line_total_net)
          if (ltn > 0) return s + ltn
          return s + Math.round(Number(p.ilosc) * Number(p.cena_netto) * 100) / 100
        }, 0)
        const totalBrutto = poz.reduce((s, p) => {
          // Prefer stored line_total_gross (already rounded, avoids netto×vat float errors)
          const ltg = Number(p.line_total_gross)
          if (ltg > 0) return s + ltg
          const upg = Number(p.unit_price_gross ?? 0)
          if (upg > 0) return s + Math.round(upg * Number(p.ilosc) * 100) / 100
          const net = Math.round(Number(p.ilosc) * Number(p.cena_netto) * 100) / 100
          return s + Math.round(net * (1 + Number(p.vat_procent ?? 23) / 100) * 100) / 100
        }, 0)
        const isGross = fak.price_mode === 'gross'
        const mainAmount  = isGross ? totalBrutto : totalNetto
        const altAmount   = isGross ? totalNetto  : totalBrutto
        return (
          <div key={fak.id} className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 px-4 sm:px-5 py-3 sm:py-4 faktura-card-row" style={{ background: isOpen ? 'var(--table-odd)' : 'transparent' }}>
              {/* Content button — full width on xs, flex-1 on sm+ */}
              <button className="flex-none w-full sm:flex-1 sm:w-auto flex items-center gap-3 text-left min-w-0" onClick={() => onToggleExpand(fak.id)}>
                <div className="rounded-lg flex items-center justify-center flex-shrink-0" style={{ width: 38, height: 38, background: 'rgba(59,130,246,0.1)' }}>
                  <FileText size={16} style={{ color: '#3b82f6' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold faktura-numer" style={{ color: 'var(--text)', fontFamily: 'DM Mono, monospace', fontSize: 13 }}>{fak.numer}</span>
                    {typBadge(fak.typ)}
                    {statusBadge(fak.status)}
                    {fak.price_mode === 'gross' && (
                      <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontSize: 10 }}>BRUTTO</span>
                    )}
                    {fak.price_mode === 'net' && (
                      <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', fontSize: 10 }}>NETTO</span>
                    )}
                    {fak.plik_url && <span className="flex items-center gap-1" title="Załączony plik">{fileIcon(fak.plik_url)}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs" style={{ color: 'var(--text-2)' }}>{fak.kontrahenci?.nazwa || '—'}</span>
                    <span style={{ color: 'var(--muted)' }}>·</span>
                    <span className="text-xs" style={{ color: 'var(--text-2)' }}>{fak.data_zakupu}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-auto sm:ml-0 mr-1">
                  <p className="font-medium text-sm" style={{ color: 'var(--text)', fontFamily: 'DM Mono, monospace' }}>
                    {mainAmount.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł
                  </p>
                  {altAmount > 0 && altAmount !== mainAmount && (
                    <p className="text-xs" style={{ color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
                      {isGross ? 'netto: ' : 'brutto: '}{altAmount.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł
                    </p>
                  )}
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>{poz.length} poz.</p>
                </div>
                {isOpen ? <ChevronUp size={16} style={{ color: 'var(--muted)', flexShrink: 0 }} /> : <ChevronDown size={16} style={{ color: 'var(--muted)', flexShrink: 0 }} />}
              </button>

              {/* Actions — full width on xs (wraps below button), inline on sm+ */}
              <div className="flex items-center gap-1.5 w-full sm:w-auto sm:flex-shrink-0 faktura-row-actions">
                {fak.status === 'robocza' && (
                  <>
                    <button onClick={() => onZatwierdz(fak)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white" style={{ background: '#22c55e', minHeight: 44 }} title="Zatwierdź fakturę">
                      <CheckCircle2 size={13} /> Zatwierdź
                    </button>
                    <button onClick={() => onAddPoz(fak)} className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'var(--table-sub)', color: 'var(--text-2)', border: '1px solid var(--border)', minHeight: 36 }} title="Dodaj pozycję">
                      <Plus size={12} /> Dodaj poz.
                    </button>
                    {fak.plik_url && (
                      <a href={fak.plik_url} target="_blank" rel="noreferrer" className="flex items-center justify-center rounded-lg" style={{ color: '#3b82f6', minHeight: 44, minWidth: 44 }} title="Pobierz plik">
                        <Download size={13} />
                      </a>
                    )}
                    <button onClick={() => onEditFak(fak)} className="flex items-center justify-center rounded-lg" style={{ color: 'var(--text-2)', minWidth: 44, minHeight: 44 }} title="Edytuj"><Pencil size={13} /></button>
                    <button onClick={() => onDeleteFak(fak)} className="flex items-center justify-center rounded-lg" style={{ color: '#dc2626', minWidth: 44, minHeight: 44 }} title="Usuń"><Trash2 size={13} /></button>
                  </>
                )}
                {fak.status === 'zatwierdzona' && (
                  <>
                    <button
                      onClick={() => onToggleExpand(fak.id)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium flex-1 sm:flex-none justify-center sm:justify-start"
                      style={{ background: 'var(--table-sub)', color: 'var(--text-2)', border: '1px solid var(--border)', minHeight: 44 }}
                    >
                      {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />} Pozycje
                    </button>
                    <button
                      onClick={() => onCofnij(fak)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium flex-1 sm:flex-none justify-center sm:justify-start"
                      style={{ background: 'rgba(245,158,11,0.08)', color: '#d97706', border: '1px solid #fcd34d', minHeight: 44 }}
                      title="Cofnij do roboczej i odwróć stany magazynowe"
                    >
                      Cofnij
                    </button>
                  </>
                )}
                {fak.status === 'anulowana' && (
                  <>
                    {fak.plik_url && (
                      <a href={fak.plik_url} target="_blank" rel="noreferrer" className="flex items-center justify-center rounded-lg" style={{ color: '#3b82f6', minHeight: 44, minWidth: 44 }} title="Pobierz plik">
                        <Download size={13} />
                      </a>
                    )}
                    <button onClick={() => onDeleteFak(fak)} className="flex items-center justify-center rounded-lg" style={{ color: '#dc2626', minWidth: 44, minHeight: 44 }} title="Usuń"><Trash2 size={13} /></button>
                  </>
                )}
              </div>
            </div>

            {isOpen && (
              <InvoiceDetails
                fak={fak}
                poz={poz}
                towary={towary}
                onAddPoz={onAddPoz}
                onEditPoz={onEditPoz}
                onDeletePoz={onDeletePoz}
                onSavePriceMode={onSavePriceMode}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
