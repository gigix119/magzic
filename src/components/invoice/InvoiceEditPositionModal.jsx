import Modal from '../Modal'
import { IS } from './invoiceShared'
import { CheckCircle2, AlertTriangle } from 'lucide-react'
import { recalculateInvoiceLineStatus } from '../../utils/invoicePositionValidator'

export default function InvoiceEditPositionModal({
  show, onClose,
  editPozTarget, editPozFak,
  editPozForm, onFieldChange, onTowarChange, editPozErrors,
  editPozShowCreate, onToggleShowCreate,
  editPozNewTowarForm, onNewTowarFieldChange,
  editPozNewTowarSaving,
  onSave, saving,
  onCreateTowar,
  towary, magazyny,
}) {
  if (!show || !editPozTarget) return null

  const _t = towary.find(t => t.id === editPozForm.towar_id)
  const _net = Number(editPozForm.ilosc || 0) * Number(editPozForm.cena_netto || 0)
  const _vat = _net * Number(editPozForm.vat_procent || 0) / 100
  const _brutto = _net + _vat
  const lineStatus = recalculateInvoiceLineStatus(
    { ...editPozTarget, towar_id: editPozForm.towar_id || null, magazyn_id: editPozForm.magazyn_id || null, cena_netto: editPozForm.cena_netto, ilosc: editPozForm.ilosc },
    { towary, fakturaDefaultMagazynId: editPozFak?.magazyn_id || null }
  )

  return (
    <Modal
      title="Edytuj pozycję"
      onClose={onClose}
      maxWidth={520}
    >
      <div className="space-y-4">
        {lineStatus.inventoryImpactStatus === 'ready' && (
          <div className="rounded-lg px-3 py-2 flex items-center gap-2 text-xs" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534' }}>
            <CheckCircle2 size={13} /> Pozycja gotowa do magazynu
          </div>
        )}
        {lineStatus.inventoryImpactStatus === 'blocked' && lineStatus.errors.length > 0 && (
          <div className="rounded-lg px-3 py-2 text-xs" style={{ background: '#fef3c7', border: '1px solid #fcd34d', color: '#92400e' }}>
            <div className="flex items-center gap-2 font-semibold mb-1"><AlertTriangle size={13} /> Niekompletna — brakuje:</div>
            {lineStatus.errors.map((e, i) => <div key={i}>· {e}</div>)}
          </div>
        )}
        {lineStatus.inventoryImpactStatus === 'none' && (
          <div className="rounded-lg px-3 py-2 text-xs" style={{ background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0369a1' }}>
            Pozycja bez wpływu na magazyn (usługa/koszt lub brak towaru)
          </div>
        )}

        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>
            Towar {!editPozForm.is_service && <span style={{ color: '#dc2626' }}>*</span>}
          </label>
          <select
            style={IS(editPozErrors.towar_id)}
            value={editPozForm.towar_id}
            onChange={e => onTowarChange(e.target.value)}
          >
            <option value="">— brak towaru (usługa / koszt) —</option>
            {towary.map(t => <option key={t.id} value={t.id}>{t.nazwa} ({t.jednostka || 'szt'})</option>)}
          </select>
          {editPozErrors.towar_id && <p className="text-xs mt-1" style={{ color: '#dc2626' }}>{editPozErrors.towar_id}</p>}
          {!editPozForm.towar_id && (
            <button
              type="button"
              onClick={onToggleShowCreate}
              className="text-xs mt-1.5 underline"
              style={{ color: '#3b82f6' }}
            >
              {editPozShowCreate ? '▲ Ukryj formularz' : '+ Utwórz towar z tej pozycji'}
            </button>
          )}
        </div>

        {editPozShowCreate && !editPozForm.towar_id && (
          <div className="rounded-lg p-3 space-y-3" style={{ background: 'var(--table-sub)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-semibold" style={{ color: 'var(--text-2)' }}>Nowy towar</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-2)' }}>Nazwa *</label>
                <input
                  style={IS()}
                  value={editPozNewTowarForm.nazwa}
                  onChange={e => onNewTowarFieldChange('nazwa', e.target.value)}
                  placeholder="Nazwa towaru"
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-2)' }}>Typ / SKU</label>
                <input
                  style={IS()}
                  value={editPozNewTowarForm.typ}
                  onChange={e => onNewTowarFieldChange('typ', e.target.value)}
                  placeholder="Typ (opcjonalnie)"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-2)' }}>Jednostka</label>
              <select style={IS()} value={editPozNewTowarForm.jednostka} onChange={e => onNewTowarFieldChange('jednostka', e.target.value)}>
                <option value="szt">szt</option>
                <option value="kg">kg</option>
                <option value="l">l</option>
                <option value="m">m</option>
                <option value="m2">m²</option>
                <option value="opak">opak</option>
              </select>
            </div>
            <button
              type="button"
              disabled={editPozNewTowarSaving}
              onClick={onCreateTowar}
              className="w-full rounded-lg py-2 text-xs font-medium text-white"
              style={{ background: '#3b82f6', opacity: editPozNewTowarSaving ? 0.7 : 1 }}
            >
              {editPozNewTowarSaving ? 'Tworzenie...' : 'Utwórz i przypisz towar'}
            </button>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Ilość *</label>
            <input
              type="number" min="0.001" step="0.001"
              style={IS(editPozErrors.ilosc)}
              value={editPozForm.ilosc}
              onChange={e => onFieldChange('ilosc', e.target.value)}
              placeholder="0"
            />
            {editPozErrors.ilosc && <p className="text-xs mt-1" style={{ color: '#dc2626' }}>{editPozErrors.ilosc}</p>}
          </div>
          <div>
            <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Jednostka</label>
            <div className="rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--table-sub)', border: '1px solid var(--border)', color: _t ? 'var(--text)' : 'var(--muted)', minHeight: 37 }}>
              {_t?.jednostka || '—'}
            </div>
          </div>
          <div>
            <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>VAT %</label>
            <select style={IS()} value={editPozForm.vat_procent} onChange={e => onFieldChange('vat_procent', e.target.value)}>
              <option value={23}>23%</option>
              <option value={8}>8%</option>
              <option value={5}>5%</option>
              <option value={0}>0%</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Cena netto za jednostkę (zł) *</label>
          <input
            type="number" min="0" step="0.01"
            style={IS(editPozErrors.cena_netto)}
            value={editPozForm.cena_netto}
            onChange={e => onFieldChange('cena_netto', e.target.value)}
            placeholder="0.00"
          />
          {editPozErrors.cena_netto && <p className="text-xs mt-1" style={{ color: '#dc2626' }}>{editPozErrors.cena_netto}</p>}
        </div>

        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Magazyn docelowy</label>
          <select style={IS()} value={editPozForm.magazyn_id} onChange={e => onFieldChange('magazyn_id', e.target.value)}>
            <option value="">— brak (usługa / koszt) —</option>
            {magazyny.map(m => <option key={m.id} value={m.id}>{m.nazwa}</option>)}
          </select>
        </div>

        {(Number(editPozForm.ilosc) > 0 || Number(editPozForm.cena_netto) > 0) && (
          <div className="rounded-lg px-4 py-3 space-y-1" style={{ background: 'var(--table-sub)', border: '1px solid var(--border)' }}>
            <div className="flex justify-between text-xs" style={{ color: 'var(--text-2)' }}>
              <span>Suma netto</span>
              <span style={{ fontFamily: 'DM Mono, monospace' }}>{_net.toFixed(2)} zł</span>
            </div>
            <div className="flex justify-between text-xs" style={{ color: 'var(--text-2)' }}>
              <span>VAT ({editPozForm.vat_procent}%)</span>
              <span style={{ fontFamily: 'DM Mono, monospace' }}>{_vat.toFixed(2)} zł</span>
            </div>
            <div className="flex justify-between text-sm font-semibold" style={{ color: 'var(--text)', borderTop: '1px solid var(--border)', paddingTop: 6, marginTop: 4 }}>
              <span>Suma brutto</span>
              <span style={{ fontFamily: 'DM Mono, monospace', color: '#3b82f6' }}>{_brutto.toFixed(2)} zł</span>
            </div>
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
            disabled={saving}
            onClick={onSave}
            className="flex-1 rounded-lg py-2 text-sm font-semibold text-white"
            style={{ background: '#3b82f6', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Zapisywanie...' : 'Zapisz zmiany'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
