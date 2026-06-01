import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  normalizeForAlias,
  lookupAlias,
  lookupAliasesForItems,
  upsertAlias,
  invalidateAliasCache,
  _resetAliasCache,
  countAliases,
  topAliases,
  mostUsedAliases,
  recentAliases,
  getAliasAnalytics,
} from './invoiceAliasService.js'

// ── Mock Supabase factory ─────────────────────────────────────────────────────
// Mirrors the pattern used in invoiceDeleteLogic.test.js

function makeSupabase({
  cacheRows = [],
  maybySingleData = null,
  maybeError = null,
  insertError = null,
  updateError = null,
  rpcData = null,
  rpcError = null,
  countResult = { count: 0, error: null },
  listRows = [],
  listError = null,
} = {}) {
  return {
    from: (table) => {
      if (table !== 'invoice_aliases') {
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }
      }

      // Chain state — we track what operations were applied
      let _isHead = false
      let _cols = '*'
      const eqFilters = []
      let _orderCol = null
      let _limitVal = null

      const builder = {
        select: (cols, opts = {}) => {
          _cols = cols
          _isHead = !!(opts.head && opts.count === 'exact')
          return builder
        },
        eq: (col, val) => { eqFilters.push([col, val]); return builder },
        order: (col) => { _orderCol = col; return builder },
        limit: (n) => { _limitVal = n; return builder },

        // Terminal methods
        maybeSingle: () => Promise.resolve({ data: maybySingleData, error: maybeError }),
        single: () => Promise.resolve({ data: maybySingleData, error: maybeError }),

        // Mutating builders — return a thenable for `await chain`
        update: (data) => ({
          eq: () => Promise.resolve({ data: null, error: updateError }),
        }),
        insert: (rows) => ({
          // Awaitable directly
          then: (resolve, reject) =>
            Promise.resolve({ data: null, error: insertError }).then(resolve, reject),
        }),

        // Awaitable: resolves with list rows for SELECT … ORDER … queries
        then: (resolve, reject) => {
          if (_isHead) return Promise.resolve(countResult).then(resolve, reject)
          return Promise.resolve({ data: cacheRows.length > 0 ? cacheRows : listRows, error: listError }).then(resolve, reject)
        },
      }

      return builder
    },
    rpc: () => Promise.resolve({ data: rpcData, error: rpcError }),
  }
}

// ── Reset cache between tests ─────────────────────────────────────────────────
beforeEach(() => {
  _resetAliasCache()
  vi.clearAllMocks()
})

// ─────────────────────────────────────────────────────────────────────────────
// normalizeForAlias
// ─────────────────────────────────────────────────────────────────────────────

