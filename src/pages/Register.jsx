import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Warehouse, Loader2, CheckCircle2, Eye, EyeOff } from 'lucide-react'

const SPECIAL_RE = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/

const inputStyle = (hasError) => ({
  width: '100%', padding: '10px 14px', fontSize: 14,
  border: `1px solid ${hasError ? '#ef4444' : '#d1d5db'}`,
  borderRadius: 8, outline: 'none', background: '#fff', color: '#111827',
  boxSizing: 'border-box', transition: 'border-color 0.15s',
})

function FieldError({ msg }) {
  if (!msg) return null
  return <p style={{ color: '#dc2626', fontSize: 12, marginTop: 4 }}>{msg}</p>
}

export default function Register() {
  const { user, signUp } = useAuth()
  const navigate = useNavigate()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true })
  }, [user, navigate])

  function validate() {
    const e = {}
    if (!firstName.trim()) e.firstName = 'Podaj imię.'
    if (!lastName.trim()) e.lastName = 'Podaj nazwisko.'
    if (!email.trim()) {
      e.email = 'Podaj adres e-mail.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      e.email = 'Podaj poprawny adres e-mail.'
    }
    if (!password) {
      e.password = 'Hasło musi mieć minimum 8 znaków.'
    } else if (password.length < 8) {
      e.password = 'Hasło musi mieć minimum 8 znaków.'
    } else if (!SPECIAL_RE.test(password)) {
      e.password = 'Hasło musi zawierać minimum jeden znak specjalny.'
    }
    if (password && confirm && password !== confirm) {
      e.confirm = 'Hasła nie są takie same.'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setServerError('')
    if (!validate()) return
    setLoading(true)
    const { error: err } = await signUp(email.trim(), password, firstName.trim(), lastName.trim())
    if (err) {
      const msg = err.message || ''
      if (msg.includes('already registered') || msg.includes('User already registered')) {
        setServerError('Konto z tym adresem e-mail już istnieje.')
      } else {
        setServerError(msg)
      }
    } else {
      setDone(true)
    }
    setLoading(false)
  }

  const eyeBtn = (show, toggle) => (
    <button
      type="button"
      onClick={toggle}
      tabIndex={-1}
      style={{
        position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        color: '#9ca3af', display: 'flex', alignItems: 'center',
      }}
    >
      {show ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  )

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 50%, #f0fdf4 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem', fontFamily: 'DM Sans, sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
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
          <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>Utwórz nowe konto</p>
        </div>

        {/* Card */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: 32, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          {done ? (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <CheckCircle2 size={48} color="#22c55e" style={{ margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: 18, fontWeight: 600, color: '#111827', marginBottom: 8 }}>
                Sprawdź swoją skrzynkę!
              </h3>
              <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
                Konto zostało utworzone. Sprawdź skrzynkę e-mail i potwierdź adres{' '}
                <strong>{email}</strong>, aby aktywować konto.
              </p>
              <Link
                to="/login"
                style={{ display: 'inline-block', padding: '10px 24px', background: '#3b82f6', color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}
              >
                Przejdź do logowania
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }} noValidate>
              {serverError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 14 }}>
                  {serverError}
                </div>
              )}

              {/* Imię + Nazwisko */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>Imię</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    placeholder="Jan"
                    style={inputStyle(!!errors.firstName)}
                    onFocus={e => e.target.style.borderColor = '#3b82f6'}
                    onBlur={e => e.target.style.borderColor = errors.firstName ? '#ef4444' : '#d1d5db'}
                  />
                  <FieldError msg={errors.firstName} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>Nazwisko</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    placeholder="Kowalski"
                    style={inputStyle(!!errors.lastName)}
                    onFocus={e => e.target.style.borderColor = '#3b82f6'}
                    onBlur={e => e.target.style.borderColor = errors.lastName ? '#ef4444' : '#d1d5db'}
                  />
                  <FieldError msg={errors.lastName} />
                </div>
              </div>

              {/* Email */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>Adres e-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="jan@firma.pl"
                  style={inputStyle(!!errors.email)}
                  onFocus={e => e.target.style.borderColor = '#3b82f6'}
                  onBlur={e => e.target.style.borderColor = errors.email ? '#ef4444' : '#d1d5db'}
                />
                <FieldError msg={errors.email} />
              </div>

              {/* Hasło */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>Hasło</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{ ...inputStyle(!!errors.password), paddingRight: 40 }}
                    onFocus={e => e.target.style.borderColor = '#3b82f6'}
                    onBlur={e => e.target.style.borderColor = errors.password ? '#ef4444' : '#d1d5db'}
                  />
                  {eyeBtn(showPass, () => setShowPass(v => !v))}
                </div>
                <FieldError msg={errors.password} />
              </div>

              {/* Potwierdź hasło */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>Potwierdź hasło</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    style={{ ...inputStyle(!!errors.confirm), paddingRight: 40 }}
                    onFocus={e => e.target.style.borderColor = '#3b82f6'}
                    onBlur={e => e.target.style.borderColor = errors.confirm ? '#ef4444' : '#d1d5db'}
                  />
                  {eyeBtn(showConfirm, () => setShowConfirm(v => !v))}
                </div>
                <FieldError msg={errors.confirm} />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', padding: '11px', background: loading ? '#93c5fd' : '#3b82f6',
                  color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: 8, transition: 'background 0.15s', marginTop: 4,
                }}
              >
                {loading && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
                {loading ? 'Rejestracja...' : 'Zarejestruj się'}
              </button>
            </form>
          )}
        </div>

        {!done && (
          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: '#6b7280' }}>
            Masz już konto?{' '}
            <Link to="/login" style={{ color: '#3b82f6', fontWeight: 500, textDecoration: 'none' }}>
              Zaloguj się
            </Link>
          </p>
        )}

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
}
