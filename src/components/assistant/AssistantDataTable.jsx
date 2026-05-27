export default function AssistantDataTable({ title, columns, rows, emptyMessage }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      <div
        className="px-4 py-2.5"
        style={{ background: 'var(--table-head)', borderBottom: '1px solid var(--border)' }}
      >
        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{title}</p>
      </div>

      {!rows?.length ? (
        <p
          className="text-center py-5 text-sm"
          style={{ color: 'var(--muted)', background: 'var(--table-even)' }}
        >
          {emptyMessage ?? 'Brak danych'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 240 }}>
            <thead>
              <tr style={{ background: 'var(--table-sub)' }}>
                {columns.map(col => (
                  <th
                    key={col.key}
                    className={`py-2 font-medium ${col.align === 'right' ? 'text-right pr-4 pl-2' : 'text-left px-4'} ${col.hideOnMobile ? 'hidden sm:table-cell' : ''}`}
                    style={{ color: 'var(--muted)', fontSize: 11 }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr
                  key={idx}
                  style={{
                    borderTop: '1px solid var(--border)',
                    background: idx % 2 === 0 ? 'var(--table-even)' : 'var(--table-odd)',
                  }}
                >
                  {columns.map(col => (
                    <td
                      key={col.key}
                      className={`py-2.5 ${col.align === 'right' ? 'text-right pr-4 pl-2' : 'px-4'} ${col.hideOnMobile ? 'hidden sm:table-cell' : ''}`}
                      style={{
                        color: col.color ?? 'var(--text-2)',
                        fontSize: 12,
                        fontFamily: col.mono ? 'DM Mono, monospace' : undefined,
                        maxWidth: col.maxWidth ?? undefined,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: col.noWrap ? 'nowrap' : undefined,
                      }}
                    >
                      {row[col.key] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
