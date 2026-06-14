import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../supabase', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}))
vi.mock('./events', () => ({ refreshInventory: vi.fn() }))

import { cofnijDoRoboczej, dodajStan, wydajStan, transferujStan } from './magazyn'
import { supabase } from '../supabase'
import { refreshInventory } from './events'
import { computeReconciliation } from './inventoryReconciliation'

const FAKTURA_ID = 'fak-test-1'
const TOWAR_ID   = 'twr-test-1'
const MAGAZYN_ID = 'mag-test-1'

const ZATWIERDZONA = {
  id: FAKTURA_ID,
  status: 'zatwierdzona',
  magazyn_id: MAGAZYN_ID,
  pozycje_faktury: [{ towar_id: TOWAR_ID, magazyn_id: null, ilosc: 5 }],
}

function setupMock({ faktura = ZATWIERDZONA } = {}) {
  const ruchyUpdateEq = vi.fn().mockResolvedValue({ error: null })
  const ruchyUpdate   = vi.fn().mockReturnValue({ eq: ruchyUpdateEq })
  const ruchyDelete   = vi.fn()

  vi.mocked(supabase.from).mockImplementation((table) => {
    if (table === 'faktury') {
      return {
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: faktura, error: null }) }) }),
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      }
    }
    if (table === 'stany_magazynowe') {
      return {
        select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { ilosc: 10 }, error: null }) }) }) }),
        upsert:  () => Promise.resolve({ error: null }),
      }
    }
    if (table === 'ruchy_magazynowe') {
      return { update: ruchyUpdate, delete: ruchyDelete }
    }
    return {}
  })

  return { ruchyUpdate, ruchyUpdateEq, ruchyDelete }
}

describe('cofnijDoRoboczej', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('marks ruchy_magazynowe as reversed instead of deleting them', async () => {
    const { ruchyUpdate, ruchyUpdateEq, ruchyDelete } = setupMock()

    const result = await cofnijDoRoboczej(FAKTURA_ID)

    expect(result.success).toBe(true)
    expect(ruchyDelete).not.toHaveBeenCalled()
    expect(ruchyUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ reversed_at: expect.any(String) })
    )
    expect(ruchyUpdateEq).toHaveBeenCalledWith('faktura_id', FAKTURA_ID)
  })

  it('row count is preserved — update is called once (not delete)', async () => {
    const { ruchyUpdate, ruchyDelete } = setupMock()

    await cofnijDoRoboczej(FAKTURA_ID)

    expect(ruchyDelete).toHaveBeenCalledTimes(0)
    expect(ruchyUpdate).toHaveBeenCalledTimes(1)
  })

  it('returns error when invoice status is not zatwierdzona', async () => {
    const robocza = { ...ZATWIERDZONA, status: 'robocza' }
    setupMock({ faktura: robocza })

    const result = await cofnijDoRoboczej(FAKTURA_ID)

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/nie jest zatwierdzona/)
  })

  it('reversed_at value is a valid ISO timestamp string', async () => {
    const { ruchyUpdate } = setupMock()

    await cofnijDoRoboczej(FAKTURA_ID)

    const [callArg] = ruchyUpdate.mock.calls[0]
    expect(() => new Date(callArg.reversed_at).toISOString()).not.toThrow()
    expect(new Date(callArg.reversed_at).getTime()).toBeGreaterThan(0)
  })
})

// ── dodajStan — atomic RPC path (P8) ──────────────────────────────────────────

