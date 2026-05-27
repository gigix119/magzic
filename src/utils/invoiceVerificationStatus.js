import { getAssignmentStatus } from './invoicePositionValidator.js'
import { validatePolishNip } from './invoiceValidation.js'

// ── Contractor validation ─────────────────────────────────────────────────────

const GENERIC_CONTRACTOR_NAMES = new Set([
  'sprzedawca', 'nabywca', 'sprzedawca nabywca', 'nabywca sprzedawca',
  'dostawca', 'kontrahent', 'firma', 'wystawca', 'odbiorca',
  'kupujacy', 'kupujący', 'płatnik', 'platnik',
  'vendor', 'buyer', 'supplier', 'customer', 'seller',
])

export function isGenericContractorName(name) {
  if (!name) return true
  const n = name.toLowerCase().trim()
  if (n.length < 3) return true
  return GENERIC_CONTRACTOR_NAMES.has(n)
}

/**
 * Validates a contractor candidate extracted from PDF.
 * Returns { valid, nipOk, warnings }.
 */
export function validateContractorFromPdf(candidate) {
  if (!candidate) return { valid: false, nipOk: null, warnings: ['Brak danych kontrahenta'] }
  const warnings = []

  if (isGenericContractorName(candidate.nazwa)) {
    return {
      valid: false,
      nipOk: null,
      warnings: ['Nie udało się pewnie odczytać nazwy kontrahenta — wybierz lub wpisz ręcznie'],
    }
  }

  let nipOk = null
  if (candidate.nip) {
    nipOk = validatePolishNip(candidate.nip)
    if (!nipOk) {
      warnings.push(`NIP ${candidate.nip} — niepoprawna suma kontrolna`)
    }
  }

  return { valid: true, nipOk, warnings }
}

// ── Item status helpers ───────────────────────────────────────────────────────

export { getAssignmentStatus as getVerificationStatus }

export function getVerificationStatusConfig(status) {
  const configs = {
    ready: {
      label: 'Gotowa do dodania do magazynu',
      short: '✓ gotowa',
      bg: '#dcfce7', color: '#166534', border: '#86efac',
    },
    service_cost: {
      label: 'Usługa / koszt — nie wpłynie na magazyn',
      short: '✓ usługa',
      bg: '#f0fdf4', color: '#166534', border: '#bbf7d0',
    },
    needs_review: {
      label: 'Wymaga weryfikacji przed zatwierdzeniem',
      short: '⚠ sprawdź',
      bg: '#fef9c3', color: '#854d0e', border: '#fde047',
    },
    needs_price: {
      label: 'Brak ceny — uzupełnij cenę przed zapisem',
      short: '✗ brak ceny',
      bg: '#fee2e2', color: '#991b1b', border: '#fca5a5',
    },
    needs_product: {
      label: 'Wybierz towar, aby pozycja trafiła do magazynu',
      short: '✗ brak towaru',
      bg: '#fee2e2', color: '#991b1b', border: '#fca5a5',
    },
    ignored: {
      label: 'Pominięta — nie zostanie zapisana',
      short: '– pominięta',
      bg: '#f3f4f6', color: '#6b7280', border: '#e5e7eb',
    },
  }
  return configs[status] || configs.ignored
}

export function getItemTypeLabel(itemType) {
  const map = {
    inventory_item: { text: 'Towar', bg: '#dcfce7', color: '#166534' },
    service_item: { text: 'Usługa', bg: '#fed7aa', color: '#9a3412' },
    cost_item: { text: 'Koszt', bg: '#fce7f3', color: '#9d174d' },
    fee_item: { text: 'Opłata', bg: '#fce7f3', color: '#9d174d' },
  }
  return map[itemType] || { text: 'Sprawdź', bg: '#f3f4f6', color: '#6b7280' }
}

const SERVICE_NAME_KEYWORDS = [
  'transport', 'dostawa', 'montaż', 'montaz', 'usługa', 'usluga',
  'abonament', 'prowizja', 'opłata', 'oplata', 'serwis',
  'energia', 'telefon', 'licencja', 'subskrypcja',
  'konsulting', 'doradztwo', 'szkolenie', 'naprawa', 'projekt',
  'wdrożenie', 'wdrozenie', 'programowanie', 'hosting',
]

export function looksLikeServiceItem(rawName) {
  if (!rawName) return false
  const lower = rawName.toLowerCase()
  return SERVICE_NAME_KEYWORDS.some(k => lower.includes(k))
}

export function canLineAffectInventory(item) {
  if (!item) return false
  return item.itemType === 'inventory_item' && item.shouldAffectInventory !== false
}

export function canLineBeSavedAsDraft(item) {
  if (!item) return false
  const name = (item.rawName || item.nazwa || '').trim()
  if (!name || name.length < 2) return false
  if (item.lineType === 'summary_line' || item.lineType === 'payment_info') return false
  return true
}

export function getLineBlockingReasons(item, towary = []) {
  const status = getAssignmentStatus(item, towary)
  const reasons = []
  if (status === 'needs_price') reasons.push('Brak ceny netto (= 0)')
  if (status === 'needs_product') reasons.push('Brak dopasowania do towaru w bazie')
  if (status === 'needs_review') reasons.push('Niskie dopasowanie towaru — weryfikacja wymagana')
  if (item.warnings?.length > 0) reasons.push(...item.warnings.slice(0, 2))
  return reasons
}
