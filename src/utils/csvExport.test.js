import { describe, it, expect } from 'vitest'
import { toCsv, sanitizeCsvFilename } from './csvExport'

const cols = [
  { key: 'name', label: 'Nazwa' },
  { key: 'price', label: 'Cena' },
]

describe('toCsv', () => {
  it('exports header row with column labels', () => {
    const csv = toCsv([], cols)
    expect(csv).toContain('Nazwa')
    expect(csv).toContain('Cena')
  })

  it('exports values', () => {
    const csv = toCsv([{ name: 'Test', price: '1,23 zł' }], cols)
    expect(csv).toContain('Test')
    expect(csv).toContain('1,23 zł')
  })

  it('uses semicolon as default separator', () => {
    const csv = toCsv([{ name: 'A', price: '1' }], cols)
    expect(csv).toContain(';')
  })

  it('escapes semicolon in value by quoting', () => {
    const csv = toCsv([{ name: 'A;B', price: '1' }], cols)
    expect(csv).toContain('"A;B"')
  })

  it('escapes double quotes by doubling', () => {
    const csv = toCsv([{ name: 'Say "hello"', price: '1' }], cols)
    expect(csv).toContain('""hello""')
  })

  it('escapes newlines by quoting', () => {
    const csv = toCsv([{ name: 'Line1\nLine2', price: '1' }], cols)
    expect(csv).toContain('"Line1\nLine2"')
  })

  it('handles null as empty string', () => {
    const csv = toCsv([{ name: null, price: undefined }], cols)
    const rows = csv.split('\n')
    expect(rows[1]).toBe(';')
  })

  it('does not output "null" or "undefined" as literal text', () => {
    const csv = toCsv([{ name: null, price: undefined }], cols)
    expect(csv).not.toContain('null')
    expect(csv).not.toContain('undefined')
  })

  it('returns header only for empty rows (single line)', () => {
    const csv = toCsv([], cols)
    expect(csv.split('\n').length).toBe(1)
    expect(csv).toBe('Nazwa;Cena')
  })

  it('returns header only for null rows', () => {
    const csv = toCsv(null, cols)
    expect(csv.split('\n').length).toBe(1)
  })

  it('handles custom separator', () => {
    const csv = toCsv([{ name: 'A', price: '1' }], cols, { separator: ',' })
    expect(csv).toContain(',')
    expect(csv).not.toContain(';')
  })
})

describe('sanitizeCsvFilename', () => {
  it('adds .csv extension if missing', () => {
    expect(sanitizeCsvFilename('export')).toBe('export.csv')
  })

  it('keeps existing .csv extension', () => {
    expect(sanitizeCsvFilename('export.csv')).toBe('export.csv')
  })

  it('keeps existing .CSV extension (case insensitive)', () => {
    expect(sanitizeCsvFilename('export.CSV')).toBe('export.CSV')
  })

  it('replaces forward slash', () => {
    expect(sanitizeCsvFilename('a/b')).not.toContain('/')
  })

  it('replaces colon', () => {
    expect(sanitizeCsvFilename('file:name')).not.toContain(':')
  })

  it('replaces asterisk', () => {
    expect(sanitizeCsvFilename('file*name')).not.toContain('*')
  })

  it('handles empty string', () => {
    expect(sanitizeCsvFilename('')).toBe('export.csv')
  })

  it('handles null', () => {
    expect(sanitizeCsvFilename(null)).toBe('export.csv')
  })

  it('handles undefined', () => {
    expect(sanitizeCsvFilename(undefined)).toBe('export.csv')
  })

  it('collapses multiple dashes', () => {
    const result = sanitizeCsvFilename('a//b')
    expect(result).not.toContain('--')
  })
})
