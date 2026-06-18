// Paleta kolorów tablic/list/etykiet — stonowane, nasycone pastele (nie korpo-niebieski Trello)
export const TABLICA_COLORS = [
  { value: '#5B8DEF', label: 'Niebieski' },
  { value: '#6C63FF', label: 'Indygo' },
  { value: '#22A6A0', label: 'Morski' },
  { value: '#2FB67C', label: 'Zielony' },
  { value: '#E0A53C', label: 'Bursztyn' },
  { value: '#E2725B', label: 'Terakota' },
  { value: '#E0567C', label: 'Malinowy' },
  { value: '#9B6FD1', label: 'Fiolet' },
  { value: '#5C7080', label: 'Grafit' },
  { value: '#2D9CDB', label: 'Lazurowy' },
]

export const TYP_OPTIONS = [
  { value: 'lokale', label: 'Lokale' },
  { value: 'serwis', label: 'Serwis' },
  { value: 'ogolna', label: 'Ogólna' },
]

export const TYP_LABELS = {
  lokale: 'Lokale',
  serwis: 'Serwis',
  ogolna: 'Ogólna',
}

// Fractional indexing: nowa pozycja pomiędzy prev i next (brzegi: null = brak sąsiada)
export function positionBetween(prev, next) {
  if (prev == null && next == null) return 1000
  if (prev == null) return next / 2
  if (next == null) return prev + 1000
  return (prev + next) / 2
}

export function formatTermin(termin) {
  if (!termin) return null
  const d = new Date(termin)
  return d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })
}

export function terminStatus(termin, zakonczona) {
  if (!termin || zakonczona) return 'neutral'
  const diff = new Date(termin).getTime() - Date.now()
  if (diff < 0) return 'overdue'
  if (diff < 1000 * 60 * 60 * 24) return 'soon'
  return 'neutral'
}

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}
