/**
 * Alias Learning Engine — self-learning invoice → product alias system.
 *
 * Every manual product correction is remembered in the `invoice_aliases` Supabase table.
 * On the next invoice with the same item name the alias is returned instantly — no TF-IDF,
 * no Jaccard, no regex needed.
 *
 * Design:
 *  - workspace-scoped: aliases are never shared across workspaces
 *  - lazy, cache-first: full workspace cache loaded on first access (1 query), then in-memory
 *  - idempotent upsert: safe for repeated clicks / concurrent requests
 *  - normalization delegated to invoiceTfIdf.normalizeText — single source of truth
 */

import { normalizeText } from './invoiceTfIdf.js'

// ── Normalization ─────────────────────────────────────────────────────────────

/**
 * Normalize an invoice item name for alias key storage and lookup.
 * Delegates to invoiceTfIdf.normalizeText — no duplication of normalization logic.
 * @param {string|null|undefined} rawName
 * @returns {string}
 */
export function normalizeForAlias(rawName) {
  return normalizeText(rawName ?? '')
}

// ── In-memory workspace alias cache ──────────────────────────────────────────

let _cache = {
  workspaceId: null,
  /** @type {Map<string, { productId: string, usageCount: number }>} */
  aliases: new Map(),
  loaded: false,
}

/** @param {string} workspaceId */
function _isCacheValid(workspaceId) {
  return _cache.loaded && _cache.workspaceId === workspaceId
}

function _populateCache(workspaceId, rows) {
  _cache.workspaceId = workspaceId
  _cache.aliases.clear()
  for (const row of rows) {
    _cache.aliases.set(row.invoice_name_normalized, {
      productId: row.product_id,
      usageCount: row.usage_count,
    })
  }
  _cache.loaded = true
}

/**
 * Invalidate the cache after a write so the next lookup re-reads from DB.
 * @param {string|null} [workspaceId] - pass null to invalidate all
 */
export function invalidateAliasCache(workspaceId = null) {
  if (workspaceId === null || _cache.workspaceId === workspaceId) {
    _cache.loaded = false
  }
}

/** Reset all cache state. For tests only. */
export function _resetAliasCache() {
  _cache = { workspaceId: null, aliases: new Map(), loaded: false }
}

// ── Cache loader ──────────────────────────────────────────────────────────────

async function _loadCache(workspaceId, supabase) {
  const { data, error } = await supabase
    .from('invoice_aliases')
    .select('invoice_name_normalized, product_id, usage_count')
    .eq('workspace_id', workspaceId)
    .order('usage_count', { ascending: false })

  if (error) {
    console.warn('[invoiceAliasService] cache load error:', error.message)
    return false
  }

  _populateCache(workspaceId, data || [])
  return true
}

// ── Lookup ────────────────────────────────────────────────────────────────────

/**
 * Look up a single alias by raw invoice item name.
 * @param {string} workspaceId
 * @param {string} rawName
 * @param {object} supabase - Supabase client
 * @returns {Promise<{ productId: string, usageCount: number } | null>}
 */
export async function lookupAlias(workspaceId, rawName, supabase) {
  if (!workspaceId || !rawName) return null

  const normalized = normalizeForAlias(rawName)
  if (!normalized) return null

  if (_isCacheValid(workspaceId)) {
    const hit = _cache.aliases.get(normalized)
    return hit ? { productId: hit.productId, usageCount: hit.usageCount } : null
  }

  try {
    await _loadCache(workspaceId, supabase)
    const hit = _cache.aliases.get(normalized)
    return hit ? { productId: hit.productId, usageCount: hit.usageCount } : null
  } catch {
    // Cache load failed — direct DB fallback for this single item
    try {
      const { data } = await supabase
        .from('invoice_aliases')
        .select('product_id, usage_count')
        .eq('workspace_id', workspaceId)
        .eq('invoice_name_normalized', normalized)
        .maybeSingle()
      return data ? { productId: data.product_id, usageCount: data.usage_count } : null
    } catch { return null }
  }
}

/**
 * Batch alias lookup for multiple invoice item names.
 * Loads the full workspace alias cache in ONE query — zero N+1 overhead.
 *
 * @param {string} workspaceId
 * @param {string[]} rawNames
 * @param {object} supabase
 * @returns {Promise<Map<string, { productId: string, usageCount: number }>>}
 *          Map keyed by the original rawName strings
 */
export async function lookupAliasesForItems(workspaceId, rawNames, supabase) {
  if (!workspaceId || !Array.isArray(rawNames) || rawNames.length === 0) return new Map()

  if (!_isCacheValid(workspaceId)) {
    try {
      await _loadCache(workspaceId, supabase)
    } catch { return new Map() }
  }

  const result = new Map()
  for (const name of rawNames) {
    if (!name) continue
    const normalized = normalizeForAlias(name)
    const hit = _cache.aliases.get(normalized)
    if (hit) result.set(name, { productId: hit.productId, usageCount: hit.usageCount })
  }
  return result
}

// ── Upsert ────────────────────────────────────────────────────────────────────

/**
 * Create or update an alias.  Always safe to call repeatedly:
 *  - First call: inserts new row (usage_count = 1)
 *  - Repeat call: increments usage_count, updates product_id if corrected
 *  - Concurrent calls: handled via UNIQUE constraint + retry
 *
 * @param {string} workspaceId
 * @param {string} rawName
 * @param {string} productId
 * @param {object} supabase
 * @param {object} [opts]
 * @param {string} [opts.createdBy] - user UUID (optional, for audit)
 * @returns {Promise<{ success: boolean, isNew?: boolean, usageCount?: number, error?: string }>}
 */