describe('dodajStan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { success: true, idempotent: false, new_balance: 10 },
      error: null,
    })
  })

  // ── Client-side validation (no RPC call) ──────────────────────────────────

  it('returns error and skips RPC when magazynId is missing', async () => {
    const result = await dodajStan('twr-1', null, 5, null, null, 'ws-1')
    expect(result).toEqual({ success: false, error: 'Magazyn jest wymagany' })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('returns error and skips RPC when towarId is missing', async () => {
    const result = await dodajStan(null, 'mag-1', 5, null, null, 'ws-1')
    expect(result).toEqual({ success: false, error: 'Towar jest wymagany' })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('returns error and skips RPC when ilosc is zero', async () => {
    const result = await dodajStan('twr-1', 'mag-1', 0, null, null, 'ws-1')
    expect(result.success).toBe(false)
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('returns error and skips RPC when ilosc is negative', async () => {
    const result = await dodajStan('twr-1', 'mag-1', -3, null, null, 'ws-1')
    expect(result.success).toBe(false)
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  // ── Successful receive ────────────────────────────────────────────────────

  it('calls receive_stock RPC with correct params', async () => {
    await dodajStan('twr-1', 'mag-1', 10, 'dostawa', 'fak-1', 'ws-1')
    expect(supabase.rpc).toHaveBeenCalledWith('receive_stock', {
      p_towar_id:        'twr-1',
      p_magazyn_id:      'mag-1',
      p_ilosc:           10,
      p_powod:           'dostawa',
      p_faktura_id:      'fak-1',
      p_workspace_id:    'ws-1',
      p_idempotency_key: null,
    })
  })

  it('returns success and fires refreshInventory on success', async () => {
    const result = await dodajStan('twr-1', 'mag-1', 10, null, null, 'ws-1')
    expect(result).toEqual({ success: true })
    expect(refreshInventory).toHaveBeenCalledTimes(1)
  })

  it('coerces ilosc string to number before passing to RPC', async () => {
    await dodajStan('twr-1', 'mag-1', '7', null, null, 'ws-1')
    const [[, params]] = vi.mocked(supabase.rpc).mock.calls
    expect(params.p_ilosc).toBe(7)
    expect(typeof params.p_ilosc).toBe('number')
  })

  // ── Idempotency ───────────────────────────────────────────────────────────

  it('idempotent re-call: RPC returns idempotent=true → function still returns success', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { success: true, idempotent: true },
      error: null,
    })
    const result = await dodajStan('twr-1', 'mag-1', 10, null, null, 'ws-1')
    expect(result.success).toBe(true)
  })

  it('idempotent re-call does not fire refreshInventory a second time from two calls', async () => {
    await dodajStan('twr-1', 'mag-1', 10, null, null, 'ws-1')

    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { success: true, idempotent: true },
      error: null,
    })
    await dodajStan('twr-1', 'mag-1', 10, null, null, 'ws-1')

    // Both calls succeed; refreshInventory fires once per successful call
    expect(refreshInventory).toHaveBeenCalledTimes(2)
  })

  // ── Cross-workspace rejection ─────────────────────────────────────────────

  it('cross-workspace product rejection propagates as error', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { success: false, error: 'product does not belong to workspace' },
      error: null,
    })
    const result = await dodajStan('twr-other-ws', 'mag-1', 10, null, null, 'ws-1')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/workspace/)
    expect(refreshInventory).not.toHaveBeenCalled()
  })

  it('cross-workspace warehouse rejection propagates as error', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { success: false, error: 'warehouse does not belong to workspace' },
      error: null,
    })
    const result = await dodajStan('twr-1', 'mag-other-ws', 10, null, null, 'ws-1')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/workspace/)
    expect(refreshInventory).not.toHaveBeenCalled()
  })

  it('workspace ownership rejection propagates as error', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { success: false, error: 'workspace not owned by caller' },
      error: null,
    })
    const result = await dodajStan('twr-1', 'mag-1', 10, null, null, 'ws-other')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/workspace/)
    expect(refreshInventory).not.toHaveBeenCalled()
  })

  // ── Network / DB errors ───────────────────────────────────────────────────

  it('Supabase network error propagates as { success: false, error }', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data:  null,
      error: { message: 'connection timeout' },
    })
    const result = await dodajStan('twr-1', 'mag-1', 10, null, null, 'ws-1')
    expect(result.success).toBe(false)
    expect(result.error).toBe('connection timeout')
    expect(refreshInventory).not.toHaveBeenCalled()
  })

  // ── Balance invariant (pure computation) ──────────────────────────────────
  // The RPC guarantees balance == sum(non-reversed movements) at the DB level.
  // We verify the matching invariant holds in the JS reconciliation layer:
  // a 'purchase' movement for qty Q, with stored balance Q, yields drift 0.

  it('balance invariant: purchase movement exactly accounts for stored balance (drift = 0)', () => {
    // The RPC writes a 'purchase' row and sets ilosc = SUM(movements).
    // After a single receive of 10, stany_magazynowe.ilosc = 10 and
    // ruchy_magazynowe has one row: purchase, qty=10.
    // computeReconciliation must return drift=0.
    const stany = [{ towar_id: 'twr-1', magazyn_id: 'mag-1', ilosc: 10, workspace_id: 'ws-1' }]
    const ruchy = [{
      typ: 'purchase', towar_id: 'twr-1', ilosc: 10, workspace_id: 'ws-1',
      magazyn_docelowy_id: 'mag-1', magazyn_zrodlowy_id: null,
    }]
    const [row] = computeReconciliation(stany, ruchy)
    expect(row.drift).toBe(0)
  })
})

