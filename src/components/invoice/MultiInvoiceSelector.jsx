import { useState } from 'react'

function pluralFaktury(n) {
  if (n === 1) return 'fakturę'
  if (n >= 2 && n <= 4) return 'faktury'
  return 'faktur'
}

export default function MultiInvoiceSelector({ previews, onSelect, onCancel }) {
  const [selected, setSelected] = useState(new Set(previews.map((_, i) => i)))

  const toggleAll = () => {
    setSelected(selected.size === previews.length ? new Set() : new Set(previews.map((_, i) => i)))
  }

  const toggle = (i) => {
    const next = new Set(selected)
    next.has(i) ? next.delete(i) : next.add(i)
    setSelected(next)
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>
          Wykryto {previews.length} {previews.length === 1 ? 'fakturę' : pluralFaktury(previews.length)} w pliku
        </div>
        <div style={{ color: 'var(--muted)', fontSize: 13 }}>
          Zaznacz dokumenty do zaimportowania. Każdy zostanie zapisany jako roboczy.
        </div>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, marginBottom: 10 }}>
        <input
          type="checkbox"
          checked={selected.size === previews.length}
          onChange={toggleAll}
          style={{ width: 15, height: 15 }}
        />
        Zaznacz wszystkie
      </label>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '50vh', overflowY: 'auto' }}>
        {previews.map((inv, i) => (
          <div
            key={i}
            onClick={() => toggle(i)}
            style={{
              border: selected.has(i) ? '2px solid #2563eb' : '1px solid var(--border)',
              borderRadius: 8,
              padding: '10px 14px',
              cursor: 'pointer',
              background: selected.has(i) ? '#eff6ff' : 'var(--card)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" checked={selected.has(i)} readOnly style={{ width: 15, height: 15 }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {inv.invoiceNumber || `Dokument ${i + 1}`}
                  {inv.docType === 'paragon' && (
                    <span style={{ background: '#f97316', color: '#fff', padding: '1px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
                      PARAGON
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>
                  {inv.sellerName || inv.sellerNip || '—'}
                  {inv.invoiceDate ? ` · ${inv.invoiceDate}` : ''}
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>
                {inv.totalAmount > 0
                  ? `${inv.totalAmount.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PLN`
                  : '—'}
              </div>
              {inv.priceMode !== 'unknown' && (
                <div style={{ fontSize: 11, color: inv.priceMode === 'gross' ? '#2563eb' : '#16a34a' }}>
                  {inv.priceMode === 'gross' ? 'brutto' : 'netto'}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onCancel}
          style={{ padding: '9px 18px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card)', cursor: 'pointer', fontSize: 13 }}
        >
          Anuluj
        </button>
        <button
          type="button"
          onClick={() => onSelect([...selected].sort((a, b) => a - b).map(i => previews[i]))}
          disabled={selected.size === 0}
          style={{
            padding: '9px 18px',
            borderRadius: 8,
            background: selected.size > 0 ? '#2563eb' : '#9ca3af',
            color: '#fff',
            border: 'none',
            cursor: selected.size > 0 ? 'pointer' : 'not-allowed',
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          Importuj {selected.size} {pluralFaktury(selected.size)} →
        </button>
      </div>
    </div>
  )
}
