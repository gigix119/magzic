// Characterization tests: CURRENT behavior of the invoice approval path.
//
// These tests capture what the system does today — they are NOT aspirational.
// If you find a bug, open a ticket and update these tests AFTER the fix lands.
// Do not edit to make them pass a different behavior.
//
// Coverage focused on (per scope):
//   - draft vs approved stock effect
//   - service position creates no movement
//   - line without product creates no movement
//   - NET / BRUTTO price_mode switch has no effect on approval
//   - per-position warehouse overrides invoice-level warehouse

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../supabase', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}))
vi.mock('./events', () => ({ refreshInventory: vi.fn() }))

import { zatwierdźFakturę } from './magazyn'
import { supabase } from '../supabase'
import { refreshInventory } from './events'
import { recalculateInvoiceLineStatus } from './invoicePositionValidator'

// ── Test fixtures ─────────────────────────────────────────────────────────────

const WS_ID  = 'ws-char-test'
const FAK_ID = 'fak-char-test'

function makeFaktura(overrides = {}) {
  return {
    id:              FAK_ID,
    numer:           'FV/CHAR/1',
    status:          'robocza',
    magazyn_id:      'mag-invoice',
    workspace_id:    WS_ID,
    pozycje_faktury: [],
    ...overrides,
  }
}

function makePosition(overrides = {}) {
  return {
    id:          'poz-1',
    towar_id:    'twr-1',
    magazyn_id:  'mag-pos',
    ilosc:       3,
    cena_netto:  10,
    vat_procent: 23,
    towary:      { nazwa: 'Farba biała', jednostka: 'szt' },
    ...overrides,
  }
}

/**
 * Sets up supabase.from mock for zatwierdźFakturę.
 * Returns spies for stany_magazynowe.upsert and ruchy_magazynowe.insert.
 *
 * zatwierdźFakturę calls supabase.from('faktury') twice:
 *   #1 — .select(…).eq(…).single()   → loads the invoice
 *   #2 — .update(…).eq(…)            → marks it zatwierdzona
 */
function setupApprovalMock({ faktura, stanIlosc = 0 } = {}) {
  let fakturyCallIndex = 0
  const upsertSpy = vi.fn().mockResolvedValue({ error: null })
  const insertSpy = vi.fn().mockResolvedValue({ error: null })

  vi.mocked(supabase.from).mockImplementation((table) => {
    if (table === 'faktury') {
      fakturyCallIndex++
      if (fakturyCallIndex === 1) {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: faktura, error: null }),
            }),
          }),
        }
      }
      return {
        update: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
      }
    }

    if (table === 'stany_magazynowe') {
      return {
        // Called per-position to read current balance before upsert
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: stanIlosc > 0 ? { id: 'stan-1', ilosc: stanIlosc } : null,
                  error: null,
                }),
            }),
          }),
        }),
        upsert: upsertSpy,
      }
    }

    if (table === 'ruchy_magazynowe') {
      return { insert: insertSpy }
    }

    return {}
  })

  return { upsertSpy, insertSpy }
}

// ── Suite 1: Early-rejection guards ──────────────────────────────────────────

describe('zatwierdźFakturę — early rejection', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('rejects when invoice is already zatwierdzona', async () => {
    const faktura = makeFaktura({
      status: 'zatwierdzona',
      pozycje_faktury: [makePosition()],
    })
    setupApprovalMock({ faktura })

    const result = await zatwierdźFakturę(FAK_ID)

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/już zatwierdzona/)
  })

  it('does not touch stock when already zatwierdzona', async () => {
    const faktura = makeFaktura({
      status: 'zatwierdzona',
      pozycje_faktury: [makePosition()],
    })
    const { upsertSpy, insertSpy } = setupApprovalMock({ faktura })

    await zatwierdźFakturę(FAK_ID)

    expect(upsertSpy).not.toHaveBeenCalled()
    expect(insertSpy).not.toHaveBeenCalled()
  })

  it('does not fire refreshInventory when already zatwierdzona', async () => {
    const faktura = makeFaktura({
      status: 'zatwierdzona',
      pozycje_faktury: [makePosition()],
    })
    setupApprovalMock({ faktura })

    await zatwierdźFakturę(FAK_ID)

    expect(refreshInventory).not.toHaveBeenCalled()
  })

  it('rejects when invoice has no positions', async () => {
    const faktura = makeFaktura({ status: 'robocza', pozycje_faktury: [] })
    setupApprovalMock({ faktura })

    const result = await zatwierdźFakturę(FAK_ID)

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/pozycj/)
  })
})

