/**
 * tablicaTokens.ts
 * Magzic Tablice — design tokens (TypeScript)
 * Mapa 1:1 do magzic-tablice-tokens.json i Figma Variables / kolekcja „Tokens"
 * Wygenerowany automatycznie — nie edytuj ręcznie wartości hexów bez aktualizacji JSON.
 *
 * Użycie:
 *   import { tokens, getTheme } from "@/tokens/tablicaTokens";
 *   const t = getTheme("baltic");
 *   style={{ background: t.bg.deep, color: t.text.primary }}
 */

export type ThemeKey = "baltic" | "midnight" | "coastal" | "sunset";

// ─── Token shape ──────────────────────────────────────────────────────────────
export interface ThemeTokens {
  /** bg/* — tła i gradienty */
  bg: {
    /** #080F1A — najciemniejsze tło (sidebar) */
    abyss: string;
    /** gradient start — tło płótna BoardGrid */
    deep: string;
    /** gradient mid */
    mid: string;
    /** gradient end */
    tide: string;
    /**
     * Kolor tła wnętrza tablicy.
     * Źródło Supabase: tablice.kolor_tla
     * Domyślna wartość per motyw; zastępowana przez wybór użytkownika.
     */
    board: string;
  };
  /** glass/* — efekt glass-morphism */
  glass: {
    /** Wypełnienie paneli (kolumny, modal, header) */
    surface: string;
    /** Obramowanie glass (boki + dół) */
    edge: string;
    /** Obramowanie glass — górna krawędź (jaśniejsza) */
    edgeTop: string;
    /** Overlay za modalami */
    scrim: string;
    /** backdrop-filter: blur() */
    blur: string;
  };
  /** akcent/* */
  akcent: {
    /** Główny kolor CTA, focus ring, aktywne elementy */
    baltic: string;
  };
  /** text/* */
  text: {
    primary: string;
    muted: string;
  };
  /**
   * status/* — kolory typów pracy.
   * Źródło: karty.klasyfikacja ∈ { 'zmiana', 'przyjazd', 'wyjazd' }
   * Automatyzacja BlueApart ustawia to pole z importu KW Hotel.
   */
  status: {
    /** Pełna zmiana między gościami */
    zmiana: string;
    /** Przygotowanie pod check-in */
    przyjazd: string;
    /** Obsługa po wymeldowaniu */
    wyjazd: string;
  };
  /** Flagi pomocnicze */
  isLight: boolean;
  /** Nazwy motywu */
  name: string;
}

// ─── Kolory list / okładek tablic (stałe — poza trybami) ─────────────────────
/**
 * lista/* — kolory nagłówków list i okładek tablic.
 * Źródło: listy.kolor ∈ { 'teal', 'violet', 'amber', 'green', 'red', 'navy', null }
 * null → brak koloru (domyślny przezroczysty nagłówek)
 */
export const listaColors = {
  none:   "transparent",
  teal:   "#0FA3B1",
  violet: "#5B4A9E",
  amber:  "#C47A1E",
  green:  "#1F7A5C",
  red:    "#8B2E2E",
  navy:   "#2B4A6F",
} as const;

export type ListaColorKey = keyof typeof listaColors;

// ─── Spacing (space/*) ────────────────────────────────────────────────────────
export const space = {
  4:  "4px",
  8:  "8px",
  12: "12px",
  16: "16px",
  20: "20px",
  24: "24px",
  32: "32px",
} as const;

