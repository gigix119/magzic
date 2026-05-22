import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Warehouse, FileText, Bell, Brain, BarChart3, History, Sparkles,
  ArrowRight, Building2, Wrench, Home, Briefcase,
  MapPin, Menu, X, TrendingDown, Receipt, Package,
  LayoutDashboard, TrendingUp, RefreshCw, Layers, Shield,
  Lock, Database, CheckCircle2, XCircle,
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
  { icon: MapPin,       color: '#ef4444', bg: '#fef2f2', border: '#fca5a5', title: 'Nie wiadomo, gdzie jest towar',    desc: 'Towar jest w firmie, ale nikt nie wie w którym magazynie, lokalu albo u którego pracownika.' },
  { icon: TrendingDown, color: '#f59e0b', bg: '#fffbeb', border: '#fcd34d', title: 'Braki wychodzą za późno',          desc: 'Dowiadujesz się o problemie dopiero wtedy, gdy ktoś nie może wykonać pracy.' },
  { icon: Receipt,      color: '#8b5cf6', bg: '#f5f3ff', border: '#c4b5fd', title: 'Faktury nie aktualizują stanów',   desc: 'Zakupy są w dokumentach, ale magazyn nadal żyje własnym życiem.' },
  { icon: History,      color: '#06b6d4', bg: '#ecfeff', border: '#67e8f9', title: 'Pobrania bez historii',            desc: 'Nie wiadomo kto, kiedy i ile pobrał — więc nie da się kontrolować zużycia.' },
  { icon: FileText,     color: '#10b981', bg: '#f0fdf4', border: '#6ee7b7', title: 'Za dużo Excela',                   desc: 'Stany są rozbite między arkusze, wiadomości, faktury i pamięć pracowników.' },
  { icon: Brain,        color: '#3b82f6', bg: '#eff6ff', border: '#93c5fd', title: 'Brak prognozy',                    desc: 'Firma reaguje po fakcie, zamiast wiedzieć wcześniej, co trzeba uzupełnić.' },
]

const HOW_STEPS = [
  { num: '01', color: '#3b82f6', bg: '#eff6ff', title: 'Dodajesz towary, lokalizacje i magazyny',        desc: 'Budujesz strukturę firmy: co masz, gdzie to trzymasz, jak to mierzysz.' },
  { num: '02', color: '#8b5cf6', bg: '#f5f3ff', title: 'System śledzi stany, pobrania, faktury i ruchy', desc: 'Każda zmiana jest rejestrowana. Nic nie ginie, nic nie jest z pamięci.' },
  { num: '03', color: '#06b6d4', bg: '#ecfeff', title: 'AI pokazuje alerty, prognozy i rekomendacje',    desc: 'Zanim zabraknie towaru, zanim pracownik zapyta — Magzic już wie.' },
]

/* Wide featured cards */
const FEATURES_WIDE = [
  {
    icon: FileText, color: '#06b6d4', border: '#a5f3fc', bg: 'linear-gradient(135deg, #ecfeff 0%, #f0f9ff 100%)',
    title: 'Faktury z odczytem AI',
    desc: 'Dodaj fakturę, zatwierdź — pozycje trafiają do magazynu bez ręcznego przepisywania. AI identyfikuje pozycje i sugeruje dopasowanie do katalogu.',
  },
  {
    icon: LayoutDashboard, color: '#3b82f6', border: '#bfdbfe', bg: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)',
    title: 'Dashboard właściciela',
    desc: 'Widok ogólny z kluczowymi metrykami, alertami i aktywnością. Zawsze wiesz, co się dzieje w firmie — z każdego miejsca i urządzenia.',
  },
]

/* Regular small cards */
const FEATURES_SMALL = [
  { icon: Warehouse,  color: '#3b82f6', title: 'Stany per magazyn',        desc: 'Aktualne ilości w każdym miejscu, w jednym widoku.' },
  { icon: Package,    color: '#8b5cf6', title: 'Towary i kategorie',        desc: 'Baza z kategoriami, jednostkami i minimami stanów.' },
  { icon: RefreshCw,  color: '#10b981', title: 'Automatyczna aktualizacja', desc: 'Zatwierdzone faktury od razu odzwierciedlone w magazynach.' },
  { icon: Bell,       color: '#ef4444', title: 'Alerty niskich stanów',     desc: 'Powiadomienie gdy towar spada poniżej minimum.' },
  { icon: History,    color: '#6b7280', title: 'Historia ruchów',           desc: 'Kto, co, skąd, kiedy — pełny audit trail.' },
  { icon: Brain,      color: '#f59e0b', title: 'Predykcja zużycia',         desc: 'AI przewiduje, kiedy zabraknie towaru.' },
  { icon: TrendingUp, color: '#3b82f6', title: 'Rekomendacje zamówień',     desc: 'Co, ile i kiedy zamówić — system podpowiada.' },
  { icon: Sparkles,   color: '#8b5cf6', title: 'Pakiety operacyjne',        desc: 'Jednym klikiem wydaj komplet produktów na operację.' },
]

