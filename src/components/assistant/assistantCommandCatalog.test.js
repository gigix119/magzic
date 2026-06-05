import { describe, it, expect } from 'vitest'
import { ASSISTANT_COMMANDS } from './assistantCommandCatalog'

const ALL_INTENTS = [
  'purchase_dashboard',
  'latest_price_changes',
  'compare_invoices',
  'low_stock',
  'order_recommendation',
  'invoices_needing_review',
  'product_price_history',
  'compare_suppliers',
]

describe('assistantCommandCatalog', () => {
  it('contains exactly 10 commands', () => {
    expect(ASSISTANT_COMMANDS).toHaveLength(10)
  })

  it('every command has an intent', () => {
    for (const cmd of ASSISTANT_COMMANDS) {
      expect(typeof cmd.intent).toBe('string')
      expect(cmd.intent.length).toBeGreaterThan(0)
    }
  })

  it('every command has a title', () => {
    for (const cmd of ASSISTANT_COMMANDS) {
      expect(typeof cmd.title).toBe('string')
      expect(cmd.title.length).toBeGreaterThan(0)
    }
  })

  it('every command has a description', () => {
    for (const cmd of ASSISTANT_COMMANDS) {
      expect(typeof cmd.description).toBe('string')
      expect(cmd.description.length).toBeGreaterThan(0)
    }
  })

  it('every command has at least 2 examples', () => {
    for (const cmd of ASSISTANT_COMMANDS) {
      expect(Array.isArray(cmd.examples)).toBe(true)
      expect(cmd.examples.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('every command has a badge', () => {
    for (const cmd of ASSISTANT_COMMANDS) {
      expect(typeof cmd.badge).toBe('string')
      expect(cmd.badge.length).toBeGreaterThan(0)
    }
  })

  it('every command has a boolean requiresProductQuery', () => {
    for (const cmd of ASSISTANT_COMMANDS) {
      expect(typeof cmd.requiresProductQuery).toBe('boolean')
    }
  })

  it('all 8 intents are represented', () => {
    const catalogIntents = ASSISTANT_COMMANDS.map(c => c.intent)
    for (const intent of ALL_INTENTS) {
      expect(catalogIntents).toContain(intent)
    }
  })

  it('no duplicate intents', () => {
    const intents = ASSISTANT_COMMANDS.map(c => c.intent)
    const unique = new Set(intents)
    expect(unique.size).toBe(ASSISTANT_COMMANDS.length)
  })

  it('product_price_history has requiresProductQuery: true', () => {
    const cmd = ASSISTANT_COMMANDS.find(c => c.intent === 'product_price_history')
    expect(cmd).toBeDefined()
    expect(cmd.requiresProductQuery).toBe(true)
  })

  it('compare_suppliers has requiresProductQuery: false', () => {
    const cmd = ASSISTANT_COMMANDS.find(c => c.intent === 'compare_suppliers')
    expect(cmd).toBeDefined()
    expect(cmd.requiresProductQuery).toBe(false)
  })

  it('compare_suppliers examples include a general query', () => {
    const cmd = ASSISTANT_COMMANDS.find(c => c.intent === 'compare_suppliers')
    const hasGeneral = cmd.examples.some(ex =>
      /porównaj\s+dostawców/i.test(ex) || /najtańszy/i.test(ex) || /najtaniej/i.test(ex)
    )
    expect(hasGeneral).toBe(true)
  })

  it('all example texts are non-empty strings', () => {
    for (const cmd of ASSISTANT_COMMANDS) {
      for (const ex of cmd.examples) {
        expect(typeof ex).toBe('string')
        expect(ex.length).toBeGreaterThan(0)
      }
    }
  })
})