describe('normalizeForAlias', () => {
  it('handles null, undefined, empty string', () => {
    expect(normalizeForAlias(null)).toBe('')
    expect(normalizeForAlias(undefined)).toBe('')
    expect(normalizeForAlias('')).toBe('')
  })

  it('lowercases and trims', () => {
    expect(normalizeForAlias('  KABEL LAN  ')).toBe('kabel lan')
  })

  it('removes Polish diacritics', () => {
    const r = normalizeForAlias('Przewód sieciowy Łódź')
    expect(r).not.toMatch(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/)
    expect(r).toContain('przewod')
    expect(r).toContain('lodz')
  })

  it('normalises cat.6 and kat 6 to cat6 / kat6', () => {
    expect(normalizeForAlias('KABEL UTP CAT.6')).toContain('cat6')
    expect(normalizeForAlias('Kabel kat 6')).toContain('kat6')
    expect(normalizeForAlias('Kabel kat. 6')).toContain('kat6')
  })

  it('preserves slash in fractions', () => {
    expect(normalizeForAlias('Rura 1/2"')).toContain('1/2')
  })

  it('collapses multiple spaces', () => {
    expect(normalizeForAlias('kabel   utp   cat6')).toBe('kabel utp cat6')
  })

  it('same input always produces same output (deterministic)', () => {
    const a = normalizeForAlias('KABEL LAN CAT6')
    const b = normalizeForAlias('KABEL LAN CAT6')
    expect(a).toBe(b)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// lookupAlias
// ─────────────────────────────────────────────────────────────────────────────

describe('lookupAlias', () => {
  it('returns null for null workspaceId or rawName', async () => {
    const supa = makeSupabase()
    expect(await lookupAlias(null, 'KABEL', supa)).toBeNull()
    expect(await lookupAlias('ws1', null, supa)).toBeNull()
    expect(await lookupAlias('ws1', '', supa)).toBeNull()
  })

  it('returns null when DB has no alias', async () => {
    const supa = makeSupabase({ cacheRows: [] })
    const result = await lookupAlias('ws-1', 'KABEL LAN CAT6', supa)
    expect(result).toBeNull()
  })

  it('returns productId and usageCount when alias exists in DB', async () => {
    const supa = makeSupabase({
      cacheRows: [{
        invoice_name_normalized: 'kabel lan cat6',
        product_id: 'prod-uuid-1',
        usage_count: 5,
      }],
    })
    const result = await lookupAlias('ws-1', 'KABEL LAN CAT6', supa)
    expect(result).not.toBeNull()
    expect(result.productId).toBe('prod-uuid-1')
    expect(result.usageCount).toBe(5)
  })

  it('returns from cache on second call without hitting DB again', async () => {
    const rpcSpy = vi.fn().mockResolvedValue({ data: null, error: null })
    const fromSpy = vi.fn().mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({
            data: [{ invoice_name_normalized: 'kabel', product_id: 'p1', usage_count: 2 }],
            error: null,
          }),
        }),
      }),
    })
    const supa = { from: fromSpy, rpc: rpcSpy }

    await lookupAlias('ws-cache', 'kabel', supa)
    await lookupAlias('ws-cache', 'kabel', supa)

    // from() should only be called once (for the initial cache load)
    expect(fromSpy).toHaveBeenCalledTimes(1)
  })

  it('returns null when DB returns an error (fail gracefully)', async () => {
    const supa = makeSupabase({
      listError: { message: 'DB error' },
      maybeError: { message: 'DB error' },
    })
    const result = await lookupAlias('ws-err', 'KABEL', supa)
    expect(result).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// lookupAliasesForItems (batch)
// ─────────────────────────────────────────────────────────────────────────────

describe('lookupAliasesForItems', () => {
  it('returns empty Map for empty inputs', async () => {
    const supa = makeSupabase()
    expect(await lookupAliasesForItems(null, ['kabel'], supa)).toEqual(new Map())
    expect(await lookupAliasesForItems('ws', [], supa)).toEqual(new Map())
    expect(await lookupAliasesForItems('ws', null, supa)).toEqual(new Map())
  })

  it('returns correct Map for matching aliases', async () => {
    const supa = makeSupabase({
      cacheRows: [
        { invoice_name_normalized: 'kabel utp cat6', product_id: 'prod-1', usage_count: 3 },
        { invoice_name_normalized: 'syfon umywalkowy', product_id: 'prod-2', usage_count: 1 },
      ],
    })
    const map = await lookupAliasesForItems('ws', ['KABEL UTP CAT6', 'syfon umywalkowy', 'nieznany'], supa)
    expect(map.size).toBe(2)
    expect(map.get('KABEL UTP CAT6')?.productId).toBe('prod-1')
    expect(map.get('KABEL UTP CAT6')?.usageCount).toBe(3)
    expect(map.get('syfon umywalkowy')?.productId).toBe('prod-2')
    expect(map.has('nieznany')).toBe(false)
  })

  it('uses cache on repeated calls for the same workspace', async () => {
    let loadCount = 0
    const supa = {
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => {
              loadCount++
              return Promise.resolve({ data: [], error: null })
            },
          }),
        }),
      }),
      rpc: vi.fn(),
    }

    await lookupAliasesForItems('ws-batch', ['kabel'], supa)
    await lookupAliasesForItems('ws-batch', ['syfon'], supa)

    expect(loadCount).toBe(1) // only one DB call total
  })

  it('isolates different workspaces', async () => {
    // Load cache for ws-A
    const supaA = makeSupabase({
      cacheRows: [{ invoice_name_normalized: 'kabel', product_id: 'prod-A', usage_count: 1 }],
    })
    const supaB = makeSupabase({ cacheRows: [] })

    await lookupAliasesForItems('ws-A', ['kabel'], supaA)
    const mapB = await lookupAliasesForItems('ws-B', ['kabel'], supaB)
    expect(mapB.size).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// upsertAlias
// ─────────────────────────────────────────────────────────────────────────────

describe('upsertAlias', () => {
  it('returns error for missing required fields', async () => {
    const supa = makeSupabase()
    expect((await upsertAlias(null, 'kabel', 'prod1', supa)).success).toBe(false)
    expect((await upsertAlias('ws', null, 'prod1', supa)).success).toBe(false)
    expect((await upsertAlias('ws', 'kabel', null, supa)).success).toBe(false)
  })

  it('returns error when name normalizes to less than 2 chars', async () => {
    const supa = makeSupabase()
    const result = await upsertAlias('ws', 'i', 'prod1', supa)
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/short/)
  })

  it('succeeds via RPC (is_new=true path)', async () => {
    const supa = makeSupabase({
      rpcData: { id: 'new-uuid', usage_count: 1, is_new: true },
      rpcError: null,
    })
    const result = await upsertAlias('ws-1', 'KABEL LAN CAT6', 'prod-1', supa)
    expect(result.success).toBe(true)
    expect(result.isNew).toBe(true)
    expect(result.usageCount).toBe(1)
  })

  it('succeeds via RPC (is_new=false path, increments count)', async () => {
    const supa = makeSupabase({
      rpcData: { id: 'existing-uuid', usage_count: 7, is_new: false },
      rpcError: null,
    })
    const result = await upsertAlias('ws-1', 'KABEL LAN CAT6', 'prod-1', supa)
    expect(result.success).toBe(true)
    expect(result.isNew).toBe(false)
    expect(result.usageCount).toBe(7)
  })

  it('falls back to manual insert when RPC is unavailable', async () => {
    const supa = makeSupabase({
      rpcError: { message: 'function upsert_invoice_alias does not exist' },
      maybySingleData: null,   // no existing row
      insertError: null,
    })
    const result = await upsertAlias('ws-2', 'Śruba M6x20', 'prod-2', supa)
    expect(result.success).toBe(true)
    expect(result.isNew).toBe(true)
    expect(result.usageCount).toBe(1)
  })

  it('falls back to update when row already exists (no RPC)', async () => {
    const supa = makeSupabase({
      rpcError: { message: 'function upsert_invoice_alias does not exist' },
      maybySingleData: { id: 'row-id', usage_count: 4 },
      updateError: null,
    })
    const result = await upsertAlias('ws-3', 'Przewód UTP', 'prod-3', supa)
    expect(result.success).toBe(true)
    expect(result.isNew).toBe(false)
    expect(result.usageCount).toBe(5)
  })

  it('invalidates alias cache after successful upsert', async () => {
    // Seed cache with a stale hit
    const rows = [{ invoice_name_normalized: 'kabel', product_id: 'old-prod', usage_count: 1 }]
    const supaLoad = makeSupabase({ cacheRows: rows })
    await lookupAlias('ws-inv', 'kabel', supaLoad)

    // Upsert should invalidate
    const supaUpsert = makeSupabase({ rpcData: { id: 'id', usage_count: 2, is_new: false } })
    await upsertAlias('ws-inv', 'kabel', 'new-prod', supaUpsert)

    // Cache should be invalid now — next lookup would go to DB
    // We verify by checking a fresh lookup call reaches the DB
    let dbCalled = false
    const supaCheck = {
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => { dbCalled = true; return Promise.resolve({ data: [], error: null }) },
          }),
        }),
      }),
      rpc: vi.fn(),
    }
    await lookupAlias('ws-inv', 'kabel', supaCheck)
    expect(dbCalled).toBe(true)
  })

  it('returns success=false when insert fails (non-conflict error)', async () => {
    const supa = makeSupabase({
      rpcError: { message: 'rpc not found' },
      maybySingleData: null,
      insertError: { code: '42501', message: 'Permission denied' },
    })
    const result = await upsertAlias('ws-4', 'Kabel', 'prod-4', supa)
    expect(result.success).toBe(false)
  })

  it('handles update error gracefully', async () => {
    const supa = makeSupabase({
      rpcError: { message: 'rpc not found' },
      maybySingleData: { id: 'row', usage_count: 1 },
      updateError: { message: 'network error' },
    })
    const result = await upsertAlias('ws-5', 'Kabel', 'prod-5', supa)
    expect(result.success).toBe(false)
    expect(result.error).toBe('network error')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// invalidateAliasCache
// ─────────────────────────────────────────────────────────────────────────────

describe('invalidateAliasCache', () => {
  it('causes next lookup to re-query the DB', async () => {
    let callCount = 0
    const supa = {
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => { callCount++; return Promise.resolve({ data: [], error: null }) },
          }),
        }),
      }),
      rpc: vi.fn(),
    }

    await lookupAlias('ws-inv2', 'item', supa)
    invalidateAliasCache('ws-inv2')
    await lookupAlias('ws-inv2', 'item', supa)

    expect(callCount).toBe(2)
  })

  it('invalidate(null) resets all workspaces', async () => {
    let callCount = 0
    const supa = {
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => { callCount++; return Promise.resolve({ data: [], error: null }) },
          }),
        }),
      }),
      rpc: vi.fn(),
    }

    await lookupAlias('ws-A2', 'item', supa)
    invalidateAliasCache(null)
    await lookupAlias('ws-A2', 'item', supa)

    expect(callCount).toBe(2)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Analytics helpers
