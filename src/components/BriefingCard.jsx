import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, ArrowRight } from 'lucide-react'
import { useWorkspace } from '../context/WorkspaceContext'
import { generateDailyBriefing } from '../utils/briefingEngine'
import { getBriefingTitleFor } from '../config/businessTypes'
import { supabase } from '../supabase'

function Skeleton() {
  return (
    <div>
      {[1, 2, 3].map(i => (
        <div
          key={i}
          style={{
            borderTop: i > 1 ? '1px solid var(--border)' : 'none',
            padding: '14px 20px',
          }}
        >
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ width: 22, height: 22, borderRadius: 4, background: 'var(--hover-bg)', flexShrink: 0 }} className="animate-pulse" />
            <div style={{ flex: 1 }}>
              <div style={{ width: '60%', height: 14, borderRadius: 4, background: 'var(--hover-bg)', marginBottom: 6 }} className="animate-pulse" />
              <div style={{ width: '80%', height: 11, borderRadius: 4, background: 'var(--hover-bg)', marginBottom: 8 }} className="animate-pulse" />
              <div style={{ width: 120, height: 11, borderRadius: 4, background: 'var(--hover-bg)' }} className="animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function BriefingItem({ item, onNavigate }) {
  const isGood = item.type === 'no_data'
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px 20px' }}>
      <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1, marginTop: 1 }}>{item.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: isGood ? '#16a34a' : 'var(--text)',
            margin: 0,
            lineHeight: 1.35,
          }}
        >
          {item.title}
        </p>
        {item.description && (
          <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '3px 0 0', lineHeight: 1.45 }}>
            {item.description}
          </p>
        )}
        <button
          onClick={() => onNavigate(item.action.route)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            marginTop: 6,
            padding: '6px 0',
            minHeight: 44,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: isGood ? '#16a34a' : '#3b82f6',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {item.action.label}
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  )
}

const MAX_VISIBLE = 6

export default function BriefingCard() {
  const { workspaceId, getBusinessCategory } = useWorkspace()
  const navigate = useNavigate()
  const [briefing, setBriefing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  const load = useCallback(async () => {
    if (!workspaceId) { setLoading(false); return }
    setLoading(true)
    setExpanded(false)
    const result = await generateDailyBriefing(supabase, workspaceId, getBusinessCategory())
    setBriefing(result)
    setLoading(false)
  }, [workspaceId, getBusinessCategory])

  useEffect(() => {
    load()
  }, [workspaceId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!workspaceId) return null

  const title = getBriefingTitleFor(getBusinessCategory())
  const items = briefing?.items || []
  const visibleItems = expanded ? items : items.slice(0, MAX_VISIBLE)
  const hiddenCount = items.length - MAX_VISIBLE

  return (
    <div
      className="rounded-xl mb-6"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        overflow: 'hidden',
        boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px 12px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--table-head)',
        }}
      >
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.01em' }}>
            🌅 {title}
          </h2>
          {briefing?.generatedAt && !loading && (
            <p style={{ fontSize: 11, color: 'var(--muted)', margin: '2px 0 0' }}>
              Ostatnia aktualizacja:{' '}
              {briefing.generatedAt.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <Skeleton />
      ) : briefing?.error ? (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>
            Nie udało się załadować briefingu. Spróbuj ponownie.
          </p>
          <button
            onClick={load}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', minHeight: 44, borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--table-sub)',
              color: 'var(--text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <RefreshCw size={13} /> Spróbuj ponownie
          </button>
        </div>
      ) : (
        <div>
          {visibleItems.map((item, i) => (
            <div key={item.type + i} style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
              <BriefingItem item={item} onNavigate={route => navigate(route)} />
            </div>
          ))}

          {!expanded && hiddenCount > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', padding: '8px 20px' }}>
              <button
                onClick={() => setExpanded(true)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#3b82f6', fontSize: 13, fontWeight: 500,
                  padding: '6px 0', minHeight: 44,
                }}
              >
                i {hiddenCount} {hiddenCount === 1 ? 'więcej' : 'więcej'}... ↓
              </button>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      {!loading && !briefing?.error && (
        <div
          style={{
            borderTop: '1px solid var(--border)',
            padding: '10px 20px',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <button
            onClick={load}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', minHeight: 44, borderRadius: 8,
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--text-2)', fontSize: 13, fontWeight: 500,
              cursor: 'pointer', transition: 'background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <RefreshCw size={13} /> Odśwież briefing
          </button>
        </div>
      )}
    </div>
  )
}
