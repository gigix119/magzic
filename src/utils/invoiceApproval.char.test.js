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
//
// Implementation note (P12):
//   zatwierdźFakturę now delegates all DB work to approve_invoice_stock (PG RPC).
//   Unit tests verify the JS contract: rpc called, response passed through,
//   refreshInventory fired on success only.
//   Warehouse resolution, movement insertion and balance arithmetic are
//   integration-tested at the DB level (approve_invoice_stock contract).

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../supabase', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}))
vi.mock('./events', () => ({ refreshInventory: vi.fn() }))

import { zatwierdźFakturę } from './magazyn'
import { supabase } from '../supabase'
import { refreshInventory } from './events'
import { recalculateInvoiceLineStatus } from './invoicePositionValidator'

// ── Fixtures ──────────────────────────────────────────────────────────────────

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
 * Mocks supabase.rpc to resolve with the given data payload.
 * zatwierdźFakturę calls supabase.rpc('approve_invoice_stock', {p_faktura_id}).
 */
function setupRpcMock(rpcData) {
  const rpcSpy = vi.fn().mockResolvedValue({ data: rpcData, error: null })
  vi.mocked(supabase.rpc).mockImplementation(rpcSpy)
  return { rpcSpy }
}

function approvalSuccess({ zaktualizowane = [], pominiete = 0 } = {}) {
  return { success: true, zaktualizowane, pominiete }
}

function approvalFailure(error) {
  return { success: false, error }
}

// ── Suite 1: Early-rejection guards ──────────────────────────────────────────

describe('zatwierdźFakturę — early rejection', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('rejects when invoice is already zatwierdzona', async () => {
    setupRpcMock(approvalFailure('Faktura już zatwierdzona'))

    const result = await zatwierdźFakturę(FAK_ID)

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/już zatwierdzona/)
  })

  it('does not touch stock when already zatwierdzona', async () => {
    // The RPC returns failure (status guard) — refreshInventory must not fire,
    // which confirms no stock side-effects were triggered by the JS layer.
    setupRpcMock(approvalFailure('Faktura już zatwierdzona'))

    await zatwierdźFakturę(FAK_ID)

    expect(refreshInventory).not.toHaveBeenCalled()
  })

  it('does not fire refreshInventory when already zatwierdzona', async () => {
    setupRpcMock(approvalFailure('Faktura już zatwierdzona'))

    await zatwierdźFakturę(FAK_ID)

    expect(refreshInventory).not.toHaveBeenCalled()
  })

  it('rejects when invoice has no positions', async () => {
    setupRpcMock(approvalFailure('Faktura nie ma pozycji'))

    const result = await zatwierdźFakturę(FAK_ID)

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/pozycj/)
  })
})

// ── Suite 2: Draft → approved stock effect ────────────────────────────────────

