/**
 * Automatyczne tworzenie przygotowania (zlecenia) na podstawie rezerwacji.
 * Czyste operacje async — wywołuje supabase, ale nie importuje React.
 *
 * @module domain/reservationAutomation
 */

import { buildChecklistRows } from '../utils/defaultChecklist'

/**
 * Gdy rezerwacja jest potwierdzona i nie ma jeszcze przygotowania:
 * 1. Znajdź domyślny pakiet lokalu
 * 2. Zbuduj zlecenie (przygotowanie) z pozycjami z pakietu
 * 3. Wstaw domyślną checklistę
 * 4. Zapisz zlecenie i podlinkuj do rezerwacji
 *
 * @param {Object} rezerwacja - Row z tabeli rezerwacje
 * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient, workspaceId: string }} ctx
 * @returns {Promise<{created: boolean, reason?: string, przygotowanie_id?: string, nazwa?: string, error?: unknown}>}
 */
export async function autoCreatePreparation(rezerwacja, { supabase, workspaceId }) {
  if (rezerwacja.przygotowanie_id) return { created: false, reason: 'already_exists' }
  if (!rezerwacja.lokal_id) return { created: false, reason: 'no_lokal' }

  const { data: lokal } = await supabase
    .from('lokale')
    .select('id, nazwa, domyslny_pakiet_id')
    .eq('id', rezerwacja.lokal_id)
    .single()

  if (!lokal?.domyslny_pakiet_id) return { created: false, reason: 'no_default_package' }

  const { data: elementy } = await supabase
    .from('elementy_pakietu')
    .select('towar_id, ilosc, towary(nazwa, jednostka)')
    .eq('pakiet_id', lokal.domyslny_pakiet_id)

  const nazwa = `${lokal.nazwa} – check-in ${rezerwacja.checkin_at}`

  const { data: zlecenie, error: zlErr } = await supabase
    .from('zlecenia')
    .insert([{
      workspace_id: workspaceId,
      nazwa,
      opis: `Auto: ${rezerwacja.gosc_nazwa || 'gość'}, ${rezerwacja.liczba_gosci ?? 1} os., ${rezerwacja.checkin_at}–${rezerwacja.checkout_at}`,
      data_realizacji: rezerwacja.checkin_at,
      status: 'nowe',
      priorytet: 'normalny',
    }])
    .select('id')
    .single()

  if (zlErr) return { created: false, reason: 'insert_error', error: zlErr }

  if (elementy?.length) {
    const pozycje = elementy.map(e => ({
      zlecenie_id: zlecenie.id,
      nazwa_pozycji: e.towary?.nazwa || '',
      ilosc: e.ilosc,
      jednostka: e.towary?.jednostka || 'szt.',
      notatka: 'Z pakietu (auto)',
      wydano: false,
    }))
    await supabase.from('zlecenia_pozycje').insert(pozycje)
  }

  // Wstaw domyślną checklistę (ignoruj błąd jeśli tabela nie istnieje — migracja nie uruchomiona)
  try {
    await supabase.from('checklist_items').insert(buildChecklistRows(zlecenie.id, workspaceId))
  } catch {
    // Migracja checklist_zdjecia_migration.sql nie została jeszcze uruchomiona
  }

  await supabase
    .from('rezerwacje')
    .update({ przygotowanie_id: zlecenie.id })
    .eq('id', rezerwacja.id)

  return { created: true, przygotowanie_id: zlecenie.id, nazwa }
}
