import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Warehouse, FileText, Bell, Brain, BarChart3, History, Sparkles,
  ShieldCheck, ArrowRight, ChevronDown, Building2, Users, Wrench,
  Hotel, Home, Briefcase, Lock, Database, Eye, Server,
  MapPin, Menu, X, TrendingDown, Receipt,
} from 'lucide-react'

/* ─── Scroll-reveal hook ─────────────────────────────────── */
function useReveal(threshold = 0.1) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
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
      transform: visible ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.99)',
      transition: `opacity 0.55s ease ${delay}ms, transform 0.55s ease ${delay}ms`,
      ...style,
    }}>
      {children}
    </div>
  )
}

/* ─── Data ───────────────────────────────────────────────── */
const PROBLEMS = [
  { icon: MapPin, color: '#ef4444', bg: '#fef2f2', border: '#fecaca',
    title: 'Nie wiesz, gdzie leży towar',
    desc: 'Szukasz po wszystkich magazynach, tracisz czas na pytania i zgadywanie.' },
  { icon: TrendingDown, color: '#f59e0b', bg: '#fffbeb', border: '#fde68a',
    title: 'Braki wychodzą za późno',
    desc: 'Dowiadujesz się o problemie, gdy nie ma już czasu na zamówienie.' },
  { icon: Receipt, color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe',
    title: 'Faktury nie aktualizują stanów',
    desc: 'Ręczne przepisywanie do arkuszy — błędy i stracone godziny tygodniowo.' },
  { icon: History, color: '#06b6d4', bg: '#ecfeff', border: '#a5f3fc',
    title: 'Sprzątanie bez historii',
    desc: 'Technicy pobierają produkty bez śladu — nikt nie wie co zużyto i kiedy.' },
]

const FEATURES = [
  { icon: Warehouse, color: '#3b82f6', title: 'Stany per magazyn', desc: 'Aktualne ilości w każdym magazynie w jednym widoku.' },
  { icon: MapPin, color: '#8b5cf6', title: 'Lokalizacje i apartamenty', desc: 'Przypisuj towary do konkretnych lokalizacji i budynków.' },
  { icon: FileText, color: '#06b6d4', title: 'Faktury z odczytem AI', desc: 'Zatwierdź fakturę — stan magazynu aktualizuje się automatycznie.' },
  { icon: Bell, color: '#ef4444', title: 'Alerty braków', desc: 'Natychmiastowe powiadomienie gdy stan spada poniżej minimum.' },
  { icon: Brain, color: '#10b981', title: 'Predykcja zużycia', desc: 'System przewiduje kiedy zabraknie danego towaru.' },
  { icon: History, color: '#6b7280', title: 'Historia ruchów', desc: 'Pełny audit trail — kto, co, kiedy pobrał lub dodał.' },
  { icon: Sparkles, color: '#f59e0b', title: 'Pakiety sprzątania', desc: 'Jednym klikiem wydaj zestaw produktów na sprzątanie.' },
  { icon: BarChart3, color: '#3b82f6', title: 'Dashboard operacyjny', desc: 'Kluczowe metryki i wykresy zużycia na głównym ekranie.' },
]

const AI_INSIGHTS = [
  { icon: '⚠️', label: 'Prognoza', text: 'Za 7 dni zabraknie papieru toaletowego w Magazynie Sprzątanie.', action: 'Zamów' },
  { icon: '📈', label: 'Anomalia', text: 'Zużycie CLIN jest o 38% wyższe niż zwykle — rozważ zwiększenie zamówienia.', action: 'Analizuj' },
  { icon: '💡', label: 'Rekomendacja', text: 'Przenieś 10 szt z Magazynu Głównego do Magazynu Sprzątanie — wystarczy na miesiąc.', action: 'Wykonaj' },
  { icon: '✅', label: 'Gotowe', text: 'Faktura FV/2025/088 została odczytana i jest gotowa do zatwierdzenia.', action: 'Zatwierdź' },
]