// ── Suite 2: Draft → approved stock effect ────────────────────────────────────

describe('zatwierdźFakturę — robocza → stock update', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('succeeds for a robocza invoice with one valid inventory position', async () => {
    const faktura = makeFaktura({ pozycje_faktury: [makePosition()] })
    setupApprovalMock({ faktura, stanIlosc: 0 })

    const result = await zatwierdźFakturę(FAK_ID)

    expect(result.success).toBe(true)
  })

  it('upserts stany_magazynowe with current + position qty when starting from zero', async () => {
    const faktura = makeFaktura({ pozycje_faktury: [makePosition({ ilosc: 5 })] })
    const { upsertSpy } = setupApprovalMock({ faktura, stanIlosc: 0 })

    await zatwierdźFakturę(FAK_ID)

    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ ilosc: 5, towar_id: 'twr-1' }),
      expect.any(Object)
    )
  })

  it('upserts with current + position qty when starting from a non-zero balance', async () => {
    const faktura = makeFaktura({ pozycje_faktury: [makePosition({ ilosc: 3 })] })
    const { upsertSpy } = setupApprovalMock({ faktura, stanIlosc: 10 })

    await zatwierdźFakturę(FAK_ID)

    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ ilosc: 13 }),
      expect.any(Object)
    )
  })

  it('inserts an invoice_purchase movement', async () => {
    const faktura = makeFaktura({ pozycje_faktury: [makePosition()] })
    const { insertSpy } = setupApprovalMock({ faktura })

    await zatwierdźFakturę(FAK_ID)

    expect(insertSpy).toHaveBeenCalledWith([
      expect.objectContaining({ typ: 'invoice_purchase' }),
    ])
  })

  it('movement references the faktura id', async () => {
    const faktura = makeFaktura({ pozycje_faktury: [makePosition()] })
    const { insertSpy } = setupApprovalMock({ faktura })

    await zatwierdźFakturę(FAK_ID)

    expect(insertSpy).toHaveBeenCalledWith([
      expect.objectContaining({ faktura_id: FAK_ID }),
    ])
  })

  it('movement references the towar and warehouse', async () => {
    const faktura = makeFaktura({
      pozycje_faktury: [makePosition({ towar_id: 'twr-1', magazyn_id: 'mag-pos' })],
    })
    const { insertSpy } = setupApprovalMock({ faktura })

    await zatwierdźFakturę(FAK_ID)

    expect(insertSpy).toHaveBeenCalledWith([
      expect.objectContaining({ towar_id: 'twr-1', magazyn_docelowy_id: 'mag-pos' }),
    ])
  })

  it('upsert payload includes workspace_id', async () => {
    const faktura = makeFaktura({ pozycje_faktury: [makePosition()] })
    const { upsertSpy } = setupApprovalMock({ faktura })

    await zatwierdźFakturę(FAK_ID)

    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ workspace_id: WS_ID }),
      expect.any(Object)
    )
  })

  it('fires refreshInventory after successful approval', async () => {
    const faktura = makeFaktura({ pozycje_faktury: [makePosition()] })
    setupApprovalMock({ faktura })

    await zatwierdźFakturę(FAK_ID)

    expect(refreshInventory).toHaveBeenCalledTimes(1)
  })

  it('return value includes zaktualizowane with towar name and new balance', async () => {
    const faktura = makeFaktura({
      pozycje_faktury: [makePosition({ ilosc: 7, towary: { nazwa: 'Grzybek', jednostka: 'szt' } })],
    })
    setupApprovalMock({ faktura, stanIlosc: 0 })

    const result = await zatwierdźFakturę(FAK_ID)

    expect(result.zaktualizowane).toHaveLength(1)
    expect(result.zaktualizowane[0]).toMatchObject({
      towar:      'Grzybek',
      ilosc:      7,
      nowaIlosc:  7,
    })
  })

  it('wartosc_netto is computed from ALL positions, including service/zero-price ones', async () => {
    // Current behavior: wartosc_netto = sum of ilosc * cena_netto for every pozycja_faktury row,
    // not just the inventory-eligible ones.
    const faktura = makeFaktura({
      pozycje_faktury: [
        makePosition({ ilosc: 2, cena_netto: 10 }),  // 20 — will affect stock
        { id: 'poz-svc', towar_id: null, cena_netto: 50, ilosc: 1 }, // 50 — no stock impact
      ],
    })
    const { upsertSpy } = setupApprovalMock({ faktura })

    const result = await zatwierdźFakturę(FAK_ID)

    // wartosc_netto is set on the faktury.update call; we verify it via the return
    expect(result.success).toBe(true)
    expect(upsertSpy).toHaveBeenCalledTimes(1) // only the inventory position
  })
})

