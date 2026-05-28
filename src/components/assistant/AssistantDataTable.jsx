import { Download } from 'lucide-react'
import { downloadCsv } from '../../utils/csvExport'

export default function AssistantDataTable({ title, columns, rows, emptyMessage, exportable, exportFilename, exportLabel }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      <div
        className="px-4 py-2.5 flex items-center justify-between gap-2"
        style={{ background: 'var(--table-head)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="text-sm font-medium flex-1 min-w-0" style={{ color: 'var(--text)' }}>{title}</div>
        {exportable && rows?.length > 0 && (
          <button
            onClick={() => downloadCsv(exportFilename ?? 'export.csv', rows, columns)}
            className="flex-shrink-0 flex items-center gap-1 text-xs rounded-md px-2 py-0.5 transition-opacity hover:opacity-80 active:opacity-60"
            style={{ background: 'var(--table-sub)', border: '1px solid var(--border)', color: 'var(--muted)' }}
            title={exportLabel ?? 'Eksportuj CSV'}
          >
            <Download size={10} />
            <span>CSV</span>
          </button>
        )}
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
