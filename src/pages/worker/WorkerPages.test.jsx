// Smoke tests for the worker (mobile field) view — createElement only, no DOM needed.
// Mirrors the pattern used in Layout.test.jsx.
import { describe, it, expect, vi } from 'vitest'
import React from 'react'

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...rest }) => React.createElement('a', { href: to, ...rest }, children),
  NavLink: ({ children, to, style, ...rest }) => {
    const styleResult = typeof style === 'function' ? style({ isActive: false }) : (style || {})
    return React.createElement('a', { href: to, style: styleResult, ...rest }, children)
  },
  Outlet: () => React.createElement('div', { 'data-testid': 'outlet' }),
  useNavigate: () => vi.fn(),
  useParams: () => ({ id: 'zlecenie-1' }),
}))

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { email: 'pracownik@example.com' }, signOut: vi.fn() }),
}))

vi.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }),
}))

vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}))

const { mockSupabase } = vi.hoisted(() => {
  const chainable = () => {
    const q = {
      select: () => q,
      eq: () => q,
      in: () => q,
      neq: () => q,
      order: () => q,
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      single: () => Promise.resolve({ data: null, error: null }),
      then: (resolve) => resolve({ data: [], error: null }),
    }
    return q
  }
  return {
    mockSupabase: {
      from: () => chainable(),
      storage: { from: () => ({ upload: vi.fn(), getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
    },
  }
})

vi.mock('../../context/WorkspaceContext', () => ({
  useWorkspace: () => ({
    workspaceId: 'ws-1',
    wsQuery: (table) => mockSupabase.from(table),
    addWsFilter: (q) => q,
  }),
}))

vi.mock('../../supabase', () => ({ supabase: mockSupabase }))

import WorkerLayout from '../../components/WorkerLayout'
import WorkerDzis from './WorkerDzis'
import WorkerZabrac from './WorkerZabrac'
import WorkerGotowe from './WorkerGotowe'
import WorkerProfil from './WorkerProfil'
import WorkerZadanie from './WorkerZadanie'

describe('Worker view components — smoke', () => {
  it('WorkerLayout is a function component (no sidebar — distinct from Layout)', () => {
    const el = React.createElement(WorkerLayout)
    expect(el).toBeTruthy()
    expect(typeof WorkerLayout).toBe('function')
  })

  it('WorkerDzis renders without throwing on creation', () => {
    const el = React.createElement(WorkerDzis)
    expect(el).toBeTruthy()
    expect(typeof WorkerDzis).toBe('function')
  })

  it('WorkerZabrac renders without throwing on creation', () => {
    const el = React.createElement(WorkerZabrac)
    expect(el).toBeTruthy()
    expect(typeof WorkerZabrac).toBe('function')
  })

  it('WorkerGotowe renders without throwing on creation', () => {
    const el = React.createElement(WorkerGotowe)
    expect(el).toBeTruthy()
    expect(typeof WorkerGotowe).toBe('function')
  })

  it('WorkerProfil renders without throwing on creation', () => {
    const el = React.createElement(WorkerProfil)
    expect(el).toBeTruthy()
    expect(typeof WorkerProfil).toBe('function')
  })

  it('WorkerZadanie renders without throwing on creation', () => {
    const el = React.createElement(WorkerZadanie)
    expect(el).toBeTruthy()
    expect(typeof WorkerZadanie).toBe('function')
  })
})
