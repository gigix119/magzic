import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, CheckCircle, AlertTriangle, Package } from 'lucide-react'
import { supabase } from '../../supabase'
import { fetchAndReconcile } from '../../utils/inventoryReconciliation'

// ── Helpers ───────────────────────────────────────────────────────

function fmt(n) {
  const v = Number(n)
  return Number.isInteger(v) ? String(v) : v.toFixed(3)
}

function DriftBadge({ drift }) {
  if (Math.abs(drift) < 0.001) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
        style={{ background: '#dcfce7', color: '#16a34a' }}>
        OK
      </span>
    )
  }
  const color = drift > 0 ? '#2563eb' : '#dc2626'
  const bg    = drift > 0 ? '#dbeafe' : '#fee2e2'
  const label = drift > 0 ? `+${fmt(drift)}` : fmt(drift)
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ background: bg, color }}>
      {label}
    </span>
  )
}

// ── Component ─────────────────────────────────────────────────────

export default function BackendInventoryReconciliation() {
  const [workspaces, setWorkspaces]       = useState([])
  const [selectedWs, setSelectedWs]       = useState('')
  const [wsLoading, setWsLoading]         = useState(true)
  const [wsError, setWsError]             = useState(null)

  const [running, setRunning]             = useState(false)
  const [result, setResult]               = useState(null)   // { rows, mismatches, error, wsName }
  const [nameMap, setNameMap]             = useState({})     // { prodId → name, magId → name }

  // ── Load workspace list ──────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setWsLoading(true)
      const { data, error } = await supabase
        .from('workspaces')
        .select('id, name, company_name')
        .order('name')
      if (error) {
        setWsError(error.message)
      } else {
        setWorkspaces(data ?? [])
        if (data?.length) setSelectedWs(data[0].id)
      }
      setWsLoading(false)
    }
    load()
  }, [])

  // ── Run reconciliation ───────────────────────────────────────────
  const run = useCallback(async () => {
    if (!selectedWs) return
    setRunning(true)
    setResult(null)

    const wsName = workspaces.find(w => w.id === selectedWs)?.name ?? selectedWs

    // Fetch human-readable names for products + warehouses in parallel with data
    const [
      { rows, mismatches, error },
      { data: towaryData },
      { data: magazynyData },
    ] = await Promise.all([
      fetchAndReconcile(supabase, selectedWs),
      supabase.from('towary').select('id, nazwa').eq('workspace_id', selectedWs),
      supabase.from('magazyny').select('id, nazwa').eq('workspace_id', selectedWs),
    ])

    const names = {}
    for (const t of towaryData  ?? []) names[t.id] = t.nazwa
    for (const m of magazynyData ?? []) names[m.id] = m.nazwa

    setNameMap(names)
    setResult({ rows, mismatches, error, wsName })
    setRunning(false)
  }, [selectedWs, workspaces])

  // ── Render ───────────────────────────────────────────────────────

  if (wsLoading) {
    return <p style={{ color: 'var(--muted)', fontSize: 14 }}>Ładowanie workspace'ów…</p>
  }

  if (wsError) {
    return (
      <div className="rounded-xl p-4" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
        <p className="text-sm font-semibold" style={{ color: '#dc2626' }}>Błąd ładowania workspace'ów</p>
        <p className="text-sm mt-1" style={{ color: '#991b1b' }}>{wsError}</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* Header + controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="font-semibold text-base" style={{ color: 'var(--text)' }}>
            Reconciliacja stanów magazynowych
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            Tylko odczyt. Porównuje zapisane salda z sumą ruchów — wykrywa rozbieżności.
          </p>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <select
            value={selectedWs}
            onChange={e => { setSelectedWs(e.target.value); setResult(null) }}
            className="rounded-lg px-3 py-1.5 text-sm border"
            style={{ background: 'var(--card)', color: 'var(--text)', borderColor: 'var(--border)' }}
          >
            {workspaces.map(w => (
              <option key={w.id} value={w.id}>
                {w.name}{w.company_name ? ` — ${w.company_name}` : ''}
              </option>
            ))}
          </select>

          <button
            onClick={run}
            disabled={running || !selectedWs}
            className="flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-opacity"
            style={{
              background: '#7c3aed', color: '#fff',
              opacity: running || !selectedWs ? 0.6 : 1,
            }}
          >
            <RefreshCw size={13} className={running ? 'animate-spin' : ''} />
            {running ? 'Sprawdzam…' : 'Uruchom'}
          </button>
        </div>
      </div>

      {/* Result */}
      {result && (
        <>
          {result.error ? (
            <div className="rounded-xl p-4" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
              <p className="text-sm font-semibold" style={{ color: '#dc2626' }}>Błąd zapytania</p>
              <p className="text-sm mt-1 font-mono" style={{ color: '#991b1b' }}>{result.error}</p>
            </div>
          ) : (
            <>
              {/* Summary banner */}
              <div
                className="rounded-xl p-4 flex items-center gap-3"
                style={{
                  background: result.mismatches.length === 0 ? '#f0fdf4' : '#fffbeb',
                  border: `1px solid ${result.mismatches.length === 0 ? '#bbf7d0' : '#fde68a'}`,
                }}
              >
                {result.mismatches.length === 0
                  ? <CheckCircle size={18} style={{ color: '#16a34a', flexShrink: 0 }} />
                  : <AlertTriangle size={18} style={{ color: '#d97706', flexShrink: 0 }} />
                }
                <div>
                  <p className="text-sm font-semibold"
                    style={{ color: result.mismatches.length === 0 ? '#15803d' : '#92400e' }}>
                    {result.mismatches.length === 0
                      ? `Brak rozbieżności — wszystkie ${result.rows.length} pozycji zgodne`
                      : `${result.mismatches.length} z ${result.rows.length} pozycji ma rozbieżność`
                    }
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                    Workspace: {result.wsName}
                  </p>
                </div>
              </div>

              {/* Mismatch table */}
              {result.mismatches.length > 0 && (
                <div className="rounded-xl overflow-hidden"
                  style={{ border: '1px solid var(--border)' }}>
                  <div className="px-4 py-3 flex items-center gap-2"
                    style={{ borderBottom: '1px solid var(--border)', background: 'var(--card)' }}>
                    <AlertTriangle size={14} style={{ color: '#d97706' }} />
                    <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                      Rozbieżności
                    </span>
                    <span className="ml-auto text-xs" style={{ color: 'var(--muted)' }}>
                      drift = oczekiwane − zapisane
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--card)' }}>
                          {['Towar', 'Magazyn', 'Zapisane', 'Oczekiwane (suma ruchów)', 'Drift'].map(h => (
                            <th key={h}
                              className="px-3 py-2 text-left font-medium whitespace-nowrap"
                              style={{ color: 'var(--muted)', fontSize: 11 }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.mismatches
                          .slice()
                          .sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift))
                          .map((row, i) => (
                            <tr key={`${row.towar_id}:${row.magazyn_id}`}
                              style={{ borderBottom: '1px solid var(--border)', background: i % 2 ? 'var(--hover-bg)' : undefined }}>
                              <td className="px-3 py-2.5" style={{ color: 'var(--text)' }}>
                                <div className="flex items-center gap-1.5">
                                  <Package size={12} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                                  <span>{nameMap[row.towar_id] ?? row.towar_id}</span>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--muted)' }}>
                                {nameMap[row.magazyn_id] ?? row.magazyn_id}
                              </td>
                              <td className="px-3 py-2.5 font-mono text-xs" style={{ color: 'var(--text)' }}>
                                {fmt(row.stored)}
                              </td>
                              <td className="px-3 py-2.5 font-mono text-xs" style={{ color: 'var(--text)' }}>
                                {fmt(row.expected)}
                              </td>
                              <td className="px-3 py-2.5">
                                <DriftBadge drift={row.drift} />
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* All-rows table (collapsed by default when mismatches exist) */}
              {result.rows.length > 0 && (
                <details className="rounded-xl" style={{ border: '1px solid var(--border)' }}>
                  <summary
                    className="px-4 py-3 cursor-pointer text-sm font-semibold select-none"
                    style={{ color: 'var(--text)', background: 'var(--card)', borderRadius: 'inherit', listStyle: 'none' }}
                  >
                    Wszystkie pozycje ({result.rows.length})
                  </summary>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--card)' }}>
                          {['Towar', 'Magazyn', 'Zapisane', 'Oczekiwane', 'Drift'].map(h => (
                            <th key={h}
                              className="px-3 py-2 text-left font-medium whitespace-nowrap"
                              style={{ color: 'var(--muted)', fontSize: 11 }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.rows.map((row, i) => (
                          <tr key={`${row.towar_id}:${row.magazyn_id}`}
                            style={{ borderBottom: '1px solid var(--border)', background: i % 2 ? 'var(--hover-bg)' : undefined }}>
                            <td className="px-3 py-2.5" style={{ color: 'var(--text)' }}>
                              <div className="flex items-center gap-1.5">
                                <Package size={12} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                                <span>{nameMap[row.towar_id] ?? row.towar_id}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--muted)' }}>
                              {nameMap[row.magazyn_id] ?? row.magazyn_id}
                            </td>
                            <td className="px-3 py-2.5 font-mono text-xs" style={{ color: 'var(--text)' }}>
                              {fmt(row.stored)}
                            </td>
                            <td className="px-3 py-2.5 font-mono text-xs" style={{ color: 'var(--text)' }}>
                              {fmt(row.expected)}
                            </td>
                            <td className="px-3 py-2.5">
                              <DriftBadge drift={row.drift} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
            </>
          )}
        </>
      )}

      {/* Explain drift sign */}
      {result && result.rows.length > 0 && (
        <div className="rounded-lg p-3 text-xs" style={{ background: 'var(--hover-bg)', color: 'var(--muted)' }}>
          <strong style={{ color: 'var(--text-2)' }}>Jak czytać drift:</strong>
          {' '}drift = (suma ruchów) − (saldo zapisane).
          {' '}Ujemny drift → saldo zapisane jest wyższe niż wynikałoby z ruchów (np. saldo dodane ręcznie bez ruchu).
          {' '}Dodatni drift → ruchy sumują się wyżej niż saldo (np. ruch bez aktualizacji salda).
        </div>
      )}

    </div>
  )
}
