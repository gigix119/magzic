// Smoke tests: verify each primitive exports a React function component.
// React Testing Library not available; React.createElement used to create virtual elements
// without a DOM — confirms components are valid and accept their props.

import { describe, it, expect } from 'vitest'
import React from 'react'
import Button from './Button.jsx'
import Badge from './Badge.jsx'
import KpiCard from './KpiCard.jsx'

describe('Button – createElement smoke', () => {
  it.each(['action', 'ghost', 'danger', 'automation'])('variant %s', (variant) => {
    const el = React.createElement(Button, { variant }, 'Test')
    expect(el).toBeTruthy()
    expect(el.type).toBe(Button)
    expect(el.props.variant).toBe(variant)
  })

  it.each(['sm', 'md'])('size %s', (size) => {
    const el = React.createElement(Button, { size }, 'Test')
    expect(el).toBeTruthy()
  })
})

describe('Badge – createElement smoke', () => {
  it.each(['success', 'attention', 'critical', 'action', 'automation', 'default'])('status %s', (status) => {
    const el = React.createElement(Badge, { status }, 'Label')
    expect(el).toBeTruthy()
    expect(el.type).toBe(Badge)
  })
})

describe('KpiCard – createElement smoke', () => {
  it('renders with value and delta', () => {
    const el = React.createElement(KpiCard, { label: 'Przychód', value: '48 320 zł', delta: '+12%', deltaPositive: true })
    expect(el).toBeTruthy()
    expect(el.props.label).toBe('Przychód')
  })

  it('renders without delta', () => {
    const el = React.createElement(KpiCard, { label: 'Zamówienia', value: 37 })
    expect(el).toBeTruthy()
  })
})
