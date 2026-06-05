import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabase'
import { BUSINESS_CATEGORIES, getSubcategoriesFor, getCategoryById } from '../config/businessTypes'
import { Loader2 } from 'lucide-react'

// ─── Step 1: Welcome ─────────────────────────────────────────────────────

function Step1({ onNext, onSkip, loading }) {
  return (
    <div style={{ textAlign: 'center', padding: '4px 0 4px' }}>
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

      <button onClick={onNext} className="mgz-btn-primary" style={{ width: '100%', marginBottom: 18, fontSize: 16, boxShadow: '0 4px 16px rgba(59,130,246,0.38)' }}>
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

      {/* Category grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
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

      {/* Subcategory chips — slide in after selecting */}
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
      <div style={{ textAlign: 'center', padding: '20px 0 16px' }}>
        <div style={{ fontSize: 52, marginBottom: 16, animation: 'mgzPop 0.52s cubic-bezier(0.34,1.56,0.64,1) both' }}>
          ✅
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 6 }}>Gotowe!</div>
        <div style={{ fontSize: 14, color: '#6b7280' }}>Uruchamiam Magzic…</div>
      </div>
    )
  }

  const inputStyle = {
    width: '100%', padding: '10px 14px', fontSize: 14,
    border: '1px solid #d1d5db', borderRadius: 10, outline: 'none',
    background: '#fff', color: '#111827', boxSizing: 'border-box',
    fontFamily: 'DM Sans, sans-serif',
  }

  return (
    <div>
      <h2 style={{ fontSize: 19, fontWeight: 700, color: '#111827', margin: '0 0 4px', letterSpacing: '-0.3px' }}>
        Ostatni krok!
      </h2>
      <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 16px', lineHeight: 1.5 }}>
        Możesz to zmienić później w ustawieniach.
      </p>

      {/* Summary badge with change link */}
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
          style={inputStyle}
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
          style={inputStyle}
        />
      </div>

      {error && <p className="mgz-error" style={{ marginBottom: 14 }}>{error}</p>}

      <button
        onClick={onSave}
        disabled={loading}
        className="mgz-btn-primary"
        style={{
          width: '100%', marginBottom: 14, fontSize: 15,
          boxShadow: loading ? 'none' : '0 4px 14px rgba(59,130,246,0.3)',
          opacity: loading ? 0.75 : 1,
          cursor: loading ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
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

  const [step, setStep]                       = useState(1)
  const [fade, setFade]                       = useState(true)
  const [mounted, setMounted]                 = useState(false)
  const [selectedCategory, setSelectedCategory]     = useState('')
  const [selectedSubcategory, setSelectedSubcategory] = useState('')
  const [companyName, setCompanyName]         = useState('')
  const [nip, setNip]                         = useState('')
  const [loading, setLoading]                 = useState(false)
  const [error, setError]                     = useState('')
  const [success, setSuccess]                 = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  // Pre-fill company name once workspace loads
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
    } catch (err) {
      console.error('[BusinessOnboarding] skip error:', err)
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
    } catch (err) {
      console.error('[BusinessOnboarding] save error:', err)
      setError('Wystąpił błąd. Spróbuj ponownie.')
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(15,23,42,0.68)',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '20px 16px 40px',
      overflowY: 'auto',
      fontFamily: 'DM Sans, sans-serif',
    }}>
      <div style={{
        background: '#fff', borderRadius: 24,
        width: '100%', maxWidth: 520,
        margin: 'auto',
        boxShadow: '0 24px 64px rgba(0,0,0,0.24)',
        padding: '28px 24px 24px',
        transform: mounted ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.97)',
        opacity: mounted ? 1 : 0,
        transition: 'transform 0.38s cubic-bezier(0.16,1,0.3,1), opacity 0.3s ease',
      }}>

        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 26 }}>
          {[1, 2, 3].map(n => (
            <div key={n} style={{
              height: 6, borderRadius: 3,
              width: n === step ? 22 : 7,
              background: n === step ? '#3b82f6' : n < step ? '#93c5fd' : '#e5e7eb',
              transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)',
            }} />
          ))}
        </div>

        {/* Step content — fade on transition */}
        <div style={{
          opacity: fade ? 1 : 0,
          transform: fade ? 'translateY(0)' : 'translateY(5px)',
          transition: 'opacity 0.19s ease, transform 0.19s ease',
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

        /* Category cards */
        .mgz-card {
          position: relative; cursor: pointer; text-align: left;
          border-radius: 12px; padding: 12px 10px;
          border: 1.5px solid #e5e7eb; background: #fafafa;
          outline: none; width: 100%; font-family: DM Sans, sans-serif;
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

        /* Subcategory chips */
        .mgz-chips {
          display: flex; gap: 6px;
          overflow-x: auto; padding-bottom: 2px;
          scrollbar-width: none;
        }
        .mgz-chips::-webkit-scrollbar { display: none; }
        .mgz-chip {
          cursor: pointer; white-space: nowrap;
          border-radius: 20px; padding: 6px 12px;
          font-size: 12px; font-weight: 500; line-height: 1.4;
          border: 1.5px solid #e5e7eb; background: #f9fafb; color: #374151;
          transition: all 0.12s ease; flex-shrink: 0;
          font-family: DM Sans, sans-serif; outline: none;
        }
        .mgz-chip:hover { border-color: #93c5fd; background: #f0f9ff; color: #0369a1; }
        .mgz-chip--active { border-color: #3b82f6 !important; background: #eff6ff !important; color: #1d4ed8 !important; }

        /* Buttons */
        .mgz-btn-primary {
          padding: 12px 20px; background: #3b82f6; color: #fff;
          border: none; border-radius: 11px;
          font-size: 14px; font-weight: 600; letter-spacing: -0.01em;
          font-family: DM Sans, sans-serif;
          transition: opacity 0.15s, box-shadow 0.15s;
          cursor: pointer;
        }
        .mgz-btn-primary:hover:not(:disabled) { opacity: 0.9; }
        .mgz-btn-secondary {
          padding: 11px 16px; background: #f9fafb; color: #374151;
          border: 1.5px solid #e5e7eb; border-radius: 11px;
          font-size: 14px; font-weight: 500; font-family: DM Sans, sans-serif;
          cursor: pointer; flex-shrink: 0; outline: none;
          transition: background 0.12s;
        }
        .mgz-btn-secondary:hover { background: #f3f4f6; }

        /* Skip link */
        .mgz-skip {
          background: none; border: none; color: #9ca3af;
          font-size: 13px; cursor: pointer; padding: 0;
          text-decoration: underline; font-family: DM Sans, sans-serif;
          transition: color 0.1s; line-height: 1.5;
        }
        .mgz-skip:hover { color: #6b7280; }
        .mgz-skip:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Input focus */
        .mgz-input:focus { border-color: #3b82f6 !important; box-shadow: 0 0 0 3px rgba(59,130,246,0.12) !important; }

        /* Error message */
        .mgz-error {
          padding: 8px 12px; background: #fef2f2;
          border: 1px solid #fecaca; border-radius: 8px;
          color: #dc2626; font-size: 13px; line-height: 1.5; margin: 0;
        }

        /* 1-line text truncation */
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
