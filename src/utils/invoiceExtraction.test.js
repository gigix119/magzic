import { describe, it, expect } from 'vitest'
import { isForbiddenAsInvoiceItem } from './invoiceLineGuards'
import { normalizePolishNumber, normalizeDate, extractWithPatterns } from './polishInvoicePatterns'
import { normalizeVatRate } from './polishInvoicePatterns'

// ── invoiceLineGuards ─────────────────────────────────────────────────────────

describe('isForbiddenAsInvoiceItem', () => {
  it('blocks summary lines', () => {
    expect(isForbiddenAsInvoiceItem('Razem netto')).toBe(true)
    expect(isForbiddenAsInvoiceItem('Suma brutto')).toBe(true)
    expect(isForbiddenAsInvoiceItem('Do zapłaty')).toBe(true)
    expect(isForbiddenAsInvoiceItem('Łącznie')).toBe(true)
  })

  it('blocks payment/banking info', () => {
    expect(isForbiddenAsInvoiceItem('Numer konta: 12 3456 7890')).toBe(true)
    expect(isForbiddenAsInvoiceItem('IBAN PL12 3456 7890 1234 5678 9012 3456')).toBe(true)
    expect(isForbiddenAsInvoiceItem('Termin płatności: 14 dni')).toBe(true)
  })

  it('blocks raw PL IBAN numbers', () => {
    expect(isForbiddenAsInvoiceItem('PL12 1234 5678 9012 3456 7890 1234')).toBe(true)
    expect(isForbiddenAsInvoiceItem('PL1212345678901234567890123456')).toBe(true)
  })

  it('blocks header lines', () => {
    expect(isForbiddenAsInvoiceItem('Faktura VAT')).toBe(true)
    expect(isForbiddenAsInvoiceItem('Sprzedawca:')).toBe(true)
    expect(isForbiddenAsInvoiceItem('Nabywca:')).toBe(true)
  })

  it('blocks KSeF metadata', () => {
    expect(isForbiddenAsInvoiceItem('Numer KSeF: PL-12345')).toBe(true)
    expect(isForbiddenAsInvoiceItem('PLU 1234')).toBe(true)
    expect(isForbiddenAsInvoiceItem('PKWiU: 47.11')).toBe(true)
  })

  it('blocks too-short lines', () => {
    expect(isForbiddenAsInvoiceItem('AB')).toBe(true)
    expect(isForbiddenAsInvoiceItem('')).toBe(true)
    expect(isForbiddenAsInvoiceItem(null)).toBe(true)
  })

  it('allows normal product names', () => {
    expect(isForbiddenAsInvoiceItem('Śruba M6x20 ocynkowana')).toBe(false)
    expect(isForbiddenAsInvoiceItem('Farba lateksowa biała 10L')).toBe(false)
    expect(isForbiddenAsInvoiceItem('Usługa serwisowa')).toBe(false)
  })

  it('blocks lines with only numbers/symbols', () => {
    expect(isForbiddenAsInvoiceItem('12345')).toBe(true)
    expect(isForbiddenAsInvoiceItem('---')).toBe(true)
  })
})

// ── normalizePolishNumber ─────────────────────────────────────────────────────

describe('normalizePolishNumber', () => {
  it('handles Polish decimal comma', () => {
    expect(normalizePolishNumber('1234,56')).toBeCloseTo(1234.56)
  })

  it('handles space as thousands separator', () => {
    expect(normalizePolishNumber('2 071,54')).toBeCloseTo(2071.54)
  })

  it('handles dot-thousands comma-decimal', () => {
    expect(normalizePolishNumber('1.234,56')).toBeCloseTo(1234.56)
  })

  it('handles plain float', () => {
    expect(normalizePolishNumber('99.99')).toBeCloseTo(99.99)
  })

  it('handles integer', () => {
    expect(normalizePolishNumber('500')).toBe(500)
  })

  it('handles "7,-" shorthand', () => {
    expect(normalizePolishNumber('7,-')).toBe(7)
  })

  it('returns NaN for empty', () => {
    expect(normalizePolishNumber('')).toBeNaN()
  })

  it('returns NaN for null', () => {
    expect(normalizePolishNumber(null)).toBeNaN()
  })
})

// ── normalizeDate ─────────────────────────────────────────────────────────────

