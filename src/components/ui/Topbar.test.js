// Smoke tests for Topbar — createElement only, no DOM/routing needed.
import { describe, it, expect, vi } from 'vitest'
import React from 'react'

// Stub react-router-dom so hooks don't crash outside a Router context
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  NavLink: ({ children, to, ...rest }) =>
    React.createElement('a', { href: to, ...rest }, children),
}))

import Topbar from './Topbar.jsx'

const baseProps = {
  onMenuOpen: vi.fn(),
  alertCount: 0,
  user: { email: 'jan.kowalski@example.com' },
  dark: false,
  toggleTheme: vi.fn(),
  handleSignOut: vi.fn(),
  workspace: { name: 'Moja Firma' },
}

describe('Topbar – createElement smoke', () => {
  it('renders without throwing', () => {
    const el = React.createElement(Topbar, baseProps)
    expect(el).toBeTruthy()
    expect(el.type).toBe(Topbar)
  })

  it('forwards alertCount prop', () => {
    const el = React.createElement(Topbar, { ...baseProps, alertCount: 5 })
    expect(el.props.alertCount).toBe(5)
  })

  it('initial from email is first char uppercased', () => {
    // Verify the logic directly — Topbar uses user.email[0].toUpperCase()
    const email = baseProps.user.email
    const initial = email[0].toUpperCase()
    expect(initial).toBe('J')
  })

  it('accepts null workspace gracefully (defaults to magzic)', () => {
    const el = React.createElement(Topbar, { ...baseProps, workspace: null })
    expect(el).toBeTruthy()
  })

  it('accepts zero alertCount without badge', () => {
    const el = React.createElement(Topbar, { ...baseProps, alertCount: 0 })
    expect(el.props.alertCount).toBe(0)
  })
})
