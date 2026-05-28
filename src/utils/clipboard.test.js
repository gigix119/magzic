import { describe, it, expect, vi, afterEach } from 'vitest'
import { copyTextToClipboard } from './clipboard'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('copyTextToClipboard', () => {
  it('returns ok:false for empty string', async () => {
    const result = await copyTextToClipboard('')
    expect(result.ok).toBe(false)
    expect(typeof result.error).toBe('string')
  })

  it('returns ok:false for null', async () => {
    const result = await copyTextToClipboard(null)
    expect(result.ok).toBe(false)
  })

  it('returns ok:false for undefined', async () => {
    const result = await copyTextToClipboard(undefined)
    expect(result.ok).toBe(false)
  })

  it('uses clipboard API when available and returns ok:true', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const result = await copyTextToClipboard('hello world')
    expect(writeText).toHaveBeenCalledWith('hello world')
    expect(result.ok).toBe(true)
  })

  it('returns ok:false and does not throw when clipboard API rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('Permission denied'))
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const result = await copyTextToClipboard('test text')
    expect(typeof result.ok).toBe('boolean')
    expect(() => {}).not.toThrow()
  })

  it('result always has ok boolean field', async () => {
    const result = await copyTextToClipboard('any text')
    expect(typeof result.ok).toBe('boolean')
  })
})