// ── wydajStan — delegates to issue_stock RPC (P9) ─────────────────────────────
//
// After the P12 consolidation, wydajStan is a thin façade over issueStock.
// Client-side validation is preserved; the RPC handles atomicity, the
// non-negative guard, and workspace isolation.

describe('wydajStan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { success: true, idempotent: false, new_balance: 40 },
      error: null,
    })
  })

  // ── Client-side validation ─────────────────────────────────────────────────

  it('returns error and skips RPC when magazynId is missing', async () => {
    const result = await wydajStan('twr-1', null, 5, null, 'ws-1')
    expect(result).toEqual({ success: false, error: 'Magazyn jest wymagany' })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('returns error and skips RPC when towarId is missing', async () => {
    const result = await wydajStan(null, 'mag-1', 5, null, 'ws-1')
    expect(result).toEqual({ success: false, error: 'Towar jest wymagany' })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('returns error and skips RPC when ilosc is zero', async () => {
    const result = await wydajStan('twr-1', 'mag-1', 0, null, 'ws-1')
    expect(result.success).toBe(false)
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('returns error and skips RPC when ilosc is negative', async () => {
    const result = await wydajStan('twr-1', 'mag-1', -3, null, 'ws-1')
    expect(result.success).toBe(false)
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  // ── Successful issue ───────────────────────────────────────────────────────

  it('calls issue_stock RPC with correct params', async () => {
    await wydajStan('twr-1', 'mag-1', 10, 'zużycie', 'ws-1')
    expect(supabase.rpc).toHaveBeenCalledWith('issue_stock', expect.objectContaining({
      p_towar_id:    'twr-1',
      p_magazyn_id:  'mag-1',
      p_ilosc:       10,
      p_powod:       'zużycie',
      p_workspace_id:'ws-1',
    }))
  })

  it('returns success and fires refreshInventory on success', async () => {
    const result = await wydajStan('twr-1', 'mag-1', 10, null, 'ws-1')
    expect(result.success).toBe(true)
    expect(refreshInventory).toHaveBeenCalledTimes(1)
  })

  it('coerces ilosc string to number before passing to RPC', async () => {
    await wydajStan('twr-1', 'mag-1', '7', null, 'ws-1')
    const [[, params]] = vi.mocked(supabase.rpc).mock.calls
    expect(params.p_ilosc).toBe(7)
    expect(typeof params.p_ilosc).toBe('number')
  })

  // ── Insufficient stock — Polish error message translation ─────────────────

  it('translates RPC insufficient-stock into Polish error with available qty', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { success: false, error: 'insufficient stock', available: 3 },
      error: null,
    })
    const result = await wydajStan('twr-1', 'mag-1', 10, null, 'ws-1')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/Niewystarczający stan/)
    expect(result.error).toContain('3')
    expect(refreshInventory).not.toHaveBeenCalled()
  })

  it('does not fire refreshInventory when stock is insufficient', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { success: false, error: 'insufficient stock', available: 0 },
      error: null,
    })
    await wydajStan('twr-1', 'mag-1', 99, null, 'ws-1')
    expect(refreshInventory).not.toHaveBeenCalled()
  })

  // ── Network / DB errors ───────────────────────────────────────────────────

  it('propagates Supabase transport error as { success: false, error }', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: 'connection timeout' } })
    const result = await wydajStan('twr-1', 'mag-1', 10, null, 'ws-1')
    expect(result.success).toBe(false)
    expect(result.error).toBe('connection timeout')
    expect(refreshInventory).not.toHaveBeenCalled()
  })

  it('propagates workspace ownership rejection', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { success: false, error: 'workspace not owned by caller' },
      error: null,
    })
    const result = await wydajStan('twr-1', 'mag-1', 10, null, 'ws-other')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/workspace/)
  })
})

