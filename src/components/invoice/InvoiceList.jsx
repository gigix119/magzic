import { FileText, ChevronDown, ChevronUp, Trash2, Pencil, Plus, Download, CheckCircle2 } from 'lucide-react'
import InvoiceDetails from './InvoiceDetails'
import { fileIcon, typBadge, statusBadge } from './invoiceShared'

export default function InvoiceList({
  faktury, pozycje, expanded, towary, magazyny,
  onToggleExpand, onZatwierdz, onCofnij,
  onDeleteFak, onEditFak, onAddPoz,
  onEditPoz, onDeletePoz,
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
        const total = poz.reduce((s, p) => s + Number(p.ilosc) * Number(p.cena_netto), 0)
        return (
          <div key={fak.id} className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-3 px-5 py-4 faktura-card-row" style={{ background: isOpen ? 'var(--table-odd)' : 'transparent' }}>
              <button className="flex-1 flex items-center gap-3 text-left min-w-0" onClick={() => onToggleExpand(fak.id)}>
                <div className="rounded-lg flex items-center justify-center flex-shrink-0" style={{ width: 38, height: 38, background: 'rgba(59,130,246,0.1)' }}>
                  <FileText size={16} style={{ color: '#3b82f6' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold" style={{ color: 'var(--text)', fontFamily: 'DM Mono, monospace', fontSize: 13 }}>{fak.numer}</span>
                    {typBadge(fak.typ)}
                    {statusBadge(fak.status)}
                    {fak.plik_url && <span className="flex items-center gap-1" title="Załączony plik">{fileIcon(fak.plik_url)}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs" style={{ color: 'var(--text-2)' }}>{fak.kontrahenci?.nazwa || '—'}</span>
                    <span style={{ color: 'var(--muted)' }}>·</span>
                    <span className="text-xs" style={{ color: 'var(--text-2)' }}>{fak.data_zakupu}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 mr-2">
                  <p className="font-medium text-sm" style={{ color: 'var(--text)', fontFamily: 'DM Mono, monospace' }}>
                    {total.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł
                  </p>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>{poz.length} poz.</p>
                </div>
                {isOpen ? <ChevronUp size={16} style={{ color: 'var(--muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--muted)' }} />}
              </button>

              <div className="flex items-center gap-1 flex-shrink-0 faktura-row-actions">
                {fak.status === 'robocza' && (
                  <>
                    <button onClick={() => onZatwierdz(fak)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white" style={{ background: '#22c55e', minHeight: 36 }} title="Zatwierdź fakturę">
                      <CheckCircle2 size={12} /> Zatwierdź
                    </button>
                    <button onClick={() => onAddPoz(fak)} className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'var(--table-sub)', color: 'var(--text-2)', border: '1px solid var(--border)', minHeight: 36 }} title="Dodaj pozycję">
                      <Plus size={12} /> Dodaj poz.
                    </button>
                    {fak.plik_url && (
                      <a href={fak.plik_url} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg flex items-center justify-center" style={{ color: '#3b82f6', minHeight: 36, minWidth: 36 }} title="Pobierz plik">
                        <Download size={13} />
                      </a>
                    )}
                    <button onClick={() => onEditFak(fak)} className="p-1.5 rounded-lg table-action-btn" style={{ color: 'var(--text-2)' }} title="Edytuj"><Pencil size={13} /></button>
                    <button onClick={() => onDeleteFak(fak)} className="p-1.5 rounded-lg table-action-btn" style={{ color: '#dc2626' }} title="Usuń"><Trash2 size={13} /></button>
                  </>
                )}
                {fak.status === 'zatwierdzona' && (
                  <>
                    <button
                      onClick={() => onToggleExpand(fak.id)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                      style={{ background: 'var(--table-sub)', color: 'var(--text-2)', border: '1px solid var(--border)', minHeight: 36 }}
                    >
                      {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />} Pozycje
                    </button>
                    <button
                      onClick={() => onCofnij(fak)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                      style={{ background: 'rgba(245,158,11,0.08)', color: '#d97706', border: '1px solid #fcd34d', minHeight: 36 }}
                      title="Cofnij do roboczej i odwróć stany magazynowe"
                    >
                      Cofnij
                    </button>
                  </>
                )}
                {fak.status === 'anulowana' && (
                  <>
                    {fak.plik_url && (
                      <a href={fak.plik_url} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg flex items-center justify-center" style={{ color: '#3b82f6', minHeight: 36, minWidth: 36 }} title="Pobierz plik">
                        <Download size={13} />
                      </a>
                    )}
                    <button onClick={() => onDeleteFak(fak)} className="p-1.5 rounded-lg table-action-btn" style={{ color: '#dc2626' }} title="Usuń"><Trash2 size={13} /></button>
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
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
