import { supabase } from '../supabase'
import { refreshInventory } from './events'

// ── Stan helpers ───────────────────────────────────────────────

async function getStan(towarId, magazynId) {
  const { data } = await supabase
    .from('stany_magazynowe')
    .select('id, ilosc')
    .eq('towar_id', towarId)
    .eq('magazyn_id', magazynId)
    .maybeSingle()
  return data
}

async function insertRuch(fields) {
  const { error } = await supabase.from('ruchy_magazynowe').insert([fields])
  if (error) console.error('ruchy_magazynowe insert:', error)
}

// ── Eksportowane funkcje ───────────────────────────────────────

export async function dodajStan(towarId, magazynId, ilosc, powod = null, fakturaId = null) {
  if (Number(ilosc) <= 0) return { success: false, error: 'Ilość musi być większa od 0' }

  const current = await getStan(towarId, magazynId)
  if (current) {
    const { error } = await supabase
      .from('stany_magazynowe')
      .update({ ilosc: Number(current.ilosc) + Number(ilosc) })
      .eq('id', current.id)
    if (error) return { success: false, error: error.message }
  } else {
    const { error } = await supabase
      .from('stany_magazynowe')
      .insert([{ towar_id: towarId, magazyn_id: magazynId, ilosc: Number(ilosc) }])
    if (error) return { success: false, error: error.message }
  }

  await insertRuch({
    towar_id: towarId,
    magazyn_docelowy_id: magazynId,
    ilosc: Number(ilosc),
    typ: 'purchase',
    powod,
    faktura_id: fakturaId || null,
  })

  return { success: true }
}

export async function wydajStan(towarId, magazynId, ilosc, powod = null) {
  if (Number(ilosc) <= 0) return { success: false, error: 'Ilość musi być większa od 0' }

  const current = await getStan(towarId, magazynId)
  if (!current || Number(current.ilosc) < Number(ilosc)) {
    return { success: false, error: `Niewystarczający stan. Dostępne: ${current?.ilosc ?? 0}` }
  }

  const { error } = await supabase
    .from('stany_magazynowe')
    .update({ ilosc: Number(current.ilosc) - Number(ilosc) })
    .eq('id', current.id)
  if (error) return { success: false, error: error.message }

  await insertRuch({
    towar_id: towarId,
    magazyn_zrodlowy_id: magazynId,
    ilosc: Number(ilosc),
    typ: 'issue',
    powod,
  })

  return { success: true }
}

export async function transferujStan(towarId, zMagazynuId, doMagazynuId, ilosc, powod = null) {
  if (Number(ilosc) <= 0) return { success: false, error: 'Ilość musi być większa od 0' }
  if (zMagazynuId === doMagazynuId) return { success: false, error: 'Magazyny muszą być różne' }

  const zrodlo = await getStan(towarId, zMagazynuId)
  if (!zrodlo || Number(zrodlo.ilosc) < Number(ilosc)) {
    return { success: false, error: `Niewystarczający stan w magazynie źródłowym. Dostępne: ${zrodlo?.ilosc ?? 0}` }
  }

  const { error: e1 } = await supabase
    .from('stany_magazynowe')
    .update({ ilosc: Number(zrodlo.ilosc) - Number(ilosc) })
    .eq('id', zrodlo.id)
  if (e1) return { success: false, error: e1.message }

  const cel = await getStan(towarId, doMagazynuId)
  if (cel) {
    const { error: e2 } = await supabase
      .from('stany_magazynowe')
      .update({ ilosc: Number(cel.ilosc) + Number(ilosc) })
      .eq('id', cel.id)
    if (e2) return { success: false, error: e2.message }
  } else {
    const { error: e2 } = await supabase
      .from('stany_magazynowe')
      .insert([{ towar_id: towarId, magazyn_id: doMagazynuId, ilosc: Number(ilosc) }])
    if (e2) return { success: false, error: e2.message }
  }

  await insertRuch({
    towar_id: towarId,
    magazyn_zrodlowy_id: zMagazynuId,
    magazyn_docelowy_id: doMagazynuId,
    ilosc: Number(ilosc),
    typ: 'transfer',
    powod,
  })

  return { success: true }
}

