// TODO: Replace with final legal documents reviewed by a lawyer before production launch
import { Link } from 'react-router-dom'
import { Warehouse } from 'lucide-react'

export default function Regulamin() {
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

        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Regulamin</h1>
        <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 40 }}>Ostatnia aktualizacja: 2026-06-05</p>

        <Section title="§1. Postanowienia ogólne">
          <p>Niniejszy Regulamin określa zasady korzystania z serwisu Magzic dostępnego pod adresem magzic.com, prowadzonego przez właściciela serwisu. Korzystanie z serwisu jest równoznaczne z akceptacją niniejszego Regulaminu.</p>
        </Section>

        <Section title="§2. Definicje">
          <p><strong>Serwis</strong> – platforma Magzic dostępna pod adresem magzic.com.<br />
          <strong>Użytkownik</strong> – osoba fizyczna lub prawna korzystająca z Serwisu.<br />
          <strong>Konto</strong> – indywidualne konto Użytkownika w Serwisie.<br />
          <strong>Workspace</strong> – przestrzeń robocza przypisana do Konta Użytkownika.</p>
        </Section>

        <Section title="§3. Zasady korzystania z serwisu">
          <p>Użytkownik zobowiązuje się do korzystania z Serwisu zgodnie z obowiązującym prawem i zasadami niniejszego Regulaminu. Zabrania się udostępniania danych dostępowych osobom trzecim oraz korzystania z Serwisu w sposób naruszający prawa innych użytkowników.</p>
        </Section>

        <Section title="§4. Dane osobowe i prywatność">
          <p>Zasady przetwarzania danych osobowych opisane są w <Link to="/polityka-prywatnosci" style={{ color: '#3b82f6' }}>Polityce Prywatności</Link>. Administratorem danych osobowych jest właściciel Serwisu.</p>
        </Section>

        <Section title="§5. Odpowiedzialność">
          <p>Serwis świadczy usługi w zakresie zarządzania magazynem i analizy faktur. Właściciel serwisu nie ponosi odpowiedzialności za decyzje biznesowe podjęte na podstawie danych przetworzonych przez Serwis.</p>
        </Section>

        <Section title="§6. Postanowienia końcowe">
          <p>Właściciel serwisu zastrzega sobie prawo do zmiany Regulaminu. O zmianach Użytkownicy będą informowani poprzez powiadomienie w Serwisie. Korzystanie z Serwisu po wprowadzeniu zmian jest równoznaczne z ich akceptacją.</p>
        </Section>

        <p style={{ marginTop: 48, fontSize: 14, color: '#9ca3af' }}>
          <Link to="/register" style={{ color: '#3b82f6' }}>Wróć do rejestracji</Link>
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
