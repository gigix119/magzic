import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../supabase', () => ({
  supabase: { from: vi.fn() },
}))
vi.mock('./events', () => ({ refreshInventory: vi.fn() }))

import { cofnijDoRoboczej } from './magazyn'
import { supabase } from '../supabase'

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
