import { describe, it, expect } from 'vitest'
import { parseAssistantIntent, getAssistantResponse } from './assistantIntentParser.js'

describe('parseAssistantIntent', () => {
  it('rozpoznaje purchase_dashboard', () => {
    const r = parseAssistantIntent('Pokaż dashboard zakupów z ostatniego miesiąca')
    expect(r.intent).toBe('purchase_dashboard')
    expect(r.confidence).toBeGreaterThan(0)
  })

  it('rozpoznaje purchase_dashboard — wariant raport', () => {
    const r = parseAssistantIntent('raport zakupów za ostatni miesiąc')
    expect(r.intent).toBe('purchase_dashboard')
  })

  it('rozpoznaje compare_invoices', () => {
    const r = parseAssistantIntent('Porównaj dwie ostatnie faktury')
    expect(r.intent).toBe('compare_invoices')
    expect(r.confidence).toBeGreaterThan(0)
  })

  it('rozpoznaje compare_invoices — wariant zestawienie', () => {
    const r = parseAssistantIntent('zestawienie faktur z tego miesiąca')
    expect(r.intent).toBe('compare_invoices')
  })

  it('rozpoznaje latest_price_changes', () => {
    const r = parseAssistantIntent('Co najbardziej podrożało?')
    expect(r.intent).toBe('latest_price_changes')
    expect(r.confidence).toBeGreaterThan(0)
  })

  it('rozpoznaje latest_price_changes — wariant wzrost cen', () => {
    const r = parseAssistantIntent('pokaż wzrost cen ostatnio')
    expect(r.intent).toBe('latest_price_changes')
  })

  it('rozpoznaje product_price_history', () => {
    const r = parseAssistantIntent('Pokaż historię ceny produktu')
    expect(r.intent).toBe('product_price_history')
    expect(r.confidence).toBeGreaterThan(0)
  })

  it('rozpoznaje product_price_history — wariant historię cen', () => {
    const r = parseAssistantIntent('jak zmieniała się cena towaru?')
    expect(r.intent).toBe('product_price_history')
  })

  it('rozpoznaje compare_suppliers', () => {
    const r = parseAssistantIntent('Porównaj dostawców')
    expect(r.intent).toBe('compare_suppliers')
    expect(r.confidence).toBeGreaterThan(0)
  })

  it('rozpoznaje compare_suppliers — wariant zestawienie', () => {
    const r = parseAssistantIntent('zestawienie dostawców według cen')
    expect(r.intent).toBe('compare_suppliers')
  })

  it('rozpoznaje invoices_needing_review', () => {
    const r = parseAssistantIntent('Pokaż faktury do weryfikacji')
    expect(r.intent).toBe('invoices_needing_review')
    expect(r.confidence).toBeGreaterThan(0)
  })

  it('rozpoznaje invoices_needing_review — wariant do zatwierdzenia', () => {
    const r = parseAssistantIntent('faktury do zatwierdzenia')
    expect(r.intent).toBe('invoices_needing_review')
  })

  it('rozpoznaje low_stock', () => {
    const r = parseAssistantIntent('Pokaż towary z niskim stanem')
    expect(r.intent).toBe('low_stock')
    expect(r.confidence).toBeGreaterThan(0)
  })

  it('rozpoznaje low_stock — wariant niskie stany', () => {
    const r = parseAssistantIntent('niskie stany magazynowe')
    expect(r.intent).toBe('low_stock')
  })

  it('rozpoznaje order_recommendation', () => {
    const r = parseAssistantIntent('Co powinienem zamówić?')
    expect(r.intent).toBe('order_recommendation')
    expect(r.confidence).toBeGreaterThan(0)
  })

  it('rozpoznaje order_recommendation — wariant co zamówić', () => {
    const r = parseAssistantIntent('co zamówić na przyszły tydzień')
    expect(r.intent).toBe('order_recommendation')
  })

  it('zwraca unknown dla nieznanego zapytania', () => {
    const r = parseAssistantIntent('jaka jest pogoda w Krakowie?')
    expect(r.intent).toBe('unknown')
    expect(r.confidence).toBe(0)
  })

  it('zwraca unknown dla pustego stringa', () => {
    const r = parseAssistantIntent('')
    expect(r.intent).toBe('unknown')
  })

  it('zachowuje rawQuery', () => {
    const input = 'Porównaj dwie ostatnie faktury'
    const r = parseAssistantIntent(input)
    expect(r.rawQuery).toBe(input)
  })

  it('zwraca entities.timeRef gdy jest miesięczne odniesienie', () => {
    const r = parseAssistantIntent('dashboard zakupów z ostatniego miesiąca')
    expect(r.entities.timeRef).toBeDefined()
  })
})

describe('getAssistantResponse', () => {
  it('zwraca odpowiedź dla purchase_dashboard', () => {
    const r = getAssistantResponse({ intent: 'purchase_dashboard' })
    expect(r).toContain('dashboard zakupów')
  })

  it('zwraca fallback dla unknown', () => {
    const r = getAssistantResponse({ intent: 'unknown' })
    expect(r).toContain('Na razie')
  })
})
