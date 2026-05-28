import { ASSISTANT_COMMANDS, BADGE_COLORS } from './assistantCommandCatalog'

function CommandCard({ cmd, onExampleClick }) {
  const badge = BADGE_COLORS[cmd.badge] ?? { bg: 'var(--table-sub)', color: 'var(--muted)' }
  return (
    <div
      className="rounded-xl p-3.5 flex flex-col gap-2"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-start gap-2">
        <span
          className="text-xs font-medium rounded-md px-1.5 py-0.5 flex-shrink-0"
          style={{ background: badge.bg, color: badge.color }}
        >
          {cmd.badge}
        </span>
        {cmd.requiresProductQuery && (
          <span
            className="text-xs rounded-md px-1.5 py-0.5 flex-shrink-0"
            style={{ background: 'var(--table-sub)', color: 'var(--muted)', border: '1px solid var(--border)' }}
          >
            + nazwa produktu
          </span>
        )}
      </div>
      <p className="font-semibold" style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.3 }}>
        {cmd.title}
      </p>
      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>
        {cmd.description}
      </p>
      <div className="flex flex-wrap gap-1.5 mt-0.5">
        {cmd.examples.map(ex => (
          <button
            key={ex}
            onClick={() => onExampleClick(ex)}
            className="text-xs rounded-lg px-2.5 py-1 transition-opacity hover:opacity-80 active:opacity-60"
            style={{
              background: 'var(--table-sub)',
              color: 'var(--text-2)',
              border: '1px solid var(--border)',
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
        className="px-4 pt-3.5 pb-2"
        style={{ background: 'var(--bg)' }}
      >
        <p className="font-semibold" style={{ fontSize: 13, color: 'var(--text)' }}>
          Co możesz zapytać?
        </p>
        <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-2)' }}>
          Asystent działa na danych Magzic: fakturach, towarach, cenach, dostawcach i stanach magazynowych.
        </p>
      </div>
      <div
        className="px-4 pb-3.5 overflow-y-auto"
        style={{
          maxHeight: 360,
          background: 'var(--bg)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 8,
        }}
      >
        {ASSISTANT_COMMANDS.map(cmd => (
          <CommandCard key={cmd.intent} cmd={cmd} onExampleClick={onExampleClick} />
        ))}
      </div>
    </div>
  )
}
