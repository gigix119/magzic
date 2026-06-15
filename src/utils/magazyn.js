import { supabase } from '../supabase'
import { refreshInventory } from './events'
import { issueStock }    from './issueStock'
import { transferStock } from './transferStock'

const DEV = import.meta.env.DEV

// ── Stan helpers ───────────────────────────────────────────────

async function getStan(towarId, magazynId, workspaceId) {
  let q = supabase
    .from('stany_magazynowe')
    .select('id, ilosc')
    .eq('towar_id', towarId)
    .eq('magazyn_id', magazynId)
  if (workspaceId) q = q.eq('workspace_id', workspaceId)
  const { data, error } = await q.maybeSingle()
  if (error) console.error('getStan error:', error)
  return data
}

async function insertRuch(fields, workspaceId) {
  const payload = workspaceId ? { ...fields, workspace_id: workspaceId } : fields
  const { error } = await supabase.from('ruchy_magazynowe').insert([payload])
  if (error) console.error('ruchy_magazynowe insert:', error)
}

// ── Eksportowane funkcje ───────────────────────────────────────

export async function dodajStan(towarId, magazynId, ilosc, powod = null, fakturaId = null, workspaceId = null, idempotencyKey = null) {
  if (!magazynId) return { success: false, error: 'Magazyn jest wymagany' }
  if (!towarId) return { success: false, error: 'Towar jest wymagany' }
  if (Number(ilosc) <= 0) return { success: false, error: 'Ilość musi być większa od 0' }

  const { data, error } = await supabase.rpc('receive_stock', {
    p_towar_id:        towarId,
    p_magazyn_id:      magazynId,
    p_ilosc:           Number(ilosc),
    p_powod:           powod ?? null,
    p_faktura_id:      fakturaId ?? null,
    p_workspace_id:    workspaceId ?? null,
    p_idempotency_key: idempotencyKey ?? null,
  })

  if (error) return { success: false, error: error.message }
  if (!data?.success) return { success: false, error: data?.error ?? 'Nieznany błąd' }

  if (DEV) console.debug('[magazyn] dodajStan', { towarId, magazynId, ilosc, newBalance: data.new_balance })
  refreshInventory()
  return { success: true }
}

export async function wydajStan(towarId, magazynId, ilosc, powod = null, workspaceId = null) {
  if (!magazynId) return { success: false, error: 'Magazyn jest wymagany' }
  if (!towarId)   return { success: false, error: 'Towar jest wymagany' }
  if (Number(ilosc) <= 0) return { success: false, error: 'Ilość musi być większa od 0' }

  const result = await issueStock({ towarId, magazynId, ilosc: Number(ilosc), powod, workspaceId })

  // Translate the RPC's English insufficient-stock message to Polish for the UI.
  if (!result.success && result.available !== undefined) {
    return { success: false, error: `Niewystarczający stan. Dostępne: ${result.available}` }
  }
  if (DEV && result.success) {
    console.debug('[magazyn] wydajStan', { towarId, magazynId, ilosc, newBalance: result.newBalance })
  }
  return result
}

export async function transferujStan(towarId, zMagazynuId, doMagazynuId, ilosc, powod = null, workspaceId = null) {
  if (!zMagazynuId || !doMagazynuId) return { success: false, error: 'Oba magazyny są wymagane' }
  if (!towarId) return { success: false, error: 'Towar jest wymagany' }
  if (Number(ilosc) <= 0) return { success: false, error: 'Ilość musi być większa od 0' }
  if (zMagazynuId === doMagazynuId) return { success: false, error: 'Magazyny muszą być różne' }

  const result = await transferStock({
    towarId,
    magazynZrodlowyId: zMagazynuId,
    magazynDocelowyId: doMagazynuId,
    ilosc: Number(ilosc),
    powod,
    workspaceId,
  })

  // Translate the RPC's English insufficient-stock message to Polish for the UI.
  if (!result.success && result.available !== undefined) {
    return { success: false, error: `Niewystarczający stan w magazynie źródłowym. Dostępne: ${result.available}` }
  }
  if (DEV && result.success) {
    console.debug('[magazyn] transferujStan', { towarId, zMagazynuId, doMagazynuId, ilosc })
  }
  return result
}

export async function korektaStan(towarId, magazynId, nowaIlosc, powod, workspaceId = null) {
  if (!magazynId) return { success: false, error: 'Magazyn jest wymagany' }
  if (!towarId) return { success: false, error: 'Towar jest wymagany' }
  if (Number(nowaIlosc) < 0) return { success: false, error: 'Ilość nie może być ujemna' }
  if (!powod?.trim()) return { success: false, error: 'Powód korekty jest wymagany' }

  const current = await getStan(towarId, magazynId, workspaceId)
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
    const payload = { towar_id: towarId, magazyn_id: magazynId, ilosc: Number(nowaIlosc) }
    if (workspaceId) payload.workspace_id = workspaceId
    const { error } = await supabase.from('stany_magazynowe').insert([payload])
    if (error) return { success: false, error: error.message }
  }

  await insertRuch({
    towar_id: towarId,
    magazyn_docelowy_id: magazynId,
    ilosc: Math.abs(roznica),
    typ,
    powod,
  }, workspaceId)

  if (DEV) console.debug('[magazyn] korektaStan', { towarId, magazynId, stary, nowaIlosc, roznica })
  refreshInventory()
  return { success: true }
}

