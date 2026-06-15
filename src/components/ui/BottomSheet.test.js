// Smoke tests: BottomSheet renders based on open prop; onClose wired to overlay.
// No DOM required — component is hook-free, called as plain function.
import { describe, it, expect, vi } from 'vitest'
import BottomSheet from './BottomSheet.jsx'

describe('BottomSheet — open=false', () => {
  it('returns null when closed', () => {
    const result = BottomSheet({ open: false, onClose: vi.fn(), title: 'Test', children: 'Content' })
    expect(result).toBeNull()
  })
})

describe('BottomSheet — open=true', () => {
  it('returns a React element when open', () => {
    const result = BottomSheet({ open: true, onClose: vi.fn(), title: 'Tytuł', children: 'Treść' })
    expect(result).toBeTruthy()
    expect(typeof result).toBe('object')
  })

  it('overlay onClick is wired to onClose', () => {
    const onClose = vi.fn()
    const result = BottomSheet({ open: true, onClose, title: 'T', children: null })
    expect(result.props.onClick).toBe(onClose)
  })

  it('renders with title prop', () => {
    const result = BottomSheet({ open: true, onClose: vi.fn(), title: 'Mój tytuł', children: null })
    expect(result).toBeTruthy()
    // children of overlay include the sheet div
    const sheet = result.props.children
    expect(sheet).toBeTruthy()
  })

  it('renders without title (no title element)', () => {
    const result = BottomSheet({ open: true, onClose: vi.fn(), title: undefined, children: 'x' })
    expect(result).toBeTruthy()
  })
})
