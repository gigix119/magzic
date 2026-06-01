import Modal from '../Modal'
import { IS } from './invoiceShared'
import { Upload, X, Download } from 'lucide-react'

export default function InvoiceEditorModal({
  show, onClose,
  fakForm, onFieldChange, fakErrors,
  selectedFile, onFileSelect, onFileClear,
  fileRef, editFak,
  onSave, saving, uploading,
  kontrahenci, magazyny,
}) {
  if (!show) return null

  return (
    <Modal title="Edytuj fakturę" onClose={onClose} maxWidth={620}>
      <form onSubmit={onSave} className="space-y-4">
        <div className="grid grid-cols-2 gap-3 modal-2col">
          <div>
            <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Numer *</label>
            <input style={IS(fakErrors.numer)} value={fakForm.numer} onChange={e => onFieldChange('numer', e.target.value)} placeholder="np. FV/2025/001" />
            {fakErrors.numer && <p className="text-xs mt-1" style={{ color: '#dc2626' }}>Pole wymagane</p>}
          </div>
          <div>
            <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Data *</label>
            <input type="date" style={IS(fakErrors.data_zakupu)} value={fakForm.data_zakupu} onChange={e => onFieldChange('data_zakupu', e.target.value)} />
            {fakErrors.data_zakupu && <p className="text-xs mt-1" style={{ color: '#dc2626' }}>Pole wymagane</p>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 modal-2col">
          <div>
            <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Kontrahent</label>
            <select style={IS()} value={fakForm.kontrahent_id} onChange={e => onFieldChange('kontrahent_id', e.target.value)}>
              <option value="">— wybierz —</option>
              {kontrahenci.map(k => <option key={k.id} value={k.id}>{k.nazwa}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Typ dokumentu</label>
            <select style={IS()} value={fakForm.typ} onChange={e => onFieldChange('typ', e.target.value)}>
              <option value="zakup">Faktura zakupu</option>
              <option value="sprzedaz">Faktura sprzedaży</option>
              <option value="wz">WZ</option>
              <option value="paragon">Paragon</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Magazyn docelowy</label>
          <select style={IS()} value={fakForm.magazyn_id} onChange={e => onFieldChange('magazyn_id', e.target.value)}>
            <option value="">— wybierz —</option>
            {magazyny.map(m => <option key={m.id} value={m.id}>{m.nazwa}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Załącznik (PDF, CSV, JPG, PNG, WEBP)</label>
          <div
            className="rounded-lg px-4 py-3 flex items-center gap-3 cursor-pointer"
            style={{ border: '1px dashed var(--border)', background: 'var(--table-sub)' }}
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={16} style={{ color: 'var(--muted)', flexShrink: 0 }} />
            <span className="text-sm flex-1 truncate" style={{ color: selectedFile ? 'var(--text)' : 'var(--muted)' }}>
              {selectedFile ? selectedFile.name : editFak?.plik_url ? 'Kliknij aby zmienić plik' : 'Kliknij aby wybrać plik'}
            </span>
            {selectedFile && (
              <button type="button" onClick={e => { e.stopPropagation(); onFileClear() }} style={{ color: 'var(--muted)' }}>
                <X size={14} />
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" className="hidden" accept=".pdf,.csv,.jpg,.jpeg,.png,.webp" onChange={e => onFileSelect(e.target.files[0] || null)} />
          {editFak?.plik_url && !selectedFile && (
            <a href={editFak.plik_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs mt-1.5" style={{ color: '#3b82f6' }}>
              <Download size={12} /> Aktualny plik
            </a>
          )}
        </div>
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Notatki</label>
          <textarea style={{ ...IS(), resize: 'vertical', minHeight: 60 }} value={fakForm.notatki} onChange={e => onFieldChange('notatki', e.target.value)} placeholder="Opcjonalne notatki..." />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg py-2 text-sm font-medium" style={{ background: 'var(--table-sub)', color: 'var(--text-2)' }}>Anuluj</button>
          <button type="submit" disabled={saving || uploading} className="flex-1 rounded-lg py-2 text-sm font-medium text-white" style={{ background: '#3b82f6', opacity: (saving || uploading) ? 0.7 : 1 }}>
            {uploading ? 'Wysyłanie pliku...' : saving ? 'Zapisywanie...' : 'Zapisz zmiany'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
