import { Inbox, CalendarDays, LayoutGrid, Shuffle } from 'lucide-react'

export default function BottomNav({ onInbox, onPlanner, onSwitch }) {
  const items = [
    { id: 'inbox', icon: <Inbox size={18} />, label: 'Skrzynka odbiorcza', onClick: onInbox },
    { id: 'planner', icon: <CalendarDays size={18} />, label: 'Planista', onClick: onPlanner },
    { id: 'board', icon: <LayoutGrid size={18} />, label: 'Tablica', active: true },
    { id: 'switch', icon: <Shuffle size={18} />, label: 'Przełącz tablice', onClick: onSwitch },
  ]

  return (
    <nav className="board-bottom-nav">
      {items.map(item => (
        <button
          key={item.id}
          onClick={item.onClick}
          className={`board-bottom-nav-item${item.active ? ' active' : ''}`}
        >
          {item.icon}
          <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
