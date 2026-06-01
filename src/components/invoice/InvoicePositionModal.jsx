import Modal from '../Modal'
import { IS } from './invoiceShared'

export default function InvoicePositionModal({
  show, onClose,
  pozForm, onFieldChange, onTowarChange, pozErrors,
  towary, magazyny,
  onSave, saving,
}) {
  if (!show) return null

  const _t = towary.find(t => t.id === pozForm.towar_id)
  const _net = Number(pozForm.ilosc || 0) * Number(pozForm.cena_netto || 0)
  const _vat = _net * Number(pozForm.vat_procent || 0) / 100
  const _brutto = _net + _vat

  return (
    <Modal title="Dodaj pozycję do faktury" onClose={onClose} maxWidth={480}>
      <form onSubmit={onSave} className="space-y-4">
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Towar *</label>
          <select
            style={IS(pozErrors.towar_id)}
            value={pozForm.towar_id}
            onChange={e => onTowarChange(e.target.value)}
          >
            <option value="">— wybierz towar —</option>
            {towary.map(t => <option key={t.id} value={t.id}>{t.nazwa} ({t.jednostka || 'szt'})</option>)}
          </select>
          {pozErrors.towar_id && <p className="text-xs mt-1" style={{ color: '#dc2626' }}>Wybierz towar</p>}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Ilość *</label>
            <input type="number" min="0.01" step="0.001" style={IS(pozErrors.ilosc)} value={pozForm.ilosc} onChange={e => onFieldChange('ilosc', e.target.value)} placeholder="0" />
            {pozErrors.ilosc && <p className="text-xs mt-1" style={{ color: '#dc2626' }}>Pole wymagane</p>}
          </div>
          <div>
            <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Jednostka</label>
            <div
              className="rounded-lg px-3 py-2 text-sm"
              style={{ background: 'var(--table-sub)', border: '1px solid var(--border)', color: _t ? 'var(--text)' : 'var(--muted)', minHeight: 37 }}
            >
              {_t?.jednostka || (pozForm.towar_id ? '—' : 'wybierz towar')}
            </div>
          </div>
          <div>
            <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>VAT %</label>
            <select style={IS()} value={pozForm.vat_procent} onChange={e => onFieldChange('vat_procent', e.target.value)}>
              <option value={23}>23%</option>
              <option value={8}>8%</option>
              <option value={5}>5%</option>
              <option value={0}>0%</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Cena netto za jednostkę (zł) *</label>
          <input type="number" min="0" step="0.01" style={IS(pozErrors.cena_netto)} value={pozForm.cena_netto} onChange={e => onFieldChange('cena_netto', e.target.value)} placeholder="0.00" />
          {pozErrors.cena_netto && <p className="text-xs mt-1" style={{ color: '#dc2626' }}>Pole wymagane</p>}
        </div>

        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Magazyn docelowy (dla towarów)</label>
          <select style={IS()} value={pozForm.magazyn_id} onChange={e => onFieldChange('magazyn_id', e.target.value)}>
            <option value="">— brak (usługa / koszt) —</option>
            {magazyny.map(m => <option key={m.id} value={m.id}>{m.nazwa}</option>)}
          </select>
        </div>

        {(Number(pozForm.ilosc) > 0 || Number(pozForm.cena_netto) > 0) && (
          <div className="rounded-lg px-4 py-3 space-y-1" style={{ background: 'var(--table-sub)', border: '1px solid var(--border)' }}>
            <div className="flex justify-between text-xs" style={{ color: 'var(--text-2)' }}>
              <span>Suma netto</span>
              <span style={{ fontFamily: 'DM Mono, monospace' }}>{_net.toFixed(2)} zł</span>
            </div>
            <div className="flex justify-between text-xs" style={{ color: 'var(--text-2)' }}>
              <span>VAT ({pozForm.vat_procent}%)</span>
              <span style={{ fontFamily: 'DM Mono, monospace' }}>{_vat.toFixed(2)} zł</span>
            </div>
            <div className="flex justify-between text-sm font-semibold" style={{ color: 'var(--text)', borderTop: '1px solid var(--border)', paddingTop: 6, marginTop: 4 }}>
              <span>Suma brutto</span>
              <span style={{ fontFamily: 'DM Mono, monospace', color: '#3b82f6' }}>{_brutto.toFixed(2)} zł</span>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg py-2 text-sm font-medium" style={{ background: 'var(--table-sub)', color: 'var(--text-2)' }}>Anuluj</button>
          <button type="submit" disabled={saving} className="flex-1 rounded-lg py-2 text-sm font-medium text-white" style={{ background: '#3b82f6', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Zapisywanie...' : 'Dodaj pozycję'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
