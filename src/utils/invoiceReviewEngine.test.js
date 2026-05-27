import { describe, it, expect } from 'vitest'
import { buildInvoicesNeedingReview } from './invoiceReviewEngine'

function makeInvoice(id, overrides = {}) {
  return {
    id,
    numer: `FV/${id}/2025`,
    data_zakupu: '2025-03-01',
    typ: 'zakup',
    status: 'zatwierdzona',
    kontrahent_id: 1,
    kontrahenci: { id: 1, nazwa: 'Firma X' },
    ...overrides,
  }
}

function makeLine(faktura_id, overrides = {}) {
  return {
    id: Math.random(),
    faktura_id,
    towar_id: 1,
    ilosc: 2,
    cena_netto: 10,
    raw_name: 'Towar A',
    towary: { id: 1, nazwa: 'Towar A' },
    ...overrides,
  }
}

describe('buildInvoicesNeedingReview', () => {
  it('wykrywa fakturę bez numeru', () => {
    const invoices = [makeInvoice(1, { numer: '' })]
    const r = buildInvoicesNeedingReview({ invoices, invoiceLines: [] })
    const inv = r.invoicesToReview.find(i => i.id === 1)
    expect(inv).toBeTruthy()
    expect(inv.issues.some(i => i.type === 'missing_invoice_number')).toBe(true)
  })

  it('wykrywa fakturę bez daty', () => {
    const invoices = [makeInvoice(1, { data_zakupu: null })]
    const r = buildInvoicesNeedingReview({ invoices, invoiceLines: [] })
    const inv = r.invoicesToReview.find(i => i.id === 1)
    expect(inv.issues.some(i => i.type === 'missing_invoice_date')).toBe(true)
  })

  it('wykrywa fakturę bez kontrahenta', () => {
    const invoices = [makeInvoice(1, { kontrahent_id: null, kontrahenci: null })]
    const invoiceLines = [makeLine(1)]
    const r = buildInvoicesNeedingReview({ invoices, invoiceLines })
    const inv = r.invoicesToReview.find(i => i.id === 1)
    expect(inv.issues.some(i => i.type === 'missing_contractor')).toBe(true)
  })

  it('wykrywa fakturę bez pozycji', () => {
    const invoices = [makeInvoice(1)]
    const r = buildInvoicesNeedingReview({ invoices, invoiceLines: [] })
    const inv = r.invoicesToReview.find(i => i.id === 1)
    expect(inv.issues.some(i => i.type === 'missing_lines')).toBe(true)
  })

  it('wykrywa pozycję bez ceny', () => {
    const invoices = [makeInvoice(1)]
    const invoiceLines = [makeLine(1, { cena_netto: 0 })]
    const r = buildInvoicesNeedingReview({ invoices, invoiceLines })
    const inv = r.invoicesToReview.find(i => i.id === 1)
    expect(inv.issues.some(i => i.type === 'missing_price')).toBe(true)
  })

  it('wykrywa pozycję bez ilości', () => {
    const invoices = [makeInvoice(1)]
    const invoiceLines = [makeLine(1, { ilosc: 0 })]
    const r = buildInvoicesNeedingReview({ invoices, invoiceLines })
    const inv = r.invoicesToReview.find(i => i.id === 1)
    expect(inv.issues.some(i => i.type === 'missing_quantity')).toBe(true)
  })

  it('wykrywa niedopasowaną pozycję bez towaru', () => {
    const invoices = [makeInvoice(1)]
    const invoiceLines = [makeLine(1, { towar_id: null })]
    const r = buildInvoicesNeedingReview({ invoices, invoiceLines })
    const inv = r.invoicesToReview.find(i => i.id === 1)
    expect(inv.issues.some(i => i.type === 'unmatched_lines')).toBe(true)
  })

  it('wykrywa status roboczy', () => {
    const invoices = [makeInvoice(1, { status: 'robocza' })]
    const invoiceLines = [makeLine(1, { towar_id: null })]
    const r = buildInvoicesNeedingReview({ invoices, invoiceLines })
    const inv = r.invoicesToReview.find(i => i.id === 1)
    expect(inv.issues.some(i => i.type === 'draft_or_incomplete')).toBe(true)
  })

  it('liczy liczbę problemów per faktura', () => {
    const invoices = [makeInvoice(1, { numer: '', kontrahent_id: null, kontrahenci: null })]
    const invoiceLines = [makeLine(1, { cena_netto: 0 })]
    const r = buildInvoicesNeedingReview({ invoices, invoiceLines })
    const inv = r.invoicesToReview.find(i => i.id === 1)
    expect(inv.issueCount).toBeGreaterThanOrEqual(2)
  })

  it('ustawia severity critical dla faktury bez pozycji', () => {
    const invoices = [makeInvoice(1)]
    const r = buildInvoicesNeedingReview({ invoices, invoiceLines: [] })
    const inv = r.invoicesToReview.find(i => i.id === 1)
    expect(inv.severity).toBe('critical')
  })

  it('ustawia severity warning dla faktury z brakiem kontrahenta', () => {
    const invoices = [makeInvoice(1, { kontrahent_id: null, kontrahenci: null })]
    const invoiceLines = [makeLine(1)]
    const r = buildInvoicesNeedingReview({ invoices, invoiceLines })
    const inv = r.invoicesToReview.find(i => i.id === 1)
    expect(inv.severity).toBe('warning')
  })

  it('buduje issueBreakdown', () => {
    const invoices = [makeInvoice(1), makeInvoice(2, { numer: '' })]
    const invoiceLines = [makeLine(1, { towar_id: null })]
    const r = buildInvoicesNeedingReview({ invoices, invoiceLines })
    expect(Array.isArray(r.issueBreakdown)).toBe(true)
    expect(r.issueBreakdown.length).toBeGreaterThan(0)
    const entry = r.issueBreakdown[0]
    expect(entry).toHaveProperty('type')
    expect(entry).toHaveProperty('count')
    expect(entry).toHaveProperty('label')
  })

  it('liczy KPI reviewedCount', () => {
    const invoices = [makeInvoice(1), makeInvoice(2)]
    const invoiceLines = [makeLine(1), makeLine(2)]
    const r = buildInvoicesNeedingReview({ invoices, invoiceLines })
    expect(r.kpis.reviewedCount).toBe(2)
  })

  it('liczy KPI reviewCount', () => {
    const invoices = [makeInvoice(1), makeInvoice(2, { numer: '' })]
    const invoiceLines = [makeLine(1), makeLine(2)]
    const r = buildInvoicesNeedingReview({ invoices, invoiceLines })
    expect(r.kpis.reviewCount).toBeGreaterThanOrEqual(1)
  })

  it('liczy KPI criticalCount', () => {
    const invoices = [makeInvoice(1), makeInvoice(2)]
    const invoiceLines = [makeLine(1)]
    const r = buildInvoicesNeedingReview({ invoices, invoiceLines })
    expect(r.kpis.criticalCount).toBeGreaterThanOrEqual(1)
  })

  it('obsługuje pusty input', () => {
    const r = buildInvoicesNeedingReview({})
    expect(r.hasEnoughData).toBe(false)
    expect(typeof r.summaryText).toBe('string')
    expect(r.invoicesToReview).toHaveLength(0)
  })

  it('nie zwraca NaN ani Infinity', () => {
    const invoices = [makeInvoice(1, { numer: null, data_zakupu: null })]
    const r = buildInvoicesNeedingReview({ invoices, invoiceLines: [] })
    expect(isNaN(r.kpis.reviewedCount)).toBe(false)
    expect(isFinite(r.kpis.reviewCount)).toBe(true)
    expect(isFinite(r.kpis.reviewRatio)).toBe(true)
  })
})
