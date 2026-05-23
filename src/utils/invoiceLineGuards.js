const BLOCKED = [
  'razem', 'suma', 'do zapłaty', 'łącznie', 'podsumowanie',
  'zapłacono', 'pozostało', 'konto bankowe', 'nr rachunku',
  'termin płatności', 'termin zaplaty', 'forma płatności', 'forma zaplaty',
  'przelew', 'sposób zapłaty', 'sposob zaplaty',
  'obsługa klienta', 'zapłać online', 'zaplac online', 'zeskanuj kod',
  'tytułem', 'tytulem', 'nazwa odbiorcy', 'numer konta klienta', 'numer konta',
  'abonament za okres', 'opłaty naliczone', 'oplaty naliczone',
  'rozliczenie konta', 'saldo', 'blankiet wpłaty', 'blankiet wplaty',
  'słownie', 'slownie', 'wartość faktury', 'wartosc faktury',
  'razem do zapłaty', 'razem do zaplaty',
  'w tym vat', 'w tym podatek',
  // KSeF / Comarch / e-invoice metadata
  'remarks', 'nr wiersza', 'line number', 'value line number',
  'powered by comarch', 'ksef', 'numer ksef', 'faktura ustrukturyzowana',
  'opłata za pobór', 'oplata za pobor', 'pobór nie przy odbiorze',
  'pobor nie przy odbiorze', 'klucz', 'key',
]

const FORBIDDEN_PATTERNS = [
  // Sumy i podsumowania
  /^(razem|łącznie|lacznie|laczne|suma|total)\b/i,
  /\b(do zapłaty|do zaplaty)\b/i,
  /^(podstawa|podstaw|stawk)/i,
  /^vat\s*[\d%]/i,
  /(kwota|wartość|wartosc)\s+(brutto|netto|vat)\s*:/i,

  // Dane bankowe i adresowe
  /^(numer\s+konta|nr\s+konta|konto|iban|swift)\b/i,
  /\bIBAN\s+PL\b/i,
  /^(bank|nazwa banku)\b/i,
  /^(nip|regon|krs)\s*:/i,
  /^(ul\.|ulica|adres|miasto|kod pocztowy|kod\s+pocz\.)/i,

  // Płatność i terminy
  /\btermin\s+(zapłaty|płatności|zaplaty|platnosci)\b/i,
  /\bsposób\s+zapłaty\b/i,
  /\bpłatność\s+(gotówka|przelew|karta)\b/i,
  /\bplatnosc\s+(gotowka|przelew|karta)\b/i,

  // Telecom-specific
  /\bopłata\s+abonamentowa\b/i,
  /\brozliczenie\s+konta\b/i,
  /\bokres\s+rozliczeniowy\b/i,
  /\bnumer\s+konta\s+klienta\b/i,

  // Faktury i nagłówki
  /^(faktura|invoice|paragon|wz\b|wydanie zewnętrzne)/i,
  /^data\s+(wystawienia|sprzedaży|sprzedazy|dostawy|zakupu)\s*:/i,
  /^(sprzedawca|nabywca|odbiorca|wystawca)\s*:/i,

  // Strony
  /^(strona|str\.|page)\s+\d+/i,
  /^\d+\s*\/\s*\d+$/,

  // Podpisy i pieczęcie
  /\b(podpis|stamp|pieczęć|pieczec)\b/i,
  /\b(otrzymałem|wystawił|sporządził)\b/i,

  // Inne administracyjne
  /^miejsce\s+wystawienia\b/i,
  /^uwagi\b/i,

  // KSeF / Comarch / e-faktura metadata
  /^(remarks|uwagi\s*\/\s*remarks)\b/i,
  /\b(nr wiersza|line number|value line number)\b/i,
  /powered\s+by\s+comarch/i,
  /\bksef\b/i,
  /faktura\s+ustrukturyzowana/i,
  /opłata\s+za\s+pobór/i,
  /pobór\s+nie\s+przy\s+odbiorze/i,

  // EURO-NET KSeF PLU / product-code metadata lines
  /^PLU\s+\d+$/i,
  /^PLU\s*:/i,
  /^PKWiU\s*:/i,
  /^GTU\s*\d*\s*$/i,

  // Slash-separated bilingual metadata (≥3 slashes + metadata keyword)
  /(\w+\s*\/\s*){3,}.*(wiersz|line|klucz|key|uwagi|remarks|wartość|value|opis|description)/i,
]

export function isForbiddenAsInvoiceItem(lineText, context = {}) {
  if (!lineText) return true
  const lower = lineText.toLowerCase().trim()
  if (lower.length < 3) return true

  // Blocked exact/startsWith list (fast path)
  for (const b of BLOCKED) {
    if (lower === b || lower.startsWith(b + ' ') || lower.startsWith(b + ':')) return true
  }

  // Pattern-based (broader coverage)
  for (const p of FORBIDDEN_PATTERNS) {
    if (p.test(lineText)) return true
  }

  // Same numbers/symbols only (no letters)
  if (!/[a-ząćęłńóśźżA-ZĄĆĘŁŃÓŚŹŻ]/.test(lineText)) return true

  // Long lines with metadata keywords → KSeF/Comarch header noise
  if (lineText.length > 160) {
    const metaKeywords = ['wiersz', 'klucz', 'key', 'uwagi', 'remarks', 'value', 'opis', 'description', 'ksef']
    if (metaKeywords.some(k => lower.includes(k))) return true
    if (!context.hasPrice && !context.hasUnit) return true
  }

  // Very long lines with no price/unit context are likely prose
  if (lineText.length > 120 && !context.hasPrice && !context.hasUnit) return true

  return false
}

export function isAllowedLongInventoryName(lineText, context) {
  if (context.inInventoryTable && (context.hasPrice || context.hasUnit)) {
    return true
  }
  return false
}
