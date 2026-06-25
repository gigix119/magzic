/**
 * tablicaTokens.js
 * Magzic Tablice — design tokens (JS, konwersja z figma/src/tokens/tablicaTokens.ts)
 * Mapa 1:1 do magzic-tablice-tokens.json i Figma Variables / kolekcja „Tokens".
 *
 * Użycie:
 *   import { getTheme } from '../lib/tablicaTokens'
 *   const t = getTheme('baltic')
 *   style={{ background: t.bg.deep, color: t.text.primary }}
 */

// ─── Kolory list / okładek tablic (stałe — poza trybami) ──────────────────────
export const listaColors = {
  none: 'transparent',
  teal: '#0FA3B1',
  violet: '#5B4A9E',
  amber: '#C47A1E',
  green: '#1F7A5C',
  red: '#8B2E2E',
  navy: '#2B4A6F',
}

// ─── Spacing (space/*) ──────────────────────────────────────────────────────────
export const space = {
  4: '4px',
  8: '8px',
  12: '12px',
  16: '16px',
  20: '20px',
  24: '24px',
  32: '32px',
}

// ─── Radius (radius/*) ──────────────────────────────────────────────────────────
export const radius = {
  sm8: '8px',
  md12: '12px',
  lg16: '16px',
  pill999: '999px',
}

// ─── Typography ─────────────────────────────────────────────────────────────────
export const typography = {
  display: { family: "'Space Grotesk', sans-serif", size: '24px', weight: 700 },
  title: { family: "'Space Grotesk', sans-serif", size: '16px', weight: 600 },
  body: { family: "'Inter', sans-serif", size: '14px', weight: 400 },
  label: { family: "'Inter', sans-serif", size: '13px', weight: 500 },
  caption: { family: "'Inter', sans-serif", size: '12px', weight: 400 },
  inputMinSize: '16px',
}

// ─── Shadows ────────────────────────────────────────────────────────────────────
export const shadow = {
  card: '0 1px 4px rgba(0,0,0,0.25)',
  cardHover: '0 4px 12px rgba(0,0,0,0.40)',
  cardDrag: '0 12px 32px rgba(0,0,0,0.55)',
  column: '0 4px 32px rgba(0,0,0,0.38)',
  modal: '0 24px 64px rgba(0,0,0,0.65)',
  fab: '0 4px 20px rgba(55,160,201,0.50)',
  bottomNav: '0 8px 32px rgba(0,0,0,0.45)',
}

// ─── Theme values ───────────────────────────────────────────────────────────────
const THEMES = {
  baltic: {
    name: 'Baltic Deep',
    bg: { abyss: '#080F1A', deep: '#0A1A2F', mid: '#13314F', tide: '#1E4D6B', board: '#1A8B99' },
    glass: { surface: 'rgba(255,255,255,0.09)', edge: 'rgba(255,255,255,0.18)', edgeTop: 'rgba(255,255,255,0.28)', scrim: 'rgba(8,18,32,0.62)', blur: 'blur(20px)' },
    akcent: { baltic: '#37A0C9' },
    text: { primary: '#F4F8FB', muted: '#A9BBC9' },
    status: { zmiana: '#F5A524', przyjazd: '#2BD17E', wyjazd: '#9B8CFF' },
    isLight: false,
  },
  midnight: {
    name: 'Midnight Slate',
    bg: { abyss: '#050508', deep: '#0D0D0F', mid: '#141418', tide: '#1C1C24', board: '#1C1C24' },
    glass: { surface: 'rgba(255,255,255,0.06)', edge: 'rgba(255,255,255,0.10)', edgeTop: 'rgba(255,255,255,0.18)', scrim: 'rgba(3,3,5,0.70)', blur: 'blur(20px)' },
    akcent: { baltic: '#7C6FF7' },
    text: { primary: '#F0F0F8', muted: '#8B8B9E' },
    status: { zmiana: '#F5A524', przyjazd: '#2BD17E', wyjazd: '#9B8CFF' },
    isLight: false,
  },
  coastal: {
    name: 'Coastal Fog',
    bg: { abyss: '#D8E4EE', deep: '#EEF3F8', mid: '#EEF3F8', tide: '#EEF3F8', board: '#D8E4EE' },
    glass: { surface: 'rgba(255,255,255,0.94)', edge: 'rgba(0,0,0,0.08)', edgeTop: 'rgba(0,0,0,0.10)', scrim: 'rgba(0,0,0,0.40)', blur: 'blur(0px)' },
    akcent: { baltic: '#0B7FCC' },
    text: { primary: '#0F1923', muted: '#5E7080' },
    status: { zmiana: '#E8930A', przyjazd: '#16A870', wyjazd: '#6B52E0' },
    isLight: true,
  },
  sunset: {
    name: 'Sunset Coast',
    bg: { abyss: '#0F0408', deep: '#1A0A18', mid: '#2D1320', tide: '#3D2010', board: '#2D1320' },
    glass: { surface: 'rgba(255,230,200,0.07)', edge: 'rgba(255,200,150,0.16)', edgeTop: 'rgba(255,210,170,0.26)', scrim: 'rgba(16,4,12,0.65)', blur: 'blur(20px)' },
    akcent: { baltic: '#E8855A' },
    text: { primary: '#F5EBE0', muted: '#C4A898' },
    status: { zmiana: '#F5A524', przyjazd: '#4CC68D', wyjazd: '#C084FC' },
    isLight: false,
  },
}

/** Zwraca pełny zestaw tokenów dla danego motywu */
export function getTheme(key) {
  return THEMES[key]
}

/** Wszystkie motywy — do ThemeSwitcher */
export const themes = THEMES
