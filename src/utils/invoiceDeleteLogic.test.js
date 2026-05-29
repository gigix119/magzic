import { describe, it, expect, vi } from 'vitest'
import {
  countInvoiceMovements,
  checkInvoiceDeletable,
  safeDeleteInvoice,
  deleteInvoiceWithInventoryRollback,
} from './invoiceDeleteLogic'

// ── Supabase mock factory ─────────────────────────────────────────────────────
// Builds a minimal fake Supabase client that returns whatever we specify.

// ── cofnijFn mock helpers ─────────────────────────────────────────────────────

function makeCofnijFn(result = { success: true }) {
  return vi.fn().mockResolvedValue(result)
}

function makeSupabase({ movementsCount = 0, movementsError = null, pozDeleteError = null, fakturaDeleteError = null } = {}) {
  const from = (table) => {
    if (table === 'ruchy_magazynowe') {
      return {
        select: () => ({
          eq: () => Promise.resolve(movementsError
            ? { count: null, error: { message: movementsError } }
            : { count: movementsCount, error: null }
          ),
        }),
      }
    }

    if (table === 'pozycje_faktury') {
      return {
        delete: () => ({
          eq: () => Promise.resolve(pozDeleteError
            ? { error: { message: pozDeleteError } }
            : { error: null }
          ),
        }),
      }
    }

    if (table === 'faktury') {
      return {
        delete: () => ({
          eq: () => Promise.resolve(fakturaDeleteError
            ? { error: { message: fakturaDeleteError, code: fakturaDeleteError === 'FK' ? '23503' : 'XX000' } }
            : { error: null }
          ),
        }),
      }
    }

    return {}
  }

  return { from }
}

const FAKTURA_ID = 'faktura-uuid-001'

// ── countInvoiceMovements ─────────────────────────────────────────────────────

describe('countInvoiceMovements', () => {
  it('returns count=0 when no movements', async () => {
    const sb = makeSupabase({ movementsCount: 0 })
    const result = await countInvoiceMovements(FAKTURA_ID, sb)
    expect(result.count).toBe(0)
    expect(result.error).toBeNull()
  })

  it('returns count=3 when 3 movements exist', async () => {
    const sb = makeSupabase({ movementsCount: 3 })
    const result = await countInvoiceMovements(FAKTURA_ID, sb)
    expect(result.count).toBe(3)
    expect(result.error).toBeNull()
  })

  it('returns error string on supabase failure', async () => {
    const sb = makeSupabase({ movementsError: 'connection refused' })
    const result = await countInvoiceMovements(FAKTURA_ID, sb)
    expect(result.error).toBe('connection refused')
  })
})

// ── checkInvoiceDeletable ─────────────────────────────────────────────────────

describe('checkInvoiceDeletable', () => {
  it('allows delete for robocza invoice with 0 movements', async () => {
    const sb = makeSupabase({ movementsCount: 0 })
    const result = await checkInvoiceDeletable(FAKTURA_ID, sb)
    expect(result.canDelete).toBe(true)
  })

  it('blocks delete when invoice has warehouse movements', async () => {
    const sb = makeSupabase({ movementsCount: 2 })
    const result = await checkInvoiceDeletable(FAKTURA_ID, sb)
    expect(result.canDelete).toBe(false)
    expect(result.reason).toContain('ruchy magazynowe')
    expect(result.reason).toContain('cofnij')
  })

  it('blocks delete when movements query errors', async () => {
    const sb = makeSupabase({ movementsError: 'timeout' })
    const result = await checkInvoiceDeletable(FAKTURA_ID, sb)
    expect(result.canDelete).toBe(false)
    expect(result.reason).toBeTruthy()
  })

  it('user-facing reason does not contain raw Supabase error codes', async () => {
    const sb = makeSupabase({ movementsCount: 5 })
    const { reason } = await checkInvoiceDeletable(FAKTURA_ID, sb)
    expect(reason).not.toMatch(/23503|pgsql|violates/)
  })
})

// ── safeDeleteInvoice ─────────────────────────────────────────────────────────

