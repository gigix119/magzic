import { useState, useRef, useEffect } from 'react'
import { Search, X, Plus, ChevronDown } from 'lucide-react'

const IS = (err) => ({
  background: 'var(--input-bg)',
  border: `1px solid ${err ? '#ef4444' : 'var(--border)'}`,
  borderRadius: 8,
  color: 'var(--text)',
  padding: '8px 12px',
  fontSize: 14,
  width: '100%',
  outline: 'none',
})

const STATUS_CONFIG = {
  matched_nip: {
    bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0',
    text: 'Dopasowano istniejącego kontrahenta (NIP)',
  },
  matched_name: {
    bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0',
    text: 'Dopasowano istniejącego kontrahenta',
  },
  new_from_pdf: {
    bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe',
    text: 'Wykryto z PDF — zostanie utworzony przy zapisie',
  },
  new_manual: {
    bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe',
    text: 'Nowy kontrahent zostanie utworzony przy zapisie faktury',
  },
}

/**
 * value shape:
 *   {
 *     existingId: string|null,
 *     candidate: { nazwa, nip, email, telefon, adres }|null,
 *     matchStatus: 'matched_nip'|'matched_name'|'new_from_pdf'|'new_manual'|null
 *   }
 */
export default function ContractorCombobox({ contractors = [], value, onChange, hasError, disabled }) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const containerRef = useRef(null)
  const inputRef = useRef(null)

  const existingContractor = value?.existingId
    ? contractors.find(c => c.id === value.existingId)
    : null

  // Filter contractors by query (name or NIP)
  const filtered = query.trim()
    ? contractors.filter(c =>
        c.nazwa.toLowerCase().includes(query.toLowerCase()) ||
        (c.nip || '').replace(/\D/g, '').includes(query.replace(/\D/g, ''))
      )
    : contractors.slice(0, 10)

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  function clearSelection() {
    onChange({ existingId: null, candidate: null, matchStatus: null })
    setQuery('')
    setShowDetails(false)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function selectExisting(contractor) {
    onChange({ existingId: contractor.id, candidate: null, matchStatus: 'matched_name' })
    setQuery('')
    setIsOpen(false)
    setShowDetails(false)
  }

  function commitNew(name) {
    const nazwaTrimmed = (name || query).trim()
    if (!nazwaTrimmed) return
    onChange({
      existingId: null,
      candidate: {
        nazwa: nazwaTrimmed,
        nip: value?.candidate?.nip || null,
        email: value?.candidate?.email || null,
        telefon: value?.candidate?.telefon || null,
        adres: value?.candidate?.adres || null,
      },
      matchStatus: 'new_manual',
    })
    setQuery('')
    setIsOpen(false)
  }

  function updateCandidateField(field, val) {
    if (value && !value.existingId) {
      onChange({
        ...value,
        candidate: {
          ...(value.candidate || {}),
          [field]: val || null,
        },
      })
    }
  }

  const isExisting = !!value?.existingId
  const candidateName = value?.candidate?.nazwa || ''
  const badge = STATUS_CONFIG[value?.matchStatus]

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>

      {/* ── Selected existing: chip ── */}
      {isExisting ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...IS(hasError), padding: '6px 12px' }}>
          <span style={{ flex: 1, fontSize: 14, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {existingContractor?.nazwa || '—'}
          </span>
          {existingContractor?.nip && (
            <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>
              NIP: {existingContractor.nip}
            </span>
          )}
          {!disabled && (
            <button
              type="button"
              onClick={clearSelection}
              style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0, display: 'flex', alignItems: 'center' }}
              title="Zmień kontrahenta"
            >
              <X size={14} />
            </button>
          )}
        </div>
      ) : (
        /* ── Search input ── */
        <div style={{ position: 'relative' }}>
          <input
            ref={inputRef}
            value={candidateName || query}
            onChange={e => {
              const val = e.target.value
              setQuery(val)
              if (value?.candidate) {
                onChange({ ...value, candidate: { ...value.candidate, nazwa: val }, matchStatus: val.trim() ? 'new_manual' : null })
              } else if (!val.trim()) {
                onChange({ existingId: null, candidate: null, matchStatus: null })
              }
              setIsOpen(true)
            }}
            onFocus={() => setIsOpen(true)}
            placeholder="Wpisz nazwę lub NIP kontrahenta…"
            disabled={disabled}
            style={{ ...IS(hasError), paddingLeft: 36, paddingRight: 36 }}
          />
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
          {(candidateName || query) && !disabled && (
            <button
              type="button"
              onClick={clearSelection}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}
            >
              <X size={13} />
            </button>
          )}
        </div>
      )}

      {/* ── Dropdown ── */}
      {isOpen && !isExisting && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 8, marginTop: 4,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          maxHeight: 220, overflowY: 'auto',
        }}>
          {filtered.length > 0 && (
            <>
              <div style={{ padding: '6px 12px 4px', fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Istniejący kontrahenci
              </div>
              {filtered.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selectExisting(c)}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, width: '100%', padding: '7px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{c.nazwa}</span>
                  {c.nip && <span style={{ fontSize: 11, color: 'var(--muted)' }}>NIP: {c.nip}</span>}
                </button>
              ))}
            </>
          )}

          {(query.trim() || candidateName.trim()) && (
            <button
              type="button"
              onClick={() => commitNew(query || candidateName)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', borderTop: filtered.length > 0 ? '1px solid var(--border)' : 'none' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <Plus size={13} style={{ color: '#3b82f6', flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: '#3b82f6' }}>
                Utwórz: <strong>„{(query || candidateName).trim()}"</strong>
              </span>
            </button>
          )}

          {!filtered.length && !(query.trim() || candidateName.trim()) && (
            <div style={{ padding: '12px', fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
              Wpisz nazwę lub NIP aby wyszukać
            </div>
          )}

          {!filtered.length && (query.trim() || candidateName.trim()) && (
            <div style={{ padding: '6px 12px 2px', fontSize: 11, color: 'var(--muted)' }}>
              Nie znaleziono pasujących kontrahentów
            </div>
          )}
        </div>
      )}

      {/* ── Status badge ── */}
      {badge && (
        <div style={{
          marginTop: 6, padding: '5px 10px',
          background: badge.bg, color: badge.color,
          border: `1px solid ${badge.border}`,
          borderRadius: 6, fontSize: 11, fontWeight: 500,
        }}>
          {badge.text}
        </div>
      )}

      {/* ── PDF candidate info box ── */}
      {value?.matchStatus === 'new_from_pdf' && value?.candidate && !isExisting && (
        <div style={{ marginTop: 6, padding: '8px 10px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#1e40af' }}>Dane z PDF:</span>
            <button
              type="button"
              onClick={() => setShowDetails(v => !v)}
              style={{ fontSize: 11, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}
            >
              <ChevronDown size={12} style={{ transform: showDetails ? 'rotate(180deg)' : 'none', transition: '0.15s' }} />
              {showDetails ? 'Ukryj dane' : 'Edytuj dane'}
            </button>
          </div>
          <div style={{ fontSize: 12, color: '#1e40af', marginTop: 3 }}>
            {value.candidate.nazwa && <div><strong>{value.candidate.nazwa}</strong></div>}
            {value.candidate.nip && <div>NIP: {value.candidate.nip}</div>}
          </div>
        </div>
      )}

      {/* ── Expandable details for new contractor ── */}
      {(value?.matchStatus === 'new_manual' || value?.matchStatus === 'new_from_pdf') && !isExisting && (
        <div style={{ marginTop: value?.matchStatus === 'new_from_pdf' ? 0 : 4 }}>
          {value?.matchStatus !== 'new_from_pdf' && (
            <button
              type="button"
              onClick={() => setShowDetails(v => !v)}
              style={{ fontSize: 11, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '3px 0', display: 'flex', alignItems: 'center', gap: 3 }}
            >
              <ChevronDown size={11} style={{ transform: showDetails ? 'rotate(180deg)' : 'none', transition: '0.15s' }} />
              {showDetails ? 'Ukryj dane kontrahenta' : 'Uzupełnij dane kontrahenta (opcjonalnie)'}
            </button>
          )}
          {showDetails && (
            <div style={{
              marginTop: 6, padding: '10px 12px',
              background: 'var(--table-sub)', borderRadius: 6,
              border: '1px solid var(--border)',
              display: 'grid', gap: 8,
            }}>
              <input
                value={value?.candidate?.nip || ''}
                onChange={e => updateCandidateField('nip', e.target.value)}
                placeholder="NIP (opcjonalnie)"
                style={{ ...IS(false), fontSize: 13 }}
              />
              <input
                value={value?.candidate?.email || ''}
                onChange={e => updateCandidateField('email', e.target.value)}
                placeholder="Email (opcjonalnie)"
                type="email"
                style={{ ...IS(false), fontSize: 13 }}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={value?.candidate?.telefon || ''}
                  onChange={e => updateCandidateField('telefon', e.target.value)}
                  placeholder="Telefon"
                  style={{ ...IS(false), fontSize: 13 }}
                />
                <input
                  value={value?.candidate?.adres || ''}
                  onChange={e => updateCandidateField('adres', e.target.value)}
                  placeholder="Adres"
                  style={{ ...IS(false), fontSize: 13 }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
