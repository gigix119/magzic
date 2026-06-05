import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabase'
import { BUSINESS_CATEGORIES, getSubcategoriesFor, getCategoryById } from '../config/businessTypes'
import { Loader2 } from 'lucide-react'

// ─── Step 1: Welcome ─────────────────────────────────────────────────────

function Step1({ onNext, onSkip, loading }) {
  return (
    <div className="mgz-step1-center">
      <div style={{
        position: 'relative', height: 130,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 16,
      }}>
        <div style={{
          position: 'absolute',
          width: 108, height: 108, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.16) 0%, rgba(59,130,246,0.04) 60%, transparent 100%)',
          animation: 'mgzPulse 2.8s ease-in-out infinite',
        }} />
        <span style={{
          fontSize: 58, lineHeight: 1,
          animation: 'mgzFloat 3s ease-in-out infinite',
          display: 'inline-block', position: 'relative',
          userSelect: 'none',
        }}>
          📦
        </span>
      </div>

      <h2 style={{ fontSize: 26, fontWeight: 700, color: '#111827', margin: '0 0 10px', letterSpacing: '-0.5px' }}>
        Cześć! 👋
      </h2>
      <p style={{ color: '#6b7280', fontSize: 15, lineHeight: 1.65, margin: '0 0 32px' }}>
        Skonfiguruj Magzic w 30 sekund.
      </p>

      <button
        onClick={onNext}
        className="mgz-btn-primary"
        style={{ marginBottom: 18, fontSize: 16, boxShadow: '0 4px 16px rgba(59,130,246,0.38)' }}
      >
        Zaczynamy →
      </button>

      <p style={{ margin: 0 }}>
        <button onClick={onSkip} disabled={loading} className="mgz-skip">Pomiń konfigurację</button>
      </p>
    </div>
  )
}

// ─── Step 2: Category selection ──────────────────────────────────────────

