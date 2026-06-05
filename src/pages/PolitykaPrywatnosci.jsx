// TODO: Replace with final legal documents reviewed by a lawyer before production launch
import { Link } from 'react-router-dom'
import { Warehouse } from 'lucide-react'

export default function PolitykaPrywatnosci() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      fontFamily: 'DM Sans, sans-serif',
      padding: '24px 16px',
    }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 40 }}>
          <div style={{ width: 36, height: 36, background: '#3b82f6', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Warehouse size={18} color="#fff" />
          </div>
          <span style={{ fontSize: 20, fontWeight: 700, color: '#111827', fontFamily: 'DM Mono, monospace', letterSpacing: '-0.5px' }}>
            magzic
          </span>
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Polityka Prywatności</h1>
        <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 40 }}>Ostatnia aktualizacja: 2026-06-05</p>

        <Section title="§1. Administrator danych">
          <p>Administratorem Twoich danych osobowych jest właściciel serwisu Magzic (magzic.com). W sprawach dotyczących ochrony danych osobowych możesz skontaktować się z nami poprzez formularz kontaktowy dostępny w Serwisie.</p>
        </Section>

        <Section title="§2. Jakie dane zbieramy">
          <p>Zbieramy dane niezbędne do świadczenia usług: adres e-mail, imię i nazwisko, dane firmy (nazwa, NIP), faktury i dane magazynowe wprowadzone przez Użytkownika. Dane logowania (hasło) są przechowywane w formie zaszyfrowanej.</p>
        </Section>

        <Section title="§3. Cel przetwarzania danych">
          <p>Dane przetwarzamy w celu: świadczenia usług Serwisu, umożliwienia logowania i zarządzania kontem, analizy faktur i danych magazynowych, wysyłki powiadomień systemowych. Jeśli wyraziłeś zgodę — również w celach marketingowych.</p>
        </Section>

        <Section title="§4. Podstawa prawna">
          <p>Przetwarzamy dane na podstawie: wykonania umowy (art. 6 ust. 1 lit. b RODO), Twojej zgody (art. 6 ust. 1 lit. a RODO) oraz prawnie uzasadnionego interesu administratora (art. 6 ust. 1 lit. f RODO).</p>
        </Section>

        <Section title="§5. Twoje prawa">
          <p>Masz prawo do: dostępu do swoich danych, sprostowania, usunięcia (prawo do bycia zapomnianym), ograniczenia przetwarzania, przenoszenia danych oraz wniesienia sprzeciwu. Możesz cofnąć zgodę marketingową w ustawieniach konta.</p>
        </Section>

        <Section title="§6. Cookies">
          <p>Serwis korzysta z plików cookies wyłącznie niezbędnych do działania aplikacji (sesja, uwierzytelnianie). Nie stosujemy cookies śledzących ani reklamowych.</p>
        </Section>

        <Section title="§7. Postanowienia końcowe">
          <p>Polityka prywatności może być aktualizowana. O zmianach informujemy poprzez powiadomienie w Serwisie. Aktualna wersja jest zawsze dostępna pod adresem magzic.com/polityka-prywatnosci.</p>
        </Section>

        <p style={{ marginTop: 48, fontSize: 14, color: '#9ca3af' }}>
          <Link to="/register" style={{ color: '#3b82f6' }}>Wróć do rejestracji</Link>
          {' · '}
          <Link to="/regulamin" style={{ color: '#3b82f6' }}>Regulamin</Link>
          {' · '}
          <Link to="/login" style={{ color: '#3b82f6' }}>Logowanie</Link>
        </p>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: '#111827', marginBottom: 12 }}>{title}</h2>
      <div style={{ color: '#374151', fontSize: 14, lineHeight: 1.7 }}>{children}</div>
    </div>
  )
}
