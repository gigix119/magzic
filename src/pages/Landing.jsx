import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Warehouse, FileText, Bell, Brain, BarChart3, History, Sparkles,
  ArrowRight, Building2, Wrench, Home, Briefcase,
  MapPin, Menu, X, TrendingDown, Receipt, Package,
  LayoutDashboard, TrendingUp, RefreshCw, Layers, Shield,
  Lock, Database,
} from 'lucide-react'

/* ── Scroll reveal ──────────────────────────────────────────── */
function useReveal(threshold = 0.08) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return [ref, visible]
}

function Reveal({ children, delay = 0, style = {} }) {
  const [ref, visible] = useReveal()
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'none' : 'translateY(22px)',
      transition: `opacity 0.6s ease ${delay}ms, transform 0.65s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
      ...style,
    }}>
      {children}
    </div>
  )
}

/* ── Data ───────────────────────────────────────────────────── */
const PROBLEMS = [
  { icon: MapPin,      color: '#ef4444', bg: '#fef2f2', border: '#fca5a5', title: 'Nie wiadomo, gdzie jest towar',       desc: 'Towar jest w firmie, ale nikt nie wie w którym magazynie, lokalu albo u którego pracownika.' },
  { icon: TrendingDown,color: '#f59e0b', bg: '#fffbeb', border: '#fcd34d', title: 'Braki wychodzą za późno',             desc: 'Dowiadujesz się o problemie dopiero wtedy, gdy ktoś nie może wykonać pracy.' },
  { icon: Receipt,     color: '#8b5cf6', bg: '#f5f3ff', border: '#c4b5fd', title: 'Faktury nie aktualizują stanów',      desc: 'Zakupy są w dokumentach, ale magazyn nadal żyje własnym życiem.' },
  { icon: History,     color: '#06b6d4', bg: '#ecfeff', border: '#67e8f9', title: 'Pobrania bez historii',               desc: 'Nie wiadomo kto, kiedy i ile pobrał — więc nie da się kontrolować zużycia.' },
  { icon: FileText,    color: '#10b981', bg: '#f0fdf4', border: '#6ee7b7', title: 'Za dużo Excela',                      desc: 'Stany są rozbite między arkusze, wiadomości, faktury i pamięć pracowników.' },
  { icon: Brain,       color: '#3b82f6', bg: '#eff6ff', border: '#93c5fd', title: 'Brak prognozy',                       desc: 'Firma reaguje po fakcie, zamiast wiedzieć wcześniej, co trzeba uzupełnić.' },
]

const HOW_STEPS = [
  { num: '01', icon: Package,    color: '#3b82f6', bg: '#eff6ff', title: 'Dodajesz towary, lokalizacje i magazyny',          desc: 'Budujesz strukturę firmy: co masz, gdzie to trzymasz, jak to mierzysz.' },
  { num: '02', icon: RefreshCw,  color: '#8b5cf6', bg: '#f5f3ff', title: 'System śledzi stany, pobrania, faktury i ruchy',   desc: 'Każda zmiana jest rejestrowana. Nic nie ginie, nic nie jest z pamięci.' },
  { num: '03', icon: Brain,      color: '#06b6d4', bg: '#ecfeff', title: 'AI pokazuje alerty, prognozy i rekomendacje',      desc: 'Zanim zabraknie towaru, zanim pracownik zapyta — Magzic już wie.' },
]

const FEATURES = [
  { icon: Warehouse,      color: '#3b82f6', title: 'Stany per magazyn',           desc: 'Aktualne ilości w każdym miejscu, w jednym widoku.' },
  { icon: Package,        color: '#8b5cf6', title: 'Towary, kategorie i jednostki', desc: 'Baza produktów z kategoriami, jednostkami i minimami.' },
  { icon: FileText,       color: '#06b6d4', title: 'Faktury z odczytem AI',        desc: 'Zatwierdź fakturę — stany aktualizują się automatycznie.' },
  { icon: RefreshCw,      color: '#10b981', title: 'Automatyczna aktualizacja',    desc: 'Zatwierdzone faktury od razu odzwierciedlają się w magazynach.' },
  { icon: Bell,           color: '#ef4444', title: 'Alerty niskich stanów',        desc: 'Powiadomienie gdy towar spada poniżej minimum.' },
  { icon: History,        color: '#6b7280', title: 'Historia ruchów i pobrań',     desc: 'Kto, co, skąd, kiedy — pełny audit trail każdej zmiany.' },
  { icon: Brain,          color: '#f59e0b', title: 'Predykcja zużycia',            desc: 'AI przewiduje, kiedy zabraknie towaru na podstawie historii.' },
  { icon: TrendingUp,     color: '#3b82f6', title: 'Rekomendacje zamówień',        desc: 'System podpowiada co, ile i kiedy warto zamówić.' },
  { icon: Sparkles,       color: '#8b5cf6', title: 'Pakiety operacyjne',           desc: 'Jednym klikiem wydaj komplet produktów na operację.' },
  { icon: LayoutDashboard,color: '#06b6d4', title: 'Dashboard właściciela',        desc: 'Metryki, alerty i aktywność w jednym miejscu.' },
]

const AI_INSIGHTS = [
  { icon: '🚨', label: 'Alert krytyczny', lc: '#f87171', bg: 'rgba(239,68,68,0.08)',   bd: 'rgba(239,68,68,0.2)',   text: 'Papier toaletowy: 0 szt. w Zapleczu 2. Ryzyko zatrzymania operacji w ciągu 48h.',        action: 'Zamów teraz' },
  { icon: '⚠️', label: 'Prognoza braku',  lc: '#fbbf24', bg: 'rgba(245,158,11,0.08)',  bd: 'rgba(245,158,11,0.2)',  text: 'Za 7 dni zabraknie środka CLIN. Zużycie wzrosło o 42% vs. poprzedni miesiąc.',         action: 'Zaplanuj' },
  { icon: '💡', label: 'Rekomendacja',    lc: '#60a5fa', bg: 'rgba(59,130,246,0.08)',  bd: 'rgba(59,130,246,0.2)',  text: 'Przesuń 15 szt. środka X z Magazynu Głównego do Zaplecza 1 — wystarczy na 3 tygodnie.', action: 'Wykonaj' },
  { icon: '✅', label: 'Faktura gotowa',  lc: '#34d399', bg: 'rgba(34,197,94,0.08)',   bd: 'rgba(34,197,94,0.2)',   text: 'FV/2025/088 odczytana przez AI. 4 pozycje gotowe do zatwierdzenia w magazynie.',        action: 'Zatwierdź' },
]

const AUDIENCES = [
  { icon: Building2, color: '#3b82f6', title: 'Firmy z wieloma lokalizacjami',     desc: 'Kontrola stanów w biurach, magazynach, lokalach, punktach i zapleczach.' },
  { icon: Wrench,    color: '#f59e0b', title: 'Serwisy i ekipy terenowe',          desc: 'Wydawanie narzędzi, części i materiałów z pełną historią pobrań.' },
  { icon: Home,      color: '#8b5cf6', title: 'Aparthotele i najem krótkoterminowy', desc: 'Środki czystości, wyposażenie i zapasy pod wiele apartamentów.' },
  { icon: Warehouse, color: '#06b6d4', title: 'Małe magazyny i zaplecza',          desc: 'Prosty WMS bez korporacyjnego ciężaru — działa od razu.' },
  { icon: Briefcase, color: '#10b981', title: 'Firmy utrzymania obiektów',         desc: 'Materiały eksploatacyjne, kontrola zużycia i alerty braków.' },
  { icon: Layers,    color: '#ef4444', title: 'Operacje bez magazyniera',          desc: 'Dla firm, gdzie magazynem zajmuje się każdy — system pilnuje porządku.' },
]

const OUTCOMES = [
  { stat: '1 system',  label: 'zamiast wielu arkuszy',   icon: LayoutDashboard, color: '#3b82f6', bg: 'rgba(59,130,246,0.08)',   desc: 'Szybciej znajdujesz towar, bo wszystko jest w jednym miejscu.' },
  { stat: '24/7',      label: 'widoczność stanów',       icon: BarChart3,       color: '#10b981', bg: 'rgba(16,185,129,0.08)',   desc: 'Wiesz, co trzeba zamówić zanim pojawi się brak.' },
  { stat: 'AI',        label: 'alerty przed problemem',  icon: Brain,           color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)',   desc: 'System pilnuje operacji zanim problem uderzy w pracę.' },
  { stat: '100%',      label: 'historii ruchów',         icon: History,         color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',   desc: 'Nie opierasz operacji na pamięci ludzi i Excelu.' },
]

const NAV_LINKS = [
  ['problem',  'Problem'],
  ['funkcje',  'Funkcje'],
  ['ai',       'AI'],
  ['dla-kogo', 'Dla kogo'],
  ['bezpieczenstwo', 'Bezpieczeństwo'],
]

/* ── Component ──────────────────────────────────────────────── */
export default function Landing() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function scrollTo(id) {
    setMobileOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif', color: '#111827', background: '#fff', overflowX: 'hidden' }}>

      {/* ── GLOBAL STYLES ──────────────────────────────────── */}
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        @keyframes float     { 0%,100%{ transform: translateY(0); }   50%{ transform: translateY(-12px); } }
        @keyframes glow-orb  { 0%,100%{ opacity: .35; transform: scale(1); } 50%{ opacity: .6; transform: scale(1.05); } }
        @keyframes blink     { 0%,100%{ opacity: 1; }  50%{ opacity: .2; } }
        @keyframes hero-up   { from{ opacity:0; transform: translateY(24px); } to{ opacity:1; transform: none; } }
        @keyframes hero-right{ from{ opacity:0; transform: translateX(32px); } to{ opacity:1; transform: none; } }
        @keyframes spin-slow { to{ transform: rotate(360deg); } }

        .ha { animation: hero-up    .75s cubic-bezier(.16,1,.3,1) both; }
        .hb { animation: hero-up    .75s cubic-bezier(.16,1,.3,1) .1s  both; }
        .hc { animation: hero-up    .75s cubic-bezier(.16,1,.3,1) .22s both; }
        .hd { animation: hero-up    .75s cubic-bezier(.16,1,.3,1) .34s both; }
        .he { animation: hero-up    .75s cubic-bezier(.16,1,.3,1) .46s both; }
        .hf { animation: hero-right .85s cubic-bezier(.16,1,.3,1) .3s  both; }

        .nav-btn {
          background: none; border: none; padding: 7px 13px; border-radius: 7px;
          font-size: 14px; font-weight: 500; cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          transition: background .15s, color .15s;
        }

        .card-lift {
          transition: transform .22s cubic-bezier(.4,0,.2,1), box-shadow .22s, border-color .22s;
        }
        .card-lift:hover { transform: translateY(-4px); }

        .feat-card { transition: all .2s; }
        .feat-card:hover {
          background: #fff !important;
          box-shadow: 0 8px 28px rgba(59,130,246,.1) !important;
          transform: translateY(-3px);
          border-color: #bfdbfe !important;
        }

        .ai-row { transition: background .18s, border-color .18s; cursor: default; }
        .ai-row:hover {
          background: rgba(255,255,255,.09) !important;
          border-color: rgba(255,255,255,.18) !important;
        }

        .prog-bar { transition: width .4s ease; }

        /* Responsive */
        .desk { display: flex; }
        .mob  { display: none; }

        @media (max-width: 1023px) {
          .desk { display: none !important; }
          .mob  { display: flex !important; }
        }
        @media (max-width: 1023px) {
          .hero-grid   { grid-template-columns: 1fr !important; }
          .ai-grid     { grid-template-columns: 1fr !important; gap: 48px !important; }
          .how-grid    { grid-template-columns: 1fr !important; gap: 48px !important; }
          .feat-grid   { grid-template-columns: repeat(2,1fr) !important; }
          .prob-grid   { grid-template-columns: repeat(2,1fr) !important; }
          .aud-grid    { grid-template-columns: repeat(2,1fr) !important; }
          .out-grid    { grid-template-columns: repeat(2,1fr) !important; }
          .trust-grid  { flex-wrap: wrap; gap: 14px !important; justify-content: center !important; }
        }
        @media (max-width: 600px) {
          .feat-grid   { grid-template-columns: 1fr !important; }
          .prob-grid   { grid-template-columns: 1fr !important; }
          .aud-grid    { grid-template-columns: 1fr !important; }
          .out-grid    { grid-template-columns: 1fr !important; }
          .hero-cta    { flex-direction: column !important; align-items: stretch !important; }
          .hero-cta a, .hero-cta button { text-align: center !important; justify-content: center !important; }
        }
      `}</style>

      {/* ══ NAVBAR ════════════════════════════════════════════ */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        background: scrolled ? 'rgba(255,255,255,0.94)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(229,231,235,.8)' : '1px solid transparent',
        boxShadow: scrolled ? '0 2px 24px rgba(0,0,0,.07)' : 'none',
        transition: 'all .3s ease',
      }}>
        <div style={{ maxWidth: 1240, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', gap: 8 }}>

          {/* Logo */}
          <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg,#3b82f6,#2563eb)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(59,130,246,.4)' }}>
              <Warehouse size={18} color="#fff" />
            </div>
            <span style={{ fontSize: 18, fontWeight: 700, fontFamily: 'DM Mono, monospace', letterSpacing: '-.5px', color: scrolled ? '#111827' : '#fff', transition: 'color .3s' }}>
              Magzic
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="desk" style={{ gap: 2, flex: 1, marginLeft: 20 }}>
            {NAV_LINKS.map(([id, label]) => (
              <button key={id} className="nav-btn" onClick={() => scrollTo(id)}
                style={{ color: scrolled ? '#374151' : '#cbd5e1' }}
                onMouseEnter={e => { e.currentTarget.style.background = scrolled ? '#f3f4f6' : 'rgba(255,255,255,.1)'; e.currentTarget.style.color = scrolled ? '#111827' : '#fff' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = scrolled ? '#374151' : '#cbd5e1' }}
              >
                {label}
              </button>
            ))}
          </nav>

          {/* Desktop auth */}
          <div className="desk" style={{ alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            <Link to="/login"
              style={{ padding: '8px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none', transition: 'all .2s', display: 'inline-block', border: scrolled ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,.25)', color: scrolled ? '#374151' : '#e2e8f0', background: 'transparent' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.color = '#2563eb'; e.currentTarget.style.background = scrolled ? '#fff' : 'rgba(255,255,255,.08)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = scrolled ? '#e5e7eb' : 'rgba(255,255,255,.25)'; e.currentTarget.style.color = scrolled ? '#374151' : '#e2e8f0'; e.currentTarget.style.background = 'transparent' }}
            >
              Zaloguj się
            </Link>
            <Link to="/register"
              style={{ padding: '8px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, color: '#fff', textDecoration: 'none', background: 'linear-gradient(135deg,#3b82f6,#2563eb)', boxShadow: '0 2px 8px rgba(59,130,246,.4)', transition: 'all .2s', display: 'inline-block' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(59,130,246,.55)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(59,130,246,.4)' }}
            >
              Zarejestruj się
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="mob"
            onClick={() => setMobileOpen(v => !v)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: scrolled ? '#374151' : '#e2e8f0', alignItems: 'center', justifyContent: 'center', transition: 'color .3s' }}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile dropdown */}
        {mobileOpen && (
          <div style={{ background: '#0d1526', borderTop: '1px solid rgba(255,255,255,.08)', padding: '8px 24px 20px' }}>
            {NAV_LINKS.map(([id, label]) => (
              <button key={id} onClick={() => scrollTo(id)}
                style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '13px 0', fontSize: 16, fontWeight: 500, color: '#cbd5e1', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,.06)', fontFamily: 'DM Sans, sans-serif' }}
              >{label}</button>
            ))}
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Link to="/login" onClick={() => setMobileOpen(false)} style={{ textAlign: 'center', padding: '12px', borderRadius: 9, fontSize: 15, fontWeight: 600, color: '#e2e8f0', textDecoration: 'none', border: '1px solid rgba(255,255,255,.18)' }}>Zaloguj się</Link>
              <Link to="/register" onClick={() => setMobileOpen(false)} style={{ textAlign: 'center', padding: '12px', borderRadius: 9, fontSize: 15, fontWeight: 600, color: '#fff', textDecoration: 'none', background: 'linear-gradient(135deg,#3b82f6,#2563eb)' }}>Zarejestruj się</Link>
            </div>
          </div>
        )}
      </header>

      {/* ══ HERO (dark) ════════════════════════════════════════ */}
      <section style={{
        paddingTop: 120, paddingBottom: 112, position: 'relative', overflow: 'hidden',
        background: '#080e1e',
        backgroundImage: 'linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }}>
        {/* Glow orbs */}
        <div style={{ position: 'absolute', top: -120, right: -60, width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,.16) 0%, transparent 65%)', animation: 'glow-orb 6s ease-in-out infinite', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -80, left: -100, width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,.13) 0%, transparent 65%)', animation: 'glow-orb 8s ease-in-out infinite 2s', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '40%', left: '30%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,182,212,.08) 0%, transparent 65%)', animation: 'glow-orb 7s ease-in-out infinite 4s', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 1240, margin: '0 auto', padding: '0 24px', position: 'relative' }}>
          <div className="hero-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 500px', gap: 72, alignItems: 'center' }}>

            {/* Left — text */}
            <div>
              <div className="ha" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(59,130,246,.1)', border: '1px solid rgba(59,130,246,.3)', borderRadius: 24, padding: '6px 15px', fontSize: 12.5, color: '#93c5fd', fontWeight: 700, marginBottom: 28, letterSpacing: '.3px', textTransform: 'uppercase' }}>
                <Brain size={12} /> Napędzany przez AI
              </div>

              <h1 className="hb" style={{ fontSize: 'clamp(36px,5.5vw,64px)', fontWeight: 800, lineHeight: 1.08, color: '#f8fafc', marginBottom: 10, letterSpacing: '-2px' }}>
                Koniec zgadywania.
              </h1>
              <h1 className="hc" style={{ fontSize: 'clamp(36px,5.5vw,64px)', fontWeight: 800, lineHeight: 1.08, letterSpacing: '-2px', marginBottom: 28, background: 'linear-gradient(135deg, #60a5fa 0%, #a78bfa 60%, #38bdf8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                Magzic pilnuje<br />Twojego magazynu.
              </h1>

              <p className="hd" style={{ fontSize: 18, color: '#94a3b8', lineHeight: 1.75, marginBottom: 36, maxWidth: 520 }}>
                Zarządzaj towarami, lokalizacjami, fakturami i pobraniami w jednym systemie. AI analizuje zużycie, wykrywa braki i podpowiada decyzje zanim problem uderzy w operacje.
              </p>

              <div className="he hero-cta" style={{ display: 'flex', gap: 12, marginBottom: 22 }}>
                <Link to="/register"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 28px', background: 'linear-gradient(135deg,#3b82f6,#2563eb)', color: '#fff', borderRadius: 10, fontWeight: 700, fontSize: 16, textDecoration: 'none', boxShadow: '0 4px 20px rgba(59,130,246,.5)', transition: 'all .2s' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(59,130,246,.65)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(59,130,246,.5)' }}
                >
                  Rozpocznij teraz <ArrowRight size={17} />
                </Link>
                <button onClick={() => scrollTo('funkcje')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 28px', background: 'rgba(255,255,255,.07)', color: '#e2e8f0', borderRadius: 10, fontWeight: 600, fontSize: 16, border: '1px solid rgba(255,255,255,.18)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', backdropFilter: 'blur(4px)', transition: 'all .2s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.13)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.3)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.07)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.18)' }}
                >
                  Zobacz, jak działa
                </button>
              </div>
              <p className="hf" style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
                Dla firm z magazynem, ekipami, lokalizacjami i codziennym obiegiem towaru.
              </p>
            </div>

            {/* Right — dashboard mockup */}
            <div className="hf" style={{ animation: 'float 5.5s ease-in-out infinite' }}>
              <div style={{ position: 'relative' }}>
                {/* Glow behind card */}
                <div style={{ position: 'absolute', inset: -24, background: 'radial-gradient(circle, rgba(59,130,246,.22) 0%, transparent 70%)', filter: 'blur(20px)', pointerEvents: 'none' }} />

                {/* Main card */}
                <div style={{ position: 'relative', background: '#fff', borderRadius: 20, border: '1px solid rgba(59,130,246,.15)', overflow: 'hidden', boxShadow: '0 40px 90px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.06), inset 0 1px 0 rgba(255,255,255,.9)' }}>

                  {/* Window chrome */}
                  <div style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 5 }}>
                      {['#ef4444','#fbbf24','#22c55e'].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}
                    </div>
                    <span style={{ flex: 1, textAlign: 'center', fontSize: 11, color: '#9ca3af', fontFamily: 'DM Mono, monospace' }}>magzic · dashboard</span>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', animation: 'blink 2s ease-in-out infinite' }} />
                  </div>

                  {/* App layout */}
                  <div style={{ display: 'flex' }}>
                    {/* Mini sidebar */}
                    <div style={{ width: 44, borderRight: '1px solid #f1f5f9', padding: '14px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, background: '#fafafa', flexShrink: 0 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 7, background: 'rgba(59,130,246,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <LayoutDashboard size={13} color="#3b82f6" />
                      </div>
                      {[Package, FileText, Bell].map((Icon, i) => (
                        <div key={i} style={{ width: 30, height: 30, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon size={13} color="#d1d5db" />
                        </div>
                      ))}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, padding: '16px 16px 18px' }}>
                      {/* Stats 2×2 */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                        {[
                          { label: 'Towary OK',    value: '47', bg: '#f0fdf4', color: '#16a34a', dot: '#22c55e' },
                          { label: 'Niskie stany', value: '5',  bg: '#fffbeb', color: '#d97706', dot: '#fbbf24' },
                          { label: 'Alerty',       value: '2',  bg: '#fef2f2', color: '#dc2626', dot: '#ef4444' },
                          { label: 'Faktury',      value: '1',  bg: '#eff6ff', color: '#2563eb', dot: '#3b82f6' },
                        ].map(s => (
                          <div key={s.label} style={{ background: s.bg, borderRadius: 9, padding: '10px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, display: 'inline-block', flexShrink: 0 }} />
                              <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 600 }}>{s.label}</span>
                            </div>
                            <span style={{ fontSize: 26, fontWeight: 800, color: s.color, fontFamily: 'DM Mono, monospace', lineHeight: 1 }}>{s.value}</span>
                          </div>
                        ))}
                      </div>

                      {/* Locations */}
                      <div style={{ marginBottom: 12 }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.5px' }}>Stany magazynowe</p>
                        {[
                          { name: 'Magazyn Główny', cur: 89, max: 120, pct: 74 },
                          { name: 'Zaplecze 1',     cur: 12, max: 50,  pct: 24, warn: true },
                          { name: 'Apartament A',   cur: 45, max: 60,  pct: 75 },
                        ].map(loc => (
                          <div key={loc.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                            <span style={{ fontSize: 10.5, color: '#374151', fontWeight: 500, width: 90, flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{loc.name}</span>
                            <div style={{ flex: 1, height: 5, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${loc.pct}%`, background: loc.warn ? '#f59e0b' : '#22c55e', borderRadius: 3 }} />
                            </div>
                            <span style={{ fontSize: 10, color: loc.warn ? '#d97706' : '#6b7280', fontFamily: 'DM Mono, monospace', flexShrink: 0, width: 32, textAlign: 'right' }}>{loc.cur}</span>
                          </div>
                        ))}
                      </div>

                      {/* AI strip */}
                      <div style={{ background: 'linear-gradient(135deg,#fefce8,#fffbeb)', border: '1px solid #fbbf24', borderRadius: 9, padding: '10px 12px', display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                        <div style={{ width: 26, height: 26, background: 'rgba(251,191,36,.15)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Brain size={13} color="#d97706" />
                        </div>
                        <div>
                          <p style={{ fontSize: 10, fontWeight: 700, color: '#d97706', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '.3px' }}>AI Insight</p>
                          <p style={{ fontSize: 11.5, color: '#374151', lineHeight: 1.5 }}>Za 7 dni zabraknie papieru w Zapleczu 1</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ══ PROBLEM ════════════════════════════════════════════ */}
      <section id="problem" style={{ padding: '96px 24px', background: '#f8fafc' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: 64 }}>
              <span style={{ display: 'inline-block', fontSize: 11.5, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#dc2626', background: '#fef2f2', padding: '5px 14px', borderRadius: 20, border: '1px solid #fca5a5', marginBottom: 18 }}>Problem</span>
              <h2 style={{ fontSize: 'clamp(28px,4vw,48px)', fontWeight: 800, color: '#111827', marginBottom: 16, letterSpacing: '-1px', lineHeight: 1.15 }}>
                Bez systemu ten chaos<br />jest normalny
              </h2>
              <p style={{ fontSize: 17, color: '#6b7280', maxWidth: 520, margin: '0 auto', lineHeight: 1.7 }}>
                Znasz te problemy? Magzic rozwiązuje je wszystkie — w jednym miejscu, bez wdrożeń i szkoleń.
              </p>
            </div>
          </Reveal>

          <div className="prob-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
            {PROBLEMS.map((p, i) => (
              <Reveal key={p.title} delay={i * 65}>
                <div className="card-lift" style={{ background: '#fff', borderRadius: 16, border: `1px solid ${p.border}`, padding: '26px 24px', boxShadow: '0 1px 3px rgba(0,0,0,.04)', height: '100%', borderLeft: `4px solid ${p.color}` }}>
                  <div style={{ width: 46, height: 46, background: p.bg, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                    <p.icon size={21} color={p.color} />
                  </div>
                  <h3 style={{ fontSize: 15.5, fontWeight: 700, color: '#111827', marginBottom: 9, lineHeight: 1.35 }}>{p.title}</h3>
                  <p style={{ fontSize: 13.5, color: '#6b7280', lineHeight: 1.65 }}>{p.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ JAK MAGZIC TO OGARNIA ══════════════════════════════ */}
      <section style={{ padding: '96px 24px', background: '#fff' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto' }}>
          <div className="how-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>

            {/* Left — steps */}
            <Reveal>
              <div>
                <span style={{ display: 'inline-block', fontSize: 11.5, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#2563eb', background: '#eff6ff', padding: '5px 14px', borderRadius: 20, border: '1px solid #bfdbfe', marginBottom: 20 }}>Jak to działa</span>
                <h2 style={{ fontSize: 'clamp(26px,4vw,44px)', fontWeight: 800, color: '#111827', marginBottom: 20, letterSpacing: '-1px', lineHeight: 1.15 }}>
                  Jak Magzic<br />to ogarnia
                </h2>
                <p style={{ fontSize: 17, color: '#6b7280', lineHeight: 1.72, marginBottom: 44 }}>
                  Magzic łączy klasyczny magazyn z warstwą AI. Nie tylko zapisuje dane — ale pomaga z nich podejmować decyzje.
                </p>

                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {/* Vertical connector line */}
                  <div style={{ position: 'absolute', left: 23, top: 48, bottom: 48, width: 2, background: 'linear-gradient(180deg, #3b82f6, #8b5cf6, #06b6d4)', borderRadius: 2, opacity: .3 }} />

                  {HOW_STEPS.map((step, i) => (
                    <div key={step.num} style={{ display: 'flex', gap: 20, paddingBottom: i < HOW_STEPS.length - 1 ? 36 : 0, position: 'relative' }}>
                      {/* Number circle */}
                      <div style={{ width: 48, height: 48, borderRadius: '50%', background: step.bg, border: `2px solid ${step.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative', zIndex: 1 }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: step.color, fontFamily: 'DM Mono, monospace' }}>{step.num}</span>
                      </div>
                      <div style={{ paddingTop: 8 }}>
                        <h3 style={{ fontSize: 15.5, fontWeight: 700, color: '#111827', marginBottom: 7, lineHeight: 1.35 }}>{step.title}</h3>
                        <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            {/* Right — flow visual */}
            <Reveal delay={150}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe', label: 'Wejście', title: 'Dane operacyjne', tags: ['Towary', 'Lokalizacje', 'Faktury', 'Pobrania'] },
                  { color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe', label: 'Przetwarzanie', title: 'System analizuje', tags: ['Stany', 'Historia', 'Ruchy', 'Trendy'] },
                  { color: '#06b6d4', bg: '#ecfeff', border: '#a5f3fc', label: 'AI Output', title: 'Inteligentne wyjście', tags: ['Alerty', 'Prognozy', 'Rekomendacje'] },
                ].map((fl, i) => (
                  <div key={fl.label} style={{ position: 'relative' }}>
                    <div style={{ background: fl.bg, border: `1px solid ${fl.border}`, borderRadius: 16, padding: '20px 22px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: fl.color, background: '#fff', padding: '3px 10px', borderRadius: 12, border: `1px solid ${fl.border}` }}>{fl.label}</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{fl.title}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                        {fl.tags.map(t => (
                          <span key={t} style={{ fontSize: 12.5, color: fl.color, background: '#fff', padding: '4px 12px', borderRadius: 20, border: `1px solid ${fl.border}`, fontWeight: 600 }}>{t}</span>
                        ))}
                      </div>
                    </div>
                    {i < 2 && (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
                        <div style={{ width: 2, height: 12, background: `linear-gradient(180deg, ${fl.color}, ${['#8b5cf6','#06b6d4','#06b6d4'][i]})`, borderRadius: 2, opacity: .4 }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Reveal>

          </div>
        </div>
      </section>

      {/* ══ FUNKCJE ════════════════════════════════════════════ */}
      <section id="funkcje" style={{ padding: '96px 24px', background: '#f8fafc' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: 64 }}>
              <span style={{ display: 'inline-block', fontSize: 11.5, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#2563eb', background: '#eff6ff', padding: '5px 14px', borderRadius: 20, border: '1px solid #bfdbfe', marginBottom: 18 }}>Możliwości</span>
              <h2 style={{ fontSize: 'clamp(28px,4vw,48px)', fontWeight: 800, color: '#111827', marginBottom: 16, letterSpacing: '-1px' }}>
                Wszystko, czego potrzebujesz
              </h2>
              <p style={{ fontSize: 17, color: '#6b7280', maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>
                Kompleksowy system WMS z inteligentną warstwą AI na każdym etapie operacji.
              </p>
            </div>
          </Reveal>

          <div className="feat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14 }}>
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 40}>
                <div className="feat-card" style={{ background: '#fff', borderRadius: 14, border: '1px solid #f1f5f9', padding: '20px 18px', height: '100%' }}>
                  <div style={{ width: 40, height: 40, background: '#f8fafc', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 13, border: '1px solid #e5e7eb' }}>
                    <f.icon size={18} color={f.color} />
                  </div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 7, lineHeight: 1.35 }}>{f.title}</h3>
                  <p style={{ fontSize: 12.5, color: '#6b7280', lineHeight: 1.65 }}>{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ AI SECTION (dark) ══════════════════════════════════ */}
      <section id="ai" style={{
        padding: '96px 24px', position: 'relative', overflow: 'hidden',
        background: '#080e1e',
        backgroundImage: 'linear-gradient(rgba(255,255,255,.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.02) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }}>
        <div style={{ position: 'absolute', top: '5%', right: '-5%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,.14) 0%, transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '5%', left: '-5%', width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,.1) 0%, transparent 65%)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 1240, margin: '0 auto', position: 'relative' }}>
          <div className="ai-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 72, alignItems: 'center' }}>

            {/* Left */}
            <Reveal>
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(139,92,246,.12)', border: '1px solid rgba(139,92,246,.3)', borderRadius: 24, padding: '6px 15px', fontSize: 12.5, color: '#a78bfa', fontWeight: 700, marginBottom: 24, letterSpacing: '.3px', textTransform: 'uppercase' }}>
                  <Brain size={12} /> Sztuczna inteligencja
                </div>
                <h2 style={{ fontSize: 'clamp(28px,4vw,48px)', fontWeight: 800, color: '#fff', marginBottom: 20, letterSpacing: '-1px', lineHeight: 1.15 }}>
                  AI, która nie gada<br />dla ozdoby.
                </h2>
                <p style={{ fontSize: 17, color: '#64748b', lineHeight: 1.75, marginBottom: 16 }}>
                  Magzic analizuje zużycie, historię pobrań i aktualne stany — i podpowiada:
                </p>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 36 }}>
                  {['co zamówić i kiedy', 'gdzie przesunąć towar', 'które braki zaraz zatrzymają pracę', 'które faktury są gotowe do zatwierdzenia'].map(t => (
                    <li key={t} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, color: '#94a3b8' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#a78bfa', flexShrink: 0 }} />
                      {t}
                    </li>
                  ))}
                </ul>
                <Link to="/register"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 26px', background: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', color: '#fff', borderRadius: 10, fontWeight: 700, fontSize: 15, textDecoration: 'none', boxShadow: '0 4px 18px rgba(139,92,246,.45)', transition: 'all .2s' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(139,92,246,.6)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 18px rgba(139,92,246,.45)' }}
                >
                  Wypróbuj AI <ArrowRight size={16} />
                </Link>
              </div>
            </Reveal>

            {/* Right — AI panel */}
            <Reveal delay={160}>
              <div style={{ background: 'rgba(255,255,255,.04)', borderRadius: 20, border: '1px solid rgba(255,255,255,.1)', overflow: 'hidden', backdropFilter: 'blur(12px)' }}>
                {/* Panel header */}
                <div style={{ background: 'rgba(139,92,246,.1)', borderBottom: '1px solid rgba(139,92,246,.2)', padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#a78bfa', animation: 'blink 1.8s ease-in-out infinite' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#c4b5fd', fontFamily: 'DM Mono, monospace', flex: 1 }}>Magzic AI · Centrum operacyjne</span>
                  <span style={{ fontSize: 11, color: '#475569', background: 'rgba(255,255,255,.06)', padding: '3px 9px', borderRadius: 12 }}>Live</span>
                </div>
                {/* Insights */}
                <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {AI_INSIGHTS.map((ins, i) => (
                    <div key={i} className="ai-row" style={{ background: ins.bg, border: `1px solid ${ins.bd}`, borderRadius: 12, padding: '13px 15px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 17, flexShrink: 0, lineHeight: 1.4 }}>{ins.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: ins.lc, letterSpacing: '.5px', textTransform: 'uppercase' }}>{ins.label}</span>
                        </div>
                        <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.55 }}>{ins.text}</p>
                      </div>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: ins.lc, flexShrink: 0, cursor: 'pointer', whiteSpace: 'nowrap', alignSelf: 'center', opacity: .85 }}>{ins.action} →</span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

          </div>
        </div>
      </section>

      {/* ══ DLA KOGO ════════════════════════════════════════════ */}
      <section id="dla-kogo" style={{ padding: '96px 24px', background: '#fff' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: 64 }}>
              <span style={{ display: 'inline-block', fontSize: 11.5, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#16a34a', background: '#f0fdf4', padding: '5px 14px', borderRadius: 20, border: '1px solid #bbf7d0', marginBottom: 18 }}>Dla kogo</span>
              <h2 style={{ fontSize: 'clamp(28px,4vw,48px)', fontWeight: 800, color: '#111827', marginBottom: 16, letterSpacing: '-1px' }}>
                Dla każdej firmy z obiegiem towaru
              </h2>
              <p style={{ fontSize: 17, color: '#6b7280', maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>
                Magzic dopasowuje się do Twojej branży — bez wdrożeń, bez szkoleń, bez korporacyjnego ciężaru.
              </p>
            </div>
          </Reveal>

          <div className="aud-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }}>
            {AUDIENCES.map((a, i) => (
              <Reveal key={a.title} delay={i * 65}>
                <div className="card-lift" style={{ background: '#fafafa', borderRadius: 16, border: '1px solid #f1f5f9', padding: '28px 24px', height: '100%' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#bfdbfe'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(59,130,246,.1)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fafafa'; e.currentTarget.style.borderColor = '#f1f5f9'; e.currentTarget.style.boxShadow = 'none' }}
                >
                  <div style={{ width: 52, height: 52, background: '#fff', borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18, border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
                    <a.icon size={22} color={a.color} />
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 8 }}>{a.title}</h3>
                  <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.65 }}>{a.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ EFEKT BIZNESOWY ════════════════════════════════════ */}
      <section style={{ padding: '96px 24px', background: 'linear-gradient(160deg, #eff6ff 0%, #f5f3ff 50%, #ecfeff 100%)' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: 64 }}>
              <span style={{ display: 'inline-block', fontSize: 11.5, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#7c3aed', background: '#f5f3ff', padding: '5px 14px', borderRadius: 20, border: '1px solid #ddd6fe', marginBottom: 18 }}>Efekt biznesowy</span>
              <h2 style={{ fontSize: 'clamp(28px,4vw,48px)', fontWeight: 800, color: '#111827', marginBottom: 16, letterSpacing: '-1px' }}>
                Mniej chaosu. Mniej braków.<br />Więcej kontroli.
              </h2>
              <p style={{ fontSize: 17, color: '#6b7280', maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>
                Konkretne rezultaty, które firmy operacyjne osiągają po wdrożeniu Magzic.
              </p>
            </div>
          </Reveal>

          <div className="out-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18 }}>
            {OUTCOMES.map((o, i) => (
              <Reveal key={o.stat} delay={i * 70}>
                <div className="card-lift" style={{ background: '#fff', borderRadius: 18, border: '1px solid rgba(255,255,255,.8)', padding: '32px 24px', textAlign: 'center', height: '100%', boxShadow: '0 2px 12px rgba(0,0,0,.05)' }}>
                  <div style={{ width: 56, height: 56, borderRadius: 14, background: o.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: `0 4px 14px ${o.bg}` }}>
                    <o.icon size={24} color={o.color} />
                  </div>
                  <div style={{ fontSize: 'clamp(28px,3vw,40px)', fontWeight: 800, color: o.color, fontFamily: 'DM Mono, monospace', lineHeight: 1, marginBottom: 6 }}>{o.stat}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.4px' }}>{o.label}</div>
                  <p style={{ fontSize: 13.5, color: '#6b7280', lineHeight: 1.6 }}>{o.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ CTA KOŃCOWE ════════════════════════════════════════ */}
      <section style={{
        padding: '100px 24px', position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg, #1e1b4b 0%, #1e3a8a 40%, #0c4a6e 100%)',
      }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 800, height: 800, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,.1) 0%, transparent 60%)', pointerEvents: 'none' }} />
        <Reveal>
          <div style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
            <h2 style={{ fontSize: 'clamp(28px,5vw,52px)', fontWeight: 800, color: '#fff', marginBottom: 20, letterSpacing: '-1.5px', lineHeight: 1.1 }}>
              Zamień magazynowy chaos<br />w system, który działa codziennie.
            </h2>
            <p style={{ fontSize: 18, color: 'rgba(255,255,255,.68)', marginBottom: 16, lineHeight: 1.65 }}>
              Zacznij od prostego magazynu, dodaj lokalizacje, faktury i AI wtedy,<br />kiedy firma zacznie rosnąć.
            </p>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,.4)', marginBottom: 44 }}>
              Dla firm z magazynem, ekipami, lokalizacjami i codziennym obiegiem towaru.
            </p>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/register"
                style={{ padding: '15px 36px', background: '#fff', color: '#1d4ed8', borderRadius: 11, fontWeight: 700, fontSize: 16, textDecoration: 'none', boxShadow: '0 4px 24px rgba(0,0,0,.25)', transition: 'all .2s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 36px rgba(0,0,0,.3)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,.25)' }}
              >
                Zarejestruj się
              </Link>
              <Link to="/login"
                style={{ padding: '15px 36px', background: 'rgba(255,255,255,.1)', color: '#fff', borderRadius: 11, fontWeight: 700, fontSize: 16, textDecoration: 'none', border: '1px solid rgba(255,255,255,.24)', backdropFilter: 'blur(4px)', transition: 'background .2s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.18)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,.1)'}
              >
                Zaloguj się
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ══ TRUST STRIP ════════════════════════════════════════ */}
      <section id="bezpieczenstwo" style={{ background: '#0d1526', padding: '22px 24px' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto' }}>
          <div className="trust-grid" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 32, flexWrap: 'wrap' }}>
            {[
              { icon: Shield,   label: 'Supabase Auth · JWT' },
              { icon: Lock,     label: 'Szyfrowane połączenia HTTPS' },
              { icon: Database, label: 'Row Level Security' },
              { icon: Building2,label: 'Izolacja danych organizacji' },
            ].map(t => (
              <div key={t.label} style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#475569' }}>
                <t.icon size={14} color="#334155" />
                <span style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}>{t.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FOOTER ═════════════════════════════════════════════ */}
      <footer style={{ background: '#080e1e', padding: '24px', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,.04)' }}>
        <p style={{ fontSize: 14, color: '#334155' }}>© 2026 Magzic</p>
      </footer>

    </div>
  )
}