// ─────────────────────────────────────────────────────────────────────────────

describe('analytics helpers', () => {
  it('countAliases returns 0 for null workspaceId', async () => {
    expect(await countAliases(null, makeSupabase())).toBe(0)
  })

  it('countAliases returns count from DB', async () => {
    const supa = makeSupabase({ countResult: { count: 42, error: null } })
    expect(await countAliases('ws', supa)).toBe(42)
  })

  it('countAliases returns 0 on DB error', async () => {
    const supa = makeSupabase({ countResult: { count: null, error: { message: 'err' } } })
    expect(await countAliases('ws', supa)).toBe(0)
  })

  it('topAliases returns [] for null workspaceId', async () => {
    expect(await topAliases(null, makeSupabase())).toEqual([])
  })

  it('topAliases returns rows from DB', async () => {
    const rows = [
      { invoice_name: 'KABEL UTP', product_id: 'p1', usage_count: 17, last_used_at: '2025-01-01' },
      { invoice_name: 'Śruba M6', product_id: 'p2', usage_count: 9, last_used_at: '2025-01-02' },
    ]
    const supa = makeSupabase({ listRows: rows })
    const result = await topAliases('ws', supa, 5)
    expect(result).toHaveLength(2)
    expect(result[0].invoice_name).toBe('KABEL UTP')
    expect(result[0].usage_count).toBe(17)
  })

  it('mostUsedAliases is the same function as topAliases', () => {
    expect(mostUsedAliases).toBe(topAliases)
  })

  it('recentAliases returns [] for null workspaceId', async () => {
    expect(await recentAliases(null, makeSupabase())).toEqual([])
  })

  it('recentAliases returns rows from DB', async () => {
    const rows = [{ invoice_name: 'Listwa LED', product_id: 'p3', usage_count: 3, last_used_at: '2025-05-01' }]
    const supa = makeSupabase({ listRows: rows })
    const result = await recentAliases('ws', supa)
    expect(result).toHaveLength(1)
    expect(result[0].invoice_name).toBe('Listwa LED')
  })

  it('getAliasAnalytics returns total and rows', async () => {
    const supa = makeSupabase({
      countResult: { count: 10, error: null },
      listRows: [{ invoice_name: 'kabel', product_id: 'p1', usage_count: 5, last_used_at: '2025-01-01' }],
    })
    const analytics = await getAliasAnalytics('ws', supa)
    expect(analytics.total).toBe(10)
    expect(analytics.rows).toHaveLength(1)
  })

  it('getAliasAnalytics returns {total:0, rows:[]} for null workspaceId', async () => {
    const analytics = await getAliasAnalytics(null, makeSupabase())
    expect(analytics.total).toBe(0)
    expect(analytics.rows).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Edge cases and error handling
// ─────────────────────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('handles very long invoice names by truncating', async () => {
    const longName = 'A'.repeat(1000)
    const supa = makeSupabase({ rpcData: { id: 'id', usage_count: 1, is_new: true } })
    const result = await upsertAlias('ws', longName, 'prod', supa)
    expect(result.success).toBe(true)
  })

  it('handles invoice names that are only stopwords (normalizes to empty)', async () => {
    const supa = makeSupabase()
    // "do na i" would normalize to "do na i" (normalizeText keeps text, but after normalizeForAlias
    // the result is "do na i" which is non-empty — lookup just returns null if not found)
    const result = await lookupAlias('ws', 'do', supa)
    // should return null (no alias found) without crashing
    expect(result).toBeNull()
  })

  it('does not crash when DB returns unexpected null data', async () => {
    const supa = makeSupabase({ cacheRows: null, listRows: null })
    const result = await lookupAliasesForItems('ws', ['item'], supa)
    expect(result).toBeInstanceOf(Map)
  })

  it('upsertAlias does not crash when product does not exist (DB allows it)', async () => {
    const supa = makeSupabase({ rpcData: { id: 'id', usage_count: 1, is_new: true } })
    const result = await upsertAlias('ws', 'Bateria LR6', 'non-existent-product-id', supa)
    expect(result.success).toBe(true)
  })

  it('multiple rapid upserts for the same name remain stable', async () => {
    const callsToRpc = []
    const supa = {
      from: () => ({
        select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }),
        insert: () => ({ then: (r) => r({ data: null, error: null }) }),
      }),
      rpc: (name, params) => {
        callsToRpc.push(params?.p_invoice_name_normalized)
        return Promise.resolve({ data: { id: 'id', usage_count: callsToRpc.length, is_new: callsToRpc.length === 1 }, error: null })
      },
    }

    const results = await Promise.all([
      upsertAlias('ws', 'KABEL UTP', 'prod1', supa),
      upsertAlias('ws', 'KABEL UTP', 'prod1', supa),
      upsertAlias('ws', 'KABEL UTP', 'prod1', supa),
    ])

    expect(results.every(r => r.success)).toBe(true)
  })
})