describe('safeDeleteInvoice', () => {
  it('successfully deletes robocza invoice with no movements', async () => {
    const sb = makeSupabase({ movementsCount: 0 })
    const result = await safeDeleteInvoice(FAKTURA_ID, sb)
    expect(result.success).toBe(true)
  })

  it('blocks delete when zatwierdzona invoice has movements', async () => {
    const sb = makeSupabase({ movementsCount: 3 })
    const result = await safeDeleteInvoice(FAKTURA_ID, sb)
    expect(result.success).toBe(false)
    expect(result.error).toContain('cofnij')
  })

  it('returns error when pozycje_faktury delete fails', async () => {
    const sb = makeSupabase({ movementsCount: 0, pozDeleteError: 'permission denied' })
    const result = await safeDeleteInvoice(FAKTURA_ID, sb)
    expect(result.success).toBe(false)
    expect(result.error).toContain('pozycji')
  })

  it('translates FK violation (23503) into user-friendly message', async () => {
    // Race condition: movements appeared after our check
    const sb = makeSupabase({ movementsCount: 0, fakturaDeleteError: 'FK' })
    const result = await safeDeleteInvoice(FAKTURA_ID, sb)
    expect(result.success).toBe(false)
    expect(result.error).toContain('ruchy magazynowe')
    expect(result.error).not.toMatch(/23503|violates foreign key/)
  })

  it('returns raw message for non-FK database errors', async () => {
    const sb = makeSupabase({ movementsCount: 0, fakturaDeleteError: 'some other error' })
    const result = await safeDeleteInvoice(FAKTURA_ID, sb)
    expect(result.success).toBe(false)
    expect(result.error).toBe('some other error')
  })

  it('does NOT delete ruchy_magazynowe themselves (history preserved)', async () => {
    // The mock would throw if ruchy_magazynowe.delete() were called on it.
    // We verify that safeDeleteInvoice only deletes pozycje_faktury and faktury.
    let ruchyDeleteCalled = false
    const sb = {
      from: (table) => {
        if (table === 'ruchy_magazynowe') {
          return {
            select: () => ({ eq: () => Promise.resolve({ count: 0, error: null }) }),
            delete: () => { ruchyDeleteCalled = true; return { eq: () => Promise.resolve({ error: null }) } },
          }
        }
        if (table === 'pozycje_faktury') {
          return { delete: () => ({ eq: () => Promise.resolve({ error: null }) }) }
        }
        if (table === 'faktury') {
          return { delete: () => ({ eq: () => Promise.resolve({ error: null }) }) }
        }
        return {}
      },
    }

    await safeDeleteInvoice(FAKTURA_ID, sb)
    expect(ruchyDeleteCalled).toBe(false)
  })
})

// ── deleteInvoiceWithInventoryRollback ────────────────────────────────────────

describe('deleteInvoiceWithInventoryRollback', () => {
  it('succeeds: cofnij clears movements, then delete proceeds', async () => {
    // cofnij sets movements=0 (simulated by returning count=0 after call)
    const sb = makeSupabase({ movementsCount: 0 })
    const cofnijFn = makeCofnijFn({ success: true })

    const result = await deleteInvoiceWithInventoryRollback(FAKTURA_ID, sb, cofnijFn)

    expect(result.success).toBe(true)
    expect(result.rolledBack).toBe(true)
    expect(cofnijFn).toHaveBeenCalledWith(FAKTURA_ID)
  })

  it('blocks delete and does NOT call delete when cofnij fails', async () => {
    const sb = makeSupabase({ movementsCount: 3 })
    const cofnijFn = makeCofnijFn({ success: false, error: 'stan ujemny' })

    let fakturaDeleteCalled = false
    const sbWithSpy = {
      from: (table) => {
        if (table === 'ruchy_magazynowe') {
          return { select: () => ({ eq: () => Promise.resolve({ count: 3, error: null }) }) }
        }
        if (table === 'faktury') {
          return { delete: () => { fakturaDeleteCalled = true; return { eq: () => Promise.resolve({ error: null }) } } }
        }
        return sb.from(table)
      },
    }

    const result = await deleteInvoiceWithInventoryRollback(FAKTURA_ID, sbWithSpy, cofnijFn)

    expect(result.success).toBe(false)
    expect(result.rolledBack).toBe(false)
    expect(result.error).toContain('cofnąć ruchów')
    expect(fakturaDeleteCalled).toBe(false)
  })

  it('reports rolledBack=true when cofnij succeeds but delete fails', async () => {
    const sb = makeSupabase({ movementsCount: 0, fakturaDeleteError: 'some error' })
    const cofnijFn = makeCofnijFn({ success: true })

    const result = await deleteInvoiceWithInventoryRollback(FAKTURA_ID, sb, cofnijFn)

    expect(result.success).toBe(false)
    expect(result.rolledBack).toBe(true)
    expect(result.error).toContain('cofnięta do roboczej')
    expect(result.error).toContain('nie udało się')
  })

  it('reports rolledBack=true when movements still exist after cofnij', async () => {
    // Edge case: cofnij returns success but movements still counted (partial rollback)
    const sb = makeSupabase({ movementsCount: 1 })
    const cofnijFn = makeCofnijFn({ success: true })

    const result = await deleteInvoiceWithInventoryRollback(FAKTURA_ID, sb, cofnijFn)

    expect(result.success).toBe(false)
    expect(result.rolledBack).toBe(true)
    expect(result.error).toContain('nadal ma')
  })

  it('error messages are user-friendly (no raw FK codes)', async () => {
    const sb = makeSupabase({ movementsCount: 0, fakturaDeleteError: 'FK' })
    const cofnijFn = makeCofnijFn({ success: true })

    const result = await deleteInvoiceWithInventoryRollback(FAKTURA_ID, sb, cofnijFn)
    expect(result.error).not.toMatch(/23503|violates foreign key/)
  })

  it('calls cofnijFn exactly once', async () => {
    const sb = makeSupabase({ movementsCount: 0 })
    const cofnijFn = makeCofnijFn({ success: true })

    await deleteInvoiceWithInventoryRollback(FAKTURA_ID, sb, cofnijFn)
    expect(cofnijFn).toHaveBeenCalledTimes(1)
  })
})
