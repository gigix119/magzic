import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Warehouse, Loader2, CheckCircle2, Eye, EyeOff, XCircle, Check, X } from 'lucide-react'
import { supabase } from '../supabase'
import { trackEvent } from '../utils/adminHelpers'

const inputStyle = {
  width: '100%', padding: '10px 14px', fontSize: 14, border: '1px solid #d1d5db',
  borderRadius: 8, outline: 'none', background: '#fff', color: '#111827',
  boxSizing: 'border-box', transition: 'border-color 0.15s',
}

// Password requirements
const RULES = [
  { id: 'length',    label: 'Minimum 8 znaków',           test: p => p.length >= 8 },
  { id: 'lowercase', label: 'Przynajmniej jedna mała litera', test: p => /[a-z]/.test(p) },
  { id: 'uppercase', label: 'Przynajmniej jedna duża litera', test: p => /[A-Z]/.test(p) },
  { id: 'digit',     label: 'Przynajmniej jedna cyfra',   test: p => /[0-9]/.test(p) },
]
const SPECIAL_RULE = { id: 'special', label: 'Znak specjalny (rekomendacja)', test: p => /[^a-zA-Z0-9]/.test(p) }

function strength(password) {
  const passed = RULES.filter(r => r.test(password)).length
  if (passed <= 1) return { level: 0, label: 'Bardzo słabe', color: '#ef4444' }
  if (passed === 2) return { level: 1, label: 'Słabe',         color: '#f97316' }
  if (passed === 3) return { level: 2, label: 'Średnie',       color: '#eab308' }
  if (!SPECIAL_RULE.test(password)) return { level: 3, label: 'Dobre',     color: '#22c55e' }
  return { level: 4, label: 'Silne', color: '#16a34a' }
}