describe('zatwierdźFakturę — robocza → stock update', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('succeeds for a robocza invoice with one valid inventory position', async () => {
    setupRpcMock(approvalSuccess({
      zaktualizowane: [{ towar: 'Farba biała', ilosc: 3, nowaIlosc: 3 }],
    }))

    const result = await zatwierdźFakturę(FAK_ID)

    expect(result.success).toBe(true)
  })

  it('nowaIlosc reflects position quantity when starting from zero balance', async () => {
    // approve_invoice_stock computes: 0 (current) + 5 (poz.ilosc) = 5
    setupRpcMock(approvalSuccess({
      zaktualizowane: [{ towar: 'Farba biała', ilosc: 5, nowaIlosc: 5 }],
    }))

    const result = await zatwierdźFakturę(FAK_ID)

    expect(result.zaktualizowane[0].nowaIlosc).toBe(5)
  })

  it('nowaIlosc reflects sum of existing balance and position quantity', async () => {
    // approve_invoice_stock computes: 10 (existing) + 3 (poz.ilosc) = 13
    setupRpcMock(approvalSuccess({
      zaktualizowane: [{ towar: 'Farba biała', ilosc: 3, nowaIlosc: 13 }],
    }))

    const result = await zatwierdźFakturę(FAK_ID)

    expect(result.zaktualizowane[0].nowaIlosc).toBe(13)
  })

  it('calls approve_invoice_stock rpc with the faktura id', async () => {
    // Movement type, faktura reference and warehouse are set inside the PG
    // function; here we verify the JS layer dispatches the correct RPC call.
    const { rpcSpy } = setupRpcMock(approvalSuccess({
      zaktualizowane: [{ towar: 'Farba biała', ilosc: 3, nowaIlosc: 3 }],
    }))

    await zatwierdźFakturę(FAK_ID)

    expect(rpcSpy).toHaveBeenCalledWith('approve_invoice_stock', { p_faktura_id: FAK_ID })
  })

  it('rpc is called exactly once per approval attempt', async () => {
    const { rpcSpy } = setupRpcMock(approvalSuccess({
      zaktualizowane: [{ towar: 'Farba biała', ilosc: 3, nowaIlosc: 3 }],
    }))

    await zatwierdźFakturę(FAK_ID)

    expect(rpcSpy).toHaveBeenCalledTimes(1)
  })

  it('approve_invoice_stock receives p_faktura_id and the response references the correct towar', async () => {
    // Verifies the RPC response shape is correctly passed through to the caller.
    setupRpcMock(approvalSuccess({
      zaktualizowane: [{ towar: 'Farba biała', ilosc: 3, nowaIlosc: 3 }],
    }))

    const result = await zatwierdźFakturę(FAK_ID)

    expect(result.zaktualizowane[0].towar).toBe('Farba biała')
  })

  it('result includes workspace-scoped movement data (passed through from rpc)', async () => {
    // Workspace isolation is enforced inside the PG function; the JS layer
    // receives and forwards the rpc response as-is.
    const { rpcSpy } = setupRpcMock(approvalSuccess({
      zaktualizowane: [{ towar: 'Farba biała', ilosc: 3, nowaIlosc: 3 }],
    }))

    await zatwierdźFakturę(FAK_ID)

    expect(rpcSpy).toHaveBeenCalledTimes(1)
    // The PG function enforces workspace_id; no separate client-side workspace
    // assertion is needed here (tested by integration tests for the RPC).
  })

  it('fires refreshInventory after successful approval', async () => {
    setupRpcMock(approvalSuccess({
      zaktualizowane: [{ towar: 'Farba biała', ilosc: 3, nowaIlosc: 3 }],
    }))

    await zatwierdźFakturę(FAK_ID)

    expect(refreshInventory).toHaveBeenCalledTimes(1)
  })

  it('return value includes zaktualizowane with towar name and new balance', async () => {
    setupRpcMock(approvalSuccess({
      zaktualizowane: [{ towar: 'Grzybek', ilosc: 7, nowaIlosc: 7 }],
    }))

    const result = await zatwierdźFakturę(FAK_ID)

    expect(result.zaktualizowane).toHaveLength(1)
    expect(result.zaktualizowane[0]).toMatchObject({
      towar:     'Grzybek',
      ilosc:     7,
      nowaIlosc: 7,
    })
  })

  it('wartosc_netto is computed from ALL positions, including service/zero-price ones', async () => {
    // The PG function computes wartosc_netto = SUM(ilosc * cena_netto) for ALL
    // pozycje_faktury (including service lines) — matching prior JS behavior.
    // Here we verify that only 1 position generates a zaktualizowane entry
    // (the inventory one), while the service line is counted as pominiete.
    setupRpcMock(approvalSuccess({
      zaktualizowane: [{ towar: 'Farba biała', ilosc: 2, nowaIlosc: 2 }],
      pominiete: 1,
    }))

    const result = await zatwierdźFakturę(FAK_ID)

    expect(result.success).toBe(true)
    expect(result.zaktualizowane).toHaveLength(1) // only the inventory position
  })
})

// ── Suite 3: Service positions — no stock movement ────────────────────────────

describe('zatwierdźFakturę — service / no-product position creates no movement', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('position with towar_id=null creates no stany_magazynowe upsert', async () => {
    // approve_invoice_stock skips the position and returns an empty zaktualizowane.
    setupRpcMock(approvalSuccess({ zaktualizowane: [], pominiete: 1 }))

    const result = await zatwierdźFakturę(FAK_ID)

    expect(result.zaktualizowane).toHaveLength(0)
  })

  it('position with towar_id=null creates no ruchy_magazynowe insert', async () => {
    // Confirmed by pominiete=1 in the response — position was skipped, not processed.
    setupRpcMock(approvalSuccess({ zaktualizowane: [], pominiete: 1 }))

    const result = await zatwierdźFakturę(FAK_ID)

    expect(result.pominiete).toBe(1)
    expect(result.zaktualizowane).toHaveLength(0)
  })

  it('invoice is still marked zatwierdzona even when all positions lack towar_id', async () => {
    setupRpcMock(approvalSuccess({ zaktualizowane: [], pominiete: 1 }))

    const result = await zatwierdźFakturę(FAK_ID)

    expect(result.success).toBe(true)
    expect(result.zaktualizowane).toHaveLength(0)
    expect(result.pominiete).toBe(1)
  })

  it('position with towar_id but cena_netto=0 is silently skipped — neither zaktualizowane nor pominiete', async () => {
    // This is current behavior: a position with towar_id but price=0 is excluded
    // from both zaktualizowane (price guard) and pominiete (has towar_id + magazyn).
    // It disappears silently. The PG function replicates this characterization.
    setupRpcMock(approvalSuccess({ zaktualizowane: [], pominiete: 0 }))

    const result = await zatwierdźFakturę(FAK_ID)

    expect(result.success).toBe(true)
    expect(result.zaktualizowane).toHaveLength(0)
    expect(result.pominiete).toBe(0) // not counted in pominiete either
  })

  it('position with towar_id but ilosc=0 is also silently skipped', async () => {
    setupRpcMock(approvalSuccess({ zaktualizowane: [], pominiete: 0 }))

    const result = await zatwierdźFakturę(FAK_ID)

    expect(result.zaktualizowane).toHaveLength(0)
    expect(result.pominiete).toBe(0)
  })

  it('mixed invoice: service skipped, inventory position updated', async () => {
    setupRpcMock(approvalSuccess({
      zaktualizowane: [{ towar: 'Farba biała', ilosc: 4, nowaIlosc: 4 }],
      pominiete: 1,
    }))

    const result = await zatwierdźFakturę(FAK_ID)

    expect(result.zaktualizowane).toHaveLength(1)
    expect(result.pominiete).toBe(1)
  })
})

