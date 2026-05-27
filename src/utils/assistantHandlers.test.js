import { describe, it, expect } from 'vitest'
import { runAssistantIntent } from './assistantHandlers'

describe('runAssistantIntent', () => {
  it('returns error text when workspaceId is null', async () => {
    const result = await runAssistantIntent({
      intentResult: { intent: 'purchase_dashboard', entities: {} },
      workspaceId: null,
    })
    expect(result.intent).toBe('purchase_dashboard')
    expect(typeof result.text).toBe('string')
    expect(result.text).toMatch(/workspace/i)
    expect(result.structuredData).toBeNull()
  })

  it('returns error text when workspaceId is undefined', async () => {
    const result = await runAssistantIntent({
      intentResult: { intent: 'low_stock', entities: {} },
      workspaceId: undefined,
    })
    expect(result.intent).toBe('low_stock')
    expect(result.text).toMatch(/workspace/i)
    expect(result.structuredData).toBeNull()
  })

  it('returns text-only for unknown intent with valid workspaceId', async () => {
    const result = await runAssistantIntent({
      intentResult: { intent: 'unknown', entities: {} },
      workspaceId: 'ws-test-123',
    })
    expect(result.intent).toBe('unknown')
    expect(typeof result.text).toBe('string')
    expect(result.text.length).toBeGreaterThan(0)
    expect(result.structuredData).toBeNull()
  })

  it('preserves intent in result', async () => {
    const result = await runAssistantIntent({
      intentResult: { intent: 'unknown', entities: {} },
      workspaceId: 'ws-test-123',
    })
    expect(result.intent).toBe('unknown')
  })
})