const AI_INSIGHTS = [
  { icon: '🚨', label: 'Alert krytyczny', lc: '#f87171', bg: 'rgba(239,68,68,0.08)',  bd: 'rgba(239,68,68,0.2)',  text: 'Papier toaletowy: 0 szt. w Zapleczu 2. Ryzyko zatrzymania operacji w ciągu 48h.',         action: 'Zamów teraz' },
  { icon: '⚠️', label: 'Prognoza braku',  lc: '#fbbf24', bg: 'rgba(245,158,11,0.08)', bd: 'rgba(245,158,11,0.2)', text: 'Za 7 dni zabraknie środka CLIN. Zużycie wzrosło o 42% vs. poprzedni miesiąc.',          action: 'Zaplanuj' },
  { icon: '💡', label: 'Rekomendacja',    lc: '#60a5fa', bg: 'rgba(59,130,246,0.08)', bd: 'rgba(59,130,246,0.2)', text: 'Przesuń 15 szt. środka X z Magazynu Głównego do Zaplecza 1 — wystarczy na 3 tygodnie.',  action: 'Wykonaj' },
  { icon: '✅', label: 'Faktura gotowa',  lc: '#34d399', bg: 'rgba(34,197,94,0.08)',  bd: 'rgba(34,197,94,0.2)',  text: 'FV/2025/088 odczytana przez AI. 4 pozycje gotowe do zatwierdzenia w magazynie.',         action: 'Zatwierdź' },
]

const AUDIENCES = [
  { icon: Building2, color: '#3b82f6', title: 'Firmy z wieloma lokalizacjami',    desc: 'Kontrola stanów w biurach, magazynach, lokalach, punktach i zapleczach.' },
  { icon: Wrench,    color: '#f59e0b', title: 'Serwisy i ekipy terenowe',         desc: 'Wydawanie narzędzi, części i materiałów z pełną historią pobrań.' },
  { icon: Home,      color: '#8b5cf6', title: 'Aparthotele i najem krótkoterminowy', desc: 'Środki czystości, wyposażenie i zapasy pod wiele apartamentów.' },
  { icon: Warehouse, color: '#06b6d4', title: 'Małe magazyny i zaplecza',         desc: 'Prosty WMS bez korporacyjnego ciężaru — działa od razu.' },
  { icon: Briefcase, color: '#10b981', title: 'Firmy utrzymania obiektów',        desc: 'Materiały eksploatacyjne, kontrola zużycia i alerty braków.' },
  { icon: Layers,    color: '#ef4444', title: 'Operacje bez magazyniera',         desc: 'Dla firm, gdzie magazynem zajmuje się każdy — system pilnuje porządku.' },
]

const BEFORE = [
  'Excel i WhatsApp zamiast systemu',
  'Nikt nie wie gdzie jest towar',
  'O brakach dowiadujesz się za późno',
  'Faktury przepisujesz ręcznie',
  'Brak historii pobrań i zużycia',
]