// ─── Radius (radius/*) ────────────────────────────────────────────────────────
export const radius = {
  /** Karty (KartaTablicy), przyciski, inputy */
  sm8:    "8px",
  /** Listy (Lista), kafle tablic (BoardCard) */
  md12:   "12px",
  /** Modale (CreateBoardModal), panele (BoardMenu) */
  lg16:   "16px",
  /** StatusPill, FilterChip, BottomNav, liczniki */
  pill999: "999px",
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────
export const typography = {
  display: { family: "'Space Grotesk', sans-serif", size: "24px", weight: 700 },
  title:   { family: "'Space Grotesk', sans-serif", size: "16px", weight: 600 },
  body:    { family: "'Inter', sans-serif",          size: "14px", weight: 400 },
  label:   { family: "'Inter', sans-serif",          size: "13px", weight: 500 },
  caption: { family: "'Inter', sans-serif",          size: "12px", weight: 400 },
  /** Minimalna wartość dla <input> — blokuje auto-zoom na iOS */
  inputMinSize: "16px",
} as const;

// ─── Shadows ──────────────────────────────────────────────────────────────────
export const shadow = {
  card:       "0 1px 4px rgba(0,0,0,0.25)",
  cardHover:  "0 4px 12px rgba(0,0,0,0.40)",
  cardDrag:   "0 12px 32px rgba(0,0,0,0.55)",
  column:     "0 4px 32px rgba(0,0,0,0.38)",
  modal:      "0 24px 64px rgba(0,0,0,0.65)",
  fab:        "0 4px 20px rgba(55,160,201,0.50)",
  bottomNav:  "0 8px 32px rgba(0,0,0,0.45)",
} as const;

// ─── Theme values ─────────────────────────────────────────────────────────────
const THEMES: Record<ThemeKey, ThemeTokens> = {
  baltic: {
    name: "Baltic Deep",
    bg:     { abyss: "#080F1A", deep: "#0A1A2F", mid: "#13314F", tide: "#1E4D6B", board: "#1A8B99" },
    glass:  { surface: "rgba(255,255,255,0.09)", edge: "rgba(255,255,255,0.18)", edgeTop: "rgba(255,255,255,0.28)", scrim: "rgba(8,18,32,0.62)", blur: "blur(20px)" },
    akcent: { baltic: "#37A0C9" },
    text:   { primary: "#F4F8FB", muted: "#A9BBC9" },
    status: { zmiana: "#F5A524", przyjazd: "#2BD17E", wyjazd: "#9B8CFF" },
    isLight: false,
  },
  midnight: {
    name: "Midnight Slate",
    bg:     { abyss: "#050508", deep: "#0D0D0F", mid: "#141418", tide: "#1C1C24", board: "#1C1C24" },
    glass:  { surface: "rgba(255,255,255,0.06)", edge: "rgba(255,255,255,0.10)", edgeTop: "rgba(255,255,255,0.18)", scrim: "rgba(3,3,5,0.70)", blur: "blur(20px)" },
    akcent: { baltic: "#7C6FF7" },
    text:   { primary: "#F0F0F8", muted: "#8B8B9E" },
    status: { zmiana: "#F5A524", przyjazd: "#2BD17E", wyjazd: "#9B8CFF" },
    isLight: false,
  },
  coastal: {
    name: "Coastal Fog",
    bg:     { abyss: "#D8E4EE", deep: "#EEF3F8", mid: "#EEF3F8", tide: "#EEF3F8", board: "#D8E4EE" },
    glass:  { surface: "rgba(255,255,255,0.94)", edge: "rgba(0,0,0,0.08)", edgeTop: "rgba(0,0,0,0.10)", scrim: "rgba(0,0,0,0.40)", blur: "blur(0px)" },
    akcent: { baltic: "#0B7FCC" },
    text:   { primary: "#0F1923", muted: "#5E7080" },
    status: { zmiana: "#E8930A", przyjazd: "#16A870", wyjazd: "#6B52E0" },
    isLight: true,
  },
  sunset: {
    name: "Sunset Coast",
    bg:     { abyss: "#0F0408", deep: "#1A0A18", mid: "#2D1320", tide: "#3D2010", board: "#2D1320" },
    glass:  { surface: "rgba(255,230,200,0.07)", edge: "rgba(255,200,150,0.16)", edgeTop: "rgba(255,210,170,0.26)", scrim: "rgba(16,4,12,0.65)", blur: "blur(20px)" },
    akcent: { baltic: "#E8855A" },
    text:   { primary: "#F5EBE0", muted: "#C4A898" },
    status: { zmiana: "#F5A524", przyjazd: "#4CC68D", wyjazd: "#C084FC" },
    isLight: false,
  },
};

/** Zwraca pełny zestaw tokenów dla danego motywu */
export function getTheme(key: ThemeKey): ThemeTokens {
  return THEMES[key];
}

/** Wszystkie motywy — do ThemeSwitcher */
export const themes = THEMES;

// ─── Component prop interfaces (handoff) ─────────────────────────────────────

/**
 * BoardCard — kafel tablicy na siatce.
 * Figma variants: cover=color|photo, starred=bool, hover=bool
 */
export interface BoardCardProps {
  /** Supabase: tablice.id */
  id: string;
  /** Supabase: tablice.nazwa */
  name: string;
  /**
   * Okładka tablicy.
   * Supabase: tablice.kolor_tla (hex) lub tablice.foto_url (Storage URL)
   */
  cover: { type: "color"; value: string } | { type: "photo"; url: string };
  /** Supabase: tablice.ulubiona */
  starred: boolean;
  /** Supabase: tablice.ostatnio_przeglądana (timestamptz) — opcjonalny */
  lastVisited?: string;
  onStarToggle?: (id: string) => void;
  onClick?: () => void;
}

/**
 * Lista — kolumna kart na tablicy.
 * Figma variants: headerColor=none|teal|violet|amber|green|red|navy, collapsed=bool
 */
export interface ListaProps {
  /** Supabase: listy.id */
  id: string;
  /** Supabase: listy.nazwa */
  name: string;
  /**
   * Kolor nagłówka listy.
   * Supabase: listy.kolor ∈ ListaColorKey
   * null = brak koloru (domyślny stan)
   */
  headerColor?: ListaColorKey;
  /** Supabase: listy.pozycja (fractional indexing) */
  position: number;
  collapsed?: boolean;
}

/**
 * KartaTablicy — karta Kanban.
 * Figma variants: variant=simple|enriched, lines=1|2|4, hasLabels, hasCover, hasMeta, state=default|hover|drag
 */
export interface KartaProps {
  /** Supabase: karty.id */
  id: string;
  /** Supabase: karty.tytul */
  title: string;
  /**
   * Etykiety koloru.
   * Supabase: karty.etykiety (JSONB array [{kolor: string, tekst?: string}])
   * Widoczne tylko gdy variant="enriched" i etykiety.length > 0
   */
  labels?: { color: string; text?: string }[];
  /**
   * Foto okładki karty.
   * Supabase: Storage → signed URL TTL 1h
   * Widoczne tylko gdy variant="enriched" i hasCover=true
   */
  coverPhoto?: string;
  /** Supabase: count(zalaczniki) WHERE zalaczniki.karta_id = karty.id */
  attachments?: number;
  /** Supabase: length(karty.opis) > 0 */
  hasDescription?: boolean;
  /** Supabase: karty.termin (timestamptz → display DD.MM) */
  deadline?: string;
  isOverdue?: boolean;
  /** Supabase: karty.lista_id */
  listaId: string;
  /** Supabase: karty.pozycja (fractional indexing within lista) */
  position: number;
  /** Supabase: karty.klasyfikacja ∈ 'zmiana' | 'przyjazd' | 'wyjazd' | null */
  klasyfikacja?: "zmiana" | "przyjazd" | "wyjazd";
  /** Stan wizualny (tylko UI) */
  state?: "default" | "hover" | "drag";
}

/**
 * BottomNav — pływający pasek nawigacji.
 * Figma variants: active=inbox|planner|board|switch
 */
export interface BottomNavProps {
  active: "inbox" | "planner" | "board" | "switch";
}

// ─── Screens registry ─────────────────────────────────────────────────────────
/**
 * Rejestr ekranów — status "Ready for dev" dla wszystkich.
 * Odpowiada sekcjom w Figma Dev Mode.
 */
export const screens = {
  "A-01": { name: "BoardGrid desktop",    size: "1440×900", status: "Ready for dev" },
  "A-02": { name: "CreateBoardModal",     size: "1440×900", status: "Ready for dev" },
  "A-03": { name: "BoardGrid mobile",     size: "375×812",  status: "Ready for dev" },
  "B-01": { name: "BoardInterior teal",   size: "1440×900", status: "Ready for dev" },
  "B-02": { name: "BoardInterior colored",size: "1440×900", status: "Ready for dev" },
  "B-03": { name: "BoardMenu slide-over", size: "1440×900", status: "Ready for dev" },
  "B-04": { name: "BoardInterior mobile", size: "375×812",  status: "Ready for dev" },
  "B-05": { name: "KartaTablicy variants",size: "1440×900", status: "Ready for dev" },
} as const;