export async function korektaStan(towarId, magazynId, nowaIlosc, powod) {
  if (Number(nowaIlosc) < 0) return { success: false, error: 'Ilość nie może być ujemna' }
  if (!powod?.trim()) return { success: false, error: 'Powód korekty jest wymagany' }

  const current = await getStan(towarId, magazynId)
  const stary = Number(current?.ilosc ?? 0)
  const roznica = Number(nowaIlosc) - stary
  const typ = roznica >= 0 ? 'correction_plus' : 'correction_minus'

  if (current) {
    const { error } = await supabase
      .from('stany_magazynowe')
      .update({ ilosc: Number(nowaIlosc) })
      .eq('id', current.id)
    if (error) return { success: false, error: error.message }
  } else {
    const { error } = await supabase
      .from('stany_magazynowe')
      .insert([{ towar_id: towarId, magazyn_id: magazynId, ilosc: Number(nowaIlosc) }])
    if (error) return { success: false, error: error.message }
  }

  await insertRuch({
    towar_id: towarId,
    magazyn_docelowy_id: magazynId,
    ilosc: Math.abs(roznica),
    typ,
    powod,
  })

  return { success: true }
}

export async function getStanLaczny(towarId) {
  const { data } = await supabase
    .from('stany_magazynowe')
    .select('ilosc')
    .eq('towar_id', towarId)
  return (data || []).reduce((s, r) => s + Number(r.ilosc), 0)
}

export async function getStanyMagazynu(magazynId) {
  const { data, error } = await supabase
    .from('stany_magazynowe')
    .select('*, towary(id, nazwa, jednostka, stan_minimalny)')
    .eq('magazyn_id', magazynId)
    .gt('ilosc', 0)
    .order('ilosc', { ascending: false })
  if (error) { console.error(error); return [] }
  return data || []
}

export async function getRuchyTowaru(towarId, limit = 20) {
  const { data, error } = await supabase
    .from('ruchy_magazynowe')
    .select('*, mz:magazyn_zrodlowy_id(nazwa), md:magazyn_docelowy_id(nazwa)')
    .eq('towar_id', towarId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) { console.error(error); return [] }
  return data || []
}

export async function zatwierdźFakturę(fakturaId) {
  // 1. Pobierz fakturę z pełnymi danymi
  const { data: faktura, error: fakturaError } = await supabase
    .from('faktury')
    .select(`*, pozycje_faktury(id, towar_id, magazyn_id, ilosc, cena_netto, vat_procent, towary(nazwa, jednostka))`)
    .eq('id', fakturaId)
    .single()

  if (fakturaError || !faktura) {
    return { success: false, error: fakturaError?.message || 'Nie znaleziono faktury' }
  }

  // 2. Walidacja
  const pozycje = faktura.pozycje_faktury || []
  if (pozycje.length === 0) {
    return { success: false, error: 'Faktura nie ma pozycji' }
  }
  if (faktura.status === 'zatwierdzona') {
    return { success: false, error: 'Faktura już zatwierdzona' }
  }

  // Tylko pozycje towarowe (mają towar_id i magazyn)
  const pozycjeTowary = pozycje.filter(p =>
    p.towar_id && (p.magazyn_id || faktura.magazyn_id)
  )
  const pozycjePoziome = pozycje.filter(p => !p.towar_id || (!p.magazyn_id && !faktura.magazyn_id))

  // 3. Dla każdej pozycji towarowej — upsert stanu magazynowego
  const errors = []
  const zaktualizowane = []

  for (const poz of pozycjeTowary) {
    const magazynId = poz.magazyn_id || faktura.magazyn_id

    const { data: aktualny } = await supabase
      .from('stany_magazynowe')
      .select('id, ilosc')
      .eq('towar_id', poz.towar_id)
      .eq('magazyn_id', magazynId)
      .maybeSingle()

    const nowaIlosc = (aktualny?.ilosc || 0) + Number(poz.ilosc)

    const { error: upsertError } = await supabase
      .from('stany_magazynowe')
      .upsert(
        {
          towar_id: poz.towar_id,
          magazyn_id: magazynId,
          ilosc: nowaIlosc,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'towar_id,magazyn_id' }
      )

    if (upsertError) {
      errors.push(`${poz.towary?.nazwa || poz.towar_id}: ${upsertError.message}`)
      continue
    }

    // Zapisz ruch magazynowy (niekrytyczny)
    await supabase.from('ruchy_magazynowe').insert([{
      towar_id: poz.towar_id,
      magazyn_docelowy_id: magazynId,
      ilosc: Number(poz.ilosc),
      typ: 'invoice_purchase',
      powod: `Faktura ${faktura.numer}`,
      faktura_id: fakturaId,
    }])

    zaktualizowane.push({ towar: poz.towary?.nazwa, ilosc: poz.ilosc, nowaIlosc })
  }

  if (errors.length > 0) {
    return { success: false, error: `Błędy aktualizacji stanów: ${errors.join('; ')}` }
  }

  // 4. Zaktualizuj status i wartość netto faktury
  const wartoscNetto = pozycje.reduce((s, p) => s + (Number(p.ilosc) * Number(p.cena_netto)), 0)

  const { error: updateError } = await supabase
    .from('faktury')
    .update({ status: 'zatwierdzona', wartosc_netto: wartoscNetto })
    .eq('id', fakturaId)

  if (updateError) {
    return { success: false, error: `Błąd aktualizacji statusu: ${updateError.message}` }
  }

  refreshInventory()
  return { success: true, zaktualizowane, pominiete: pozycjePoziome.length }
}