export async function getStanLaczny(towarId, workspaceId = null) {
  let q = supabase.from('stany_magazynowe').select('ilosc').eq('towar_id', towarId)
  if (workspaceId) q = q.eq('workspace_id', workspaceId)
  const { data } = await q
  return (data || []).reduce((s, r) => s + Number(r.ilosc), 0)
}

export async function getStanyMagazynu(magazynId, workspaceId = null) {
  let q = supabase
    .from('stany_magazynowe')
    .select('*, towary(id, nazwa, jednostka, stan_minimalny)')
    .eq('magazyn_id', magazynId)
    .gt('ilosc', 0)
    .order('ilosc', { ascending: false })
  if (workspaceId) q = q.eq('workspace_id', workspaceId)
  const { data, error } = await q
  if (error) { console.error(error); return [] }
  return data || []
}

export async function getRuchyTowaru(towarId, limit = 20, workspaceId = null) {
  let q = supabase
    .from('ruchy_magazynowe')
    .select('*, mz:magazyn_zrodlowy_id(nazwa), md:magazyn_docelowy_id(nazwa)')
    .eq('towar_id', towarId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (workspaceId) q = q.eq('workspace_id', workspaceId)
  const { data, error } = await q
  if (error) { console.error(error); return [] }
  return data || []
}

export async function zatwierdźFakturę(fakturaId) {
  const { data, error } = await supabase.rpc('approve_invoice_stock', {
    p_faktura_id: fakturaId,
  })

  if (error) return { success: false, error: error.message }
  if (!data?.success) return { success: false, error: data?.error ?? 'Nieznany błąd' }

  refreshInventory()
  return {
    success:        true,
    zaktualizowane: data.zaktualizowane ?? [],
    pominiete:      data.pominiete      ?? 0,
  }
}

export async function cofnijDoRoboczej(fakturaId) {
  const { data: faktura } = await supabase
    .from('faktury')
    .select('*, pozycje_faktury(towar_id, magazyn_id, ilosc)')
    .eq('id', fakturaId)
    .single()

  if (!faktura || faktura.status !== 'zatwierdzona') {
    return { success: false, error: 'Faktura nie jest zatwierdzona' }
  }

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

  await supabase.from('ruchy_magazynowe').update({ reversed_at: new Date().toISOString() }).eq('faktura_id', fakturaId)

  const { error } = await supabase
    .from('faktury')
    .update({ status: 'robocza' })
    .eq('id', fakturaId)

  if (error) return { success: false, error: error.message }

  refreshInventory()
  return { success: true }
}

export async function sprawdzPowiazaniaTowaru(towarId) {
  const [stanyRes, ruchyRes, pozycjeRes] = await Promise.all([
    supabase
      .from('stany_magazynowe')
      .select('id, ilosc, magazyn_id, magazyny(nazwa)')
      .eq('towar_id', towarId),
    supabase
      .from('ruchy_magazynowe')
      .select('id', { count: 'exact', head: true })
      .eq('towar_id', towarId),
    supabase
      .from('pozycje_faktury')
      .select('id', { count: 'exact', head: true })
      .eq('towar_id', towarId),
  ])

  const stanyAktywne = (stanyRes.data || []).filter(s => Number(s.ilosc) > 0)
  const stanLaczny = (stanyRes.data || []).reduce((s, r) => s + Number(r.ilosc), 0)

  return {
    stany: stanyRes.data || [],
    stanyAktywne,
    stanLaczny,
    liczbaRuchow: ruchyRes.count || 0,
    liczbaPozycjiFaktur: pozycjeRes.count || 0,
    moznaUsunac:
      stanLaczny === 0 &&
      (ruchyRes.count || 0) === 0 &&
      (pozycjeRes.count || 0) === 0,
  }
}

export async function wykonajPakiet(pakietId, magazynId, workspaceId = null) {
  const { data: elementy, error } = await supabase
    .from('elementy_pakietu')
    .select('*, towary(nazwa)')
    .eq('pakiet_id', pakietId)
  if (error) return { success: false, error: error.message }
  if (!elementy?.length) return { success: false, error: 'Pakiet nie ma elementów' }

  const braki = []
  for (const el of elementy) {
    const stan = await getStan(el.towar_id, magazynId, null)
    const dostepne = Number(stan?.ilosc ?? 0)
    if (dostepne < Number(el.ilosc)) {
      braki.push({ nazwa: el.towary?.nazwa || el.towar_id, potrzebne: el.ilosc, dostepne })
    }
  }

  if (braki.length) return { success: false, braki }

  const wykonano = []
  for (const el of elementy) {
    const result = await wydajStan(el.towar_id, magazynId, Number(el.ilosc), 'Pakiet sprzątania', workspaceId)
    if (result.success) wykonano.push(el.towar_id)
    else console.error('Błąd wydania:', result.error)
  }

  return { success: true, wykonano }
}