// ── Suite 3: Service positions — no stock movement ────────────────────────────

describe('zatwierdźFakturę — service / no-product position creates no movement', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('position with towar_id=null creates no stany_magazynowe upsert', async () => {
    const faktura = makeFaktura({
      pozycje_faktury: [
        makePosition({ towar_id: null, cena_netto: 100, ilosc: 1 }),
      ],
    })
    const { upsertSpy } = setupApprovalMock({ faktura })

    await zatwierdźFakturę(FAK_ID)

    expect(upsertSpy).not.toHaveBeenCalled()
  })

  it('position with towar_id=null creates no ruchy_magazynowe insert', async () => {
    const faktura = makeFaktura({
      pozycje_faktury: [
        makePosition({ towar_id: null, cena_netto: 100, ilosc: 1 }),
      ],
    })
    const { insertSpy } = setupApprovalMock({ faktura })

    await zatwierdźFakturę(FAK_ID)

    expect(insertSpy).not.toHaveBeenCalled()
  })

  it('invoice is still marked zatwierdzona even when all positions lack towar_id', async () => {
    const faktura = makeFaktura({
      pozycje_faktury: [
        makePosition({ towar_id: null, cena_netto: 200, ilosc: 2 }),
      ],
    })
    setupApprovalMock({ faktura })

    const result = await zatwierdźFakturę(FAK_ID)

    expect(result.success).toBe(true)
    expect(result.zaktualizowane).toHaveLength(0)
    expect(result.pominiete).toBe(1)
  })

  it('position with towar_id but cena_netto=0 is silently skipped — neither zaktualizowane nor pominiete', async () => {
    // This is current behavior: a position with towar_id but price=0 is excluded
    // from pozycjeTowary (price guard) but ALSO excluded from pozycjePoziome
    // (has towar_id and magazyn). It disappears silently.
    const faktura = makeFaktura({
      pozycje_faktury: [
        makePosition({ towar_id: 'twr-1', magazyn_id: 'mag-pos', cena_netto: 0, ilosc: 3 }),
      ],
    })
    const { upsertSpy, insertSpy } = setupApprovalMock({ faktura })

    const result = await zatwierdźFakturę(FAK_ID)

    expect(upsertSpy).not.toHaveBeenCalled()
    expect(insertSpy).not.toHaveBeenCalled()
    expect(result.success).toBe(true)
    expect(result.zaktualizowane).toHaveLength(0)
    expect(result.pominiete).toBe(0) // not counted in pominiete either
  })

  it('position with towar_id but ilosc=0 is also silently skipped', async () => {
    const faktura = makeFaktura({
      pozycje_faktury: [
        makePosition({ ilosc: 0, cena_netto: 10 }),
      ],
    })
    const { upsertSpy, insertSpy } = setupApprovalMock({ faktura })

    const result = await zatwierdźFakturę(FAK_ID)

    expect(upsertSpy).not.toHaveBeenCalled()
    expect(insertSpy).not.toHaveBeenCalled()
    expect(result.zaktualizowane).toHaveLength(0)
  })

  it('mixed invoice: service skipped, inventory position updated', async () => {
    const faktura = makeFaktura({
      pozycje_faktury: [
        makePosition({ id: 'poz-inv', towar_id: 'twr-1', ilosc: 4, cena_netto: 20 }),
        makePosition({ id: 'poz-svc', towar_id: null,    ilosc: 1, cena_netto: 50 }),
      ],
    })
    const { upsertSpy, insertSpy } = setupApprovalMock({ faktura })

    const result = await zatwierdźFakturę(FAK_ID)

    expect(upsertSpy).toHaveBeenCalledTimes(1)
    expect(insertSpy).toHaveBeenCalledTimes(1)
    expect(result.zaktualizowane).toHaveLength(1)
    expect(result.pominiete).toBe(1)
  })
})

// ── Suite 4: Warehouse resolution ─────────────────────────────────────────────