export async function upsertAlias(workspaceId, rawName, productId, supabase, opts = {}) {
  if (!workspaceId || !rawName || !productId) {
    return { success: false, error: 'Missing workspaceId, rawName or productId' }
  }

  const normalized = normalizeForAlias(rawName)
  if (!normalized || normalized.length < 2) {
    return { success: false, error: 'Name too short after normalization' }
  }

  const invoiceName = rawName.trim().slice(0, 500)
  const normalizedTruncated = normalized.slice(0, 500)

  // ── Path 1: Atomic RPC (preferred — handles concurrent upserts correctly) ──
  try {
    const { data, error: rpcErr } = await supabase.rpc('upsert_invoice_alias', {
      p_workspace_id:            workspaceId,
      p_invoice_name:            invoiceName,
      p_invoice_name_normalized: normalizedTruncated,
      p_product_id:              productId,
      p_created_by:              opts.createdBy || null,
    })

    if (!rpcErr) {
      invalidateAliasCache(workspaceId)
      return { success: true, isNew: data?.is_new ?? false, usageCount: data?.usage_count ?? 1 }
    }

    // If the RPC function itself doesn't exist yet (migration not run), fall through
    if (!rpcErr.message?.includes('upsert_invoice_alias')) {
      console.warn('[invoiceAliasService] rpc error:', rpcErr.message)
    }
  } catch { /* fall through to manual path */ }

  // ── Path 2: Manual select-then-update/insert (fallback) ──────────────────
  const now = new Date().toISOString()

  try {
    const { data: existing } = await supabase
      .from('invoice_aliases')
      .select('id, usage_count')
      .eq('workspace_id', workspaceId)
      .eq('invoice_name_normalized', normalizedTruncated)
      .maybeSingle()

    if (existing) {
      const newCount = (existing.usage_count || 0) + 1
      const { error: upErr } = await supabase
        .from('invoice_aliases')
        .update({ product_id: productId, usage_count: newCount, updated_at: now, last_used_at: now })
        .eq('id', existing.id)

      if (upErr) return { success: false, error: upErr.message }
      invalidateAliasCache(workspaceId)
      return { success: true, isNew: false, usageCount: newCount }
    }

    // Insert new row
    const { error: insErr } = await supabase
      .from('invoice_aliases')
      .insert([{
        workspace_id:            workspaceId,
        invoice_name:            invoiceName,
        invoice_name_normalized: normalizedTruncated,
        product_id:              productId,
        usage_count:             1,
        created_at:              now,
        updated_at:              now,
        last_used_at:            now,
        created_by:              opts.createdBy || null,
      }])

    if (insErr) {
      // Race condition — unique_violation means another request just inserted; retry as update
      if (insErr.code === '23505') return upsertAlias(workspaceId, rawName, productId, supabase, opts)
      return { success: false, error: insErr.message }
    }

    invalidateAliasCache(workspaceId)
    return { success: true, isNew: true, usageCount: 1 }
  } catch (err) {
    return { success: false, error: err?.message || 'Unknown error' }
  }
}

// ── Analytics layer ───────────────────────────────────────────────────────────
// Helper functions for future dashboard use. No UI required yet.

/**
 * Count total aliases for a workspace.
 * @param {string} workspaceId
 * @param {object} supabase
 * @returns {Promise<number>}
 */
export async function countAliases(workspaceId, supabase) {
  if (!workspaceId) return 0
  try {
    const { count, error } = await supabase
      .from('invoice_aliases')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
    return error ? 0 : (count ?? 0)
  } catch { return 0 }
}

/**
 * Get top N aliases by usage count (most corrected items).
 * @param {string} workspaceId
 * @param {object} supabase
 * @param {number} [limit=10]
 */
export async function topAliases(workspaceId, supabase, limit = 10) {
  if (!workspaceId) return []
  try {
    const { data, error } = await supabase
      .from('invoice_aliases')
      .select('invoice_name, invoice_name_normalized, product_id, usage_count, last_used_at')
      .eq('workspace_id', workspaceId)
      .order('usage_count', { ascending: false })
      .limit(limit)
    return error ? [] : (data || [])
  } catch { return [] }
}

/** Alias for topAliases — most used corrections. */
export const mostUsedAliases = topAliases

/**
 * Get N most recently used aliases (latest corrections / confirmations).
 * @param {string} workspaceId
 * @param {object} supabase
 * @param {number} [limit=10]
 */
export async function recentAliases(workspaceId, supabase, limit = 10) {
  if (!workspaceId) return []
  try {
    const { data, error } = await supabase
      .from('invoice_aliases')
      .select('invoice_name, invoice_name_normalized, product_id, usage_count, last_used_at')
      .eq('workspace_id', workspaceId)
      .order('last_used_at', { ascending: false })
      .limit(limit)
    return error ? [] : (data || [])
  } catch { return [] }
}

/**
 * Bulk load alias info for display — enriches alias rows with product names if needed.
 * Ready for dashboard integration; product name join must be done client-side.
 * @param {string} workspaceId
 * @param {object} supabase
 * @param {object} [opts]
 * @param {number} [opts.limit=50]
 * @param {'usage'|'recent'} [opts.sortBy='usage']
 */
export async function getAliasAnalytics(workspaceId, supabase, opts = {}) {
  const { limit = 50, sortBy = 'usage' } = opts
  if (!workspaceId) return { total: 0, rows: [] }
  try {
    const countP = countAliases(workspaceId, supabase)
    const rowsP = sortBy === 'recent'
      ? recentAliases(workspaceId, supabase, limit)
      : topAliases(workspaceId, supabase, limit)
    const [total, rows] = await Promise.all([countP, rowsP])
    return { total, rows }
  } catch { return { total: 0, rows: [] } }
}
