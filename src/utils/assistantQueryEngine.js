import { supabase } from '../supabase'

export async function fetchAssistantPriceChangesData({ workspaceId, dateRange = {} }) {
  if (!workspaceId) {
    return { invoices: [], invoiceLines: [], products: [], contractors: [], errors: ['Brak aktywnego workspace'] }
  }

  const errors = []
  const dateFrom = dateRange.from ?? new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10)
  const dateTo = dateRange.to ?? new Date().toISOString().slice(0, 10)

  const { data: invoices, error: e1 } = await supabase
    .from('faktury')
    .select('id, numer, data_zakupu, typ, status, kontrahent_id, kontrahenci(id, nazwa)')
    .eq('workspace_id', workspaceId)
    .eq('typ', 'zakup')
    .neq('status', 'anulowana')
    .gte('data_zakupu', dateFrom)
    .lte('data_zakupu', dateTo)
    .order('data_zakupu', { ascending: true })
    .limit(500)

  if (e1) {
    errors.push(`Błąd pobierania faktur: ${e1.message}`)
    return { invoices: [], invoiceLines: [], products: [], contractors: [], errors }
  }

  const safeFaktury = invoices ?? []
  if (safeFaktury.length === 0) {
    return { invoices: [], invoiceLines: [], products: [], contractors: [], errors }
  }

  const invoiceIds = safeFaktury.map(f => f.id)
  const { data: invoiceLines, error: e2 } = await supabase
    .from('pozycje_faktury')
    .select('id, faktura_id, towar_id, ilosc, cena_netto, vat_procent, raw_name, towary(id, nazwa, jednostka)')
    .in('faktura_id', invoiceIds)
    .limit(8000)

  if (e2) {
    errors.push(`Błąd pobierania pozycji faktur: ${e2.message}`)
  }

  return {
    invoices: safeFaktury,
    invoiceLines: invoiceLines ?? [],
    products: [],
    contractors: [],
    errors,
  }
}

export async function fetchAssistantPurchaseDashboardData({ workspaceId, dateRange = {} }) {
  if (!workspaceId) {
    return { invoices: [], invoiceLines: [], products: [], contractors: [], errors: ['Brak aktywnego workspace'] }
  }

  const errors = []
  const dateFrom = dateRange.from ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const dateTo = dateRange.to ?? new Date().toISOString().slice(0, 10)

  const { data: invoices, error: e1 } = await supabase
    .from('faktury')
    .select('id, numer, data_zakupu, typ, status, kontrahent_id, kontrahenci(id, nazwa)')
    .eq('workspace_id', workspaceId)
    .eq('typ', 'zakup')
    .neq('status', 'anulowana')
    .gte('data_zakupu', dateFrom)
    .lte('data_zakupu', dateTo)
    .order('data_zakupu', { ascending: false })
    .limit(500)

  if (e1) {
    errors.push(`Błąd pobierania faktur: ${e1.message}`)
    return { invoices: [], invoiceLines: [], products: [], contractors: [], errors }
  }

  const safeFaktury = invoices ?? []
  if (safeFaktury.length === 0) {
    return { invoices: [], invoiceLines: [], products: [], contractors: [], errors }
  }

  const invoiceIds = safeFaktury.map(f => f.id)
  const { data: invoiceLines, error: e2 } = await supabase
    .from('pozycje_faktury')
    .select('id, faktura_id, towar_id, ilosc, cena_netto, vat_procent, raw_name, towary(id, nazwa, jednostka)')
    .in('faktura_id', invoiceIds)
    .limit(5000)

  if (e2) {
    errors.push(`Błąd pobierania pozycji faktur: ${e2.message}`)
  }

  return {
    invoices: safeFaktury,
    invoiceLines: invoiceLines ?? [],
    products: [],
    contractors: [],
    errors,
  }
}