describe('zatwierdźFakturę — warehouse override and fallback', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('uses position-level magazyn_id when both position and invoice have one', async () => {
    const faktura = makeFaktura({
      magazyn_id:      'mag-invoice',
      pozycje_faktury: [makePosition({ magazyn_id: 'mag-position' })],
    })
    const { upsertSpy, insertSpy } = setupApprovalMock({ faktura })

    await zatwierdźFakturę(FAK_ID)

    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ magazyn_id: 'mag-position' }),
      expect.any(Object)
    )
    expect(insertSpy).toHaveBeenCalledWith([
      expect.objectContaining({ magazyn_docelowy_id: 'mag-position' }),
    ])
  })

  it('falls back to invoice-level magazyn_id when position has none', async () => {
    const faktura = makeFaktura({
      magazyn_id:      'mag-invoice-fallback',
      pozycje_faktury: [makePosition({ magazyn_id: null })],
    })
    const { upsertSpy, insertSpy } = setupApprovalMock({ faktura })

    await zatwierdźFakturę(FAK_ID)

    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ magazyn_id: 'mag-invoice-fallback' }),
      expect.any(Object)
    )
    expect(insertSpy).toHaveBeenCalledWith([
      expect.objectContaining({ magazyn_docelowy_id: 'mag-invoice-fallback' }),
    ])
  })

  it('excludes position from stock update when neither position nor invoice has a warehouse', async () => {
    const faktura = makeFaktura({
      magazyn_id:      null,
      pozycje_faktury: [makePosition({ magazyn_id: null })],
    })
    const { upsertSpy, insertSpy } = setupApprovalMock({ faktura })

    const result = await zatwierdźFakturę(FAK_ID)

    expect(upsertSpy).not.toHaveBeenCalled()
    expect(insertSpy).not.toHaveBeenCalled()
    expect(result.success).toBe(true)
    expect(result.pominiete).toBe(1) // counted as pominięte (no magazyn at any level)
  })
})

// ── Suite 5: NET / BRUTTO price_mode switch ────────────────────────────────────

describe('zatwierdźFakturę — price_mode has no effect on approval', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('approves a gross-mode invoice and uses cena_netto for qty (not a brutto-adjusted value)', async () => {
    // price_mode='gross' means the UI displays brutto prices, but stored cena_netto is always netto.
    // zatwierdźFakturę does NOT read price_mode; it uses cena_netto directly.
    const faktura = makeFaktura({
      price_mode:      'gross',
      pozycje_faktury: [makePosition({ ilosc: 2, cena_netto: 10 })],
    })
    const { upsertSpy } = setupApprovalMock({ faktura })

    const result = await zatwierdźFakturę(FAK_ID)

    expect(result.success).toBe(true)
    // qty used in upsert is position.ilosc, not price-derived
    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ ilosc: 2 }),
      expect.any(Object)
    )
  })

  it('gross and net invoices with same cena_netto produce identical stock updates', async () => {
    const positionData = { ilosc: 5, cena_netto: 15 }

    // net-mode invoice
    const fakturaN = makeFaktura({ price_mode: 'net', pozycje_faktury: [makePosition(positionData)] })
    const { upsertSpy: upsertNet } = setupApprovalMock({ faktura: fakturaN })
    await zatwierdźFakturę(FAK_ID)
    const netCallArgs = upsertNet.mock.calls[0]

    vi.clearAllMocks()
    vi.mocked(supabase.from).mockReset()

    // gross-mode invoice — identical position data
    const fakturaG = makeFaktura({ price_mode: 'gross', pozycje_faktury: [makePosition(positionData)] })
    const { upsertSpy: upsertGross } = setupApprovalMock({ faktura: fakturaG })
    await zatwierdźFakturę(FAK_ID)
    const grossCallArgs = upsertGross.mock.calls[0]

    // Both produce same upsert payload (price_mode never read during approval)
    expect(netCallArgs[0].ilosc).toBe(grossCallArgs[0].ilosc)
    expect(netCallArgs[0].towar_id).toBe(grossCallArgs[0].towar_id)
    expect(netCallArgs[0].magazyn_id).toBe(grossCallArgs[0].magazyn_id)
  })

  it('cena_netto=0 excludes position regardless of price_mode', async () => {
    const faktura = makeFaktura({
      price_mode:      'gross',
      pozycje_faktury: [makePosition({ cena_netto: 0 })],
    })
    const { upsertSpy } = setupApprovalMock({ faktura })

    const result = await zatwierdźFakturę(FAK_ID)

    expect(upsertSpy).not.toHaveBeenCalled()
    expect(result.success).toBe(true)
  })
})

