import Modal from '../Modal'
import Spinner from '../Spinner'
import { AlertTriangle, Trash2 } from 'lucide-react'

export default function InvoiceDeleteRollbackModal({
  show, onClose,
  fak, pozycje, ruchyCount,
  confirmed, onConfirmedChange,
  deleting, onDelete,
}) {
  if (!show || !fak) return null

  const isDraft = fak.status === 'robocza'

  return (
    <Modal
      title={isDraft ? 'Usuń fakturę z osierconymi ruchami' : 'Cofnij i usuń fakturę'}
      onClose={onClose}
      maxWidth={480}
    >
      <div className="space-y-4">
        <div className="rounded-lg px-4 py-3 flex items-start gap-3" style={{ background: '#fef3c7', border: '1px solid #fcd34d' }}>
          <AlertTriangle size={18} style={{ color: '#d97706', flexShrink: 0, marginTop: 1 }} />
          <p className="text-sm" style={{ color: '#92400e' }}>
            {isDraft
              ? 'Ta faktura jest robocza, ale ma powiązane ruchy magazynowe. To wygląda na niespójny stan po wcześniejszym przerwanym procesie zatwierdzania. System usunie powiązane ruchy techniczne tej faktury, a następnie usunie fakturę i jej pozycje.'
              : 'Ta faktura wygenerowała ruchy magazynowe. Aby ją usunąć, system najpierw cofnie wpływ faktury na magazyn, a następnie usunie fakturę i jej pozycje.'}
          </p>
        </div>

        <div className="rounded-lg px-4 py-3 space-y-1.5" style={{ background: 'var(--table-sub)', border: '1px solid var(--border)' }}>
          <div className="flex justify-between text-sm">
            <span style={{ color: 'var(--text-2)' }}>Faktura</span>
            <span className="font-medium" style={{ color: 'var(--text)' }}>{fak.numer}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span style={{ color: 'var(--text-2)' }}>Status</span>
            <span className="font-medium" style={{ color: isDraft ? '#d97706' : '#22c55e' }}>{isDraft ? 'Robocza' : 'Zatwierdzona'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span style={{ color: 'var(--text-2)' }}>Pozycje</span>
            <span className="font-medium" style={{ color: 'var(--text)' }}>{(pozycje[fak.id] || []).length} szt.</span>
          </div>
          <div className="flex justify-between text-sm">
            <span style={{ color: 'var(--text-2)' }}>Ruchy magazynowe</span>
            <span className="font-medium" style={{ color: '#d97706' }}>{ruchyCount} szt.</span>
          </div>
          <div className="flex justify-between text-sm">
            <span style={{ color: 'var(--text-2)' }}>{isDraft ? 'Stany magazynowe' : 'Wpływ na stany'}</span>
            <span className="font-medium" style={{ color: isDraft ? 'var(--muted)' : '#dc2626' }}>
              {isDraft ? 'bez zmian (stany pozostają)' : 'zostanie odwrócony'}
            </span>
          </div>
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={e => onConfirmedChange(e.target.checked)}
            className="mt-0.5 flex-shrink-0"
            style={{ width: 16, height: 16, accentColor: '#dc2626' }}
          />
          <span className="text-sm" style={{ color: 'var(--text)' }}>
            {isDraft
              ? 'Rozumiem, że system usunie powiązane ruchy tej roboczej faktury, aby odblokować usunięcie.'
              : 'Rozumiem, że system cofnie wpływ tej faktury na magazyn i dopiero potem ją usunie.'}
          </span>
        </label>

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg py-2 text-sm font-medium"
            style={{ background: 'var(--table-sub)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
            disabled={deleting}
          >
            Anuluj
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="flex-1 rounded-lg py-2 text-sm font-semibold text-white flex items-center justify-center gap-2"
            style={{ background: confirmed && !deleting ? '#dc2626' : '#9ca3af', cursor: confirmed && !deleting ? 'pointer' : 'not-allowed' }}
            disabled={!confirmed || deleting}
          >
            {deleting ? <><Spinner size={14} /> Cofanie i usuwanie...</> : <><Trash2 size={14} /> Cofnij i usuń</>}
          </button>
        </div>
      </div>
    </Modal>
  )
}
