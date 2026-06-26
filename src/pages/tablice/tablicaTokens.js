// Kolory nagłówków list wnętrza tablicy — 1:1 z figma/src/tokens/tablicaTokens.ts (listaColors)
export const LISTA_HEADER_COLORS = [
  { value: '#0FA3B1', label: 'Teal' },
  { value: '#5B4A9E', label: 'Fiolet' },
  { value: '#C47A1E', label: 'Amber' },
  { value: '#1F7A5C', label: 'Zielony' },
  { value: '#8B2E2E', label: 'Czerwony' },
  { value: '#2B4A6F', label: 'Granat' },
]

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

// Gradienty tła boardu — ładniejsze niż Trello, ten sam duch (typ: 'gradient')
export const BOARD_GRADIENTS = [
  { id: 'g-niebieski', nazwa: 'Niebieski', typ: 'gradient', wartosc: 'linear-gradient(135deg, #0079BF, #5BA4CF)', tekst: 'light' },
  { id: 'g-granat', nazwa: 'Granat', typ: 'gradient', wartosc: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', tekst: 'light' },
  { id: 'g-fiolet', nazwa: 'Fiolet', typ: 'gradient', wartosc: 'linear-gradient(135deg, #7048e8, #9775fa)', tekst: 'light' },
  { id: 'g-roz', nazwa: 'Róż', typ: 'gradient', wartosc: 'linear-gradient(135deg, #e64980, #f783ac)', tekst: 'light' },
  { id: 'g-pomarancz', nazwa: 'Pomarańcz', typ: 'gradient', wartosc: 'linear-gradient(135deg, #e8590c, #ff922b)', tekst: 'light' },
  { id: 'g-zielen', nazwa: 'Zieleń', typ: 'gradient', wartosc: 'linear-gradient(135deg, #2b8a3e, #51cf66)', tekst: 'light' },
  { id: 'g-musztarda', nazwa: 'Musztarda', typ: 'gradient', wartosc: 'linear-gradient(135deg, #f08c00, #ffd43b)', tekst: 'dark' },
  { id: 'g-czerwien', nazwa: 'Czerwień', typ: 'gradient', wartosc: 'linear-gradient(135deg, #c92a2a, #ff6b6b)', tekst: 'light' },
  { id: 'g-grafit', nazwa: 'Grafit', typ: 'gradient', wartosc: 'linear-gradient(135deg, #343a40, #495057)', tekst: 'light' },
  { id: 'g-teal', nazwa: 'Morski', typ: 'gradient', wartosc: 'linear-gradient(135deg, #0c8599, #22b8cf)', tekst: 'light' },
  { id: 'g-zachod', nazwa: 'Zachód słońca', typ: 'gradient', wartosc: 'linear-gradient(135deg, #f76707, #ffa94d, #ffd43b)', tekst: 'dark' },
  { id: 'g-polnoc', nazwa: 'Północ', typ: 'gradient', wartosc: 'linear-gradient(135deg, #0b132b, #5b21b6)', tekst: 'light' },
]

// Statyczne, darmowe URL-e zdjęć Unsplash (bez API/klucza) — panoramy/natura/abstrakcje
export const BOARD_PHOTOS = [
  { id: 'p-gory1', url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1600&q=80', miniatura: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&q=60' },
  { id: 'p-gory2', url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1600&q=80', miniatura: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=300&q=60' },
  { id: 'p-gory3', url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1600&q=80', miniatura: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=300&q=60' },
  { id: 'p-plaza', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1600&q=80', miniatura: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=300&q=60' },
  { id: 'p-chmury', url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1600&q=80', miniatura: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=300&q=60' },
  { id: 'p-droga', url: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=1600&q=80', miniatura: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=300&q=60' },
  { id: 'p-jezioro', url: 'https://images.unsplash.com/photo-1444723121867-7a241cacace9?w=1600&q=80', miniatura: 'https://images.unsplash.com/photo-1444723121867-7a241cacace9?w=300&q=60' },
  { id: 'p-kanion', url: 'https://images.unsplash.com/photo-1431794062232-2a99a5431c6c?w=1600&q=80', miniatura: 'https://images.unsplash.com/photo-1431794062232-2a99a5431c6c?w=300&q=60' },
  { id: 'p-las', url: 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=1600&q=80', miniatura: 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=300&q=60' },
  { id: 'p-dolina', url: 'https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=1600&q=80', miniatura: 'https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=300&q=60' },
  { id: 'p-las2', url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1600&q=80', miniatura: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=300&q=60' },
  { id: 'p-zachod2', url: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=1600&q=80', miniatura: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=300&q=60' },
]

// CSS background dla boardu wg typu (solid hex / gradient css / url zdjęcia)
export function getBoardBackgroundStyle(kolorTla, tloTyp) {
  const value = kolorTla || TABLICA_COLORS[0].value
  if (tloTyp === 'zdjecie') {
    return { backgroundImage: `url(${value})`, backgroundSize: 'cover', backgroundPosition: 'center' }
  }
  return { background: value }
}

export function hexToRgba(hex, alpha) {
  if (!hex || hex[0] !== '#') return `rgba(91,141,239,${alpha})`
  const h = hex.slice(1)
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

export const TYP_OPTIONS = [
  { value: 'lokale', label: 'Lokale' },
  { value: 'serwis', label: 'Serwis' },
  { value: 'ogolna', label: 'Ogólna' },
  { value: 'robocza', label: 'Robocza' },
]

export const TYP_LABELS = {
  lokale: 'Lokale',
  serwis: 'Serwis',
  ogolna: 'Ogólna',
  robocza: 'Robocza',
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

// Stabilny kolor awatara wg hashu nazwy (zamiast jednego stałego koloru dla wszystkich)
export function hashColor(str) {
  if (!str) return TABLICA_COLORS[0].value
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = (hash << 5) - hash + str.charCodeAt(i) | 0
  return TABLICA_COLORS[Math.abs(hash) % TABLICA_COLORS.length].value
}

// Klasyfikacja karty (ZMIANA/PRZYJAZD/WYJAZD) wg słów kluczowych w tytule —
// te same słowa co reguły automatyzacji (AutomationModal/reguly_tablic_migration.sql).
// Brak osobnej kolumny w bazie — wnioskowane z tytułu, tylko do celów wizualnych (StatusPill, spine).
export const STATUS_COLORS = { zmiana: '#F5A524', przyjazd: '#2BD17E', wyjazd: '#9B8CFF' }
export const STATUS_LABELS = { zmiana: 'Zmiana', przyjazd: 'Przyjazd', wyjazd: 'Wyjazd' }

export function classifyKarta(tytul) {
  const t = (tytul || '').toLowerCase()
  if (t.includes('zmiana')) return 'zmiana'
  if (t.includes('przyjazd')) return 'przyjazd'
  if (t.includes('wyjazd')) return 'wyjazd'
  return null
}

// Szablony checklisty — wstawiane jako lista stringów, zamieniane na elementy w UI
export const CHECKLIST_TEMPLATES = [
  { id: 'sprzatanie', nazwa: 'Sprzątanie standardowe', items: ['Odkurzanie', 'Mycie łazienki', 'Kuchnia', 'Pościel', 'Ręczniki', 'Śmieci', 'Kontrola'] },
  { id: 'przygotowanie', nazwa: 'Przygotowanie lokalu', items: ['Pościel', 'Ręczniki', 'Środki czystości', 'Test urządzeń', 'Zdjęcia'] },
]

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}