function Step2({ selectedCategory, selectedSubcategory, subcategories, isGeneral, onSelectCategory, onSelectSubcategory, onNext, onBack, onSkip, loading, error }) {
  return (
    <div>
      <h2 style={{ fontSize: 19, fontWeight: 700, color: '#111827', margin: '0 0 4px', letterSpacing: '-0.3px' }}>
        Czym zajmuje się Twoja firma?
      </h2>
      <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 16px', lineHeight: 1.5 }}>
        Dopasujemy alerty i asystenta do Twojej branży.
      </p>

      <div className="mgz-cat-grid">
        {BUSINESS_CATEGORIES.map(cat => {
          const active = selectedCategory === cat.id
          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={`mgz-card${active ? ' mgz-card--active' : ''}`}
            >
              {active && <span className="mgz-card__check">✓</span>}
              <span style={{ fontSize: 20, lineHeight: 1, marginBottom: 4, display: 'block' }}>{cat.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: active ? '#1d4ed8' : '#374151', lineHeight: 1.35, marginBottom: 2, display: 'block' }}>
                {cat.label}
              </span>
              <span className="mgz-clamp1" style={{ fontSize: 10, color: '#9ca3af', lineHeight: 1.3, display: 'block' }}>
                {cat.description}
              </span>
            </button>
          )
        })}
      </div>

      {selectedCategory && !isGeneral && subcategories.length > 0 && (
        <div style={{ marginTop: 14, animation: 'mgzSlide 0.22s ease' }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>
            Rodzaj działalności
          </p>
          <div className="mgz-chips">
            {subcategories.map(sub => (
              <button
                key={sub.id}
                onClick={() => onSelectSubcategory(sub.id)}
                className={`mgz-chip${selectedSubcategory === sub.id ? ' mgz-chip--active' : ''}`}
              >
                {sub.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="mgz-error" style={{ marginTop: 12 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button onClick={onBack} className="mgz-btn-secondary">← Wstecz</button>
        <button
          onClick={onNext}
          disabled={!selectedCategory || loading}
          className="mgz-btn-primary"
          style={{ flex: 1, opacity: (!selectedCategory || loading) ? 0.4 : 1, cursor: (!selectedCategory || loading) ? 'not-allowed' : 'pointer' }}
        >
          Dalej →
        </button>
      </div>

      <p style={{ textAlign: 'center', marginTop: 14, marginBottom: 0 }}>
        <button onClick={onSkip} disabled={loading} className="mgz-skip">Pomiń konfigurację</button>
      </p>
    </div>
  )
}

// ─── Step 3: Company details + finish ────────────────────────────────────

function Step3({ companyName, nip, selectedCategoryObj, selectedSubcategoryObj, onChangeCompany, onChangeNip, onChangeBiz, onSave, onSkip, loading, error, success }) {
  if (success) {
    return (
      <div style={{ textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 0 16px' }}>
        <div style={{ fontSize: 52, marginBottom: 16, animation: 'mgzPop 0.52s cubic-bezier(0.34,1.56,0.64,1) both' }}>
          ✅
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 6 }}>Gotowe!</div>
        <div style={{ fontSize: 14, color: '#6b7280' }}>Uruchamiam Magzic…</div>
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ fontSize: 19, fontWeight: 700, color: '#111827', margin: '0 0 4px', letterSpacing: '-0.3px' }}>
        Ostatni krok!
      </h2>
      <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 16px', lineHeight: 1.5 }}>
        Możesz to zmienić później w ustawieniach.
      </p>

      {selectedCategoryObj && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', background: '#f0f9ff', border: '1px solid #bae6fd',
          borderRadius: 10, marginBottom: 18,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>{selectedCategoryObj.icon}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0369a1', lineHeight: 1.3 }}>
                {selectedCategoryObj.label}
              </div>
              {selectedSubcategoryObj && (
                <div style={{ fontSize: 11, color: '#0284c7', marginTop: 1 }}>{selectedSubcategoryObj.label}</div>
              )}
            </div>
          </div>
          <button
            onClick={onChangeBiz}
            style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: 12, fontWeight: 500, cursor: 'pointer', padding: '4px 8px', flexShrink: 0, fontFamily: 'DM Sans, sans-serif' }}
          >
            Zmień →
          </button>
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
          Nazwa firmy lub magazynu
        </label>
        <input
          type="text"
          value={companyName}
          onChange={e => onChangeCompany(e.target.value)}
          placeholder="np. Restauracja Pod Lipą"
          className="mgz-input"
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
          NIP <span style={{ color: '#9ca3af', fontWeight: 400 }}>— opcjonalnie</span>
        </label>
        <input
          type="text"
          value={nip}
          onChange={e => onChangeNip(e.target.value)}
          placeholder="np. 1234567890"
          className="mgz-input"
        />
      </div>

      {error && <p className="mgz-error" style={{ marginBottom: 14 }}>{error}</p>}

      <button
        onClick={onSave}
        disabled={loading}
        className="mgz-btn-primary"
        style={{
          marginBottom: 14, fontSize: 15,
          boxShadow: loading ? 'none' : '0 4px 14px rgba(59,130,246,0.3)',
          opacity: loading ? 0.75 : 1,
          cursor: loading ? 'not-allowed' : 'pointer',
          gap: 7,
        }}
      >
        {loading
          ? <><Loader2 size={16} style={{ animation: 'mgzSpin 1s linear infinite', flexShrink: 0 }} />Zapisuję…</>
          : 'Uruchom Magzic 🚀'
        }
      </button>

      <p style={{ textAlign: 'center', margin: 0 }}>
        <button onClick={onSkip} disabled={loading} className="mgz-skip">Pomiń konfigurację</button>
      </p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────

export default function BusinessOnboarding() {
  const { workspace, refreshWorkspace } = useAuth()
  const navigate = useNavigate()

  const [step, setStep]                             = useState(1)
  const [fade, setFade]                             = useState(true)
  const [mounted, setMounted]                       = useState(false)
  const [selectedCategory, setSelectedCategory]     = useState('')
  const [selectedSubcategory, setSelectedSubcategory] = useState('')
  const [companyName, setCompanyName]               = useState('')
  const [nip, setNip]                               = useState('')
  const [loading, setLoading]                       = useState(false)
  const [error, setError]                           = useState('')
  const [success, setSuccess]                       = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (workspace?.name) setCompanyName(p => p || workspace.name) }, [workspace])

  if (!workspace || workspace.business_profile_completed) return null

  const isGeneral              = selectedCategory === 'general'
  const subcategories          = selectedCategory ? getSubcategoriesFor(selectedCategory) : []
  const selectedCategoryObj    = selectedCategory ? getCategoryById(selectedCategory) : null
  const selectedSubcategoryObj = subcategories.find(s => s.id === selectedSubcategory) || null

  function goToStep(n) {
    setFade(false)
    setError('')
    setTimeout(() => { setStep(n); setFade(true) }, 190)
  }

  function handleSelectCategory(catId) {
    setSelectedCategory(catId)
    setSelectedSubcategory(getSubcategoriesFor(catId)[0]?.id || '')
    setError('')
  }

  async function handleSkip() {
    setLoading(true)
    try {
      await supabase.from('workspaces').update({
        business_category: 'general',
        business_subcategory: 'general_inventory',
        business_profile_completed: true,
        onboarding_completed_at: new Date().toISOString(),
      }).eq('id', workspace.id)
      await refreshWorkspace()
    } catch (_) {
      await refreshWorkspace()
    }
    navigate('/dashboard', { replace: true })
  }

  async function handleSave() {
    if (!selectedCategory) { setError('Wybierz branżę, aby kontynuować.'); return }
    setError('')
    setLoading(true)
    try {
      const subcategory = isGeneral
        ? 'general_inventory'
        : (selectedSubcategory || subcategories[0]?.id || null)
      const { error: updateErr } = await supabase.from('workspaces').update({
        company_name: companyName.trim() || null,
        nip: nip.trim() || null,
        business_category: selectedCategory,
        business_subcategory: subcategory,
        business_profile_completed: true,
        onboarding_completed_at: new Date().toISOString(),
      }).eq('id', workspace.id)
      if (updateErr) throw updateErr
      setSuccess(true)
      await refreshWorkspace()
      setTimeout(() => navigate('/dashboard', { replace: true }), 900)
    } catch (_) {
      setError('Wystąpił błąd. Spróbuj ponownie.')
      setLoading(false)
    }
  }

  return (
    <div
      className="mgz-overlay"
      style={{ position: 'fixed', inset: 0, zIndex: 9999, fontFamily: 'DM Sans, sans-serif' }}
    >
      <div className={`mgz-card-wrapper${mounted ? ' mgz-card-wrapper--mounted' : ''}`}>

        {/* Progress dots — 12px circles */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 26 }}>
          {[1, 2, 3].map(n => (
            <div
              key={n}
              className={`mgz-dot${n === step ? ' mgz-dot--active' : n < step ? ' mgz-dot--done' : ' mgz-dot--pending'}`}
            />
          ))}
        </div>

        {/* Step content — fade on transition */}
        <div style={{
          opacity: fade ? 1 : 0,
          transform: fade ? 'translateY(0)' : 'translateY(5px)',
          transition: 'opacity 0.19s ease, transform 0.19s ease',
          flex: 1, display: 'flex', flexDirection: 'column',
        }}>
          {step === 1 && (
            <Step1 onNext={() => goToStep(2)} onSkip={handleSkip} loading={loading} />
          )}
          {step === 2 && (
            <Step2
              selectedCategory={selectedCategory}
              selectedSubcategory={selectedSubcategory}
              subcategories={subcategories}
              isGeneral={isGeneral}
              onSelectCategory={handleSelectCategory}
              onSelectSubcategory={setSelectedSubcategory}
              onNext={() => {
                if (!selectedCategory) { setError('Wybierz branżę, aby kontynuować.'); return }
                goToStep(3)
              }}
              onBack={() => goToStep(1)}
              onSkip={handleSkip}
              loading={loading}
              error={error}
            />
          )}
          {step === 3 && (
            <Step3
              companyName={companyName}
              nip={nip}
              selectedCategoryObj={selectedCategoryObj}
              selectedSubcategoryObj={selectedSubcategoryObj}
              onChangeCompany={setCompanyName}
              onChangeNip={setNip}
              onChangeBiz={() => goToStep(2)}
              onSave={handleSave}
              onSkip={handleSkip}
              loading={loading}
              error={error}
              success={success}
            />
          )}
        </div>
      </div>

      <style>{`
        @keyframes mgzFloat {
          0%,100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes mgzPulse {
          0%,100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.22); opacity: 1; }
        }
        @keyframes mgzPop {
          0% { transform: scale(0.3); opacity: 0; }
          60% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes mgzSlide {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes mgzSpin {
          to { transform: rotate(360deg); }
        }

        /* ── Layout: mobile-first full-screen white ── */
        .mgz-overlay {
          display: flex;
          flex-direction: column;
          background: #fff;
          overflow-y: auto;
          -webkit-tap-highlight-color: transparent;
        }

        .mgz-card-wrapper {
          flex: 1;
          width: 100%;
          padding: 24px 20px 36px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          opacity: 0;
          transition: opacity 0.28s ease;
        }
        .mgz-card-wrapper--mounted {
          opacity: 1;
        }

        /* ── Desktop: dark backdrop + centered floating card ── */
        @media (min-width: 640px) {
          .mgz-overlay {
            background: rgba(15,23,42,0.68);
            backdrop-filter: blur(6px);
            -webkit-backdrop-filter: blur(6px);
            flex-direction: row;
            align-items: flex-start;
            justify-content: center;
            padding: 20px 16px 40px;
          }
          .mgz-card-wrapper {
            flex: unset;
            flex-shrink: 0;
            max-width: 520px;
            width: 100%;
            margin: auto;
            background: #fff;
            border-radius: 24px;
            box-shadow: 0 24px 64px rgba(0,0,0,0.24);
            padding: 28px 24px 24px;
            transform: translateY(16px) scale(0.97);
            transition: opacity 0.38s cubic-bezier(0.16,1,0.3,1), transform 0.38s cubic-bezier(0.16,1,0.3,1);
          }
          .mgz-card-wrapper--mounted {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        /* ── Progress dots: 12px circles ── */
        .mgz-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          transition: background 0.3s ease;
          flex-shrink: 0;
        }
        .mgz-dot--active  { background: #3b82f6; }
        .mgz-dot--done    { background: #93c5fd; }
        .mgz-dot--pending { background: #e5e7eb; }

        /* ── Step 1: vertically centered in full-screen mobile ── */
        .mgz-step1-center {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          text-align: center;
          padding: 4px 0;
        }

        /* ── Category grid ── */
        .mgz-cat-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 8px;
        }

        /* ── Category cards ── */
        .mgz-card {
          position: relative; cursor: pointer; text-align: left;
          border-radius: 12px; padding: 12px 10px;
          border: 1.5px solid #e5e7eb; background: #fafafa;
          outline: none; width: 100%;
          font-family: DM Sans, sans-serif;
          min-height: 44px;
          transition: transform 0.14s ease, box-shadow 0.14s ease, border-color 0.14s ease, background 0.14s ease;
        }
        .mgz-card:hover {
          transform: translateY(-2px) scale(1.01);
          box-shadow: 0 6px 16px rgba(0,0,0,0.08);
          border-color: #d1d5db;
        }
        .mgz-card--active {
          border-color: #3b82f6 !important;
          background: #eff6ff !important;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.13) !important;
        }
        .mgz-card__check {
          position: absolute; top: 6px; right: 6px;
          width: 16px; height: 16px; border-radius: 50%;
          background: #3b82f6; color: #fff;
          font-size: 9px; font-weight: 700; line-height: 1;
          display: flex; align-items: center; justify-content: center;
        }

        /* ── Subcategory chips: scroll-snap, iOS-optimized ── */
        .mgz-chips {
          display: flex; gap: 6px;
          overflow-x: auto; padding-bottom: 4px;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
          scroll-snap-type: x mandatory;
        }
        .mgz-chips::-webkit-scrollbar { display: none; }
        .mgz-chip {
          cursor: pointer; white-space: nowrap;
          border-radius: 20px; padding: 0 14px;
          min-height: 44px;
          font-size: 14px; font-weight: 500; line-height: 1.4;
          border: 1.5px solid #e5e7eb; background: #f9fafb; color: #374151;
          transition: all 0.12s ease; flex-shrink: 0;
          font-family: DM Sans, sans-serif; outline: none;
          scroll-snap-align: start;
          display: inline-flex; align-items: center;
        }
        .mgz-chip:hover { border-color: #93c5fd; background: #f0f9ff; color: #0369a1; }
        .mgz-chip--active { border-color: #3b82f6 !important; background: #eff6ff !important; color: #1d4ed8 !important; }

        /* ── Buttons: 48px height, full-width ── */
        .mgz-btn-primary {
          min-height: 48px;
          width: 100%;
          padding: 0 20px;
          background: #3b82f6; color: #fff;
          border: none; border-radius: 11px;
          font-size: 15px; font-weight: 600; letter-spacing: -0.01em;
          font-family: DM Sans, sans-serif;
          transition: opacity 0.15s, box-shadow 0.15s;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          box-sizing: border-box;
        }
        .mgz-btn-primary:hover:not(:disabled) { opacity: 0.9; }
        .mgz-btn-secondary {
          min-height: 48px;
          padding: 0 16px;
          background: #f9fafb; color: #374151;
          border: 1.5px solid #e5e7eb; border-radius: 11px;
          font-size: 14px; font-weight: 500;
          font-family: DM Sans, sans-serif;
          cursor: pointer; flex-shrink: 0; outline: none;
          transition: background 0.12s;
          display: inline-flex; align-items: center;
          box-sizing: border-box;
        }
        .mgz-btn-secondary:hover { background: #f3f4f6; }

        /* ── Skip link: 44px tap target ── */
        .mgz-skip {
          background: none; border: none; color: #9ca3af;
          font-size: 13px; cursor: pointer;
          padding: 12px 8px; min-height: 44px;
          text-decoration: underline;
          font-family: DM Sans, sans-serif;
          transition: color 0.1s; line-height: 1.5;
        }
        .mgz-skip:hover { color: #6b7280; }
        .mgz-skip:disabled { opacity: 0.5; cursor: not-allowed; }

        /* ── Input: 16px prevents iOS auto-zoom ── */
        .mgz-input {
          width: 100%;
          padding: 12px 14px;
          font-size: 16px;
          border: 1px solid #d1d5db;
          border-radius: 10px;
          outline: none;
          background: #fff;
          color: #111827;
          box-sizing: border-box;
          font-family: DM Sans, sans-serif;
          min-height: 48px;
          -webkit-appearance: none;
        }
        .mgz-input:focus { border-color: #3b82f6 !important; box-shadow: 0 0 0 3px rgba(59,130,246,0.12) !important; }

        /* ── Error message ── */
        .mgz-error {
          padding: 8px 12px; background: #fef2f2;
          border: 1px solid #fecaca; border-radius: 8px;
          color: #dc2626; font-size: 13px; line-height: 1.5; margin: 0;
        }

        /* ── 1-line text clamp ── */
        .mgz-clamp1 {
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
        }
      `}</style>
    </div>
  )
}
