import { ASSISTANT_COMMANDS, BADGE_COLORS } from './assistantCommandCatalog'

function CommandCard({ cmd, onExampleClick }) {
  const badge = BADGE_COLORS[cmd.badge] ?? { bg: 'var(--table-sub)', color: 'var(--muted)' }
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
          {cmd.badge}
        </span>
        {cmd.requiresProductQuery && (
          <span
            className="text-xs rounded-md px-1.5 py-0.5"
            style={{ background: 'var(--table-sub)', color: 'var(--muted)', border: '1px solid var(--border)', fontSize: 10 }}
          >
            + nazwa produktu
          </span>
        )}
      </div>
      <p className="font-semibold leading-tight" style={{ fontSize: 12, color: 'var(--text)' }}>
        {cmd.title}
      </p>
      <p className="leading-relaxed" style={{ fontSize: 11, color: 'var(--text-2)' }}>
        {cmd.description}
      </p>
      <div className="flex flex-wrap gap-1 mt-0.5">
        {cmd.examples.slice(0, 2).map(ex => (
          <button
            key={ex}
            onClick={() => onExampleClick(ex)}
            className="rounded-md px-2 py-0.5 transition-opacity hover:opacity-80 active:opacity-60"
            style={{
              background: 'var(--table-sub)',
              color: 'var(--text-2)',
              border: '1px solid var(--border)',
              fontSize: 11,
            }}
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function AssistantCommandHelp({ onExampleClick }) {
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
        {ASSISTANT_COMMANDS.map(cmd => (
          <CommandCard key={cmd.intent} cmd={cmd} onExampleClick={onExampleClick} />
        ))}
      </div>
    </div>
  )
}