describe('normalizeDate', () => {
  it('passes through ISO format', () => {
    expect(normalizeDate('2025-03-15')).toBe('2025-03-15')
  })

  it('converts DD.MM.YYYY', () => {
    expect(normalizeDate('15.03.2025')).toBe('2025-03-15')
  })

  it('converts DD/MM/YYYY', () => {
    expect(normalizeDate('01/12/2024')).toBe('2024-12-01')
  })

  it('converts YYYY.MM.DD', () => {
    expect(normalizeDate('2025.03.15')).toBe('2025-03-15')
  })

  it('converts 2-digit year', () => {
    expect(normalizeDate('15.03.25')).toBe('2025-03-15')
  })

  it('returns null for null', () => {
    expect(normalizeDate(null)).toBe(null)
  })

  it('returns null for empty string', () => {
    expect(normalizeDate('')).toBe(null)
  })
})

// ── extractWithPatterns ───────────────────────────────────────────────────────

describe('extractWithPatterns — invoice number', () => {
  it('extracts FV prefix invoice number', () => {
    const result = extractWithPatterns('Faktura VAT FV/2025/001 z dnia 15.03.2025')
    expect(result.numer).toBeTruthy()
    expect(result.numer).toMatch(/FV/)
  })

  it('extracts FP prefix', () => {
    const result = extractWithPatterns('FP 12345/2025')
    expect(result.numer).toBeTruthy()
  })

  it('extracts date from text', () => {
    const result = extractWithPatterns('Data wystawienia: 15.03.2025')
    expect(result.data).toBe('2025-03-15')
  })

  it('extracts date in ISO format', () => {
    const result = extractWithPatterns('Data: 2025-03-15')
    expect(result.data).toBe('2025-03-15')
  })

  it('extracts first NIP as sprzedawca', () => {
    const result = extractWithPatterns('NIP: 1234567890\nNIP: 9876543210')
    expect(result.nipSprzedawcy).toBe('1234567890')
    expect(result.nipNabywcy).toBe('9876543210')
  })

  it('extracts suma netto', () => {
    const result = extractWithPatterns('Razem netto: 1 234,56 zł')
    expect(result.sumaNetto).toBeCloseTo(1234.56)
  })

  it('extracts suma brutto from "do zapłaty"', () => {
    const result = extractWithPatterns('Do zapłaty: 1 518,51 zł')
    expect(result.sumaBrutto).toBeCloseTo(1518.51)
  })

  it('does not extract KSeF ID as numer', () => {
    const result = extractWithPatterns('1234567890-20250315-ABC123-XY')
    expect(result.numer).toBeUndefined()
  })

  it('extracts date from "z dnia" phrase', () => {
    const result = extractWithPatterns('Faktura z dnia 15.03.2025')
    expect(result.data).toBe('2025-03-15')
  })

  it('extracts year-first numer format', () => {
    const result = extractWithPatterns('Numer: 2025/FV/001')
    expect(result.numer).toBeTruthy()
    expect(result.numer).toMatch(/2025/)
  })

  it('extracts NIP with PL prefix', () => {
    const result = extractWithPatterns('NIP: PL1234567890')
    expect(result.nipSprzedawcy).toBe('1234567890')
  })

  it('extracts kwotaVat from "w tym vat" line', () => {
    const result = extractWithPatterns('W tym VAT: 284,95 zł')
    expect(result.kwotaVat).toBeCloseTo(284.95)
  })
})

// ── normalizeVatRate ──────────────────────────────────────────────────────────

describe('normalizeVatRate', () => {
  it('parses 23%', () => {
    expect(normalizeVatRate('23%')).toBe(23)
  })

  it('parses 8', () => {
    expect(normalizeVatRate('8')).toBe(8)
  })

  it('parses "zw" as 0', () => {
    expect(normalizeVatRate('zw')).toBe(0)
  })

  it('parses "np" as 0', () => {
    expect(normalizeVatRate('np')).toBe(0)
  })

  it('returns null for empty', () => {
    expect(normalizeVatRate('')).toBe(null)
  })

  it('returns null for null', () => {
    expect(normalizeVatRate(null)).toBe(null)
  })

  it('returns null for invalid rate', () => {
    expect(normalizeVatRate('99%')).toBe(null)
  })
})
