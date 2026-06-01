import { describe, it, expect } from 'vitest'
import { mapPositionToInsertPayload, mapParsedPozycjaToFormPozycja } from './invoiceLineMapper'

const FAKTURA_ID = 'fak-uuid-001'

describe('mapPositionToInsertPayload', () => {
  it('produces only whitelisted DB columns', () => {
    const poz = {
      _towarId: 'towar-001',
      towar_id: 'towar-001',
      magazyn_id: 'mag-001',
      ilosc: 3,
      cena_netto: 19.99,
      vat_procent: 23,
      rawName: 'SYFON 32MM',
      // Technical fields that must NOT reach the DB:
      jednostka: 'szt',
      unit: 'szt',
      warnings: ['unit_inferred_default_szt'],
      matchScore: 0.92,
      matchingSource: 'manual_selected',
      itemType: 'inventory_item',
      shouldAffectInventory: true,
      _isDraft: false,
      _key: 42,
      source: 'pdf_extraction',
      indeks: 'SKU-001',
    }

    const payload = mapPositionToInsertPayload(poz, FAKTURA_ID)

    // Required columns present
    expect(payload.faktura_id).toBe(FAKTURA_ID)
    expect(payload.towar_id).toBe('towar-001')
    expect(payload.magazyn_id).toBe('mag-001')
    expect(payload.ilosc).toBe(3)
    expect(payload.cena_netto).toBe(19.99)
    expect(payload.vat_procent).toBe(23)
    expect(payload.raw_name).toBe('SYFON 32MM')
    // jednostka is now a real DB column (jednostka_migration.sql) and must be in payload
    expect(payload.jednostka).toBe('szt')

    // Technical (front-end-only) fields NOT present
    expect(payload).not.toHaveProperty('unit')
    expect(payload).not.toHaveProperty('warnings')
    expect(payload).not.toHaveProperty('matchScore')
    expect(payload).not.toHaveProperty('matchingSource')
    expect(payload).not.toHaveProperty('itemType')
    expect(payload).not.toHaveProperty('shouldAffectInventory')
    expect(payload).not.toHaveProperty('_isDraft')
    expect(payload).not.toHaveProperty('_key')
    expect(payload).not.toHaveProperty('source')
    expect(payload).not.toHaveProperty('indeks')
  })

  it('uses _towarId override from caller (score-guarded id)', () => {
    const poz = { _towarId: 'guarded-id', towar_id: 'raw-id', ilosc: 1, cena_netto: 10 }
    const payload = mapPositionToInsertPayload(poz, FAKTURA_ID)
    expect(payload.towar_id).toBe('guarded-id')
  })

  it('sets towar_id null when no product matched', () => {
    const poz = { _towarId: null, towar_id: null, ilosc: 1, cena_netto: 10 }
    const payload = mapPositionToInsertPayload(poz, FAKTURA_ID)
    expect(payload.towar_id).toBeNull()
  })

  it('defaults vat_procent to 23 when missing', () => {
    const poz = { ilosc: 1, cena_netto: 10 }
    const payload = mapPositionToInsertPayload(poz, FAKTURA_ID)
    expect(payload.vat_procent).toBe(23)
  })

  it('resolves raw_name from rawName / raw_name / nazwa fallbacks', () => {
    expect(mapPositionToInsertPayload({ rawName: 'A', ilosc: 1, cena_netto: 1 }, FAKTURA_ID).raw_name).toBe('A')
    expect(mapPositionToInsertPayload({ raw_name: 'B', ilosc: 1, cena_netto: 1 }, FAKTURA_ID).raw_name).toBe('B')
    expect(mapPositionToInsertPayload({ nazwa: 'C', ilosc: 1, cena_netto: 1 }, FAKTURA_ID).raw_name).toBe('C')
    expect(mapPositionToInsertPayload({ ilosc: 1, cena_netto: 1 }, FAKTURA_ID).raw_name).toBeNull()
  })

  it('merges wsData() result into payload', () => {
    const poz = { ilosc: 1, cena_netto: 5 }
    const wsData = () => ({ workspace_id: 'ws-123' })
    const payload = mapPositionToInsertPayload(poz, FAKTURA_ID, wsData)
    expect(payload.workspace_id).toBe('ws-123')
  })

  it('includes jednostka from poz in payload (DB column added in jednostka_migration.sql)', () => {
    const poz = { jednostka: 'op', ilosc: 2, cena_netto: 8.50 }
    const payload = mapPositionToInsertPayload(poz, FAKTURA_ID)
    expect(payload.jednostka).toBe('op')
  })

  it('falls back to unit then jm when jednostka not set', () => {
    expect(mapPositionToInsertPayload({ unit: 'kg', ilosc: 1, cena_netto: 1 }, FAKTURA_ID).jednostka).toBe('kg')
    expect(mapPositionToInsertPayload({ jm: 'l', ilosc: 1, cena_netto: 1 }, FAKTURA_ID).jednostka).toBe('l')
    expect(mapPositionToInsertPayload({ ilosc: 1, cena_netto: 1 }, FAKTURA_ID).jednostka).toBeNull()
  })
})

