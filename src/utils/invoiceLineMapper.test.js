import { describe, it, expect } from 'vitest'
import { mapPositionToInsertPayload } from './invoiceLineMapper'

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
