import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Warehouse, Package, FileText, Bell, Brain, BarChart3,
  History, Sparkles, ShieldCheck, Zap, AlertTriangle,
  CheckCircle2, ArrowRight, ChevronDown, Building2, Users,
  Wrench, Hotel, Home, Briefcase, Lock, Database, Eye, Server,
} from 'lucide-react'

/* ─── Reusable helpers ─────────────────────────────────── */
const btn = (bg, color, extra = {}) => ({
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '11px 22px', borderRadius: 8, fontWeight: 600,
  fontSize: 15, cursor: 'pointer', textDecoration: 'none',
  border: 'none', transition: 'all 0.18s', ...extra,
  background: bg, color,
})

/* ─── Sections ─────────────────────────────────────────── */
const PROBLEMS = [
  { icon: <Package size={24} color="#ef4444" />, title: 'Nie wiesz gdzie leży towar', desc: 'Szukasz po wszystkich magazynach, tracisz czas na pytania.' },
  { icon: <FileText size={24} color="#f59e0b" />, title: 'Ręczne liczenie zapasów', desc: 'Arkusze Excel, kartki, błędy — każda aktualizacja to praca.' },
  { icon: <Bell size={24} color="#ef4444" />, title: 'Brak alertów o niskich stanach', desc: 'Dowiadujesz się o brakach, gdy jest już za późno na zamówienie.' },
  { icon: <Zap size={24} color="#f59e0b" />, title: 'Opóźnione zamówienia', desc: 'Dostawcy czekają, goście się skarżą, Ty tłumaczysz powody.' },
]

const FEATURES = [
  { icon: <Warehouse size={20} color="#3b82f6" />, title: 'Stany magazynowe', desc: 'Aktualne ilości w każdym magazynie w jednym widoku.' },
  { icon: <Package size={20} color="#8b5cf6" />, title: 'Towary i kategorie', desc: 'Pełna baza z przypisaniem do magazynów i jednostek miary.' },
  { icon: <FileText size={20} color="#06b6d4" />, title: 'Faktury zakupowe', desc: 'Zatwierdź fakturę — stan aktualizuje się automatycznie.' },
  { icon: <Bell size={20} color="#ef4444" />, title: 'Alerty braków', desc: 'Powiadomienia gdy stan spada poniżej minimum.' },
  { icon: <Brain size={20} color="#10b981" />, title: 'Predykcja AI', desc: 'System przewiduje kiedy zabraknie danego towaru.' },
  { icon: <Sparkles size={20} color="#f59e0b" />, title: 'Pakiety sprzątania', desc: 'Jednym klikiem wydaj zestaw towarów na sprzątanie.' },
  { icon: <History size={20} color="#6b7280" />, title: 'Historia ruchów', desc: 'Pełny audit trail — kto co kiedy pobrał lub dodał.' },
  { icon: <BarChart3 size={20} color="#3b82f6" />, title: 'Dashboard i wykresy', desc: 'Widok ogólny z kluczowymi metrykami na głównym ekranie.' },
  { icon: <Brain size={20} color="#8b5cf6" />, title: 'AI rekomendacje', desc: 'Inteligentne sugestie zakupów i transferów między magazynami.' },
]

const AI_MESSAGES = [
  { emoji: '⚠️', color: '#fef3c7', border: '#fbbf24', text: 'Za 7 dni zabraknie papieru toaletowego w Magazynie Sprzątanie.' },
  { emoji: '📈', color: '#ede9fe', border: '#8b5cf6', text: 'Zużycie CLIN jest o 38% wyższe niż zwykle — rozważ zwiększenie zamówienia.' },
  { emoji: '💡', color: '#dbeafe', border: '#3b82f6', text: 'Przenieś 10 szt z Magazynu Głównego do Magazynu Sprzątanie — to wystarczy na miesiąc.' },
  { emoji: '✅', color: '#dcfce7', border: '#22c55e', text: 'Faktura FV/2025/088 zawiera produkty gotowe do dodania do magazynu.' },
]

