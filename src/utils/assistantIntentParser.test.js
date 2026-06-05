import { describe, it, expect } from 'vitest'
import { parseAssistantIntent, getAssistantResponse, getSmartFallbackSuggestions } from './assistantIntentParser.js'

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

  it('wyciąga productQuery z historia ceny Domestos', () => {
    const r = parseAssistantIntent('historia ceny Domestos')
    expect(r.intent).toBe('product_price_history')
    expect(r.entities.productQuery).toBe('Domestos')
  })

  it('wyciąga productQuery z wykres ceny rękawic nitrylowych', () => {
    const r = parseAssistantIntent('wykres ceny rękawic nitrylowych')
    expect(r.intent).toBe('product_price_history')
    expect(r.entities.productQuery).toContain('rękawic nitrylowych')
  })

  it('zwraca productQuery null gdy brak konkretnej nazwy produktu', () => {
    const r = parseAssistantIntent('Pokaż historię ceny produktu')
    expect(r.intent).toBe('product_price_history')
    expect(r.entities.productQuery).toBeNull()
  })

  it('compare_suppliers — productQuery null gdy brak konkretnego produktu', () => {
    const r = parseAssistantIntent('porównaj dostawców')
    expect(r.intent).toBe('compare_suppliers')
    expect(r.entities.productQuery).toBeNull()
  })

  it('compare_suppliers — productQuery Domestos z "porównaj dostawców Domestos"', () => {
    const r = parseAssistantIntent('porównaj dostawców Domestos')
    expect(r.intent).toBe('compare_suppliers')
    expect(r.entities.productQuery).toBe('Domestos')
  })

  it('compare_suppliers — productQuery rękawice z "gdzie najtaniej kupujemy rękawice"', () => {
    const r = parseAssistantIntent('gdzie najtaniej kupujemy rękawice')
    expect(r.intent).toBe('compare_suppliers')
    expect(r.entities.productQuery).toBe('rękawice')
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

import { resolveTimeRef } from './assistantIntentParser.js'

describe('fuzzy matching — literówki', () => {
  it('typo: "co podrozalo" → latest_price_changes', () => {
    const r = parseAssistantIntent('co podrozalo')
    expect(r.intent).toBe('latest_price_changes')
  })

  it('typo: "niski stany" → low_stock', () => {
    const r = parseAssistantIntent('niski stany')
    expect(r.intent).toBe('low_stock')
  })

  it('typo: "co zamowic" → order_recommendation', () => {
    const r = parseAssistantIntent('co zamowic')
    expect(r.intent).toBe('order_recommendation')
  })
})

describe('invoice number extraction', () => {
  it('wyciąga dwa numery faktur', () => {
    const r = parseAssistantIntent('porównaj FV/001/2024 z FV/012/2023')
    expect(r.intent).toBe('compare_invoices')
    expect(r.entities.invoiceNumbers).toHaveLength(2)
    expect(r.entities.invoiceNumbers[0]).toContain('FV')
  })
})

describe('time ranges — dateRange', () => {
  it('dashboard zakupów za ostatni tydzień → dateRange.from = 7 dni temu', () => {
    const r = parseAssistantIntent('dashboard zakupów za ostatni tydzień')
    expect(r.intent).toBe('purchase_dashboard')
    expect(r.entities.dateRange).toBeTruthy()
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
    expect(r.entities.dateRange.from).toBe(weekAgo)
  })

  it('co podrożało w tym roku → dateRange 365 dni', () => {
    const r = parseAssistantIntent('co podrożało w tym roku')
    expect(r.intent).toBe('latest_price_changes')
    expect(r.entities.dateRange).toBeTruthy()
    const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10)
    expect(r.entities.dateRange.from).toBe(yearAgo)
  })
})

describe('resolveTimeRef', () => {
  it('tydzień → 7 dni', () => {
    const dr = resolveTimeRef('tydzień')
    expect(dr).toBeTruthy()
    const expected = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
    expect(dr.from).toBe(expected)
  })

  it('miesiąc → 30 dni', () => {
    const dr = resolveTimeRef('miesiąc')
    const expected = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    expect(dr.from).toBe(expected)
  })

  it('null → null', () => {
    expect(resolveTimeRef(null)).toBeNull()
  })
})

describe('product_search intent', () => {
  it('znajdź towar LED → product_search + searchQuery = "LED"', () => {
    const r = parseAssistantIntent('znajdź towar LED')
    expect(r.intent).toBe('product_search')
    expect(r.entities.searchQuery).toBe('LED')
  })

  it('czy mamy Domestos → product_search + searchQuery = "Domestos"', () => {
    const r = parseAssistantIntent('czy mamy Domestos')
    expect(r.intent).toBe('product_search')
    expect(r.entities.searchQuery).toBe('Domestos')
  })

  it('ile mamy papieru → product_search', () => {
    const r = parseAssistantIntent('ile mamy papieru toaletowego')
    expect(r.intent).toBe('product_search')
  })
})

describe('create_price_alert intent', () => {
  it('ustaw alert na Domestos 15% → create_price_alert + alertProduct + alertThreshold=15', () => {
    const r = parseAssistantIntent('ustaw alert na Domestos 15%')
    expect(r.intent).toBe('create_price_alert')
    expect(r.entities.alertProduct).toBeTruthy()
    expect(r.entities.alertThreshold).toBe(15)
  })

  it('dodaj alert cenowy dla rękawic 10% → create_price_alert + threshold=10', () => {
    const r = parseAssistantIntent('dodaj alert cenowy dla rękawic 10%')
    expect(r.intent).toBe('create_price_alert')
    expect(r.entities.alertThreshold).toBe(10)
  })

  it('brak % → domyślny threshold=10', () => {
    const r = parseAssistantIntent('ustaw alert na Domestos')
    expect(r.intent).toBe('create_price_alert')
    expect(r.entities.alertThreshold).toBe(10)
  })
})

describe('multi-turn context', () => {
  it('follow-up "a za ostatni tydzień" dziedziczy poprzedni intent', () => {
    const history = [
      { role: 'user', text: 'co podrożało?' },
      { role: 'assistant', text: 'Oto zmiany cen...', intent: 'latest_price_changes' },
    ]
    const r = parseAssistantIntent('a za ostatni tydzień', history)
    expect(r.intent).toBe('latest_price_changes')
    expect(r.entities.dateRange).toBeTruthy()
  })
})

describe('diacritics-agnostic fuzzy matching', () => {
  it('"zarowka led" → product_price_history or product_search', () => {
    const r = parseAssistantIntent('zarowka led historia ceny')
    expect(['product_price_history', 'product_search']).toContain(r.intent)
  })

  it('"rekawice" → fuzzy matches "rękawice" keywords', () => {
    const r = parseAssistantIntent('stany rekawice')
    expect(r.confidence).toBeGreaterThan(0)
  })
})

describe('contractor_search intent', () => {
  it('"faktury od Castorama" → contractor_search + contractorQuery = "Castorama"', () => {
    const r = parseAssistantIntent('faktury od Castorama')
    expect(r.intent).toBe('contractor_search')
    expect(r.entities.contractorQuery).toBe('Castorama')
  })

  it('"ile wydaliśmy u Makro" → contractor_search', () => {
    const r = parseAssistantIntent('ile wydaliśmy u Makro')
    expect(r.intent).toBe('contractor_search')
    expect(r.entities.contractorQuery).toBeDefined()
  })

  it('"pokaż kontrahenta Leroy" → contractor_search', () => {
    const r = parseAssistantIntent('pokaż kontrahenta Leroy')
    expect(r.intent).toBe('contractor_search')
    expect(r.entities.contractorQuery).toBe('Leroy')
  })
})

describe('getSmartFallbackSuggestions', () => {
  it('"cenka" → sugestie zawierające intenty cenowe', () => {
    const s = getSmartFallbackSuggestions('cenka')
    expect(Array.isArray(s)).toBe(true)
  })

  it('"abc123xyz" → pusta lista lub krótka lista', () => {
    const s = getSmartFallbackSuggestions('abc123xyz')
    expect(Array.isArray(s)).toBe(true)
    expect(s.length).toBeLessThanOrEqual(3)
  })

  it('pusty string → pusta lista', () => {
    expect(getSmartFallbackSuggestions('')).toHaveLength(0)
  })

  it('krótki string (< 3 znaki) → pusta lista', () => {
    expect(getSmartFallbackSuggestions('ab')).toHaveLength(0)
  })
})
