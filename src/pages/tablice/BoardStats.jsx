import { X } from 'lucide-react'
import { classifyKarta, STATUS_COLORS, STATUS_LABELS } from './tablicaTokens'

function MetricTile({ value, label, color }) {
  return (
    <div
      className="rounded-[12px] flex flex-col gap-1"
      style={{ padding: '14px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 26, color: color || 'var(--tb-text, #F4F8FB)' }}>{value}</span>
      <span style={{ fontSize: 12, color: 'var(--tb-text-muted, #A9BBC9)' }}>{label}</span>
    </div>
  )
}

export default function BoardStats({ lists, cardsByList, photosToday = 0, onClose }) {
  const allCards = Object.values(cardsByList || {}).flat()
  const totalCards = allCards.length
  const doneCards = allCards.filter(c => c.zakonczona).length
  const inProgressCards = totalCards - doneCards
  const now = Date.now()
  const overdueCards = allCards.filter(c => c.termin && !c.zakonczona && new Date(c.termin).getTime() < now)
  const donePercent = totalCards ? Math.round((doneCards / totalCards) * 100) : 0

  const typeCounts = { zmiana: 0, przyjazd: 0, wyjazd: 0 }
  for (const c of allCards) {
    const cls = classifyKarta(c.tytul)
    if (cls) typeCounts[cls] += 1
  }
  const maxTypeCount = Math.max(1, ...Object.values(typeCounts))

  const perLista = (lists || []).map(l => {
    const cards = cardsByList?.[l.id] || []
    return {
      id: l.id,
      nazwa: l.nazwa,
      total: cards.length,
      done: cards.filter(c => c.zakonczona).length,
      overdue: cards.filter(c => c.termin && !c.zakonczona && new Date(c.termin).getTime() < now).length,
    }
  })

  return (
    <>
      <div className="board-menu-overlay" onClick={onClose} />
      <div className="board-menu-panel">
        <div
          className="flex items-center justify-between flex-shrink-0"
          style={{ padding: '18px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        >
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, color: 'var(--tb-text, #F4F8FB)' }}>
            Statystyki tablicy
          </span>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-lg"
            style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer', color: 'var(--tb-text-muted, #A9BBC9)' }}
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto" style={{ padding: '16px' }}>
          <div className="grid grid-cols-2 gap-2.5 mb-4">
            <MetricTile value={totalCards} label="Karty razem" />
            <MetricTile value={doneCards} label={`Zakończone (${donePercent}%)`} color="#2BD17E" />
            <MetricTile value={inProgressCards} label="W trakcie" color="#F5A524" />
            <MetricTile value={overdueCards.length} label="Po terminie" color={overdueCards.length > 0 ? '#FF6B6B' : 'var(--tb-text, #F4F8FB)'} />
            <MetricTile value={photosToday} label="Zdjęcia dziś" color="var(--tb-accent, #37A0C9)" />
          </div>

          {totalCards > 0 && (
            <div className="rounded-full overflow-hidden mb-5" style={{ height: 8, background: 'rgba(255,255,255,0.10)' }}>
              <div style={{ height: '100%', width: `${donePercent}%`, background: '#2BD17E', transition: 'width 0.2s' }} />
            </div>
          )}

          <p className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--tb-text-muted, #A9BBC9)', letterSpacing: '0.05em' }}>
            Podział wg typu
          </p>
          <div className="flex flex-col gap-1.5 mb-5">
            {(['zmiana', 'przyjazd', 'wyjazd']).map(key => (
              <div key={key} className="flex items-center gap-2">
                <span style={{ width: 64, fontSize: 12, color: 'var(--tb-text-muted, #A9BBC9)', flexShrink: 0 }}>{STATUS_LABELS[key]}</span>
                <div className="flex-1 rounded-full overflow-hidden" style={{ height: 8, background: 'rgba(255,255,255,0.08)' }}>
                  <div style={{ height: '100%', width: `${(typeCounts[key] / maxTypeCount) * 100}%`, background: STATUS_COLORS[key], transition: 'width 0.2s' }} />
                </div>
                <span style={{ width: 24, textAlign: 'right', fontSize: 12, color: 'var(--tb-text, #F4F8FB)', flexShrink: 0 }}>{typeCounts[key]}</span>
              </div>
            ))}
          </div>

          <p className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--tb-text-muted, #A9BBC9)', letterSpacing: '0.05em' }}>
            Per lista
          </p>
          <div className="flex flex-col gap-1.5">
            {perLista.map(l => (
              <div key={l.id} className="flex items-center justify-between rounded-lg" style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.05)' }}>
                <span className="truncate" style={{ fontSize: 13, color: 'var(--tb-text, #F4F8FB)', flex: 1 }}>{l.nazwa}</span>
                <span style={{ fontSize: 12, color: 'var(--tb-text-muted, #A9BBC9)', marginLeft: 8 }}>{l.total} kart</span>
                <span style={{ fontSize: 12, color: '#2BD17E', marginLeft: 8 }}>{l.done} ✓</span>
                {l.overdue > 0 && <span style={{ fontSize: 12, color: '#FF6B6B', marginLeft: 8 }}>{l.overdue} ⚠</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