export async function cofnijDoRoboczej(fakturaId) {
  // 1. Pobierz fakturę z pozycjami
  const { data: faktura } = await supabase
    .from('faktury')
    .select('*, pozycje_faktury(towar_id, magazyn_id, ilosc)')
    .eq('id', fakturaId)
    .single()

  if (!faktura || faktura.status !== 'zatwierdzona') {
    return { success: false, error: 'Faktura nie jest zatwierdzona' }
  }

  // 2. Odwróć stany magazynowe
  for (const poz of faktura.pozycje_faktury || []) {
    if (!poz.towar_id) continue
    const magazynId = poz.magazyn_id || faktura.magazyn_id
    if (!magazynId) continue

    const { data: stan } = await supabase
      .from('stany_magazynowe')
      .select('ilosc')
      .eq('towar_id', poz.towar_id)
      .eq('magazyn_id', magazynId)
      .maybeSingle()

    const nowaIlosc = Math.max(0, (stan?.ilosc || 0) - Number(poz.ilosc))

    await supabase
      .from('stany_magazynowe')
      .upsert(
        { towar_id: poz.towar_id, magazyn_id: magazynId, ilosc: nowaIlosc },
        { onConflict: 'towar_id,magazyn_id' }
      )
  }

  // 3. Usuń powiązane ruchy magazynowe
  await supabase.from('ruchy_magazynowe').delete().eq('faktura_id', fakturaId)

  // 4. Zmień status na robocza
  const { error } = await supabase
    .from('faktury')
    .update({ status: 'robocza' })
    .eq('id', fakturaId)

  if (error) return { success: false, error: error.message }

  refreshInventory()
  return { success: true }
}

export async function wykonajPakiet(pakietId, magazynId) {
  const { data: elementy, error } = await supabase
    .from('elementy_pakietu')
    .select('*, towary(nazwa)')
    .eq('pakiet_id', pakietId)
  if (error) return { success: false, error: error.message }
  if (!elementy?.length) return { success: false, error: 'Pakiet nie ma elementów' }

  const braki = []
  for (const el of elementy) {
    const stan = await getStan(el.towar_id, magazynId)
    const dostepne = Number(stan?.ilosc ?? 0)
    if (dostepne < Number(el.ilosc)) {
      braki.push({ nazwa: el.towary?.nazwa || el.towar_id, potrzebne: el.ilosc, dostepne })
    }
  }

  if (braki.length) return { success: false, braki }

  const wykonano = []
  for (const el of elementy) {
    const result = await wydajStan(el.towar_id, magazynId, Number(el.ilosc), 'Pakiet sprzątania')
    if (result.success) wykonano.push(el.towar_id)
    else console.error('Błąd wydania:', result.error)
  }

  return { success: true, wykonano }
}
