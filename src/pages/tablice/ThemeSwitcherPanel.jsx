import { X, Check } from 'lucide-react'
import { themes } from '../../lib/tablicaTokens'

export default function ThemeSwitcherPanel({ themeKey, onSelect, onClose }) {
  return (
    <>
      <div className="board-menu-overlay" onClick={onClose} />
      <div className="board-menu-panel" style={{ width: 300 }}>
        <div
          className="flex items-center justify-between flex-shrink-0"
          style={{ padding: '18px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        >
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, color: 'var(--tb-text, #F4F8FB)' }}>
            Motyw
          </span>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-lg"
            style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer', color: 'var(--tb-text-muted, #A9BBC9)' }}
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex flex-col gap-2" style={{ padding: '14px 16px' }}>
          {Object.entries(themes).map(([key, theme]) => {
            const active = key === themeKey
            return (
              <button
                key={key}
                onClick={() => onSelect(key)}
                className="flex items-center gap-3 rounded-[10px]"
                style={{
                  padding: '8px 10px', minHeight: 56, textAlign: 'left',
                  background: active ? 'rgba(255,255,255,0.10)' : 'transparent',
                  border: active ? '1px solid rgba(255,255,255,0.20)' : '1px solid transparent',
                }}
              >
                <span
                  style={{
                    width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                    background: `linear-gradient(135deg, ${theme.bg.deep}, ${theme.bg.mid} 55%, ${theme.bg.tide})`,
                    border: `1px solid ${theme.akcent.baltic}55`,
                    display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', padding: 3,
                  }}
                >
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: theme.akcent.baltic }} />
                </span>
                <span className="flex-1" style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--tb-text, #F4F8FB)' }}>{theme.name}</span>
                {active && <Check size={16} style={{ color: theme.akcent.baltic, flexShrink: 0 }} />}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