export default function ResetPassword() {
  // 'checking' → waiting for Supabase to process recovery token
  // 'ready'    → token valid, show form
  // 'invalid'  → no token or expired
  // 'success'  → password updated
  const [phase, setPhase]         = useState('checking')
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [showPass, setShowPass]   = useState(false)
  const [showConf, setShowConf]   = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const phaseRef = useRef('checking')

  useEffect(() => {
    trackEvent({
      eventType: 'page_view',
      moduleKey: 'auth',
      action: 'reset_password_opened',
      metadata: { source: 'reset_password_page' },
    })

    // Wait for Supabase to process the recovery URL token.
    // PASSWORD_RECOVERY event fires when the URL hash contains type=recovery tokens.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        phaseRef.current = 'ready'
        setPhase('ready')
      }
      if (event === 'SIGNED_OUT') {
        // If we're still checking, this means token was invalid
        if (phaseRef.current === 'checking') {
          setPhase('invalid')
        }
      }
    })

    // Fallback: if no PASSWORD_RECOVERY fires within 6s, assume link is invalid
    const timeout = setTimeout(() => {
      if (phaseRef.current === 'checking') {
        setPhase('invalid')
      }
    }, 6000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  const rules = RULES.map(r => ({ ...r, passed: r.test(password) }))
  const allRulesPassed = rules.every(r => r.passed)
  const passStrength = strength(password)
  const passwordsMatch = password === confirm
  const canSubmit = allRulesPassed && passwordsMatch && password.length > 0

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return

    setError('')
    setLoading(true)

    const { error: err } = await supabase.auth.updateUser({ password })

    if (err) {
      const msg = err.message?.includes('same_password')
        ? 'Nowe hasło musi być inne niż poprzednie.'
        : err.message || 'Wystąpił błąd. Spróbuj ponownie.'
      setError(msg)
      trackEvent({
        eventType: 'auth',
        moduleKey: 'auth',
        action: 'password_reset_failed',
        metadata: { source: 'reset_password_page', reason: err.message },
      })
      setLoading(false)
      return
    }

    trackEvent({
      eventType: 'auth',
      moduleKey: 'auth',
      action: 'password_reset_completed',
      metadata: { source: 'reset_password_page' },
    })

    phaseRef.current = 'success'
    setPhase('success')
    setLoading(false)

    // Sign out to clear recovery session, then let user log in fresh
    await supabase.auth.signOut()
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 50%, #f0fdf4 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem', fontFamily: 'DM Sans, sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 40, height: 40, background: '#3b82f6', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Warehouse size={20} color="#fff" />
            </div>
            <span style={{ fontSize: 22, fontWeight: 700, color: '#111827', fontFamily: 'DM Mono, monospace', letterSpacing: '-0.5px' }}>
              magzic
            </span>
          </div>
          <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>Nowe hasło</p>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: 32, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>

          {/* ── Checking ── */}
          {phase === 'checking' && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <Loader2 size={32} style={{ color: '#3b82f6', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
              <p style={{ color: '#6b7280', fontSize: 14 }}>Weryfikacja linku…</p>
            </div>
          )}

          {/* ── Invalid / expired ── */}
          {phase === 'invalid' && (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{
                width: 56, height: 56, background: '#fef2f2', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
              }}>
                <XCircle size={28} style={{ color: '#ef4444' }} />
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: '#111827', margin: '0 0 10px' }}>
                Link wygasł lub jest nieprawidłowy
              </h2>
              <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.6, margin: '0 0 24px' }}>
                Linki resetowania hasła są ważne przez 1 godzinę i mogą być użyte tylko raz.
                Wyślij nowy link, jeśli potrzebujesz zmienić hasło.
              </p>
              <Link
                to="/forgot-password"
                style={{
                  display: 'inline-block', padding: '10px 20px',
                  background: '#3b82f6', color: '#fff', borderRadius: 8,
                  fontSize: 14, fontWeight: 600, textDecoration: 'none',
                }}
              >
                Wyślij nowy link
              </Link>
            </div>
          )}

          {/* ── Success ── */}
          {phase === 'success' && (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{
                width: 56, height: 56, background: '#f0fdf4', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
              }}>
                <CheckCircle2 size={28} style={{ color: '#16a34a' }} />
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: '#111827', margin: '0 0 10px' }}>
                Hasło zostało zmienione
              </h2>
              <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.6, margin: '0 0 24px' }}>
                Twoje nowe hasło jest aktywne. Możesz się teraz zalogować.
              </p>
              <Link
                to="/login"
                style={{
                  display: 'inline-block', padding: '10px 20px',
                  background: '#3b82f6', color: '#fff', borderRadius: 8,
                  fontSize: 14, fontWeight: 600, textDecoration: 'none',
                }}
              >
                Przejdź do logowania
              </Link>
            </div>
          )}

          {/* ── Form ── */}
          {phase === 'ready' && (
            <>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: '#111827', margin: '0 0 8px' }}>
                  Ustaw nowe hasło
                </h2>
                <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>
                  Wpisz nowe hasło dla swojego konta.
                </p>
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }} noValidate>
                {error && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 14 }}>
                    {error}
                  </div>
                )}

                {/* New password */}
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
                    Nowe hasło
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      autoFocus
                      placeholder="••••••••"
                      style={{ ...inputStyle, paddingRight: 40, borderColor: password && !allRulesPassed ? '#fca5a5' : '#d1d5db' }}
                      onFocus={e => e.target.style.borderColor = '#3b82f6'}
                      onBlur={e => e.target.style.borderColor = password && !allRulesPassed ? '#fca5a5' : '#d1d5db'}
                    />
                    <button type="button" tabIndex={-1} onClick={() => setShowPass(v => !v)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#9ca3af', display: 'flex', alignItems: 'center' }}>
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  {/* Strength bar */}
                  {password.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ display: 'flex', gap: 3, marginBottom: 4 }}>
                        {[0, 1, 2, 3].map(i => (
                          <div key={i} style={{
                            flex: 1, height: 3, borderRadius: 2,
                            background: i <= passStrength.level ? passStrength.color : '#e5e7eb',
                            transition: 'background 0.2s',
                          }} />
                        ))}
                      </div>
                      <p style={{ fontSize: 12, color: passStrength.color, margin: 0 }}>
                        {passStrength.label}
                      </p>
                    </div>
                  )}

                  {/* Rules checklist */}
                  {password.length > 0 && (
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {rules.map(r => (
                        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {r.passed
                            ? <Check size={13} style={{ color: '#16a34a', flexShrink: 0 }} />
                            : <X size={13} style={{ color: '#ef4444', flexShrink: 0 }} />}
                          <span style={{ fontSize: 12, color: r.passed ? '#16a34a' : '#6b7280' }}>{r.label}</span>
                        </div>
                      ))}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {SPECIAL_RULE.test(password)
                          ? <Check size={13} style={{ color: '#16a34a', flexShrink: 0 }} />
                          : <span style={{ width: 13, height: 13, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#d1d5db' }} />
                            </span>}
                        <span style={{ fontSize: 12, color: SPECIAL_RULE.test(password) ? '#16a34a' : '#9ca3af' }}>
                          {SPECIAL_RULE.label}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm password */}
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
                    Powtórz nowe hasło
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showConf ? 'text' : 'password'}
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      required
                      placeholder="••••••••"
                      style={{
                        ...inputStyle, paddingRight: 40,
                        borderColor: confirm && !passwordsMatch ? '#fca5a5' : '#d1d5db',
                      }}
                      onFocus={e => e.target.style.borderColor = '#3b82f6'}
                      onBlur={e => e.target.style.borderColor = confirm && !passwordsMatch ? '#fca5a5' : '#d1d5db'}
                    />
                    <button type="button" tabIndex={-1} onClick={() => setShowConf(v => !v)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#9ca3af', display: 'flex', alignItems: 'center' }}>
                      {showConf ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {confirm && !passwordsMatch && (
                    <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>Hasła muszą być identyczne.</p>
                  )}
                  {confirm && passwordsMatch && confirm.length > 0 && (
                    <p style={{ color: '#16a34a', fontSize: 12, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Check size={12} /> Hasła są zgodne
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!canSubmit || loading}
                  style={{
                    width: '100%', padding: '11px',
                    background: !canSubmit || loading ? '#93c5fd' : '#3b82f6',
                    color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600,
                    cursor: !canSubmit || loading ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'background 0.15s',
                  }}
                >
                  {loading && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
                  {loading ? 'Zapisywanie…' : 'Ustaw nowe hasło'}
                </button>
              </form>
            </>
          )}
        </div>

        {phase !== 'success' && (
          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: '#6b7280' }}>
            Nie masz konta?{' '}
            <Link to="/register" style={{ color: '#3b82f6', fontWeight: 500, textDecoration: 'none' }}>
              Zarejestruj się
            </Link>
          </p>
        )}

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
}
