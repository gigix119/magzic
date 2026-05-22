const BLOCKED = [
  'razem', 'suma', 'do zapłaty', 'łącznie', 'podsumowanie',
  'zapłacono', 'pozostało', 'konto bankowe', 'nr rachunku',
  'termin płatności', 'forma płatności', 'przelew',
  'obsługa klienta', 'zapłać online', 'zeskanuj kod',
  'tytułem', 'nazwa odbiorcy', 'numer konta klienta', 'numer konta',
  'abonament za okres', 'opłaty naliczone',
  'rozliczenie konta', 'saldo', 'blankiet wpłaty',
  'słownie', 'wartość faktury', 'razem do zapłaty',
  'w tym vat', 'w tym podatek',
]

export function isForbiddenAsInvoiceItem(lineText, context = {}) {
  const lower = lineText.toLowerCase().trim()

  for (const b of BLOCKED) {
    if (lower.startsWith(b) || lower === b) return true
  }

  if (lineText.length > 120 && !context.hasPrice && !context.hasUnit) {
    return true
  }

  return false
}

export function isAllowedLongInventoryName(lineText, context) {
  if (context.inInventoryTable && (context.hasPrice || context.hasUnit)) {
    return true
  }
  return false
}