const AFTER = [
  '1 system zamiast chaosu informacyjnego',
  'Stany per magazyn i lokalizację',
  'AI alerty zanim zabraknie towaru',
  'Faktury zatwierdzane jednym kliknięciem',
  'Pełna historia kto, co, kiedy',
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

      {/* ── CSS ────────────────────────────────────────────── */}
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        @keyframes float      { 0%,100%{ transform: translateY(0); } 50%{ transform: translateY(-12px); } }
        @keyframes glow-orb   { 0%,100%{ opacity: .3; transform: scale(1); } 50%{ opacity: .55; transform: scale(1.06); } }
        @keyframes blink      { 0%,100%{ opacity: 1; } 50%{ opacity: .15; } }
        @keyframes ticker     { 0%{ transform: translateX(0); } 100%{ transform: translateX(-50%); } }
        @keyframes hero-up    { from{ opacity:0; transform: translateY(28px); } to{ opacity:1; transform: none; } }
        @keyframes hero-right { from{ opacity:0; transform: translateX(36px); } to{ opacity:1; transform: none; } }

        .ha { animation: hero-up    .8s cubic-bezier(.16,1,.3,1) both; }
        .hb { animation: hero-up    .8s cubic-bezier(.16,1,.3,1) .12s both; }
        .hc { animation: hero-up    .8s cubic-bezier(.16,1,.3,1) .24s both; }
        .hd { animation: hero-up    .8s cubic-bezier(.16,1,.3,1) .36s both; }
        .he { animation: hero-up    .8s cubic-bezier(.16,1,.3,1) .48s both; }
        .hf { animation: hero-right .9s cubic-bezier(.16,1,.3,1) .35s both; }

        .nav-btn {
          background: none; border: none; padding: 7px 13px; border-radius: 7px;
          font-size: 14px; font-weight: 500; cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          transition: background .15s, color .15s;
        }

        .card-lift { transition: transform .22s cubic-bezier(.4,0,.2,1), box-shadow .22s, border-color .22s; }
        .card-lift:hover { transform: translateY(-4px); }

        .feat-small { transition: all .2s cubic-bezier(.4,0,.2,1); }
        .feat-small:hover {
          background: #fff !important;
          box-shadow: 0 10px 32px rgba(59,130,246,.1) !important;
          transform: translateY(-3px);
          border-color: #bfdbfe !important;
        }

        .feat-wide { transition: all .2s; }
        .feat-wide:hover {
          box-shadow: 0 12px 40px rgba(0,0,0,.08) !important;
          transform: translateY(-2px);
        }

        .ai-row { transition: background .18s, border-color .18s; }
        .ai-row:hover { background: rgba(255,255,255,.09) !important; border-color: rgba(255,255,255,.18) !important; }

        .prog-bar { border-radius: 3px; }

        /* Nav show/hide */
        .desk { display: flex; }
        .mob  { display: none; }
        @media (max-width: 1023px) {
          .desk { display: none !important; }
          .mob  { display: flex !important; }
        }

        /* Grids */
        @media (max-width: 1023px) {
          .hero-grid  { grid-template-columns: 1fr !important; }
          .ai-grid    { grid-template-columns: 1fr !important; gap: 48px !important; }
          .how-grid   { grid-template-columns: 1fr !important; gap: 48px !important; }
          .feat-grid  { grid-template-columns: repeat(2, 1fr) !important; }
          .prob-grid  { grid-template-columns: repeat(2, 1fr) !important; }
          .aud-grid   { grid-template-columns: repeat(2, 1fr) !important; }
          .comp-grid  { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 600px) {
          .feat-grid    { grid-template-columns: 1fr !important; }
          .feat-wide    { grid-column: span 1 !important; }
          .feat-wide-inner { flex-direction: column !important; gap: 20px !important; }
          .feat-mini    { display: none !important; }
          .prob-grid    { grid-template-columns: 1fr !important; }
          .aud-grid     { grid-template-columns: 1fr !important; }
          .hero-cta     { flex-direction: column !important; }
          .hero-cta > * { width: 100% !important; text-align: center !important; justify-content: center !important; }
          .trust-row    { flex-wrap: wrap !important; gap: 10px !important; justify-content: center !important; }

          /* Reduce section vertical padding on small phones */
          .section-pad  { padding-top: 64px !important; padding-bottom: 64px !important; }
          .section-pad-sm { padding-top: 48px !important; padding-bottom: 48px !important; }

          /* Hero: less padding so content isn't too compressed */
          .hero-section { padding-top: 80px !important; padding-bottom: 64px !important; }

          /* Mockup: prevent overflow */
          .hero-mockup  { max-width: 100% !important; overflow: hidden !important; }
        }

        @media (max-width: 480px) {
          /* Smaller section padding on very small phones */
          .section-pad  { padding-top: 52px !important; padding-bottom: 52px !important; padding-left: 16px !important; padding-right: 16px !important; }
          .hero-section { padding-top: 72px !important; padding-bottom: 52px !important; }
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
          <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg,#3b82f6,#2563eb)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(59,130,246,.4)' }}>
              <Warehouse size={18} color="#fff" />
            </div>
            <span style={{ fontSize: 18, fontWeight: 700, fontFamily: 'DM Mono, monospace', letterSpacing: '-.5px', color: scrolled ? '#111827' : '#fff', transition: 'color .3s' }}>Magzic</span>
          </Link>

          <nav className="desk" style={{ gap: 2, flex: 1, marginLeft: 20 }}>
            {NAV_LINKS.map(([id, label]) => (
              <button key={id} className="nav-btn" onClick={() => scrollTo(id)}
                style={{ color: scrolled ? '#374151' : '#94a3b8' }}
                onMouseEnter={e => { e.currentTarget.style.background = scrolled ? '#f3f4f6' : 'rgba(255,255,255,.1)'; e.currentTarget.style.color = scrolled ? '#111827' : '#fff' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = scrolled ? '#374151' : '#94a3b8' }}
              >{label}</button>
            ))}
          </nav>

          <div className="desk" style={{ alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            <Link to="/login"
              style={{ padding: '8px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none', transition: 'all .2s', display: 'inline-block', border: scrolled ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,.22)', color: scrolled ? '#374151' : '#e2e8f0', background: 'transparent' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.color = '#2563eb' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = scrolled ? '#e5e7eb' : 'rgba(255,255,255,.22)'; e.currentTarget.style.color = scrolled ? '#374151' : '#e2e8f0' }}
            >Zaloguj się</Link>
            <Link to="/register"
              style={{ padding: '8px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, color: '#fff', textDecoration: 'none', background: 'linear-gradient(135deg,#3b82f6,#2563eb)', boxShadow: '0 2px 8px rgba(59,130,246,.4)', transition: 'all .2s', display: 'inline-block' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 5px 16px rgba(59,130,246,.55)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(59,130,246,.4)' }}
            >Zarejestruj się</Link>
          </div>

          <button className="mob" onClick={() => setMobileOpen(v => !v)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: scrolled ? '#374151' : '#e2e8f0', alignItems: 'center', justifyContent: 'center', transition: 'color .3s' }}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {mobileOpen && (
          <div style={{ background: '#080e1e', borderTop: '1px solid rgba(255,255,255,.07)', padding: '8px 24px 20px' }}>
            {NAV_LINKS.map(([id, label]) => (
              <button key={id} onClick={() => scrollTo(id)}
                style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '13px 0', fontSize: 16, fontWeight: 500, color: '#94a3b8', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,.05)', fontFamily: 'DM Sans, sans-serif' }}
              >{label}</button>
            ))}
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Link to="/login" onClick={() => setMobileOpen(false)} style={{ textAlign: 'center', padding: '12px', borderRadius: 9, fontSize: 15, fontWeight: 600, color: '#e2e8f0', textDecoration: 'none', border: '1px solid rgba(255,255,255,.15)' }}>Zaloguj się</Link>
              <Link to="/register" onClick={() => setMobileOpen(false)} style={{ textAlign: 'center', padding: '12px', borderRadius: 9, fontSize: 15, fontWeight: 600, color: '#fff', textDecoration: 'none', background: 'linear-gradient(135deg,#3b82f6,#2563eb)' }}>Zarejestruj się</Link>
            </div>
          </div>
        )}
      </header>

      {/* ══ HERO ══════════════════════════════════════════════ */}
      <section className="hero-section" style={{
        paddingTop: 120, paddingBottom: 120, position: 'relative', overflow: 'hidden',
        background: '#060d1a',
        backgroundImage: 'linear-gradient(rgba(255,255,255,.022) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.022) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }}>
        <div style={{ position: 'absolute', top: -80, right: -60,  width: 720, height: 720, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,.18) 0%, transparent 62%)', animation: 'glow-orb 6s ease-in-out infinite', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -80, left: -80, width: 540, height: 540, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,.14) 0%, transparent 62%)', animation: 'glow-orb 8s ease-in-out infinite 2.5s', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '35%', left: '40%', width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,182,212,.07) 0%, transparent 62%)', animation: 'glow-orb 10s ease-in-out infinite 5s', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 1240, margin: '0 auto', padding: '0 24px', position: 'relative' }}>
          <div className="hero-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 500px', gap: 72, alignItems: 'center' }}>

            {/* Text */}
            <div>
              <div className="ha" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(59,130,246,.1)', border: '1px solid rgba(59,130,246,.28)', borderRadius: 24, padding: '6px 14px', fontSize: 12.5, color: '#93c5fd', fontWeight: 700, marginBottom: 28, letterSpacing: '.4px', textTransform: 'uppercase' }}>
                <Brain size={12} /> Napędzany przez AI
              </div>

              <h1 className="hb" style={{ fontSize: 'clamp(38px,6vw,72px)', fontWeight: 800, lineHeight: 1.04, color: '#f0f6ff', marginBottom: 14, letterSpacing: '-2.5px' }}>
                Koniec zgadywania.
              </h1>
              <h1 className="hc" style={{ fontSize: 'clamp(38px,6vw,72px)', fontWeight: 800, lineHeight: 1.04, letterSpacing: '-2.5px', marginBottom: 32, background: 'linear-gradient(135deg, #60a5fa 0%, #a78bfa 55%, #22d3ee 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                Magzic pilnuje<br />Twojego magazynu.
              </h1>

              <p className="hd" style={{ fontSize: 18.5, color: '#64748b', lineHeight: 1.78, marginBottom: 40, maxWidth: 510 }}>
                Zarządzaj towarami, lokalizacjami, fakturami i pobraniami w jednym systemie. AI analizuje zużycie, wykrywa braki i podpowiada decyzje zanim problem uderzy w operacje.
              </p>

              <div className="he hero-cta" style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
                <Link to="/register"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '15px 30px', background: 'linear-gradient(135deg,#3b82f6,#2563eb)', color: '#fff', borderRadius: 10, fontWeight: 700, fontSize: 16, textDecoration: 'none', boxShadow: '0 4px 22px rgba(59,130,246,.52)', transition: 'all .2s' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 34px rgba(59,130,246,.68)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 22px rgba(59,130,246,.52)' }}
                >
                  Rozpocznij teraz <ArrowRight size={17} />
                </Link>
                <button onClick={() => scrollTo('funkcje')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '15px 28px', background: 'rgba(255,255,255,.06)', color: '#e2e8f0', borderRadius: 10, fontWeight: 600, fontSize: 16, border: '1px solid rgba(255,255,255,.16)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', backdropFilter: 'blur(4px)', transition: 'all .2s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.12)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.28)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.06)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.16)' }}
                >
                  Zobacz, jak działa
                </button>
              </div>

              {/* Trust pills */}
              <div className="he" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['Bez wdrożeń', 'Gotowe od razu', 'Darmowy start'].map(t => (
                  <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: '#475569', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 20, padding: '4px 12px', whiteSpace: 'nowrap' }}>
                    <CheckCircle2 size={11} color="#22c55e" /> {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Mockup */}
            <div className="hf hero-mockup" style={{ animation: 'float 5.5s ease-in-out infinite' }}>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', inset: -28, background: 'radial-gradient(circle, rgba(59,130,246,.25) 0%, transparent 68%)', filter: 'blur(24px)', pointerEvents: 'none' }} />
                <div style={{ position: 'relative', background: '#fff', borderRadius: 20, border: '1px solid rgba(59,130,246,.18)', overflow: 'hidden', boxShadow: '0 48px 100px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.9)' }}>

                  {/* Chrome */}
                  <div style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 5 }}>
                      {['#ef4444','#fbbf24','#22c55e'].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}
                    </div>
                    <span style={{ flex: 1, textAlign: 'center', fontSize: 11, color: '#9ca3af', fontFamily: 'DM Mono, monospace' }}>magzic · dashboard</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', animation: 'blink 2s ease-in-out infinite' }} />
                      <span style={{ fontSize: 10, color: '#6b7280' }}>live</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex' }}>
                    {/* Sidebar */}
                    <div style={{ width: 44, borderRight: '1px solid #f1f5f9', padding: '14px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, background: '#fafafa', flexShrink: 0 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 7, background: 'rgba(59,130,246,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <LayoutDashboard size={13} color="#3b82f6" />
                      </div>
                      {[Package, FileText, Bell, History].map((Icon, i) => (
                        <div key={i} style={{ width: 30, height: 30, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon size={13} color="#d1d5db" />
                        </div>
                      ))}
                    </div>

                    <div style={{ flex: 1, padding: '15px 15px 18px' }}>
                      {/* Stats */}
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
                            <span style={{ fontSize: 27, fontWeight: 800, color: s.color, fontFamily: 'DM Mono, monospace', lineHeight: 1 }}>{s.value}</span>
                          </div>
                        ))}
                      </div>

                      {/* Locations */}
                      <div style={{ marginBottom: 13 }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.5px' }}>Stany magazynowe</p>
                        {[
                          { name: 'Magazyn Główny', cur: 89, max: 120, pct: 74 },
                          { name: 'Zaplecze 1',     cur: 12, max: 50,  pct: 24, warn: true },
                          { name: 'Apartament A',   cur: 45, max: 60,  pct: 75 },
                        ].map(loc => (
                          <div key={loc.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                            <span style={{ fontSize: 10.5, color: '#374151', fontWeight: 500, width: 88, flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{loc.name}</span>
                            <div style={{ flex: 1, height: 5, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                              <div className="prog-bar" style={{ height: '100%', width: `${loc.pct}%`, background: loc.warn ? 'linear-gradient(90deg,#f59e0b,#fbbf24)' : 'linear-gradient(90deg,#22c55e,#4ade80)' }} />
                            </div>
                            <span style={{ fontSize: 10, color: loc.warn ? '#d97706' : '#6b7280', fontFamily: 'DM Mono, monospace', flexShrink: 0, width: 28, textAlign: 'right' }}>{loc.cur}</span>
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

      {/* ══ PROBLEM ═══════════════════════════════════════════ */}
      <section id="problem" className="section-pad" style={{ padding: '96px 24px', background: '#f8fafc' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: 64 }}>
              <span style={{ display: 'inline-block', fontSize: 11.5, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#dc2626', background: '#fef2f2', padding: '5px 14px', borderRadius: 20, border: '1px solid #fca5a5', marginBottom: 18 }}>Problem</span>
              <h2 style={{ fontSize: 'clamp(30px,4.5vw,52px)', fontWeight: 800, color: '#111827', marginBottom: 16, letterSpacing: '-1.5px', lineHeight: 1.12 }}>
                Bez systemu ten chaos<br />jest normalny
              </h2>
              <p style={{ fontSize: 17, color: '#6b7280', maxWidth: 520, margin: '0 auto', lineHeight: 1.7 }}>
                Znasz te problemy? Magzic rozwiązuje je wszystkie — bez długich wdrożeń, bez szkoleń.
              </p>
            </div>
          </Reveal>

          <div className="prob-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }}>
            {PROBLEMS.map((p, i) => (
              <Reveal key={p.title} delay={i * 55}>
                <div className="card-lift" style={{ background: '#fff', borderRadius: 16, borderTop: `3px solid ${p.color}`, border: `1px solid ${p.border}`, borderTopWidth: 3, padding: '26px 24px', height: '100%', boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
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

      {/* ══ JAK TO DZIAŁA ═════════════════════════════════════ */}
      <section className="section-pad" style={{ padding: '96px 24px', background: '#fff' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto' }}>
          <div className="how-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>

            <Reveal>
              <div>
                <span style={{ display: 'inline-block', fontSize: 11.5, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#2563eb', background: '#eff6ff', padding: '5px 14px', borderRadius: 20, border: '1px solid #bfdbfe', marginBottom: 20 }}>Jak to działa</span>
                <h2 style={{ fontSize: 'clamp(28px,4vw,48px)', fontWeight: 800, color: '#111827', marginBottom: 20, letterSpacing: '-1.5px', lineHeight: 1.12 }}>
                  Jak Magzic to ogarnia
                </h2>
                <p style={{ fontSize: 17, color: '#6b7280', lineHeight: 1.72, marginBottom: 44 }}>
                  Magzic łączy klasyczny magazyn z warstwą AI. Nie tylko zapisuje dane — pomaga z nich podejmować decyzje.
                </p>

                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 0 }}>
                  <div style={{ position: 'absolute', left: 24, top: 48, bottom: 48, width: 2, background: 'linear-gradient(180deg,#3b82f6,#8b5cf6,#06b6d4)', borderRadius: 2, opacity: .25 }} />
                  {HOW_STEPS.map((step, i) => (
                    <div key={step.num} style={{ display: 'flex', gap: 20, paddingBottom: i < HOW_STEPS.length - 1 ? 36 : 0, position: 'relative' }}>
                      <div style={{ width: 48, height: 48, borderRadius: '50%', background: step.bg, border: `2px solid ${step.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1 }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: step.color, fontFamily: 'DM Mono, monospace' }}>{step.num}</span>
                      </div>
                      <div style={{ paddingTop: 9 }}>
                        <h3 style={{ fontSize: 15.5, fontWeight: 700, color: '#111827', marginBottom: 7, lineHeight: 1.35 }}>{step.title}</h3>
                        <p style={{ fontSize: 13.5, color: '#6b7280', lineHeight: 1.62 }}>{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            {/* Mini panel mockups */}
            <Reveal delay={150}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

                {/* Step 1: New product form */}
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 14, padding: '16px 18px', boxShadow: '0 2px 8px rgba(59,130,246,.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
                    <div style={{ width: 22, height: 22, borderRadius: 5, background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Package size={11} color="#fff" />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '.4px' }}>Nowy towar</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                    {[['Nazwa', 'Papier toaletowy'], ['Jednostka', 'szt.'], ['Minimum', '20']].map(([label, val]) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: '#64748b' }}>{label}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#1e40af', background: '#fff', padding: '2px 8px', borderRadius: 5, border: '1px solid #bfdbfe' }}>{val}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: '#3b82f6', color: '#fff', borderRadius: 7, padding: '6px', fontSize: 11, fontWeight: 700, textAlign: 'center' }}>Zapisz →</div>
                </div>

                {/* Step 2: Activity feed */}
                <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 14, padding: '16px 18px', boxShadow: '0 2px 8px rgba(139,92,246,.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
                    <div style={{ width: 22, height: 22, borderRadius: 5, background: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <History size={11} color="#fff" />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#6d28d9', textTransform: 'uppercase', letterSpacing: '.4px' }}>Ostatnie ruchy</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {[
                      { text: '↓ Pobranie: 5 szt. CLIN', time: '2 min', color: '#8b5cf6' },
                      { text: '↑ FV/2025/088 zatwierdzona', time: '14 min', color: '#10b981' },
                      { text: '⚠ Alert: minimum osiągnięte', time: '1 h', color: '#ef4444' },
                    ].map(a => (
                      <div key={a.text} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11.5, color: '#374151' }}>{a.text}</span>
                        <span style={{ fontSize: 10, color: '#94a3b8', flexShrink: 0, marginLeft: 10 }}>{a.time}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Step 3: AI recommendation */}
                <div style={{ background: '#ecfeff', border: '1px solid #a5f3fc', borderRadius: 14, padding: '16px 18px', boxShadow: '0 2px 8px rgba(6,182,212,.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                    <div style={{ width: 22, height: 22, borderRadius: 5, background: '#06b6d4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Brain size={11} color="#fff" />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#0891b2', textTransform: 'uppercase', letterSpacing: '.4px' }}>AI · Rekomendacja</span>
                  </div>
                  <p style={{ fontSize: 12.5, color: '#0c4a6e', lineHeight: 1.52, marginBottom: 10 }}>
                    Za 5 dni zabraknie papieru toaletowego w Zapleczu 1. Zamów min. 40 szt.
                  </p>
                  <div style={{ background: '#06b6d4', color: '#fff', borderRadius: 7, padding: '6px', fontSize: 11, fontWeight: 700, textAlign: 'center' }}>Zaplanuj zamówienie →</div>
                </div>

              </div>
            </Reveal>

          </div>
        </div>
      </section>

      {/* ══ FUNKCJE (bento) ═══════════════════════════════════ */}
      <section id="funkcje" className="section-pad" style={{ padding: '96px 24px', background: '#f8fafc' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: 64 }}>
              <span style={{ display: 'inline-block', fontSize: 11.5, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#2563eb', background: '#eff6ff', padding: '5px 14px', borderRadius: 20, border: '1px solid #bfdbfe', marginBottom: 18 }}>Możliwości</span>
              <h2 style={{ fontSize: 'clamp(30px,4.5vw,52px)', fontWeight: 800, color: '#111827', marginBottom: 16, letterSpacing: '-1.5px' }}>
                Wszystko, czego potrzebujesz
              </h2>
              <p style={{ fontSize: 17, color: '#6b7280', maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>
                Kompleksowy WMS z inteligentną warstwą AI na każdym etapie operacji.
              </p>
            </div>
          </Reveal>

          <div className="feat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>

            {/* Wide featured cards */}
            {FEATURES_WIDE.map((f, i) => (
              <Reveal key={f.title} delay={i * 80} style={{ gridColumn: 'span 2' }}>
                <div className="feat-wide" style={{ background: f.bg, border: `1px solid ${f.border}`, borderRadius: 18, padding: '28px 28px', height: '100%', boxShadow: '0 2px 8px rgba(0,0,0,.04)' }}>
                  <div className="feat-wide-inner" style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ width: 46, height: 46, background: '#fff', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, border: `1px solid ${f.border}`, boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
                        <f.icon size={21} color={f.color} />
                      </div>
                      <h3 style={{ fontSize: 17, fontWeight: 700, color: '#111827', marginBottom: 10, lineHeight: 1.3 }}>{f.title}</h3>
                      <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.65 }}>{f.desc}</p>
                    </div>

                    {/* Right-side mini visual */}
                    <div className="feat-mini" style={{ flexShrink: 0 }}>
                      {i === 0 ? (
                        /* Invoice mini-mockup */
                        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '14px 16px', width: 172, boxShadow: '0 6px 18px rgba(6,182,212,.1)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <span style={{ fontSize: 10.5, color: '#9ca3af', fontFamily: 'DM Mono, monospace' }}>FV/2025/088</span>
                            <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 700, background: '#f0fdf4', padding: '2px 7px', borderRadius: 8, border: '1px solid #bbf7d0' }}>AI ✓</span>
                          </div>
                          {[['Papier A4', '5 ryz'], ['CLIN 1L', '10 szt'], ['Rękawice', '20 par']].map(([n, q]) => (
                            <div key={n} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f3f4f6', fontSize: 11 }}>
                              <span style={{ color: '#374151' }}>{n}</span>
                              <span style={{ color: '#6b7280', fontFamily: 'DM Mono, monospace' }}>{q}</span>
                            </div>
                          ))}
                          <div style={{ marginTop: 10, background: '#06b6d4', color: '#fff', borderRadius: 7, padding: '6px', fontSize: 11, fontWeight: 700, textAlign: 'center' }}>Zatwierdź fakturę →</div>
                        </div>
                      ) : (
                        /* Dashboard mini-stats */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, width: 155 }}>
                          {[
                            { label: 'Towary OK', val: '47', color: '#16a34a', bg: '#f0fdf4' },
                            { label: 'Alerty',    val: '2',  color: '#d97706', bg: '#fffbeb' },
                            { label: 'Faktury',   val: '3',  color: '#2563eb', bg: '#eff6ff' },
                            { label: 'Aktywność', val: '↑12%', color: '#7c3aed', bg: '#f5f3ff' },
                          ].map(s => (
                            <div key={s.label} style={{ background: s.bg, borderRadius: 8, padding: '7px 11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: 10.5, color: '#6b7280', fontWeight: 500 }}>{s.label}</span>
                              <span style={{ fontSize: 15, fontWeight: 800, color: s.color, fontFamily: 'DM Mono, monospace' }}>{s.val}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}

            {/* Small cards */}
            {FEATURES_SMALL.map((f, i) => (
              <Reveal key={f.title} delay={160 + i * 45}>
                <div className="feat-small" style={{ background: '#fff', borderRadius: 14, border: '1px solid #f1f5f9', padding: '20px 18px', height: '100%' }}>
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

      {/* ══ AI (dark) ══════════════════════════════════════════ */}
      <section id="ai" className="section-pad" style={{
        padding: '96px 24px', position: 'relative', overflow: 'hidden',
        background: '#060d1a',
        backgroundImage: 'linear-gradient(rgba(255,255,255,.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.02) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }}>
        <div style={{ position: 'absolute', top: '8%',  right: '-4%', width: 480, height: 480, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,.15) 0%, transparent 62%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '8%', left: '-4%', width: 360, height: 360, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,.1) 0%, transparent 62%)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 1240, margin: '0 auto', position: 'relative' }}>
          <div className="ai-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 72, alignItems: 'center' }}>

            <Reveal>
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(139,92,246,.12)', border: '1px solid rgba(139,92,246,.28)', borderRadius: 24, padding: '6px 14px', fontSize: 12.5, color: '#a78bfa', fontWeight: 700, marginBottom: 24, letterSpacing: '.4px', textTransform: 'uppercase' }}>
                  <Brain size={12} /> Sztuczna inteligencja
                </div>
                <h2 style={{ fontSize: 'clamp(28px,4.5vw,52px)', fontWeight: 800, color: '#f0f6ff', marginBottom: 20, letterSpacing: '-1.5px', lineHeight: 1.1 }}>
                  AI, która nie gada<br />dla ozdoby.
                </h2>
                <p style={{ fontSize: 17, color: '#475569', lineHeight: 1.75, marginBottom: 20 }}>
                  Magzic analizuje zużycie, historię pobrań i aktualne stany — i podpowiada:
                </p>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 36 }}>
                  {['co zamówić i kiedy', 'gdzie przesunąć towar', 'które braki zaraz zatrzymają pracę', 'które faktury są gotowe do zatwierdzenia'].map(t => (
                    <li key={t} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15.5, color: '#94a3b8' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#a78bfa', flexShrink: 0 }} />
                      {t}
                    </li>
                  ))}
                </ul>
                <Link to="/register"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 26px', background: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', color: '#fff', borderRadius: 10, fontWeight: 700, fontSize: 15, textDecoration: 'none', boxShadow: '0 4px 18px rgba(139,92,246,.48)', transition: 'all .2s' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 30px rgba(139,92,246,.62)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 18px rgba(139,92,246,.48)' }}
                >
                  Wypróbuj AI <ArrowRight size={16} />
                </Link>
              </div>
            </Reveal>

            <Reveal delay={160}>
              <div style={{ background: 'rgba(255,255,255,.04)', borderRadius: 20, border: '1px solid rgba(255,255,255,.09)', overflow: 'hidden', backdropFilter: 'blur(12px)' }}>
                <div style={{ background: 'rgba(139,92,246,.1)', borderBottom: '1px solid rgba(139,92,246,.2)', padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#a78bfa', animation: 'blink 1.8s ease-in-out infinite' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#c4b5fd', fontFamily: 'DM Mono, monospace', flex: 1 }}>Magzic AI · Centrum operacyjne</span>
                  <span style={{ fontSize: 11, color: '#334155', background: 'rgba(255,255,255,.06)', padding: '3px 9px', borderRadius: 12 }}>Live</span>
                </div>
                <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {AI_INSIGHTS.map((ins, i) => (
                    <div key={i} className="ai-row" style={{ background: ins.bg, border: `1px solid ${ins.bd}`, borderRadius: 12, padding: '13px 15px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 17, flexShrink: 0, lineHeight: 1.4 }}>{ins.icon}</span>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: ins.lc, letterSpacing: '.5px', textTransform: 'uppercase' }}>{ins.label}</span>
                        <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.55, marginTop: 3 }}>{ins.text}</p>
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

      {/* ══ DLA KOGO ══════════════════════════════════════════ */}
      <section id="dla-kogo" className="section-pad" style={{ padding: '96px 24px', background: '#fff' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: 64 }}>
              <span style={{ display: 'inline-block', fontSize: 11.5, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#16a34a', background: '#f0fdf4', padding: '5px 14px', borderRadius: 20, border: '1px solid #bbf7d0', marginBottom: 18 }}>Dla kogo</span>
              <h2 style={{ fontSize: 'clamp(30px,4.5vw,52px)', fontWeight: 800, color: '#111827', marginBottom: 16, letterSpacing: '-1.5px' }}>
                Dla każdej firmy z obiegiem towaru
              </h2>
              <p style={{ fontSize: 17, color: '#6b7280', maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>
                Magzic dopasowuje się do Twojej branży — bez korporacyjnego ciężaru.
              </p>
            </div>
          </Reveal>

          <div className="aud-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }}>
            {AUDIENCES.map((a, i) => (
              <Reveal key={a.title} delay={i * 60}>
                <div className="card-lift" style={{ background: '#fafafa', borderRadius: 16, border: '1px solid #f1f5f9', padding: '28px 24px', height: '100%', transition: 'all .22s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#bfdbfe'; e.currentTarget.style.boxShadow = '0 14px 44px rgba(59,130,246,.1)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fafafa'; e.currentTarget.style.borderColor = '#f1f5f9'; e.currentTarget.style.boxShadow = 'none' }}
                >
                  <div style={{ width: 52, height: 52, background: '#fff', borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18, border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
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

      {/* ══ PRZED / PO ════════════════════════════════════════ */}
      <section className="section-pad" style={{ padding: '96px 24px', background: '#f8fafc' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: 56 }}>
              <span style={{ display: 'inline-block', fontSize: 11.5, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#7c3aed', background: '#f5f3ff', padding: '5px 14px', borderRadius: 20, border: '1px solid #ddd6fe', marginBottom: 18 }}>Efekt</span>
              <h2 style={{ fontSize: 'clamp(30px,4.5vw,52px)', fontWeight: 800, color: '#111827', marginBottom: 16, letterSpacing: '-1.5px' }}>
                Mniej chaosu. Mniej braków.<br />Więcej kontroli.
              </h2>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <div className="comp-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderRadius: 20, overflow: 'hidden', border: '1px solid #e5e7eb', boxShadow: '0 8px 40px rgba(0,0,0,.07)' }}>
              {/* Before */}
              <div style={{ background: '#fafafa', padding: '36px 36px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
                  <XCircle size={18} color="#dc2626" />
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#9ca3af', letterSpacing: '1px', textTransform: 'uppercase' }}>Bez systemu</span>
                </div>
                {BEFORE.map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, marginBottom: i < BEFORE.length - 1 ? 16 : 0, alignItems: 'flex-start' }}>
                    <span style={{ color: '#fca5a5', fontSize: 16, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>✗</span>
                    <span style={{ fontSize: 15, color: '#9ca3af', textDecoration: 'line-through', textDecorationColor: '#e5e7eb', lineHeight: 1.5 }}>{item}</span>
                  </div>
                ))}
              </div>

              {/* After */}
              <div style={{ background: '#fff', padding: '36px 36px', borderLeft: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
                  <CheckCircle2 size={18} color="#2563eb" />
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#2563eb', letterSpacing: '1px', textTransform: 'uppercase' }}>Z Magzic</span>
                </div>
                {AFTER.map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, marginBottom: i < AFTER.length - 1 ? 16 : 0, alignItems: 'flex-start' }}>
                    <CheckCircle2 size={16} color="#22c55e" style={{ flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: 15, color: '#111827', fontWeight: 500, lineHeight: 1.5 }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          {/* Metric pills */}
          <Reveal delay={160}>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginTop: 28 }}>
              {[
                { icon: LayoutDashboard, color: '#3b82f6', bg: '#eff6ff', text: '1 system zamiast arkuszy' },
                { icon: BarChart3,       color: '#10b981', bg: '#f0fdf4', text: '24/7 widoczność stanów' },
                { icon: Brain,           color: '#8b5cf6', bg: '#f5f3ff', text: 'AI alerty przed problemem' },
                { icon: History,         color: '#f59e0b', bg: '#fffbeb', text: 'Pełna historia ruchów' },
              ].map(m => (
                <div key={m.text} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: m.bg, border: '1px solid', borderColor: m.bg, borderRadius: 24, padding: '8px 16px' }}>
                  <m.icon size={14} color={m.color} />
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: '#374151' }}>{m.text}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══ CTA ═══════════════════════════════════════════════ */}
      <section style={{
        padding: '100px 24px', position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg, #1e1b4b 0%, #1e3a8a 42%, #0c4a6e 100%)',
      }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 900, height: 900, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,.08) 0%, transparent 58%)', pointerEvents: 'none' }} />
        <Reveal>
          <div style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
            <h2 style={{ fontSize: 'clamp(30px,5vw,56px)', fontWeight: 800, color: '#fff', marginBottom: 20, letterSpacing: '-2px', lineHeight: 1.08 }}>
              Zamień magazynowy chaos<br />w system, który działa codziennie.
            </h2>
            <p style={{ fontSize: 18, color: 'rgba(255,255,255,.62)', marginBottom: 16, lineHeight: 1.65 }}>
              Zacznij od prostego magazynu, dodaj lokalizacje, faktury i AI wtedy,<br />kiedy firma zacznie rosnąć.
            </p>
            <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,.35)', marginBottom: 44 }}>
              Dla firm z magazynem, ekipami, lokalizacjami i codziennym obiegiem towaru.
            </p>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/register"
                style={{ padding: '15px 38px', background: '#fff', color: '#1d4ed8', borderRadius: 11, fontWeight: 700, fontSize: 16, textDecoration: 'none', boxShadow: '0 4px 24px rgba(0,0,0,.25)', transition: 'all .2s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 36px rgba(0,0,0,.32)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,.25)' }}
              >Zarejestruj się</Link>
              <Link to="/login"
                style={{ padding: '15px 38px', background: 'rgba(255,255,255,.09)', color: '#fff', borderRadius: 11, fontWeight: 700, fontSize: 16, textDecoration: 'none', border: '1px solid rgba(255,255,255,.22)', backdropFilter: 'blur(4px)', transition: 'background .2s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.17)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,.09)'}
              >Zaloguj się</Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ══ TRUST STRIP ═══════════════════════════════════════ */}
      <section id="bezpieczenstwo" style={{ background: '#0d1526', padding: '20px 24px' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto' }}>
          <div className="trust-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 32 }}>
            {[
              { icon: Shield,   text: 'Supabase Auth · JWT' },
              { icon: Lock,     text: 'HTTPS · TLS' },
              { icon: Database, text: 'Row Level Security' },
              { icon: Building2,text: 'Izolacja danych organizacji' },
            ].map(t => (
              <div key={t.text} style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#334155' }}>
                <t.icon size={13} color="#1e293b" />
                <span style={{ fontSize: 12.5, fontWeight: 500, whiteSpace: 'nowrap' }}>{t.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FOOTER ════════════════════════════════════════════ */}
      <footer style={{ background: '#060d1a', padding: '22px', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,.04)' }}>
        <p style={{ fontSize: 13.5, color: '#1e293b' }}>© 2026 Magzic</p>
      </footer>

    </div>
  )
}