const AUDIENCES = [
  { icon: Building2, color: '#3b82f6', title: 'Apartamenty', desc: 'Zarządzaj środkami czystości i wyposażeniem wielu lokali w jednym systemie.' },
  { icon: Hotel, color: '#8b5cf6', title: 'Hotele', desc: 'Integruj wiele budynków i magazynów z pełnym wglądem operacyjnym.' },
  { icon: Users, color: '#10b981', title: 'Housekeeping', desc: 'Planuj sprzątanie z pełną kontrolą stanów — co zużyto, co zostało.' },
  { icon: Wrench, color: '#f59e0b', title: 'Technicy serwisowi', desc: 'Zarządzaj narzędziami i częściami zamiennymi w terenie.' },
  { icon: Home, color: '#06b6d4', title: 'Najem krótkoterminowy', desc: 'Automatyczne alerty przed każdym przyjazdem gościa.' },
  { icon: Briefcase, color: '#ef4444', title: 'Firmy serwisowe', desc: 'Kontrola zapasów konsumpcyjnych i zasobów ekip zewnętrznych.' },
]

const SECURITY = [
  { icon: ShieldCheck, color: '#22c55e', bg: '#f0fdf4', border: '#bbf7d0', title: 'Supabase Auth', desc: 'Bezpieczne logowanie z tokenami JWT i sesją po stronie serwera.' },
  { icon: Lock, color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe', title: 'Szyfrowane połączenia', desc: 'Cały ruch przez HTTPS — dane w tranzycie zawsze zaszyfrowane.' },
  { icon: Database, color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe', title: 'Row Level Security', desc: 'Każdy użytkownik widzi wyłącznie swoje dane — na poziomie bazy danych.' },
  { icon: Eye, color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', title: 'Zero sekretów w kodzie', desc: 'Żadnych haseł w repozytorium — wyłącznie zmienne środowiskowe.' },
  { icon: Server, color: '#06b6d4', bg: '#ecfeff', border: '#a5f3fc', title: 'Separacja danych', desc: 'Dane różnych organizacji logicznie odizolowane w bazie danych.' },
]

const NAV_LINKS = [
  ['funkcje', 'Funkcje'],
  ['ai', 'AI'],
  ['dla-kogo', 'Dla kogo'],
  ['bezpieczenstwo', 'Bezpieczeństwo'],
]

/* ─── Component ─────────────────────────────────────────── */
export default function Landing() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function scrollTo(id) {
    setMobileOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif', color: '#111827', background: '#fff', overflowX: 'hidden' }}>

      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        @keyframes float    { 0%,100%{ transform:translateY(0);} 50%{ transform:translateY(-10px);} }
        @keyframes glow-pulse { 0%,100%{ opacity:.35; } 50%{ opacity:.65; } }
        @keyframes dot-blink { 0%,100%{ opacity:1; } 50%{ opacity:.3; } }

        .nav-btn {
          background:none; border:none; padding:7px 13px; border-radius:7px;
          font-size:14px; font-weight:500; color:#374151; cursor:pointer;
          font-family:'DM Sans',sans-serif; transition:background .15s,color .15s;
        }
        .nav-btn:hover { background:#f3f4f6; color:#111827; }

        .card-lift {
          transition: transform .22s cubic-bezier(.4,0,.2,1),
                      box-shadow .22s cubic-bezier(.4,0,.2,1),
                      border-color .22s;
        }
        .card-lift:hover {
          transform: translateY(-4px);
          box-shadow: 0 16px 48px rgba(59,130,246,.13) !important;
          border-color: #bfdbfe !important;
        }

        .ai-row { transition: background .18s, border-color .18s; }
        .ai-row:hover { background: rgba(255,255,255,.1) !important; border-color: rgba(255,255,255,.18) !important; }

        .btn-primary {
          display:inline-flex; align-items:center; gap:7px;
          padding:13px 26px; background:linear-gradient(135deg,#3b82f6,#2563eb);
          color:#fff; border-radius:10px; font-weight:700; font-size:16px;
          text-decoration:none; border:none; cursor:pointer;
          box-shadow:0 4px 14px rgba(59,130,246,.4);
          font-family:'DM Sans',sans-serif;
          transition: transform .2s, box-shadow .2s;
        }
        .btn-primary:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(59,130,246,.52); }

        .btn-ghost {
          display:inline-flex; align-items:center; gap:7px;
          padding:13px 26px; background:rgba(255,255,255,.75);
          color:#374151; border-radius:10px; font-weight:600; font-size:16px;
          border:1px solid #e5e7eb; cursor:pointer;
          font-family:'DM Sans',sans-serif; text-decoration:none;
          backdrop-filter:blur(4px);
          transition: background .2s, border-color .2s, box-shadow .2s;
        }
        .btn-ghost:hover { background:#fff; border-color:#d1d5db; box-shadow:0 4px 12px rgba(0,0,0,.08); }

        /* hide / show for mobile */
        .desk-only { display:flex; }
        .mob-only  { display:none; }
        @media(max-width:768px) {
          .desk-only  { display:none !important; }
          .mob-only   { display:flex !important; }
          .hero-grid  { grid-template-columns:1fr !important; gap:44px !important; }
          .ai-grid    { grid-template-columns:1fr !important; gap:44px !important; }
          .feat-grid  { grid-template-columns:1fr 1fr !important; }
          .prob-grid  { grid-template-columns:1fr 1fr !important; }
          .aud-grid   { grid-template-columns:1fr 1fr !important; }
        }
        @media(max-width:520px) {
          .feat-grid { grid-template-columns:1fr !important; }
          .prob-grid { grid-template-columns:1fr !important; }
          .aud-grid  { grid-template-columns:1fr !important; }
        }
        @media(max-width:1024px) and (min-width:769px) {
          .feat-grid { grid-template-columns:repeat(2,1fr) !important; }
          .prob-grid { grid-template-columns:repeat(2,1fr) !important; }
        }
      `}</style>

      {/* ══ NAVBAR ══════════════════════════════════════════ */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        background: scrolled ? 'rgba(255,255,255,0.92)' : 'transparent',
        backdropFilter: scrolled ? 'blur(18px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(18px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(229,231,235,.8)' : '1px solid transparent',
        boxShadow: scrolled ? '0 1px 24px rgba(0,0,0,.06)' : 'none',
        transition: 'all .25s ease',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Logo */}
          <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg,#3b82f6,#2563eb)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(59,130,246,.35)' }}>
              <Warehouse size={18} color="#fff" />
            </div>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#111827', fontFamily: 'DM Mono, monospace', letterSpacing: '-0.5px' }}>Magzic</span>
          </Link>

          {/* Desktop nav links */}
          <nav className="desk-only" style={{ gap: 2, flex: 1, marginLeft: 20 }}>
            {NAV_LINKS.map(([id, label]) => (
              <button key={id} className="nav-btn" onClick={() => scrollTo(id)}>{label}</button>
            ))}
          </nav>

          {/* Desktop auth */}
          <div className="desk-only" style={{ alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            <Link to="/login"
              style={{ padding: '8px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600, color: '#374151', textDecoration: 'none', border: '1px solid #e5e7eb', background: 'transparent', transition: 'all .15s', display: 'inline-block' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.color = '#2563eb' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.color = '#374151' }}
            >
              Zaloguj się
            </Link>
            <Link to="/register"
              style={{ padding: '8px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, color: '#fff', textDecoration: 'none', background: 'linear-gradient(135deg,#3b82f6,#2563eb)', boxShadow: '0 2px 8px rgba(59,130,246,.3)', transition: 'all .15s', display: 'inline-block' }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 14px rgba(59,130,246,.48)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(59,130,246,.3)'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              Zarejestruj się
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="mob-only"
            onClick={() => setMobileOpen(v => !v)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: '#374151', alignItems: 'center', justifyContent: 'center' }}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile dropdown */}
        {mobileOpen && (
          <div style={{ background: 'rgba(255,255,255,.98)', backdropFilter: 'blur(16px)', borderTop: '1px solid #e5e7eb', padding: '12px 24px 20px' }}>
            {NAV_LINKS.map(([id, label]) => (
              <button key={id} onClick={() => scrollTo(id)}
                style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '12px 0', fontSize: 16, fontWeight: 500, color: '#374151', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', fontFamily: 'DM Sans, sans-serif' }}
              >
                {label}
              </button>
            ))}
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Link to="/login" onClick={() => setMobileOpen(false)}
                style={{ textAlign: 'center', padding: '12px', borderRadius: 9, fontSize: 15, fontWeight: 600, color: '#374151', textDecoration: 'none', border: '1px solid #e5e7eb' }}
              >Zaloguj się</Link>
              <Link to="/register" onClick={() => setMobileOpen(false)}
                style={{ textAlign: 'center', padding: '12px', borderRadius: 9, fontSize: 15, fontWeight: 600, color: '#fff', textDecoration: 'none', background: 'linear-gradient(135deg,#3b82f6,#2563eb)' }}
              >Zarejestruj się</Link>
            </div>
          </div>
        )}
      </header>

      {/* ══ HERO ════════════════════════════════════════════ */}
      <section style={{
        paddingTop: 120, paddingBottom: 112,
        position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(160deg, #eef4ff 0%, #f4f0ff 45%, #f0fffe 100%)',
      }}>
        {/* Glow blobs */}
        <div style={{ position: 'absolute', top: -100, right: -80, width: 640, height: 640, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,.14) 0%, transparent 68%)', animation: 'glow-pulse 5s ease-in-out infinite', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -60, left: -100, width: 480, height: 480, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,.11) 0%, transparent 68%)', animation: 'glow-pulse 6s ease-in-out infinite 1.5s', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', position: 'relative' }}>
          <div className="hero-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 460px', gap: 72, alignItems: 'center' }}>

            {/* Text */}
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(59,130,246,.08)', border: '1px solid rgba(59,130,246,.22)', borderRadius: 24, padding: '6px 15px', fontSize: 13, color: '#2563eb', fontWeight: 600, marginBottom: 30, backdropFilter: 'blur(4px)' }}>
                <Brain size={13} /> Napędzany przez AI
              </div>

              <h1 style={{ fontSize: 'clamp(34px,5.5vw,60px)', fontWeight: 800, lineHeight: 1.1, color: '#111827', marginBottom: 22, letterSpacing: '-1.5px' }}>
                Magzic —<br />
                <span style={{ background: 'linear-gradient(135deg,#2563eb 0%,#7c3aed 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                  interaktywny&nbsp;magazyn&nbsp;AI
                </span>
              </h1>

              <p style={{ fontSize: 18, color: '#6b7280', lineHeight: 1.75, marginBottom: 40, maxWidth: 500 }}>
                Zarządzaj towarami, magazynami, fakturami i zapasami z pomocą inteligentnych rekomendacji AI. Koniec z chaosem, ręcznym liczeniem i spóźnionymi zakupami.
              </p>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Link to="/register" className="btn-primary">
                  Rozpocznij teraz <ArrowRight size={17} />
                </Link>
                <button onClick={() => scrollTo('funkcje')} className="btn-ghost">
                  Zobacz możliwości <ChevronDown size={17} />
                </button>
              </div>
            </div>

            {/* Dashboard mockup */}
            <div style={{ animation: 'float 5s ease-in-out infinite' }}>
              <div style={{ background: '#fff', borderRadius: 22, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 32px 80px rgba(59,130,246,.13), 0 8px 32px rgba(0,0,0,.07), inset 0 1px 0 rgba(255,255,255,.9)' }}>
                {/* Window chrome */}
                <div style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {['#ef4444','#fbbf24','#22c55e'].map(c => (
                      <div key={c} style={{ width: 11, height: 11, borderRadius: '50%', background: c }} />
                    ))}
                  </div>
                  <span style={{ flex: 1, textAlign: 'center', fontSize: 12, color: '#94a3b8', fontFamily: 'DM Mono, monospace' }}>magzic · dashboard</span>
                </div>

                <div style={{ padding: '20px 20px 24px' }}>
                  {/* Stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                    {[
                      { label: 'Towary OK', value: '47', bg: '#f0fdf4', color: '#16a34a', dot: '#22c55e' },
                      { label: 'Niskie stany', value: '3',  bg: '#fffbeb', color: '#d97706', dot: '#fbbf24' },
                      { label: 'Alerty',       value: '1',  bg: '#fef2f2', color: '#dc2626', dot: '#ef4444' },
                      { label: 'Do zatwierdzenia', value: '2', bg: '#eff6ff', color: '#2563eb', dot: '#3b82f6' },
                    ].map(s => (
                      <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: '11px 13px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.dot, display: 'inline-block', flexShrink: 0 }} />
                          <span style={{ fontSize: 10.5, color: '#6b7280', fontWeight: 600 }}>{s.label}</span>
                        </div>
                        <span style={{ fontSize: 28, fontWeight: 800, color: s.color, fontFamily: 'DM Mono, monospace', lineHeight: 1 }}>{s.value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Mini bar chart */}
                  <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 13px', marginBottom: 12, border: '1px solid #f1f5f9' }}>
                    <p style={{ fontSize: 10.5, fontWeight: 600, color: '#94a3b8', marginBottom: 9, textTransform: 'uppercase', letterSpacing: '.4px' }}>Aktywność — 7 dni</p>
                    <div style={{ display: 'flex', gap: 5, alignItems: 'flex-end', height: 38 }}>
                      {[55, 38, 72, 48, 88, 42, 68].map((h, i) => (
                        <div key={i} style={{ flex: 1, background: i === 4 ? 'linear-gradient(180deg,#60a5fa,#3b82f6)' : '#bfdbfe', borderRadius: '3px 3px 0 0', height: `${h}%` }} />
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 5, marginTop: 5 }}>
                      {['P','W','Ś','C','P','S','N'].map((d, i) => (
                        <span key={i} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: '#94a3b8', fontWeight: 600 }}>{d}</span>
                      ))}
                    </div>
                  </div>

                  {/* AI insight */}
                  <div style={{ background: 'linear-gradient(135deg,#fefce8,#fffbeb)', border: '1px solid #fbbf24', borderRadius: 10, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ width: 30, height: 30, background: 'rgba(251,191,36,.15)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Brain size={15} color="#d97706" />
                    </div>
                    <div>
                      <p style={{ fontSize: 10.5, fontWeight: 700, color: '#d97706', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '.3px' }}>AI Insight</p>
                      <p style={{ fontSize: 12.5, color: '#374151', lineHeight: 1.5 }}>Za 7 dni zabraknie papieru w Magazynie Sprzątanie</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ══ PROBLEM ═════════════════════════════════════════ */}
      <section style={{ padding: '96px 24px', background: '#f9fafb', borderTop: '1px solid #f1f5f9' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: 60 }}>
              <span style={{ display: 'inline-block', background: '#fef2f2', color: '#dc2626', fontSize: 12.5, fontWeight: 700, padding: '5px 14px', borderRadius: 20, marginBottom: 16, border: '1px solid #fecaca', letterSpacing: '.3px', textTransform: 'uppercase' }}>Problem</span>
              <h2 style={{ fontSize: 'clamp(26px,4vw,42px)', fontWeight: 800, color: '#111827', marginBottom: 16, letterSpacing: '-.75px', lineHeight: 1.2 }}>
                Chaos magazynowy kosztuje Cię<br />czas i pieniądze
              </h2>
              <p style={{ fontSize: 17, color: '#6b7280', maxWidth: 520, margin: '0 auto', lineHeight: 1.7 }}>
                Znasz te problemy? Magzic rozwiązuje je wszystkie w jednym miejscu.
              </p>
            </div>
          </Reveal>

          <div className="prob-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20 }}>
            {PROBLEMS.map((p, i) => (
              <Reveal key={p.title} delay={i * 80}>
                <div className="card-lift" style={{ background: '#fff', borderRadius: 16, border: `1px solid ${p.border}`, padding: '26px 22px', boxShadow: '0 1px 4px rgba(0,0,0,.04)', height: '100%' }}>
                  <div style={{ width: 48, height: 48, background: p.bg, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, border: `1px solid ${p.border}` }}>
                    <p.icon size={22} color={p.color} />
                  </div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 9, lineHeight: 1.35 }}>{p.title}</h3>
                  <p style={{ fontSize: 13.5, color: '#6b7280', lineHeight: 1.65 }}>{p.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FEATURES ════════════════════════════════════════ */}
      <section id="funkcje" style={{ padding: '96px 24px', background: '#fff' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: 60 }}>
              <span style={{ display: 'inline-block', background: '#eff6ff', color: '#2563eb', fontSize: 12.5, fontWeight: 700, padding: '5px 14px', borderRadius: 20, marginBottom: 16, border: '1px solid #bfdbfe', letterSpacing: '.3px', textTransform: 'uppercase' }}>Możliwości</span>
              <h2 style={{ fontSize: 'clamp(26px,4vw,42px)', fontWeight: 800, color: '#111827', marginBottom: 16, letterSpacing: '-.75px' }}>
                Wszystko, czego potrzebujesz<br />w jednym miejscu
              </h2>
              <p style={{ fontSize: 17, color: '#6b7280', maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>
                Kompleksowy system WMS z inteligentną warstwą AI na każdym kroku.
              </p>
            </div>
          </Reveal>

          <div className="feat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 55}>
                <div className="card-lift" style={{ background: '#fafafa', borderRadius: 14, border: '1px solid #f1f5f9', padding: '22px 20px', height: '100%' }}>
                  <div style={{ width: 42, height: 42, background: '#fff', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
                    <f.icon size={19} color={f.color} />
                  </div>
                  <h3 style={{ fontSize: 14.5, fontWeight: 700, color: '#111827', marginBottom: 7 }}>{f.title}</h3>
                  <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.65 }}>{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ AI ══════════════════════════════════════════════ */}
      <section id="ai" style={{ padding: '96px 24px', background: 'linear-gradient(160deg,#0f172a 0%,#1e1b4b 60%,#0f172a 100%)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '10%', right: '4%', width: 440, height: 440, borderRadius: '50%', background: 'radial-gradient(circle,rgba(139,92,246,.16) 0%,transparent 68%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '10%', left: '4%', width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle,rgba(59,130,246,.13) 0%,transparent 68%)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative' }}>
          <div className="ai-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 72, alignItems: 'center' }}>

            <Reveal>
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(139,92,246,.15)', border: '1px solid rgba(139,92,246,.3)', borderRadius: 24, padding: '6px 15px', fontSize: 13, color: '#a78bfa', fontWeight: 600, marginBottom: 24 }}>
                  <Brain size={13} /> Sztuczna inteligencja
                </div>
                <h2 style={{ fontSize: 'clamp(26px,4vw,42px)', fontWeight: 800, color: '#fff', marginBottom: 20, letterSpacing: '-.75px', lineHeight: 1.2 }}>
                  AI, która rozumie<br />Twój magazyn
                </h2>
                <p style={{ fontSize: 16.5, color: '#94a3b8', lineHeight: 1.75, marginBottom: 32 }}>
                  Magzic analizuje historię zużycia, tempo rotacji i wzorce sezonowe — i daje Ci gotowe rekomendacje zanim pojawi się problem.
                </p>
                <Link to="/register"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '13px 26px', background: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', color: '#fff', borderRadius: 10, fontWeight: 700, fontSize: 15, textDecoration: 'none', boxShadow: '0 4px 16px rgba(139,92,246,.42)', transition: 'all .2s' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(139,92,246,.56)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(139,92,246,.42)' }}
                >
                  Wypróbuj AI <ArrowRight size={16} />
                </Link>
              </div>
            </Reveal>

            <Reveal delay={160}>
              <div style={{ background: 'rgba(255,255,255,.04)', borderRadius: 20, border: '1px solid rgba(255,255,255,.1)', overflow: 'hidden', backdropFilter: 'blur(8px)' }}>
                {/* Panel header */}
                <div style={{ background: 'rgba(139,92,246,.12)', borderBottom: '1px solid rgba(139,92,246,.22)', padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#a78bfa', animation: 'dot-blink 2s ease-in-out infinite' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#c4b5fd', fontFamily: 'DM Mono, monospace' }}>Magzic AI · Rekomendacje</span>
                </div>
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {AI_INSIGHTS.map((ins, i) => (
                    <div key={i} className="ai-row" style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 11, padding: '13px 15px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1.4 }}>{ins.icon}</span>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: '#94a3b8', letterSpacing: '.5px', textTransform: 'uppercase' }}>{ins.label}</span>
                        <p style={{ fontSize: 13.5, color: '#e2e8f0', lineHeight: 1.55, marginTop: 3 }}>{ins.text}</p>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#a78bfa', flexShrink: 0, cursor: 'pointer', whiteSpace: 'nowrap', alignSelf: 'center' }}>{ins.action} →</span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

          </div>
        </div>
      </section>

      {/* ══ DLA KOGO ════════════════════════════════════════ */}
      <section id="dla-kogo" style={{ padding: '96px 24px', background: '#fff' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: 60 }}>
              <span style={{ display: 'inline-block', background: '#f0fdf4', color: '#16a34a', fontSize: 12.5, fontWeight: 700, padding: '5px 14px', borderRadius: 20, marginBottom: 16, border: '1px solid #bbf7d0', letterSpacing: '.3px', textTransform: 'uppercase' }}>Dla kogo</span>
              <h2 style={{ fontSize: 'clamp(26px,4vw,42px)', fontWeight: 800, color: '#111827', marginBottom: 16, letterSpacing: '-.75px' }}>
                Dla każdej firmy operacyjnej
              </h2>
              <p style={{ fontSize: 17, color: '#6b7280', maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>
                Magzic dopasowuje się do Twojej branży i sposobu pracy z magazynem.
              </p>
            </div>
          </Reveal>

          <div className="aud-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }}>
            {AUDIENCES.map((a, i) => (
              <Reveal key={a.title} delay={i * 70}>
                <div className="card-lift" style={{ background: '#fafafa', borderRadius: 16, border: '1px solid #f1f5f9', padding: '28px 24px', height: '100%' }}>
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

      {/* ══ BEZPIECZEŃSTWO ══════════════════════════════════ */}
      <section id="bezpieczenstwo" style={{ padding: '96px 24px', background: '#f9fafb', borderTop: '1px solid #f1f5f9' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: 60 }}>
              <span style={{ display: 'inline-block', background: '#f0fdf4', color: '#16a34a', fontSize: 12.5, fontWeight: 700, padding: '5px 14px', borderRadius: 20, marginBottom: 16, border: '1px solid #bbf7d0', letterSpacing: '.3px', textTransform: 'uppercase' }}>Bezpieczeństwo</span>
              <h2 style={{ fontSize: 'clamp(26px,4vw,42px)', fontWeight: 800, color: '#111827', marginBottom: 16, letterSpacing: '-.75px' }}>
                Twoje dane są bezpieczne
              </h2>
              <p style={{ fontSize: 17, color: '#6b7280', maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>
                Budujemy na sprawdzonych standardach, by Twoje dane były zawsze pod ochroną.
              </p>
            </div>
          </Reveal>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 20, maxWidth: 1000, margin: '0 auto' }}>
            {SECURITY.map((s, i) => (
              <Reveal key={s.title} delay={i * 70}>
                <div className="card-lift" style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: '24px 22px', boxShadow: '0 1px 4px rgba(0,0,0,.04)', height: '100%' }}>
                  <div style={{ width: 44, height: 44, background: s.bg, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, border: `1px solid ${s.border}` }}>
                    <s.icon size={20} color={s.color} />
                  </div>
                  <h3 style={{ fontSize: 14.5, fontWeight: 700, color: '#111827', marginBottom: 8 }}>{s.title}</h3>
                  <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.65 }}>{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ CTA ═════════════════════════════════════════════ */}
      <section style={{ padding: '100px 24px', background: 'linear-gradient(135deg,#1e3a8a 0%,#2563eb 45%,#0891b2 100%)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle,rgba(255,255,255,.06) 0%,transparent 65%)', pointerEvents: 'none' }} />
        <Reveal>
          <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
            <h2 style={{ fontSize: 'clamp(28px,5vw,50px)', fontWeight: 800, color: '#fff', marginBottom: 20, letterSpacing: '-1px', lineHeight: 1.12 }}>
              Zmień magazynowy chaos<br />w inteligentny system operacyjny.
            </h2>
            <p style={{ fontSize: 18, color: 'rgba(255,255,255,.78)', marginBottom: 44, lineHeight: 1.65 }}>
              Dołącz do firm, które oszczędzają czas i pieniądze dzięki Magzic. Zacznij już teraz — za darmo.
            </p>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/register"
                style={{ padding: '14px 34px', background: '#fff', color: '#1d4ed8', borderRadius: 10, fontWeight: 700, fontSize: 16, textDecoration: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.2)', transition: 'all .2s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(0,0,0,.27)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,.2)' }}
              >
                Zarejestruj się
              </Link>
              <Link to="/login"
                style={{ padding: '14px 34px', background: 'rgba(255,255,255,.12)', color: '#fff', borderRadius: 10, fontWeight: 700, fontSize: 16, textDecoration: 'none', border: '1px solid rgba(255,255,255,.28)', backdropFilter: 'blur(4px)', transition: 'background .2s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.22)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,.12)'}
              >
                Zaloguj się
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ══ FOOTER ══════════════════════════════════════════ */}
      <footer style={{ background: '#0f172a', padding: '28px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: 14, color: '#475569' }}>© 2026 Magzic</p>
      </footer>

    </div>
  )
}
