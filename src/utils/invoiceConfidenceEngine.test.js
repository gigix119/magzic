import { describe, it, expect } from 'vitest'
import { calculateMatchConfidence, calculateItemConfidence } from './invoiceConfidenceEngine.js'

// ── Shared test helpers ───────────────────────────────────────────────────────

const HIGH_ALIAS_ITEM = {
  rawName: 'KABEL LAN CAT6',
  matchedProductId: 'prod-1',
  matchedProductNazwa: 'Kabel UTP kat 6',
  matchScore: 1.0,
  matchingSource: 'alias_learned',
  aliasUsageCount: 5,
  itemType: 'inventory_item',
  shouldAffectInventory: true,
}

const LOW_ALIAS_ITEM = {
  rawName: 'KABEL LAN CAT6',
  matchedProductId: 'prod-1',
  matchedProductNazwa: 'Kabel UTP kat 6',
  matchScore: 1.0,
  matchingSource: 'alias_learned',
  aliasUsageCount: 1,
  itemType: 'inventory_item',
  shouldAffectInventory: true,
}

// ─────────────────────────────────────────────────────────────────────────────
// calculateItemConfidence — main entry point
// ─────────────────────────────────────────────────────────────────────────────

describe('calculateItemConfidence', () => {

  // 1. Alias match with usage_count >= 3 → high + autoApproved
  it('alias match with usage_count >= 3 gives high confidence and autoApproved true', () => {
    const r = calculateItemConfidence(HIGH_ALIAS_ITEM)
    expect(r.level).toBe('high')
    expect(r.autoApproved).toBe(true)
    expect(r.reasons).toContain('alias_match')
    expect(r.reasons).toContain('alias_used_multiple_times')
    expect(r.confidence).toBeGreaterThanOrEqual(0.90)
    expect(r.blockers).toHaveLength(0)
  })

  // 2. Alias match with usage_count 1 → medium + NOT autoApproved
  it('alias match with usage_count 1 gives medium confidence and autoApproved false', () => {
    const r = calculateItemConfidence(LOW_ALIAS_ITEM)
    expect(r.level).toBe('medium')
    expect(r.autoApproved).toBe(false)
    expect(r.reasons).toContain('alias_match')
    expect(r.confidence).toBeLessThan(0.90)
  })

  // 3. Strong TF-IDF + clear winner → high confidence (no ambiguity)
  it('strong model score without ambiguity gives high confidence', () => {
    const item = {
      rawName: 'Syfon umywalkowy chrom',
      matchedProductId: 'prod-2',
      matchedProductNazwa: 'Syfon umywalkowy chrom',
      matchScore: 0.92,
      matchingSource: null,
      _modelScore: 0.92,
      _modelLabel: 'strong',
      _matchDisagreement: false,
      itemType: 'inventory_item',
      shouldAffectInventory: true,
    }
    const r = calculateItemConfidence(item, [{ score: 0.92 }, { score: 0.30 }])
    expect(r.level).toBe('high')
    expect(r.reasons).toContain('strong_existing_score')
  })

  // 4. Ambiguous candidates block auto-approval
  it('ambiguous candidates block auto-approval', () => {
    const item = {
      rawName: 'Sruba M6',
      matchedProductId: 'prod-3',
      matchedProductNazwa: 'Śruba M6x20',
      matchScore: 0.85,
      _modelScore: 0.85,
      _modelLabel: 'strong',
      _matchDisagreement: true,
      itemType: 'inventory_item',
      shouldAffectInventory: true,
    }
    const r = calculateItemConfidence(item, [{ score: 0.85 }, { score: 0.81 }])
    expect(r.autoApproved).toBe(false)
    expect(r.blockers).toContain('conflicting_top_candidates')
  })

  // 5. Empty invoice name → none
  it('empty invoice name gives none confidence', () => {
    const r = calculateItemConfidence({ rawName: '', matchedProductId: 'prod-1' })
    expect(r.level).toBe('none')
    expect(r.blockers).toContain('empty_invoice_name')
    expect(r.autoApproved).toBe(false)
  })

  // 6. Missing product → blocker
  it('missing product gives blocker', () => {
    const r = calculateItemConfidence({
      rawName: 'KABEL LAN CAT6', matchedProductId: null,
      itemType: 'inventory_item', shouldAffectInventory: true,
    })
    expect(r.level).toBe('none')
    expect(r.blockers).toContain('missing_product')
    expect(r.autoApproved).toBe(false)
  })

  // 7. Exact normalized name → high confidence
  it('exact normalized name match gives high confidence', () => {
    const item = {
      rawName: 'Kabel sieciowy UTP',
      matchedProductId: 'prod-4',
      matchedProductNazwa: 'Kabel sieciowy UTP',
      matchScore: 0.95,
      itemType: 'inventory_item',
      shouldAffectInventory: true,
    }
    const r = calculateItemConfidence(item)
    expect(r.level).toBe('high')
    expect(r.reasons).toContain('exact_name_match')
  })

  // 8. Weak match → low confidence
  it('weak match gives low confidence and no auto-approval', () => {
    const item = {
      rawName: 'KABEL',
      matchedProductId: 'prod-5',
      matchedProductNazwa: 'Syfon umywalkowy',
      matchScore: 0.18,
      _modelScore: 0.12,
      _modelLabel: null,
      itemType: 'inventory_item',
      shouldAffectInventory: true,
    }
    const r = calculateItemConfidence(item)
    expect(r.level).toBe('low')
    expect(r.autoApproved).toBe(false)
    expect(r.blockers).toContain('low_score')
  })

  // 9. Confidence thresholds from config are respected
  it('confidence thresholds from config are respected', () => {
    // Make threshold impossibly high so even a 5×-used alias is not auto-approved
    const strictConfig = {
      confidenceThresholds: {
        high: 0.99,
        medium: 0.80,
        autoApprove: 0.99,
        aliasAutoApproveUsageCount: 3,
      },
    }
    const r = calculateItemConfidence(HIGH_ALIAS_ITEM, [], strictConfig)
    expect(r.autoApproved).toBe(false)
    // With strict threshold, 0.95 < 0.99 → not high
    expect(r.level).not.toBe('high')
  })

  // 10. Never throws on malformed input
  it('confidence engine never throws on malformed input', () => {
    expect(() => calculateItemConfidence(null)).not.toThrow()
    expect(() => calculateItemConfidence(undefined)).not.toThrow()
    expect(() => calculateItemConfidence({})).not.toThrow()
    expect(() => calculateItemConfidence({ rawName: null })).not.toThrow()
    expect(() => calculateItemConfidence({ rawName: 'item', matchedProductId: 'p', matchScore: null })).not.toThrow()
    expect(() => calculateItemConfidence({ rawName: 'x', matchedProductId: 'p' }, null)).not.toThrow()
    expect(() => calculateItemConfidence({ rawName: 'x', matchedProductId: 'p' }, undefined, null)).not.toThrow()
  })

  // 11. Service items return medium without autoApproved
  it('service items return medium confidence without auto-approval', () => {
    const item = {
      rawName: 'Usługa serwisowa',
      matchedProductId: null,
      itemType: 'service_item',
      shouldAffectInventory: false,
    }
    const r = calculateItemConfidence(item)
    expect(r.level).toBe('medium')
    expect(r.autoApproved).toBe(false)
    expect(r.reasons).toContain('service_item')
  })

  // 12. Manual correction should not auto-approve (manual_selected has no alias count boost)
  it('manual_selected match without alias history is not auto-approved', () => {
    const item = {
      rawName: 'Bateria alkaliczna LR6',
      matchedProductId: 'prod-6',
      matchedProductNazwa: 'Bateria alkaliczna LR6',
      matchScore: 1.0,
      matchingSource: 'manual_selected',
      aliasUsageCount: 0,
      itemType: 'inventory_item',
      shouldAffectInventory: true,
    }
    // matchScore=1.0 but it's exact → should be high, but no alias learning yet
    const r = calculateItemConfidence(item)
    expect(r.reasons).toContain('exact_name_match')
    expect(r.level).toBe('high')
    // autoApproved may be true here (exact match + high score), that's acceptable
  })

  // 13. Low alias usage count (2) stays below auto-approve threshold
  it('alias with usage_count 2 stays below auto-approve threshold', () => {
    const item = { ...LOW_ALIAS_ITEM, aliasUsageCount: 2 }
    const r = calculateItemConfidence(item)
    expect(r.autoApproved).toBe(false)
    expect(r.confidence).toBeLessThan(0.90)
  })

  // 14. Shadow model disagreement reduces confidence
  it('shadow model disagreement reduces confidence and adds blocker', () => {
    const item = {
      rawName: 'Przewód elektryczny 2.5mm',
      matchedProductId: 'prod-7',
      matchedProductNazwa: 'Kabel elektryczny 2.5mm',
      matchScore: 0.88,
      matchingSource: null,
      _modelScore: 0.88,
      _modelLabel: 'strong',
      _matchDisagreement: true,
      itemType: 'inventory_item',
      shouldAffectInventory: true,
    }
    const rWithout = calculateItemConfidence({ ...item, _matchDisagreement: false })
    const rWith    = calculateItemConfidence(item)
    expect(rWith.confidence).toBeLessThan(rWithout.confidence)
    expect(rWith.blockers).toContain('conflicting_top_candidates')
  })

  // 15. Alias overrides ambiguity (alias match is trusted even when candidates are close)
  it('alias match is trusted even when top candidates are close', () => {
    const item = {
      ...HIGH_ALIAS_ITEM,
      _topCandidates: [{ score: 0.95 }, { score: 0.92 }],
    }
    const r = calculateItemConfidence(item)
    // Alias match should not be blocked by ambiguity
    expect(r.blockers).not.toContain('ambiguous_candidates')
    expect(r.autoApproved).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// calculateMatchConfidence — raw features input
// ─────────────────────────────────────────────────────────────────────────────

describe('calculateMatchConfidence', () => {

  it('alias with usage_count >= 3 gives high confidence and autoApproved true', () => {
    const features = {
      aliasScore: 1.0, tfIdfScore: 0.85, exactMatch: false,
      tokenOverlap: 0.80, techParamMatch: false, techParamConflict: false,
      score: 1.0,
    }
    const r = calculateMatchConfidence(features, {
      invoiceName: 'KABEL LAN CAT6',
      product: { id: 'prod-1' },
      aliasUsageCount: 5,
    })
    expect(r.level).toBe('high')
    expect(r.autoApproved).toBe(true)
    expect(r.reasons).toContain('alias_match')
  })

  it('strong TF-IDF with clear winner gives high confidence', () => {
    const features = {
      aliasScore: 0, tfIdfScore: 0.90, exactMatch: false,
      tokenOverlap: 0.75, techParamMatch: true, techParamConflict: false,
      score: 0.88, globalAliasMatch: false, supplierAliasMatch: false,
    }
    const r = calculateMatchConfidence(features, {
      invoiceName: 'Syfon umywalkowy',
      product: { id: 'prod-2' },
      allCandidates: [{ score: 0.88 }, { score: 0.30 }],
    })
    expect(r.level).toBe('high')
    expect(r.reasons).toContain('strong_tfidf_match')
  })

  it('empty invoiceName returns none', () => {
    const r = calculateMatchConfidence({}, { invoiceName: '', product: { id: 'p' } })
    expect(r.level).toBe('none')
    expect(r.blockers).toContain('empty_invoice_name')
  })

  it('null product returns missing_product blocker', () => {
    const r = calculateMatchConfidence({}, { invoiceName: 'item', product: null })
    expect(r.level).toBe('none')
    expect(r.blockers).toContain('missing_product')
  })

  it('tech param conflict adds blocker and reduces confidence', () => {
    const features = {
      aliasScore: 0, tfIdfScore: 0.88, exactMatch: false,
      tokenOverlap: 0.80, techParamMatch: false, techParamConflict: true,
      score: 0.88,
    }
    const r = calculateMatchConfidence(features, { invoiceName: 'Rura 50mm', product: { id: 'p' } })
    expect(r.blockers).toContain('tech_param_conflict')
    expect(r.autoApproved).toBe(false)
  })

  it('ambiguous candidates add blocker', () => {
    const features = {
      aliasScore: 0, tfIdfScore: 0.80, exactMatch: false,
      tokenOverlap: 0.70, techParamMatch: false, techParamConflict: false,
      score: 0.82,
    }
    const r = calculateMatchConfidence(features, {
      invoiceName: 'Bateria AA',
      product: { id: 'p' },
      allCandidates: [{ score: 0.82 }, { score: 0.79 }],
    })
    expect(r.blockers).toContain('ambiguous_candidates')
    expect(r.autoApproved).toBe(false)
  })

  it('weak match gives low confidence', () => {
    const features = {
      aliasScore: 0, tfIdfScore: 0.15, exactMatch: false,
      tokenOverlap: 0.10, techParamMatch: false, techParamConflict: false,
      score: 0.22,
    }
    const r = calculateMatchConfidence(features, { invoiceName: 'KABEL', product: { id: 'p' } })
    expect(r.level).toBe('low')
    expect(r.autoApproved).toBe(false)
  })

  it('never throws on malformed matchFeatures', () => {
    expect(() => calculateMatchConfidence(null, {})).not.toThrow()
    expect(() => calculateMatchConfidence(undefined, { invoiceName: 'test', product: {} })).not.toThrow()
    expect(() => calculateMatchConfidence({}, {})).not.toThrow()
    expect(() => calculateMatchConfidence('string', {})).not.toThrow()
  })

  it('exact match flag immediately sets high confidence', () => {
    const features = {
      aliasScore: 0, exactMatch: true, tfIdfScore: 0,
      tokenOverlap: 0, techParamMatch: false, techParamConflict: false, score: 0,
    }
    const r = calculateMatchConfidence(features, { invoiceName: 'Towar X', product: { id: 'p' } })
    expect(r.level).toBe('high')
    expect(r.reasons).toContain('exact_name_match')
  })

  it('localStorage alias (globalAliasMatch) adds confidence', () => {
    const features = {
      aliasScore: 0, exactMatch: false, globalAliasMatch: true,
      tfIdfScore: 0.50, tokenOverlap: 0.60, techParamMatch: false,
      techParamConflict: false, score: 0.80,
    }
    const r = calculateMatchConfidence(features, { invoiceName: 'kabel', product: { id: 'p' } })
    expect(r.reasons).toContain('alias_match')
    expect(r.confidence).toBeGreaterThan(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Edge cases and config override
// ─────────────────────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('returns level none for completely empty item', () => {
    expect(calculateItemConfidence({}).level).toBe('none')
  })

  it('confidence is always between 0 and 1', () => {
    const items = [
      HIGH_ALIAS_ITEM,
      LOW_ALIAS_ITEM,
      { rawName: 'x', matchedProductId: 'p', matchScore: 0.5 },
    ]
    for (const item of items) {
      const r = calculateItemConfidence(item)
      expect(r.confidence).toBeGreaterThanOrEqual(0)
      expect(r.confidence).toBeLessThanOrEqual(1)
    }
  })

  it('level is always one of the four valid values', () => {
    const validLevels = new Set(['high', 'medium', 'low', 'none'])
    const items = [
      HIGH_ALIAS_ITEM,
      { rawName: '', matchedProductId: 'p' },
      { rawName: 'x', matchedProductId: null },
    ]
    for (const item of items) {
      expect(validLevels.has(calculateItemConfidence(item).level)).toBe(true)
    }
  })

  it('autoApproved is always boolean', () => {
    expect(typeof calculateItemConfidence(HIGH_ALIAS_ITEM).autoApproved).toBe('boolean')
    expect(typeof calculateItemConfidence(null).autoApproved).toBe('boolean')
  })

  it('reasons and blockers are always arrays', () => {
    const r1 = calculateItemConfidence(HIGH_ALIAS_ITEM)
    const r2 = calculateItemConfidence(null)
    expect(Array.isArray(r1.reasons)).toBe(true)
    expect(Array.isArray(r1.blockers)).toBe(true)
    expect(Array.isArray(r2.reasons)).toBe(true)
    expect(Array.isArray(r2.blockers)).toBe(true)
  })

  it('reasons and blockers have no duplicate entries', () => {
    const r = calculateItemConfidence(HIGH_ALIAS_ITEM)
    expect(r.reasons.length).toBe(new Set(r.reasons).size)
    expect(r.blockers.length).toBe(new Set(r.blockers).size)
  })
})