const AUDIENCES = [
  { icon: <Building2 size={22} color="#3b82f6" />, title: 'Apartamenty', desc: 'Zarządzaj środkami czystości i wyposażeniem wielu lokali.' },
  { icon: <Users size={22} color="#8b5cf6" />, title: 'Housekeeping', desc: 'Planuj i realizuj sprzątanie z pełną kontrolą stanów.' },
  { icon: <Wrench size={22} color="#06b6d4" />, title: 'Technicy', desc: 'Zarządzaj narzędziami i częściami zamiennymi w terenie.' },
  { icon: <Hotel size={22} color="#10b981" />, title: 'Hotele', desc: 'Integruj wiele budynków i magazynów w jednym systemie.' },
  { icon: <Home size={22} color="#f59e0b" />, title: 'Najem krótkoterminowy', desc: 'Automatyczne alerty przed każdym przyjazdem gościa.' },
  { icon: <Briefcase size={22} color="#ef4444" />, title: 'Firmy serwisowe', desc: 'Kontrola zapasów konsumpcyjnych i zasobów techników.' },
]

const SECURITY = [
  { icon: <ShieldCheck size={20} color="#22c55e" />, title: 'Supabase Auth', desc: 'Bezpieczne logowanie z tokenami JWT i sesją po stronie serwera.' },
  { icon: <Lock size={20} color="#3b82f6" />, title: 'Szyfrowane połączenia', desc: 'Cały ruch przez HTTPS — dane w tranzycie są zawsze zaszyfrowane.' },
  { icon: <Database size={20} color="#8b5cf6" />, title: 'Row Level Security', desc: 'Każdy użytkownik widzi tylko swoje dane — na poziomie bazy danych.' },
  { icon: <Eye size={20} color="#f59e0b" />, title: 'Brak haseł w kodzie', desc: 'Żadnych sekretów w repozytorium — tylko zmienne środowiskowe.' },
  { icon: <Server size={20} color="#06b6d4" />, title: 'Separacja danych', desc: 'Dane różnych organizacji są logicznie odizolowane w bazie.' },
]

