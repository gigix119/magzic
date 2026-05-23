import { isForbiddenAsInvoiceItem } from './invoiceLineGuards.js'

const BRAND_SIGNALS = [
  'bosch', 'samsung', 'lg', 'philips', 'whirlpool', 'electrolux', 'indesit',
  'candy', 'beko', 'siemens', 'aeg', 'hotpoint', 'ariston', 'gorenje',
  'miele', 'liebherr', 'neff', 'zanussi', 'clin', 'brill', 'ajax', 'domestos',
  'lenovo', 'hp', 'dell', 'asus', 'acer', 'apple', 'huawei', 'xiaomi',
]

const PRODUCT_NOUN_SIGNALS = [
  'pralka', 'lodówka', 'zmywarka', 'suszarka', 'zamrażarka', 'kuchenka',
  'piekarnik', 'okap', 'bateria', 'syfon', 'listwa', 'żarówka', 'led',
  'silikon', 'kołki', 'wąż', 'gniazdko', 'przedłużacz', 'śruba', 'wkręt',
  'farba', 'klej', 'uszczelka', 'rurka', 'kabel', 'wtyczka', 'gniazdo',
  'pojemnik', 'worek', 'filtr', 'pompa', 'zawór', 'złącze', 'rura',
  'kratka', 'zawiasa', 'uchwyt', 'wspornik', 'panel', 'płyta',
  'lampa', 'reflektor', 'taśma', 'pianka', 'folia', 'lakier', 'grunt',
]

// Patterns for technical parameters: size, model code, unit, dimensions
const TECH_PARAM_PATTERNS = [
  /\b\d{1,4}(W|kW|V|Hz|L|l|kg|cm|mm|m2|m²|ml|rpm|dB|A|mA)\b/i,
  /\b[A-Z]{2,}\d{2,}[A-Z0-9]*\b/,          // model codes like WGG244ZEPL, E27, G9
  /\b(E14|E27|E40|G4|G9|GU10|GU5\.3)\b/i,  // lamp caps
  /\b(AAA|AA|C|D|9V)\b/,                    // battery sizes
  /\b\d+[xX×]\d+/,                          // dimensions 60x60
  /\b(\d+)\s*(szt|opak|ml|l|kg|g|mb|m2)\b/i,
  /\b\d{1,4}[\s,.]?\d{1,2}\s*(mm|cm|m)\b/i,
]

export function isLikelyInventoryProductName(text) {
  if (!text || typeof text !== 'string') return false
  const t = text.trim()

  if (t.length < 3 || t.length > 160) return false
  if (!/[a-ząćęłńóśźżA-ZĄĆĘŁŃÓŚŹŻ]/.test(t)) return false
  if (isForbiddenAsInvoiceItem(t, {})) return false

  const tokens = t.split(/\s+/).filter(Boolean)
  if (tokens.length < 2 || tokens.length > 15) return false

  const slashCount = (t.match(/\//g) || []).length
  if (slashCount >= 3) return false

  const lower = t.toLowerCase()

  if (BRAND_SIGNALS.some(b => lower.includes(b))) return true
  if (PRODUCT_NOUN_SIGNALS.some(n => lower.includes(n))) return true
  if (TECH_PARAM_PATTERNS.some(p => p.test(t))) return true

  // Uppercase model code (e.g. WGG244ZEPL, WAT28400PL)
  if (/\b[A-Z]{2,}\d{2,}[A-Z0-9]{0,10}\b/.test(t)) return true

  return false
}

export function extractBrandAndModelSignals(text) {
  if (!text) return { brands: [], modelCode: null, hasTechParam: false }
  const lower = text.toLowerCase()
  const brands = BRAND_SIGNALS.filter(b => lower.includes(b))
  const modelMatch = text.match(/\b([A-Z]{2,}\d{2,}[A-Z0-9]*)\b/)
  const modelCode = modelMatch ? modelMatch[1] : null
  const hasTechParam = TECH_PARAM_PATTERNS.some(p => p.test(text))
  return { brands, modelCode, hasTechParam }
}

export function hasTechnicalProductPattern(text) {
  if (!text) return false
  return TECH_PARAM_PATTERNS.some(p => p.test(text))
}

export function isGenericGarbageLine(text) {
  if (!text) return true
  const t = text.trim()
  if (t.length < 3 || t.length > 160) return true
  if (isForbiddenAsInvoiceItem(t, {})) return true
  const slashCount = (t.match(/\//g) || []).length
  if (slashCount >= 3) return true
  return false
}

export function estimateProductNameConfidence(text) {
  if (!text) return 0
  const t = text.trim()
  if (t.length < 3) return 0
  if (isGenericGarbageLine(t)) return 0

  let score = 0.3
  const lower = t.toLowerCase()
  if (BRAND_SIGNALS.some(b => lower.includes(b))) score += 0.3
  if (PRODUCT_NOUN_SIGNALS.some(n => lower.includes(n))) score += 0.25
  if (TECH_PARAM_PATTERNS.some(p => p.test(t))) score += 0.2
  if (/\b[A-Z]{2,}\d{2,}[A-Z0-9]*\b/.test(t)) score += 0.15
  return Math.min(1.0, score)
}
