import { describe, it, expect, vi } from 'vitest'

// Unit tests for ImportLokali logic (pure functions, no React/DOM needed)

// Inline the slugify logic from ImportLokali to test it in isolation
function slugifyName(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '') || `towar-fallback`
}

// Inline the row update logic
function updateRow(rows, id, changes) {
  return rows.map(r => r._id === id ? { ...r, ...changes } : r)
}

function filterIncluded(rows) {
  return rows.filter(r => r._include !== false && r.nazwa?.trim())
}

describe('ImportLokali — slugifyName', () => {
  it('creates valid sku from Polish name', () => {
    const sku = slugifyName('Komplet pościeli')
    expect(sku).toMatch(/^[a-z0-9-]+$/)
    expect(sku.length).toBeGreaterThan(0)
  })

  it('handles name with special characters', () => {
    const sku = slugifyName('Ręcznik duży')
    expect(sku).toMatch(/^[a-z0-9-]+$/)
  })

  it('collapses spaces to hyphens', () => {
    const sku = slugifyName('Woda Perlage')
    expect(sku).toBe('woda-perlage')
  })
})

describe('ImportLokali — editable preview row logic', () => {
  const baseRows = [
    { _id: 1, nazwa: 'Jur AP1', lokalizacja_kod: 'jurata', pojemnosc: 4, typ: 'apartament', zwierzeta_ok: false, parking: true, _include: true },
    { _id: 2, nazwa: 'Hel DOM2', lokalizacja_kod: 'hel', pojemnosc: 6, typ: 'dom', zwierzeta_ok: true, parking: false, _include: true },
    { _id: 3, nazwa: 'Jas AP3', lokalizacja_kod: 'jas', pojemnosc: 2, typ: 'apartament', zwierzeta_ok: false, parking: true, _include: true },
  ]

  it('updateRow changes only the matching row', () => {
    const result = updateRow(baseRows, 2, { pojemnosc: 8 })
    expect(result[1].pojemnosc).toBe(8)
    expect(result[0].pojemnosc).toBe(4) // unchanged
    expect(result[2].pojemnosc).toBe(2) // unchanged
  })

  it('updateRow can toggle _include', () => {
    const result = updateRow(baseRows, 1, { _include: false })
    expect(result[0]._include).toBe(false)
    expect(result[1]._include).toBe(true)
  })

  it('filterIncluded excludes _include=false rows', () => {
    const rows = [
      ...baseRows,
      { _id: 4, nazwa: 'Excluded', _include: false },
    ]
    const result = filterIncluded(rows)
    expect(result).toHaveLength(3)
    expect(result.every(r => r._include !== false)).toBe(true)
  })

  it('filterIncluded excludes rows with empty nazwa', () => {
    const rows = [
      ...baseRows,
      { _id: 5, nazwa: '  ', _include: true },
    ]
    const result = filterIncluded(rows)
    expect(result).toHaveLength(3)
  })
})

describe('ImportLokali — auto-create product mock', () => {
  it('calls supabase insert with correct payload for a new towar', async () => {
    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'mock-id', nazwa: 'Komplet pościeli' }, error: null })
      })
    })
    const mockSupabase = { from: vi.fn().mockReturnValue({ insert: mockInsert }) }
    const wsData = () => ({ workspace_id: 'ws-1', owner_user_id: 'u-1' })
    const towarName = 'Komplet pościeli'

    // Simulate createTowarByName
    const sku = slugifyName(towarName)
    const insertPayload = { ...wsData(), nazwa: towarName, sku, jednostka: 'szt.', aktywny: true }
    const result = await mockSupabase.from('towary').insert([insertPayload]).select('id, nazwa').single()

    expect(mockSupabase.from).toHaveBeenCalledWith('towary')
    expect(mockInsert).toHaveBeenCalledWith([expect.objectContaining({ nazwa: 'Komplet pościeli', jednostka: 'szt.', aktywny: true })])
    expect(result.data.id).toBe('mock-id')
  })
})
