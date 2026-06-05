import { BADGE_COLORS } from './assistantCommandCatalog'

function HelperCard({ card, onExampleClick }) {
  const badge = BADGE_COLORS[card.badge] ?? { bg: 'var(--table-sub)', color: 'var(--muted)' }
  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-2"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-1.5 flex-wrap">
        <span
          className="text-xs font-medium rounded-md px-1.5 py-0.5"
          style={{ background: badge.bg, color: badge.color, fontSize: 10 }}
        >
          {card.badge}
        </span>
      </div>
      <p className="font-semibold leading-tight" style={{ fontSize: 12, color: 'var(--text)' }}>
        {card.title}
      </p>
      <p className="leading-relaxed" style={{ fontSize: 11, color: 'var(--text-2)' }}>
        {card.description}
      </p>
      <div className="flex flex-wrap gap-1 mt-0.5">
        <button
          onClick={() => onExampleClick(card.example)}
          className="rounded-md px-2 py-0.5 transition-opacity hover:opacity-80 active:opacity-60"
          style={{
            background: 'var(--table-sub)',
            color: 'var(--text-2)',
            border: '1px solid var(--border)',
            fontSize: 11,
          }}
        >
          {card.example}
        </button>
      </div>
    </div>
  )
}

export default function AssistantCommandHelp({ onExampleClick, helperCards }) {
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <div
        className="px-4 pt-3 pb-2"
        style={{ background: 'var(--bg)' }}
      >
        <p className="font-semibold" style={{ fontSize: 13, color: 'var(--text)' }}>
          Co możesz zapytać?
        </p>
        <p className="leading-relaxed mt-0.5" style={{ fontSize: 11, color: 'var(--text-2)' }}>
          Asystent działa na danych Magzic: fakturach, towarach, cenach, dostawcach i stanach magazynowych.
        </p>
      </div>
      <div
        className="px-4 pb-3 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2"
        style={{ maxHeight: 340, background: 'var(--bg)' }}
      >
        {(helperCards || []).map((card, i) => (
          <HelperCard key={i} card={card} onExampleClick={onExampleClick} />
        ))}
      </div>
    </div>
  )
}
