import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Warehouse, Loader2, CheckCircle2, ArrowLeft, Mail } from 'lucide-react'
import { supabase } from '../supabase'
import { trackEvent } from '../utils/adminHelpers'

const inputStyle = {
  width: '100%', padding: '10px 14px', fontSize: 14, border: '1px solid #d1d5db',
  borderRadius: 8, outline: 'none', background: '#fff', color: '#111827',
  boxSizing: 'border-box', transition: 'border-color 0.15s',
}

export default function ForgotPassword() {
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    trackEvent({
      eventType: 'page_view',
      moduleKey: 'auth',
      action: 'forgot_password_opened',
      metadata: { source: 'forgot_password_page' },
    })
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) return
    setError('')
    setLoading(true)

    try {
      await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: window.location.origin + '/reset-password',
      })

      // Always show neutral success — never reveal whether email exists
      setSent(true)
      trackEvent({
        eventType: 'auth',
        moduleKey: 'auth',
        action: 'password_reset_requested',
        metadata: { source: 'forgot_password_page' },
      })
    } catch {
      setError('Wystąpił nieoczekiwany błąd. Spróbuj ponownie.')
      trackEvent({
        eventType: 'auth',
        moduleKey: 'auth',
        action: 'password_reset_request_failed',
        metadata: { source: 'forgot_password_page', reason: 'unexpected_error' },
      })
    } finally {
      setLoading(false)
    }
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
          <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>Resetowanie hasła</p>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: 32, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          {sent ? (
            /* ── Success state ── */
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{
                width: 56, height: 56, background: '#f0fdf4', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
              }}>
                <CheckCircle2 size={28} style={{ color: '#16a34a' }} />
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: '#111827', margin: '0 0 10px' }}>
                Sprawdź swoją skrzynkę
              </h2>
              <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.6, margin: '0 0 24px' }}>
                Jeśli konto z adresem <strong style={{ color: '#374151' }}>{email}</strong> istnieje,
                wysłaliśmy link resetowania hasła.
              </p>
              <p style={{ color: '#9ca3af', fontSize: 13, margin: '0 0 24px' }}>
                Link jest ważny przez 1 godzinę. Sprawdź również folder spam.
              </p>
              <Link
                to="/login"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  color: '#3b82f6', fontSize: 14, fontWeight: 500, textDecoration: 'none',
                }}
              >
                <ArrowLeft size={14} /> Wróć do logowania
              </Link>
            </div>
          ) : (
            /* ── Form state ── */
            <>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: '#111827', margin: '0 0 8px' }}>
                  Nie pamiętasz hasła?
                </h2>
                <p style={{ color: '#6b7280', fontSize: 14, margin: 0, lineHeight: 1.5 }}>
                  Podaj adres e-mail przypisany do konta. Wyślemy Ci link do ustawienia nowego hasła.
                </p>
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }} noValidate>
                {error && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 14 }}>
                    {error}
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
                    Adres e-mail
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      autoFocus
                      placeholder="jan@firma.pl"
                      style={{ ...inputStyle, paddingLeft: 36 }}
                      onFocus={e => e.target.style.borderColor = '#3b82f6'}
                      onBlur={e => e.target.style.borderColor = '#d1d5db'}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  style={{
                    width: '100%', padding: '11px', background: loading || !email.trim() ? '#93c5fd' : '#3b82f6',
                    color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600,
                    cursor: loading || !email.trim() ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'background 0.15s',
                  }}
                >
                  {loading && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
                  {loading ? 'Wysyłanie…' : 'Wyślij link resetowania hasła'}
                </button>
              </form>
            </>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: '#6b7280' }}>
          <Link to="/login" style={{ color: '#3b82f6', fontWeight: 500, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <ArrowLeft size={13} /> Wróć do logowania
          </Link>
        </p>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
}
