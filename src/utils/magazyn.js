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
  const { data: fak, error: fErr } = await supabase
    .from('faktury')
    .select('*, pozycje_faktury(*)')
    .eq('id', fakturaId)
    .single()
  if (fErr) return { success: false, error: fErr.message }

  if (!fak.pozycje_faktury?.length) {
    return { success: false, error: 'Faktura nie ma żadnych pozycji' }
  }

  const magazynId = fak.magazyn_id
  if (!magazynId) {
    return { success: false, error: 'Faktura nie ma przypisanego magazynu docelowego' }
  }

  const zaktualizowane = []
  for (const poz of fak.pozycje_faktury) {
    const { data: aktualny } = await supabase
      .from('stany_magazynowe')
      .select('ilosc')
      .eq('towar_id', poz.towar_id)
      .eq('magazyn_id', fak.magazyn_id)
      .single()

    const nowaIlosc = (aktualny?.ilosc || 0) + Number(poz.ilosc)

    const { error: upsertErr } = await supabase
      .from('stany_magazynowe')
      .upsert(
        { towar_id: poz.towar_id, magazyn_id: fak.magazyn_id, ilosc: nowaIlosc },
        { onConflict: 'towar_id,magazyn_id' }
      )

    if (upsertErr) { console.error('stany upsert:', upsertErr); continue }

    await supabase.from('ruchy_magazynowe').insert([{
      towar_id: poz.towar_id,
      magazyn_docelowy_id: fak.magazyn_id,
      ilosc: Number(poz.ilosc),
      typ: 'invoice_purchase',
      faktura_id: fakturaId,
      powod: `Faktura ${fak.numer}`,
    }])

    zaktualizowane.push(poz.towar_id)
  }

  await supabase.from('faktury').update({ status: 'zatwierdzona' }).eq('id', fakturaId)

  refreshInventory()
  return { success: true, zaktualizowane }
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
