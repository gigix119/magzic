import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkspace } from '../context/WorkspaceContext'
import { getFirstUseFlowFor } from '../config/businessTypes'
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react'

const DETECTION_TABLE = {
  warehouses: 'magazyny',
  products: 'towary',
  contractors: 'kontrahenci',
  invoices: 'faktury',
}

function Skeleton() {
  return (
    <div className="rounded-xl mb-6 p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      <div style={{ width: '55%', height: 22, borderRadius: 6, background: 'var(--hover-bg)', marginBottom: 12 }} />
      <div style={{ width: '100%', height: 8, borderRadius: 4, background: 'var(--hover-bg)', marginBottom: 20 }} />
      {[1, 2, 3].map(i => (
        <div key={i} style={{ width: '100%', height: 56, borderRadius: 8, background: 'var(--hover-bg)', marginBottom: 8 }} />
      ))}
    </div>
  )
}

export default function FirstUseSteps() {
  const { workspaceId, wsQuery, addWsFilter, getBusinessCategory } = useWorkspace()
  const navigate = useNavigate()

  const { workspace } = useWorkspace()
  const categoryId = getBusinessCategory()
  const flow = getFirstUseFlowFor(categoryId)
  const customCategoryName = workspace?.custom_category_name || null

  const storageKey = workspaceId ? `magzic_fus_dismissed_${workspaceId}` : null

  const [completedKeys, setCompletedKeys] = useState({})
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState(() =>
    typeof window !== 'undefined' && storageKey ? !!localStorage.getItem(storageKey) : false
  )

  useEffect(() => {
    if (!workspaceId || dismissed) {
      setLoading(false)
      return
    }

    const keys = [...new Set(flow.steps.filter(s => s.detection).map(s => s.detection))]

    async function fetchCompletion() {
      try {
        const results = await Promise.all(
          keys.map(async key => {
            try {
              const { count } = await addWsFilter(
                wsQuery(DETECTION_TABLE[key]).select('id', { count: 'exact', head: true })
              )
              return { key, done: (count || 0) > 0 }
            } catch {
              return { key, done: false }
            }
          })
        )
        const map = {}
        for (const { key, done } of results) map[key] = done
        setCompletedKeys(map)
      } catch {
        // fallback: all steps shown as not done
      } finally {
        setLoading(false)
      }
    }

    fetchCompletion()
  }, [workspaceId]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleDismiss() {
    if (storageKey) localStorage.setItem(storageKey, '1')
    setDismissed(true)
  }

  if (dismissed) return null
  if (loading) return <Skeleton />

  const detectableSteps = flow.steps.filter(s => s.detection !== null)
  const completedCount = detectableSteps.filter(s => completedKeys[s.detection]).length
  const allDone = completedCount >= detectableSteps.length
  const progressPct = detectableSteps.length > 0
    ? Math.round((completedCount / detectableSteps.length) * 100)
    : 0

  if (allDone) {
    return (
      <div className="rounded-xl mb-6 flex items-center gap-3 px-4 py-3"
        style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.3)' }}>
        <CheckCircle2 size={20} style={{ color: '#16a34a', flexShrink: 0 }} />
        <p className="flex-1 text-sm font-medium" style={{ color: '#16a34a' }}>
          Świetnie! Masz skonfigurowany magazyn.
        </p>
        <button
          onClick={handleDismiss}
          style={{
            color: '#16a34a', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 600, padding: '8px 12px', minHeight: 44,
          }}
        >
          OK
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-xl mb-6" style={{ background: 'var(--card)', border: '1px solid var(--border)', maxWidth: 600 }}>
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>
          🚀 {customCategoryName ? `Pierwsze kroki dla ${customCategoryName}` : flow.title}
        </h2>
        <div className="flex items-center gap-3">
          <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--hover-bg)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${progressPct}%`, background: '#3b82f6',
              borderRadius: 3, transition: 'width 0.35s ease',
            }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-2)', flexShrink: 0 }}>
            {completedCount}/{flow.steps.length} wykonane
          </span>
        </div>
      </div>

      {/* Steps */}
      <div style={{ borderTop: '1px solid var(--border)' }}>
        {flow.steps.map((step, i) => {
          const isCompleted = step.detection !== null && completedKeys[step.detection]
          return (
            <div
              key={step.id}
              className="flex gap-3 px-5 py-3"
              style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}
            >
              <div style={{ paddingTop: 2, flexShrink: 0 }}>
                {isCompleted
                  ? <CheckCircle2 size={20} style={{ color: '#16a34a' }} />
                  : <Circle size={20} style={{ color: 'var(--border)' }} />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm" style={{
                  fontWeight: isCompleted ? 400 : 600,
                  color: isCompleted ? 'var(--muted)' : 'var(--text)',
                  textDecoration: isCompleted ? 'line-through' : 'none',
                }}>
                  {step.label}
                </p>
                {!isCompleted && (
                  <>
                    <p className="text-xs mt-0.5 mb-2" style={{ color: 'var(--text-2)', lineHeight: 1.4 }}>
                      {step.description}
                    </p>
                    <button
                      onClick={() => navigate(step.route)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '8px 14px', borderRadius: 8, minHeight: 44,
                        border: '1px solid var(--border)', background: 'transparent',
                        color: 'var(--text)', fontSize: 13, fontWeight: 600,
                        cursor: 'pointer', transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                    >
                      {step.ctaLabel} <ArrowRight size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
