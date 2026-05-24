import { supabase } from '../supabase'

const NULL_WORKSPACE_ID = '00000000-0000-0000-0000-000000000000'

function wq(tableName, workspaceId) {
  return supabase.from(tableName).eq('workspace_id', workspaceId ?? NULL_WORKSPACE_ID)
}

export async function getTowarStanLaczny(towarId, workspaceId) {
  const { data } = await wq('stany_magazynowe', workspaceId)
    .select('ilosc')
    .eq('towar_id', towarId)
  return (data || []).reduce((s, r) => s + Number(r.ilosc), 0)
}

export async function getMagazynSummary(magazynId, workspaceId) {
  const [{ data: stany }, { data: towary }] = await Promise.all([
    wq('stany_magazynowe', workspaceId).select('towar_id, ilosc').eq('magazyn_id', magazynId).gt('ilosc', 0),
    wq('towary', workspaceId).select('id, stan_minimalny').eq('aktywny', true),
  ])

  const count = (stany || []).length
  const total = (stany || []).reduce((s, r) => s + Number(r.ilosc), 0)

  const minMap = {}
  for (const t of towary || []) minMap[t.id] = t.stan_minimalny

  const belowMin = (stany || []).filter(s => {
    const min = minMap[s.towar_id]
    return min !== null && min !== undefined && Number(s.ilosc) < min
  }).length

  return { count, total, belowMin }
}

export async function getAktywneAlerty(workspaceId) {
  const [{ data: towary }, { data: stanyRaw }] = await Promise.all([
    wq('towary', workspaceId).select('id, nazwa, stan_minimalny').eq('aktywny', true),
    wq('stany_magazynowe', workspaceId).select('towar_id, ilosc'),
  ])

  const stanMap = {}
  for (const s of stanyRaw || []) {
    stanMap[s.towar_id] = (stanMap[s.towar_id] || 0) + Number(s.ilosc)
  }

  const alerty = []
  for (const t of towary || []) {
    if (!t.stan_minimalny) continue
    const stan = stanMap[t.id] || 0
    if (stan === 0) alerty.push({ severity: 'critical', towar: t, stan })
    else if (stan < t.stan_minimalny) alerty.push({ severity: 'high', towar: t, stan })
  }
  return alerty
}
