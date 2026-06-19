import { useState } from 'react'
import { TABLICA_COLORS, BOARD_GRADIENTS, BOARD_PHOTOS } from './tablicaTokens'

export default function BoardBackgroundPicker({ kolorTla, tloTyp, onChange, showPhotos = true }) {
  const [tab, setTab] = useState('kolory')

  return (
    <div>
      {showPhotos && (
        <div className="flex gap-1.5 mb-3" style={{ borderBottom: '1px solid var(--border)' }}>
          {[{ key: 'kolory', label: 'Kolory' }, { key: 'zdjecia', label: 'Zdjęcia' }].map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className="px-3 py-2 text-sm font-medium"
              style={{
                color: tab === t.key ? 'var(--c-action)' : 'var(--text-2)',
                borderBottom: tab === t.key ? '2px solid var(--c-action)' : '2px solid transparent',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {tab === 'kolory' ? (
        <div className="flex gap-2 flex-wrap">
          {TABLICA_COLORS.map(c => (
            <button
              key={c.value}
              type="button"
              title={c.label}
              onClick={() => onChange(c.value, 'solid')}
              className="rounded-full"
              style={{
                width: 30, height: 30, background: c.value,
                outline: tloTyp !== 'zdjecie' && kolorTla === c.value ? '2px solid var(--text)' : 'none',
                outlineOffset: 2,
              }}
            />
          ))}
          {BOARD_GRADIENTS.map(g => (
            <button
              key={g.id}
              type="button"
              title={g.nazwa}
              onClick={() => onChange(g.wartosc, 'gradient')}
              className="rounded-full"
              style={{
                width: 30, height: 30, background: g.wartosc,
                outline: tloTyp === 'gradient' && kolorTla === g.wartosc ? '2px solid var(--text)' : 'none',
                outlineOffset: 2,
              }}
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {BOARD_PHOTOS.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange(p.url, 'zdjecie')}
              className="rounded-lg overflow-hidden"
              style={{
                height: 56, backgroundImage: `url(${p.miniatura})`, backgroundSize: 'cover', backgroundPosition: 'center',
                outline: tloTyp === 'zdjecie' && kolorTla === p.url ? '2px solid var(--c-action)' : 'none',
                outlineOffset: 2,
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