// ── mapParsedPozycjaToFormPozycja — regression tests for product-id preservation ──

describe('mapParsedPozycjaToFormPozycja — product id field mapping', () => {
  // Regression: manual_created_from_invoice with matchScore: null must preserve product id
  it('preserves matchedProductId for manual_created_from_invoice even when matchScore is null', () => {
    const item = {
      rawName: 'Nowy towar z faktury',
      matchedProductId: 'prod-new-uuid',
      matchedProductNazwa: 'Nowy towar',
      matchScore: null,
      matchingSource: 'manual_created_from_invoice',
      unitPriceNet: 25,
      quantity: 2,
      itemType: 'inventory_item',
      shouldAffectInventory: true,
    }
    const mapped = mapParsedPozycjaToFormPozycja(item, 'mag-1')
    expect(mapped._towarId).toBe('prod-new-uuid')
    expect(mapped.towar_id).toBe('prod-new-uuid')
  })

  // Regression: manual_selected item preserves product id
  it('preserves matchedProductId for manual_selected item', () => {
    const item = {
      rawName: 'Towar ręcznie',
      matchedProductId: 'prod-manual',
      matchScore: 1.0,
      matchingSource: 'manual_selected',
      unitPriceNet: 10,
      quantity: 1,
      itemType: 'inventory_item',
      shouldAffectInventory: true,
    }
    const mapped = mapParsedPozycjaToFormPozycja(item, 'mag-1')
    expect(mapped._towarId).toBe('prod-manual')
    expect(mapped.towar_id).toBe('prod-manual')
  })

  // Regression: alias_learned item preserves product id
  it('preserves matchedProductId for alias_learned item', () => {
    const item = {
      rawName: 'Syfon 32mm',
      matchedProductId: 'prod-alias',
      matchScore: 1.0,
      matchingSource: 'alias_learned',
      aliasUsageCount: 5,
      unitPriceNet: 8,
      quantity: 3,
      itemType: 'inventory_item',
      shouldAffectInventory: true,
    }
    const mapped = mapParsedPozycjaToFormPozycja(item, 'mag-1')
    expect(mapped._towarId).toBe('prod-alias')
    expect(mapped.towar_id).toBe('prod-alias')
  })

  // Regression: auto-matched item with score >= 0.85 preserves product id
  it('preserves matchedProductId for auto-matched item with score >= 0.85', () => {
    const item = {
      rawName: 'Auto towar',
      matchedProductId: 'prod-auto',
      matchScore: 0.90,
      itemType: 'inventory_item',
      shouldAffectInventory: true,
      unitPriceNet: 5,
    }
    const mapped = mapParsedPozycjaToFormPozycja(item, 'mag-1')
    expect(mapped._towarId).toBe('prod-auto')
    expect(mapped.towar_id).toBe('prod-auto')
  })

  // Correct behaviour: auto-matched item with score < 0.85 must NOT auto-assign
  it('nulls out product id for auto-matched item with score below 0.85 (no explicit source)', () => {
    const item = {
      rawName: 'Słabe dopasowanie',
      matchedProductId: 'prod-weak',
      matchScore: 0.70,
      matchingSource: undefined,
      unitPriceNet: 5,
      itemType: 'inventory_item',
      shouldAffectInventory: true,
    }
    const mapped = mapParsedPozycjaToFormPozycja(item, 'mag-1')
    expect(mapped._towarId).toBeNull()
    expect(mapped.towar_id).toBeNull()
  })

  // Confidence field must not override an explicitly set matchedProductId
  it('does not let confidence field override explicit match source', () => {
    const item = {
      rawName: 'Explicit plus confidence',
      matchedProductId: 'prod-explicit',
      matchScore: null,
      confidence: 0.40,
      matchingSource: 'manual_created_from_invoice',
      unitPriceNet: 12,
      itemType: 'inventory_item',
      shouldAffectInventory: true,
    }
    const mapped = mapParsedPozycjaToFormPozycja(item, 'mag-1')
    expect(mapped._towarId).toBe('prod-explicit')
  })

  // matchingSource is propagated so downstream callers can use it
  it('propagates matchingSource to mapped position', () => {
    const item = {
      rawName: 'Test',
      matchedProductId: 'p',
      matchScore: 1.0,
      matchingSource: 'alias_learned',
      unitPriceNet: 1,
      itemType: 'inventory_item',
    }
    const mapped = mapParsedPozycjaToFormPozycja(item, 'mag-1')
    expect(mapped.matchingSource).toBe('alias_learned')
  })

  it('service items have null towarId regardless of matchedProductId', () => {
    const item = {
      rawName: 'Usługa',
      matchedProductId: 'prod-x',
      matchScore: 1.0,
      matchingSource: 'manual_selected',
      itemType: 'service_item',
      shouldAffectInventory: false,
      unitPriceNet: 200,
    }
    const mapped = mapParsedPozycjaToFormPozycja(item, 'mag-1')
    // Service items don't need product — _towarId may be set but shouldAffectInventory is false
    expect(mapped.shouldAffectInventory).toBe(false)
    expect(mapped.itemType).toBe('service_item')
  })
})
