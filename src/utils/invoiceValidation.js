import { isForbiddenAsInvoiceItem } from './invoiceLineGuards.js'

function approxEqual(a, b, tolerance = 0.02) {
  if (a == null || b == null || !b) return false
  return Math.abs(a - b) / Math.max(Math.abs(b), 0.01) <= tolerance
}

export function validatePolishNip(nip) {
  if (!nip) return false
  const digits = String(nip).replace(/\D/g, '')
  if (digits.length !== 10) return false
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7]
  const sum = weights.reduce((s, w, i) => s + w * parseInt(digits[i]), 0)
  const control = sum % 11
  return control < 10 && control === parseInt(digits[9])
}

export function validateInvoiceItem(item) {
  const errors = []
  const warnings = []

  const nazwa = item.nazwa || item.rawName || ''
  const ilosc = item.ilosc ?? item.quantity ?? 0
  const cena = item.cenaNetto ?? item.unitPriceNet ?? 0
  const wartosc = item.wartoscNetto ?? item.totalNet ?? 0

  if (!nazwa || nazwa.trim().length < 2) errors.push('Brak nazwy pozycji')
  if (!ilosc || Number(ilosc) <= 0) errors.push('Nieprawidłowa ilość')
  if (Number(cena) < 0) errors.push('Ujemna cena netto')
  if (Number(cena) === 0) warnings.push('Cena netto = 0')

  if (ilosc && cena && wartosc) {
    const expected = Number(ilosc) * Number(cena)
    if (!approxEqual(expected, Number(wartosc), 0.05)) {
      warnings.push(
        `Wartość netto (${Number(wartosc).toFixed(2)}) ≠ ilość × cena (${expected.toFixed(2)})`
      )
    }
  }

  const vatVal = item.vat ?? item.vat_procent ?? null
  if (vatVal !== null && ![0, 5, 8, 23].includes(Number(vatVal))) {
    warnings.push(`Niestandardowa stawka VAT: ${vatVal}%`)
  }

  return { valid: errors.length === 0, errors, warnings }
}

export function validateTotals(items, fields) {
  const warnings = []
  if (!items.length) return warnings

  const sumNetto = items.reduce((s, i) => s + Number(i.wartoscNetto ?? i.totalNet ?? 0), 0)
  const sumBrutto = items.reduce((s, i) => s + Number(i.wartoscBrutto ?? 0), 0)

  if (fields.suma_netto && !approxEqual(sumNetto, fields.suma_netto, 0.05)) {
    warnings.push(
      `Suma pozycji netto (${sumNetto.toFixed(2)} zł) ≠ suma faktury (${Number(fields.suma_netto).toFixed(2)} zł)`
    )
  }

  if (fields.suma_brutto && sumBrutto > 0 && !approxEqual(sumBrutto, fields.suma_brutto, 0.05)) {
    warnings.push(
      `Suma pozycji brutto (${sumBrutto.toFixed(2)} zł) ≠ suma faktury (${Number(fields.suma_brutto).toFixed(2)} zł)`
    )
  }

  return warnings
}

export function calculateConfidence(result) {
  let score = 0
  let maxScore = 95

  if (result.fields.numer) score += 20
  if (result.fields.data_zakupu) score += 20
  if (result.fields.kontrahent_nip) score += 10
  if (result.validation?.errors?.length === 0) score += 10

  const pozycje = result.fields.pozycje || []

  if (pozycje.length > 0) score += 15
  if (pozycje.length > 2) score += 5

  const completePozycje = pozycje.filter(p =>
    (p.rawName || p.nazwa) && p.ilosc > 0 && p.cenaNetto > 0 && p.jednostka
  )
  if (completePozycje.length === pozycje.length && pozycje.length > 0) score += 10

  if ((result.validation?.warnings?.length ?? 0) === 0) score += 10

  const errors = result.validation?.errors || []
  const warnings = result.validation?.warnings || []

  if (errors.length > 0) maxScore = Math.min(maxScore, 60)
  if (warnings.length > 2) maxScore = Math.min(maxScore, 80)

  const zeroPricePozycje = pozycje.filter(p => p.cenaNetto === 0)
  if (zeroPricePozycje.length > 0) maxScore = Math.min(maxScore, 65)

  const suspiciousPozycje = pozycje.filter(p =>
    isForbiddenAsInvoiceItem(p.rawName || p.nazwa || '', {})
  )
  if (suspiciousPozycje.length > 0) maxScore = Math.min(maxScore, 45)

  return Math.min(score, maxScore)
}

export function validateInvoiceExtraction(result) {
  const errors = []
  const warnings = []

  if (!result.fields.numer) warnings.push('Nie udało się odczytać numeru faktury')
  if (!result.fields.data_zakupu && !result.fields.data_wystawienia) warnings.push('Nie udało się odczytać daty')

  const nip = result.fields.kontrahent_nip || result.fields.sprzedawca_nip
  if (nip && !validatePolishNip(nip)) {
    warnings.push(`NIP ${nip} — niepoprawna suma kontrolna`)
  }

  for (const item of result.fields.pozycje) {
    const { errors: ie, warnings: iw } = validateInvoiceItem(item)
    const label = item.nazwa || item.rawName || '?'
    errors.push(...ie.map(e => `Poz. "${label}": ${e}`))
    warnings.push(...iw.map(w => `Poz. "${label}": ${w}`))
    if (!item.warnings) item.warnings = []
    item.warnings.push(...ie, ...iw)
  }

  const totalWarnings = validateTotals(result.fields.pozycje, result.fields)
  warnings.push(...totalWarnings)

  let suggestedAction = 'auto_fill'
  if (errors.length > 0) suggestedAction = 'manual_required'
  else if (warnings.length > 2 || result.confidence < 60) suggestedAction = 'review_required'
  else if (result.confidence < 85) suggestedAction = 'review_required'

  result.validation = {
    isValid: errors.length === 0,
    confidence: result.confidence,
    errors,
    warnings,
    suspiciousFields: [...new Set(warnings.map(w => w.split(':')[0].trim()))],
    suggestedAction,
  }

  return result
}