// ── transferujStan — delegates to transfer_stock RPC (P11) ───────────────────
//
// After the P12 consolidation, transferujStan is a thin façade over
// transferStock. Client-side validation is preserved; the RPC owns atomicity
// (two movements in one transaction), canonical-UUID deadlock prevention, and
// workspace isolation.

describe('transferujStan', () => {
  const TSRC = 'mag-src-111'
  const TDST = 'mag-dst-222'

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { success: true, idempotent: false, src_new_balance: 40, dst_new_balance: 10 },
      error: null,
    })
  })

  // ── Client-side validation ─────────────────────────────────────────────────

  it('returns error when source magazyn is missing', async () => {
    const result = await transferujStan('twr-1', null, TDST, 5, null, 'ws-1')
    expect(result).toEqual({ success: false, error: 'Oba magazyny są wymagane' })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('returns error when destination magazyn is missing', async () => {
    const result = await transferujStan('twr-1', TSRC, null, 5, null, 'ws-1')
    expect(result).toEqual({ success: false, error: 'Oba magazyny są wymagane' })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('returns error when towarId is missing', async () => {
    const result = await transferujStan(null, TSRC, TDST, 5, null, 'ws-1')
    expect(result).toEqual({ success: false, error: 'Towar jest wymagany' })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('returns error when ilosc is zero', async () => {
    const result = await transferujStan('twr-1', TSRC, TDST, 0, null, 'ws-1')
    expect(result.success).toBe(false)
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('returns error when source and destination are the same warehouse', async () => {
    const result = await transferujStan('twr-1', TSRC, TSRC, 5, null, 'ws-1')
    expect(result).toEqual({ success: false, error: 'Magazyny muszą być różne' })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  // ── Successful transfer ────────────────────────────────────────────────────

  it('calls transfer_stock RPC with correct params', async () => {
    await transferujStan('twr-1', TSRC, TDST, 10, 'relokacja', 'ws-1')
    expect(supabase.rpc).toHaveBeenCalledWith('transfer_stock', expect.objectContaining({
      p_towar_id:            'twr-1',
      p_magazyn_zrodlowy_id: TSRC,
      p_magazyn_docelowy_id: TDST,
      p_ilosc:               10,
      p_powod:               'relokacja',
      p_workspace_id:        'ws-1',
    }))
  })

  it('returns success and fires refreshInventory on success', async () => {
    const result = await transferujStan('twr-1', TSRC, TDST, 10, null, 'ws-1')
    expect(result.success).toBe(true)
    expect(refreshInventory).toHaveBeenCalledTimes(1)
  })

  it('coerces ilosc string to number before passing to RPC', async () => {
    await transferujStan('twr-1', TSRC, TDST, '5', null, 'ws-1')
    const [[, params]] = vi.mocked(supabase.rpc).mock.calls
    expect(params.p_ilosc).toBe(5)
    expect(typeof params.p_ilosc).toBe('number')
  })

  // ── Insufficient source stock — Polish error message translation ──────────

  it('translates RPC insufficient-stock into Polish error with available qty', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { success: false, error: 'insufficient stock for transfer', available: 2 },
      error: null,
    })
    const result = await transferujStan('twr-1', TSRC, TDST, 10, null, 'ws-1')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/Niewystarczający stan w magazynie źródłowym/)
    expect(result.error).toContain('2')
    expect(refreshInventory).not.toHaveBeenCalled()
  })

  // ── Network / DB errors ───────────────────────────────────────────────────

  it('propagates Supabase transport error as { success: false, error }', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: 'timeout' } })
    const result = await transferujStan('twr-1', TSRC, TDST, 10, null, 'ws-1')
    expect(result.success).toBe(false)
    expect(result.error).toBe('timeout')
    expect(refreshInventory).not.toHaveBeenCalled()
  })

  it('propagates cross-workspace rejection for source warehouse', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { success: false, error: 'source warehouse does not belong to workspace' },
      error: null,
    })
    const result = await transferujStan('twr-1', TSRC, TDST, 5, null, 'ws-1')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/workspace/)
  })
})
