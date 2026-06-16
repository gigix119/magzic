import { describe, it, expect, vi } from 'vitest'
import { autoCreatePreparation } from './reservationAutomation'

function makeSupabase({ lokal = null, elementy = [], zlecenieId = 'zl-1', insertError = null } = {}) {
  const updateFn = vi.fn().mockReturnValue({ error: null })
  const insertPozFn = vi.fn().mockReturnValue({ error: null })

  return {
    from: vi.fn((table) => {
      if (table === 'lokale') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: lokal }),
            }),
          }),
        }
      }
      if (table === 'elementy_pakietu') {
        return {
          select: () => ({
            eq: async () => ({ data: elementy }),
          }),
        }
      }
      if (table === 'zlecenia') {
        return {
          insert: () => ({
            select: () => ({
              single: async () => ({
                data: insertError ? null : { id: zlecenieId },
                error: insertError || null,
              }),
            }),
          }),
        }
      }
      if (table === 'zlecenia_pozycje') {
        return { insert: insertPozFn }
      }
      if (table === 'rezerwacje') {
        return { update: () => ({ eq: updateFn }) }
      }
    }),
    _updateFn: updateFn,
    _insertPozFn: insertPozFn,
  }
}

const baseRez = {
  id: 'rez-1',
  lokal_id: 'lok-1',
  gosc_nazwa: 'Jan Kowalski',
  liczba_gosci: 2,
  checkin_at: '2026-07-01',
  checkout_at: '2026-07-05',
  przygotowanie_id: null,
}

describe('autoCreatePreparation', () => {
  it('tworzy zlecenie i linkuje do rezerwacji', async () => {
    const supabase = makeSupabase({
      lokal: { id: 'lok-1', nazwa: 'Apartament 3B', domyslny_pakiet_id: 'pak-1' },
      elementy: [
        { towar_id: 't-1', ilosc: 2, towary: { nazwa: 'Ręcznik', jednostka: 'szt.' } },
      ],
      zlecenieId: 'zl-99',
    })

    const result = await autoCreatePreparation(baseRez, { supabase, workspaceId: 'ws-1' })

    expect(result.created).toBe(true)
    expect(result.przygotowanie_id).toBe('zl-99')
    expect(result.nazwa).toContain('Apartament 3B')
  })

  it('zwraca already_exists gdy przygotowanie_id jest ustawione', async () => {
    const supabase = makeSupabase()
    const result = await autoCreatePreparation(
      { ...baseRez, przygotowanie_id: 'existing' },
      { supabase, workspaceId: 'ws-1' }
    )
    expect(result.created).toBe(false)
    expect(result.reason).toBe('already_exists')
  })

  it('zwraca no_lokal gdy brak lokal_id', async () => {
    const supabase = makeSupabase()
    const result = await autoCreatePreparation(
      { ...baseRez, lokal_id: null },
      { supabase, workspaceId: 'ws-1' }
    )
    expect(result.created).toBe(false)
    expect(result.reason).toBe('no_lokal')
  })

  it('zwraca no_default_package gdy lokal bez pakietu', async () => {
    const supabase = makeSupabase({
      lokal: { id: 'lok-1', nazwa: 'Apt 1', domyslny_pakiet_id: null },
    })
    const result = await autoCreatePreparation(baseRez, { supabase, workspaceId: 'ws-1' })
    expect(result.created).toBe(false)
    expect(result.reason).toBe('no_default_package')
  })

  it('zwraca insert_error gdy supabase zwróci błąd', async () => {
    const supabase = makeSupabase({
      lokal: { id: 'lok-1', nazwa: 'Apt 1', domyslny_pakiet_id: 'pak-1' },
      elementy: [],
      insertError: new Error('DB error'),
    })
    const result = await autoCreatePreparation(baseRez, { supabase, workspaceId: 'ws-1' })
    expect(result.created).toBe(false)
    expect(result.reason).toBe('insert_error')
  })
})