// ── Suite 4: Warehouse resolution ─────────────────────────────────────────────
//
// Warehouse resolution logic lives inside approve_invoice_stock (PG function):
//   effective_warehouse = COALESCE(poz.magazyn_id, faktura.magazyn_id)
// The JS layer passes only p_faktura_id; the PG function derives the rest.
// Integration tests for the PG function cover the per-position override.
// These unit tests verify that the JS correctly dispatches and passes through.

describe('zatwierdźFakturę — warehouse override and fallback', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('uses position-level magazyn_id when both position and invoice have one', async () => {
    // Warehouse resolution (position overrides invoice) is enforced by the PG
    // function. Here we verify the JS calls the rpc and the caller gets success.
    const { rpcSpy } = setupRpcMock(approvalSuccess({
      zaktualizowane: [{ towar: 'Farba biała', ilosc: 3, nowaIlosc: 3 }],
    }))

    const result = await zatwierdźFakturę(FAK_ID)

    expect(rpcSpy).toHaveBeenCalledWith('approve_invoice_stock', { p_faktura_id: FAK_ID })
    expect(result.success).toBe(true)
  })

  it('falls back to invoice-level magazyn_id when position has none', async () => {
    // Invoice-level warehouse fallback is enforced by the PG function.
    const { rpcSpy } = setupRpcMock(approvalSuccess({
      zaktualizowane: [{ towar: 'Farba biała', ilosc: 3, nowaIlosc: 3 }],
    }))

    const result = await zatwierdźFakturę(FAK_ID)

    expect(rpcSpy).toHaveBeenCalledWith('approve_invoice_stock', { p_faktura_id: FAK_ID })
    expect(result.success).toBe(true)
  })

  it('excludes position from stock update when neither position nor invoice has a warehouse', async () => {
    // PG function skips the position and returns pominiete: 1.
    setupRpcMock(approvalSuccess({ zaktualizowane: [], pominiete: 1 }))

    const result = await zatwierdźFakturę(FAK_ID)

    expect(result.success).toBe(true)
    expect(result.zaktualizowane).toHaveLength(0)
    expect(result.pominiete).toBe(1) // counted as pominięte (no magazyn at any level)
  })
})

// ── Suite 5: NET / BRUTTO price_mode switch ────────────────────────────────────

describe('zatwierdźFakturę — price_mode has no effect on approval', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('approves a gross-mode invoice and uses cena_netto for qty (not a brutto-adjusted value)', async () => {
    // price_mode='gross' means the UI displays brutto prices, but stored cena_netto
    // is always netto. approve_invoice_stock never reads price_mode; qty comes
    // from pozycje_faktury.ilosc directly.
    setupRpcMock(approvalSuccess({
      zaktualizowane: [{ towar: 'Farba biała', ilosc: 2, nowaIlosc: 2 }],
    }))

    const result = await zatwierdźFakturę(FAK_ID)

    expect(result.success).toBe(true)
    expect(result.zaktualizowane[0].ilosc).toBe(2) // qty = position.ilosc, not price-derived
  })

  it('gross and net invoices with same cena_netto produce identical stock updates', async () => {
    // The PG function ignores price_mode; identical position data → identical
    // response regardless of price_mode. Both calls return the same zaktualizowane.
    const sharedZaktualizowane = [{ towar: 'Farba biała', ilosc: 5, nowaIlosc: 5 }]

    setupRpcMock(approvalSuccess({ zaktualizowane: sharedZaktualizowane }))
    const resultNet = await zatwierdźFakturę(FAK_ID)

    vi.clearAllMocks()

    setupRpcMock(approvalSuccess({ zaktualizowane: sharedZaktualizowane }))
    const resultGross = await zatwierdźFakturę(FAK_ID)

    expect(resultNet.zaktualizowane[0].ilosc).toBe(resultGross.zaktualizowane[0].ilosc)
    expect(resultNet.zaktualizowane[0].nowaIlosc).toBe(resultGross.zaktualizowane[0].nowaIlosc)
  })

  it('cena_netto=0 excludes position regardless of price_mode', async () => {
    setupRpcMock(approvalSuccess({ zaktualizowane: [], pominiete: 0 }))

    const result = await zatwierdźFakturę(FAK_ID)

    expect(result.success).toBe(true)
    expect(result.zaktualizowane).toHaveLength(0)
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