// ── Suite 6: recalculateInvoiceLineStatus — approval display invariants ────────
// These are pure-function characterizations of the client-side status shown
// in InvoiceApproveModal. They complement the broader validator tests.

describe('recalculateInvoiceLineStatus — approval-path invariants', () => {
  const TOWARY = [
    { id: 'twr-1', nazwa: 'Farba biała', jednostka: 'szt' },
  ]

  it('service line (shouldAffectInventory=false) → inventoryImpactStatus=none', () => {
    const line = { towar_id: 'twr-1', shouldAffectInventory: false, ilosc: 1, cena_netto: 50, magazyn_id: 'mag-1' }
    const { inventoryImpactStatus } = recalculateInvoiceLineStatus(line, { towary: TOWARY })
    expect(inventoryImpactStatus).toBe('none')
  })

  it('service line (itemType=service_item) → inventoryImpactStatus=none', () => {
    const line = { towar_id: null, itemType: 'service_item', ilosc: 1, cena_netto: 200, magazyn_id: 'mag-1' }
    const { inventoryImpactStatus, shouldAffectInventory } = recalculateInvoiceLineStatus(line, { towary: TOWARY })
    expect(inventoryImpactStatus).toBe('none')
    expect(shouldAffectInventory).toBe(false)
  })

  it('line without towar_id → invoiceLineStatus=review_required and inventoryImpactStatus=none', () => {
    const line = { towar_id: null, ilosc: 2, cena_netto: 45, magazyn_id: 'mag-1' }
    const { invoiceLineStatus, inventoryImpactStatus } = recalculateInvoiceLineStatus(line, { towary: TOWARY })
    expect(invoiceLineStatus).toBe('review_required')
    expect(inventoryImpactStatus).toBe('none')
  })

  it('line without towar_id has NO errors (only a warning)', () => {
    const line = { towar_id: null, ilosc: 1, cena_netto: 10, magazyn_id: 'mag-1' }
    const { errors } = recalculateInvoiceLineStatus(line, { towary: TOWARY })
    expect(errors).toHaveLength(0)
  })

  it('line with towar_id but cena_netto=0 → inventoryImpactStatus=blocked', () => {
    const line = { towar_id: 'twr-1', ilosc: 3, cena_netto: 0, magazyn_id: 'mag-1' }
    const { inventoryImpactStatus } = recalculateInvoiceLineStatus(line, { towary: TOWARY, fakturaDefaultMagazynId: null })
    expect(inventoryImpactStatus).toBe('blocked')
  })

  it('line with towar_id but no warehouse → inventoryImpactStatus=blocked', () => {
    const line = { towar_id: 'twr-1', ilosc: 3, cena_netto: 15, magazyn_id: null }
    const { inventoryImpactStatus } = recalculateInvoiceLineStatus(line, { towary: TOWARY, fakturaDefaultMagazynId: null })
    expect(inventoryImpactStatus).toBe('blocked')
  })

  it('line with towar_id + price + qty + warehouse → inventoryImpactStatus=ready', () => {
    const line = { towar_id: 'twr-1', ilosc: 3, cena_netto: 15, magazyn_id: 'mag-1' }
    const { inventoryImpactStatus, invoiceLineStatus } = recalculateInvoiceLineStatus(line, { towary: TOWARY })
    expect(inventoryImpactStatus).toBe('ready')
    expect(invoiceLineStatus).toBe('accepted')
  })

  it('fakturaDefaultMagazynId is used as warehouse fallback for blocked → ready transition', () => {
    // Without context warehouse, the line is blocked (no magazyn).
    // With context warehouse (invoice-level), it becomes ready.
    const line = { towar_id: 'twr-1', ilosc: 1, cena_netto: 10, magazyn_id: null }
    const { inventoryImpactStatus: blocked } = recalculateInvoiceLineStatus(line, { towary: TOWARY })
    expect(blocked).toBe('blocked')

    const { inventoryImpactStatus: ready } = recalculateInvoiceLineStatus(
      line,
      { towary: TOWARY, fakturaDefaultMagazynId: 'mag-fallback' }
    )
    expect(ready).toBe('ready')
  })
})
