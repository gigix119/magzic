import {
  Share2, AlignLeft, EyeOff, Printer, Settings, Layers, Tag, Zap, Filter, PlugZap,
  Activity, Archive, ChevronsLeftRight, Copy, X,
} from 'lucide-react'

export default function BoardMenu({ onClose, onAutomation, onChangeBackground, onFilter, onPlaceholder }) {
  const items = [
    { icon: <Filter size={15} />, label: 'Filtruj', onClick: onFilter },
    { icon: <PlugZap size={15} />, label: 'Power-Upy', onClick: () => onPlaceholder('Power-Upy') },
    { icon: <Share2 size={15} />, label: 'Udostępnij', onClick: () => onPlaceholder('Udostępnij') },
    { icon: <AlignLeft size={15} />, label: 'O tej tablicy', onClick: () => onPlaceholder('O tej tablicy') },
    { icon: <EyeOff size={15} />, label: 'Widoczność', onClick: () => onPlaceholder('Widoczność') },
    { icon: <Printer size={15} />, label: 'Wydrukuj / eksportuj', onClick: () => onPlaceholder('Wydrukuj / eksportuj') },
    { icon: <Settings size={15} />, label: 'Ustawienia', onClick: () => onPlaceholder('Ustawienia') },
    { icon: <Layers size={15} />, label: 'Zmień tło', onClick: onChangeBackground },
    { icon: <Tag size={15} />, label: 'Pola niestandardowe', onClick: () => onPlaceholder('Pola niestandardowe') },
    { icon: <Zap size={15} />, label: 'Automatyzacja', onClick: onAutomation },
    { icon: <Tag size={15} />, label: 'Etykiety', onClick: () => onPlaceholder('Etykiety') },
    { icon: <Activity size={15} />, label: 'Aktywność', onClick: () => onPlaceholder('Aktywność') },
    { icon: <Archive size={15} />, label: 'Zarchiwizowane elementy', onClick: () => onPlaceholder('Zarchiwizowane elementy') },
    { icon: <ChevronsLeftRight size={15} />, label: 'Zwiń wszystkie listy', onClick: () => onPlaceholder('Zwiń wszystkie listy') },
    { icon: <Copy size={15} />, label: 'Skopiuj tablicę', onClick: () => onPlaceholder('Skopiuj tablicę') },
  ]

  return (
    <>
      <div className="board-menu-overlay" onClick={onClose} />
      <div className="board-menu-panel">
        <div
          className="flex items-center justify-between flex-shrink-0"
          style={{ padding: '18px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        >
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, color: '#F4F8FB' }}>
            Menu tablicy
          </span>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-lg"
            style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer', color: '#A9BBC9' }}
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto" style={{ padding: '10px 12px' }}>
          {items.map((item, i) => (
            <button key={i} onClick={item.onClick} className="board-menu-item">
              <span style={{ color: '#A9BBC9', flexShrink: 0 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
