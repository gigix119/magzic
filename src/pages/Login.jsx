import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabase'
import { Warehouse, Loader2, Eye, EyeOff, CheckCircle2, MailWarning, KeyRound } from 'lucide-react'

const inputStyle = {
  width: '100%', padding: '10px 14px', fontSize: 14, border: '1px solid #d1d5db',
  borderRadius: 8, outline: 'none', background: '#fff', color: '#111827',
  boxSizing: 'border-box', transition: 'border-color 0.15s',
}

export default function Login() {
  const { user, signIn } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [emailNotConfirmed, setEmailNotConfirmed] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendDone, setResendDone] = useState(false)

  const verified = searchParams.get('verified') === '1'

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true })
  }, [user, navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setEmailNotConfirmed(false)
    setLoading(true)
    const { error: err } = await signIn(email, password)
    if (err) {
      const msg = err.message || ''
      if (
        msg.includes('email_not_confirmed') ||
        msg.toLowerCase().includes('email not confirmed') ||
        err.code === 'email_not_confirmed'
      ) {
        setEmailNotConfirmed(true)
      } else if (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials')) {
        setError('Nieprawidłowy adres e-mail lub hasło.')
      } else {
        setError(msg)
      }
      setLoading(false)
    }
  }

  async function handleResend() {
    setResendLoading(true)
    setResendDone(false)
    const { error: err } = await supabase.auth.resend({ type: 'signup', email })
    if (!err) setResendDone(true)
    setResendLoading(false)
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
          <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>Zaloguj się do swojego konta</p>
        </div>

        {/* Card */}
        <div className="auth-card" style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: 32, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          {verified && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
              <CheckCircle2 size={16} style={{ color: '#16a34a', flexShrink: 0 }} />
              <p style={{ color: '#15803d', fontSize: 14, margin: 0 }}>
                Adres e-mail został potwierdzony. Możesz się teraz zalogować.
              </p>
            </div>
          )}

          {emailNotConfirmed && (
            <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                <MailWarning size={16} style={{ color: '#ea580c', flexShrink: 0, marginTop: 1 }} />
                <p style={{ color: '#9a3412', fontSize: 14, margin: 0 }}>
                  Potwierdź adres e-mail, zanim się zalogujesz.
                </p>
              </div>
              {resendDone ? (
                <p style={{ color: '#15803d', fontSize: 13 }}>Link aktywacyjny został wysłany ponownie.</p>
              ) : (
                <button
                  onClick={handleResend}
                  disabled={resendLoading}
                  style={{
                    fontSize: 13, fontWeight: 600, color: '#ea580c', background: 'none',
                    border: '1px solid #fdba74', borderRadius: 6, padding: '6px 12px',
                    cursor: resendLoading ? 'not-allowed' : 'pointer',
                    opacity: resendLoading ? 0.7 : 1,
                  }}
                >
                  {resendLoading ? 'Wysyłanie...' : 'Wyślij ponownie link aktywacyjny'}
                </button>
              )}
            </div>
          )}

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
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="jan@firma.pl"
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#3b82f6'}
                onBlur={e => e.target.style.borderColor = '#d1d5db'}
              />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>
                  Hasło
                </label>
                <Link
                  to="/forgot-password"
                  style={{ fontSize: 12, color: '#6b7280', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                  onMouseEnter={e => e.currentTarget.style.color = '#3b82f6'}
                  onMouseLeave={e => e.currentTarget.style.color = '#6b7280'}
                >
                  <KeyRound size={11} />
                  Nie pamiętasz hasła?
                </Link>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  style={{ ...inputStyle, paddingRight: 40 }}
                  onFocus={e => e.target.style.borderColor = '#3b82f6'}
                  onBlur={e => e.target.style.borderColor = '#d1d5db'}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPass(v => !v)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    color: '#9ca3af', display: 'flex', alignItems: 'center',
                  }}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '11px', background: loading ? '#93c5fd' : '#3b82f6',
                color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 8, transition: 'background 0.15s',
              }}
            >
              {loading && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
              {loading ? 'Logowanie...' : 'Zaloguj się'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: '#6b7280' }}>
          Nie masz konta?{' '}
          <Link to="/register" style={{ color: '#3b82f6', fontWeight: 500, textDecoration: 'none' }}>
            Zarejestruj się
          </Link>
        </p>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
}