/* ─── Component ────────────────────────────────────────── */
export default function Landing() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function scrollTo(id) {
    setMobileMenuOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif', color: '#111827', background: '#fff' }}>

      {/* ── NAVBAR ─────────────────────────────────── */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: scrolled ? 'rgba(255,255,255,0.92)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: scrolled ? '1px solid #e5e7eb' : '1px solid transparent',
        transition: 'all 0.2s',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', gap: 32 }}>
          {/* Logo */}
          <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, background: '#3b82f6', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Warehouse size={18} color="#fff" />
            </div>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#111827', fontFamily: 'DM Mono, monospace', letterSpacing: '-0.5px' }}>magzic</span>
          </Link>

          {/* Desktop nav */}
          <nav style={{ display: 'flex', gap: 4, flex: 1 }} className="hidden-mobile">
            {[['funkcje', 'Funkcje'], ['ai', 'AI'], ['dla-kogo', 'Dla kogo'], ['bezpieczenstwo', 'Bezpieczeństwo']].map(([id, label]) => (
              <button key={id} onClick={() => scrollTo(id)}
                style={{ background: 'none', border: 'none', padding: '6px 14px', borderRadius: 6, fontSize: 14, fontWeight: 500, color: '#374151', cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.target.style.background = '#f3f4f6'; e.target.style.color = '#111827' }}
                onMouseLeave={e => { e.target.style.background = 'none'; e.target.style.color = '#374151' }}
              >
                {label}
              </button>
            ))}
          </nav>

          {/* Auth buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            <Link to="/login" style={{ padding: '8px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600, color: '#374151', textDecoration: 'none', border: '1px solid #d1d5db', background: '#fff', transition: 'all 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#3b82f6'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#d1d5db'}
            >
              Zaloguj się
            </Link>
            <Link to="/register" style={{ padding: '8px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600, color: '#fff', textDecoration: 'none', background: '#3b82f6', transition: 'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = '#2563eb'}
              onMouseLeave={e => e.currentTarget.style.background = '#3b82f6'}
            >
              Zarejestruj się
            </Link>
          </div>
        </div>
      </header>

      <style>{`
        @media (max-width: 768px) { .hidden-mobile { display: none !important; } }
        @media (max-width: 640px) { .hero-grid { grid-template-columns: 1fr !important; } .features-grid { grid-template-columns: 1fr 1fr !important; } }
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
      `}</style>

      {/* ── HERO ──────────────────────────────────── */}
      <section style={{ paddingTop: 120, paddingBottom: 96, background: 'linear-gradient(180deg, #eff6ff 0%, #fff 100%)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
          <div className="hero-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 64, alignItems: 'center' }}>
            {/* Left */}
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 20, padding: '5px 14px', fontSize: 13, color: '#2563eb', fontWeight: 600, marginBottom: 24 }}>
                <Brain size={14} /> Napędzany przez AI
              </div>
              <h1 style={{ fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 800, lineHeight: 1.15, color: '#111827', marginBottom: 20, letterSpacing: '-1px' }}>
                magzic — Twój<br />
                <span style={{ color: '#3b82f6' }}>interaktywny magazyn AI</span>
              </h1>
              <p style={{ fontSize: 18, color: '#6b7280', lineHeight: 1.7, marginBottom: 36, maxWidth: 480 }}>
                Zarządzaj towarami, magazynami, fakturami i zapasami z pomocą inteligentnych rekomendacji AI. Koniec z chaosem i ręcznym liczeniem.
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Link to="/register" style={{ ...btn('#3b82f6', '#fff'), fontSize: 16 }}
                  onMouseEnter={e => e.currentTarget.style.background = '#2563eb'}
                  onMouseLeave={e => e.currentTarget.style.background = '#3b82f6'}
                >
                  Rozpocznij teraz <ArrowRight size={17} />
                </Link>
                <button onClick={() => scrollTo('funkcje')} style={{ ...btn('#fff', '#374151', { border: '1px solid #d1d5db', fontSize: 16 }) }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.borderColor = '#9ca3af' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#d1d5db' }}
                >
                  Zobacz możliwości <ChevronDown size={17} />
                </button>
              </div>
            </div>

            {/* Right: Mockup card */}
            <div style={{ animation: 'float 4s ease-in-out infinite' }}>
              <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #e5e7eb', padding: 28, boxShadow: '0 20px 60px rgba(59,130,246,0.1), 0 4px 16px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                  <div style={{ width: 32, height: 32, background: '#3b82f6', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Warehouse size={16} color="#fff" />
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 16, fontFamily: 'DM Mono, monospace', color: '#111827' }}>magzic</span>
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9ca3af' }}>Dashboard</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                  {[
                    { label: 'Towary OK', value: 7, bg: '#f0fdf4', color: '#16a34a', dot: '#22c55e' },
                    { label: 'Niskie stany', value: 2, bg: '#fffbeb', color: '#d97706', dot: '#f59e0b' },
                    { label: 'Alerty krytyczne', value: 1, bg: '#fef2f2', color: '#dc2626', dot: '#ef4444' },
                    { label: 'Faktury do zatw.', value: 3, bg: '#eff6ff', color: '#2563eb', dot: '#3b82f6' },
                  ].map(s => (
                    <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.dot, display: 'inline-block' }} />
                        <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>{s.label}</span>
                      </div>
                      <span style={{ fontSize: 26, fontWeight: 800, color: s.color, fontFamily: 'DM Mono, monospace' }}>{s.value}</span>
                    </div>
                  ))}
                </div>

                <div style={{ background: '#fefce8', border: '1px solid #fbbf24', borderRadius: 10, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <Brain size={16} color="#d97706" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#d97706', marginBottom: 2 }}>AI Insight</p>
                    <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.5 }}>Za 7 dni zabraknie papieru toaletowego w Magazynie Sprzątanie</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PROBLEM ────────────────────────────────── */}
      <section style={{ padding: '96px 24px', background: '#f9fafb' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <h2 style={{ fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 800, color: '#111827', marginBottom: 16, letterSpacing: '-0.5px' }}>
              Chaos magazynowy kosztuje Cię<br />czas i pieniądze
            </h2>
            <p style={{ fontSize: 17, color: '#6b7280', maxWidth: 520, margin: '0 auto' }}>
              Znasz te problemy? magzic rozwiązuje je wszystkie w jednym miejscu.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
            {PROBLEMS.map(p => (
              <div key={p.title} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ width: 44, height: 44, background: '#f9fafb', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, border: '1px solid #e5e7eb' }}>
                  {p.icon}
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 8 }}>{p.title}</h3>
                <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────── */}
      <section id="funkcje" style={{ padding: '96px 24px', background: '#fff' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <h2 style={{ fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 800, color: '#111827', marginBottom: 16, letterSpacing: '-0.5px' }}>
              Wszystko czego potrzebujesz<br />w jednym miejscu
            </h2>
            <p style={{ fontSize: 17, color: '#6b7280', maxWidth: 480, margin: '0 auto' }}>
              Kompleksowy system zarządzania magazynem z inteligentną warstwą AI.
            </p>
          </div>

          <div className="features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{ background: '#f8fafc', borderRadius: 14, border: '1px solid #e5e7eb', padding: '22px 22px', transition: 'box-shadow 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(59,130,246,0.1)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
              >
                <div style={{ width: 40, height: 40, background: '#fff', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  {f.icon}
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 6 }}>{f.title}</h3>
                <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AI SECTION ──────────────────────────────── */}
      <section id="ai" style={{ padding: '96px 24px', background: 'linear-gradient(135deg, #eff6ff 0%, #f5f3ff 100%)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }} className="hero-grid">
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 20, padding: '5px 14px', fontSize: 13, color: '#7c3aed', fontWeight: 600, marginBottom: 20 }}>
                <Brain size={14} /> Sztuczna inteligencja
              </div>
              <h2 style={{ fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 800, color: '#111827', marginBottom: 20, letterSpacing: '-0.5px', lineHeight: 1.2 }}>
                Sztuczna inteligencja która rozumie Twój magazyn
              </h2>
              <p style={{ fontSize: 16, color: '#6b7280', lineHeight: 1.7, marginBottom: 28 }}>
                magzic analizuje historię zużycia, tempo rotacji towarów i wzorce sezonowe — i daje Ci gotowe rekomendacje, zanim pojawi się problem.
              </p>
              <Link to="/register" style={{ ...btn('#3b82f6', '#fff') }}
                onMouseEnter={e => e.currentTarget.style.background = '#2563eb'}
                onMouseLeave={e => e.currentTarget.style.background = '#3b82f6'}
              >
                Wypróbuj AI <ArrowRight size={16} />
              </Link>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {AI_MESSAGES.map((m, i) => (
                <div key={i} style={{ background: m.color, border: `1px solid ${m.border}`, borderRadius: 12, padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'flex-start', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1.3 }}>{m.emoji}</span>
                  <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.55, margin: 0 }}>{m.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── DLA KOGO ──────────────────────────────── */}
      <section id="dla-kogo" style={{ padding: '96px 24px', background: '#fff' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <h2 style={{ fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 800, color: '#111827', marginBottom: 16, letterSpacing: '-0.5px' }}>
              Dla każdej firmy operacyjnej
            </h2>
            <p style={{ fontSize: 17, color: '#6b7280', maxWidth: 480, margin: '0 auto' }}>
              magzic dopasowuje się do Twojej branży i sposobu pracy z magazynem.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {AUDIENCES.map(a => (
              <div key={a.title} style={{ background: '#f8fafc', borderRadius: 14, border: '1px solid #e5e7eb', padding: 24, textAlign: 'center', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(59,130,246,0.08)'; e.currentTarget.style.borderColor = '#bfdbfe' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = '#e5e7eb' }}
              >
                <div style={{ width: 52, height: 52, background: '#fff', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  {a.icon}
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 6 }}>{a.title}</h3>
                <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BEZPIECZEŃSTWO ──────────────────────────── */}
      <section id="bezpieczenstwo" style={{ padding: '96px 24px', background: '#f9fafb' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <h2 style={{ fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 800, color: '#111827', marginBottom: 16, letterSpacing: '-0.5px' }}>
              Twoje dane są bezpieczne
            </h2>
            <p style={{ fontSize: 17, color: '#6b7280', maxWidth: 480, margin: '0 auto' }}>
              Zbudowany na sprawdzonych standardach bezpieczeństwa, by Twoje dane były zawsze pod ochroną.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, maxWidth: 900, margin: '0 auto' }}>
            {SECURITY.map(s => (
              <div key={s.title} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 36, height: 36, background: '#f0fdf4', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #bbf7d0', flexShrink: 0 }}>
                    {s.icon}
                  </div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{s.title}</h3>
                </div>
                <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ──────────────────────────────── */}
      <section style={{ padding: '96px 24px', background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #06b6d4 100%)' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(26px, 4vw, 44px)', fontWeight: 800, color: '#fff', marginBottom: 20, letterSpacing: '-0.5px', lineHeight: 1.2 }}>
            Zmień chaos magazynowy<br />w inteligentny system operacyjny.
          </h2>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.8)', marginBottom: 40, lineHeight: 1.6 }}>
            Dołącz do firm, które oszczędzają czas i pieniądze dzięki magzic. Zacznij za darmo już dziś.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/register" style={{ padding: '13px 28px', background: '#fff', color: '#2563eb', borderRadius: 10, fontWeight: 700, fontSize: 16, textDecoration: 'none', transition: 'all 0.15s', boxShadow: '0 4px 14px rgba(0,0,0,0.15)' }}
              onMouseEnter={e => e.currentTarget.style.background = '#f0f9ff'}
              onMouseLeave={e => e.currentTarget.style.background = '#fff'}
            >
              Zarejestruj się
            </Link>
            <Link to="/login" style={{ padding: '13px 28px', background: 'rgba(255,255,255,0.15)', color: '#fff', borderRadius: 10, fontWeight: 700, fontSize: 16, textDecoration: 'none', border: '1px solid rgba(255,255,255,0.3)', transition: 'all 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
            >
              Zaloguj się
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────── */}
      <footer style={{ background: '#111827', color: '#9ca3af', padding: '48px 24px 32px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 32, marginBottom: 40 }}>
            {/* Brand */}
            <div style={{ maxWidth: 280 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
                <div style={{ width: 30, height: 30, background: '#3b82f6', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Warehouse size={15} color="#fff" />
                </div>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#fff', fontFamily: 'DM Mono, monospace' }}>magzic</span>
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: '#6b7280' }}>
                Inteligentny system zarządzania magazynem z AI. Dla firm operacyjnych, które chcą działać sprawniej.
              </p>
            </div>

            {/* Links */}
            <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Produkt</p>
                {[['funkcje', 'Funkcje'], ['ai', 'AI'], ['bezpieczenstwo', 'Bezpieczeństwo']].map(([id, label]) => (
                  <button key={id} onClick={() => scrollTo(id)} style={{ display: 'block', background: 'none', border: 'none', fontSize: 14, color: '#6b7280', cursor: 'pointer', padding: '4px 0', transition: 'color 0.15s' }}
                    onMouseEnter={e => e.target.style.color = '#d1d5db'}
                    onMouseLeave={e => e.target.style.color = '#6b7280'}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Konto</p>
                {[['Zaloguj się', '/login'], ['Zarejestruj się', '/register']].map(([label, to]) => (
                  <Link key={to} to={to} style={{ display: 'block', fontSize: 14, color: '#6b7280', textDecoration: 'none', padding: '4px 0', transition: 'color 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#d1d5db'}
                    onMouseLeave={e => e.currentTarget.style.color = '#6b7280'}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #1f2937', paddingTop: 24, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <p style={{ fontSize: 13 }}>© 2025 magzic · blueapart.pl</p>
            <p style={{ fontSize: 13 }}>Zbudowany z ❤️ dla firm operacyjnych</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
