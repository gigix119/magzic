export default function BottomSheet({ open, onClose, title, children }) {
  if (!open) return null

  return (
    <div
      className="bottom-sheet-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="bottom-sheet"
        onClick={e => e.stopPropagation()}
        tabIndex={-1}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
      >
        <div className="bottom-sheet-grabber" aria-hidden="true" />
        {title && (
          <div className="bottom-sheet-title">{title}</div>
        )}
        <div className="bottom-sheet-body">
          {children}
        </div>
      </div>
    </div>
  )
}
