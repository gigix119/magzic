import { supabase } from '../supabase'
import { buildTfIdfIndex, queryTfIdf, combinedProductScore } from './invoiceTfIdf'

export async function fetchAssistantOrderRecommendationData({ workspaceId }) {
  return fetchAssistantLowStockData({ workspaceId })
}

export async function fetchAssistantSupplierComparisonData({ workspaceId, productQuery }) {
  if (!workspaceId) {
    return { invoices: [], invoiceLines: [], productQuery: productQuery ?? null, errors: ['Brak aktywnego workspace'] }
  }

  const errors = []
  const dateFrom = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10)

  const { data: invoices, error: e1 } = await supabase
    .from('faktury')
    .select('id, numer, data_zakupu, kontrahent_id, kontrahenci(id, nazwa)')
    .eq('workspace_id', workspaceId)
    .eq('typ', 'zakup')
    .neq('status', 'anulowana')
    .gte('data_zakupu', dateFrom)
    .order('data_zakupu', { ascending: true })
    .limit(1000)

  if (e1) {
    errors.push(`Błąd pobierania faktur: ${e1.message}`)
    return { invoices: [], invoiceLines: [], productQuery: productQuery ?? null, errors }
  }

  const safeInvoices = invoices ?? []
  let invoiceLines = []

  if (safeInvoices.length > 0) {
    const invoiceIds = safeInvoices.map(f => f.id)
    const { data: lines, error: e2 } = await supabase
      .from('pozycje_faktury')
      .select('id, faktura_id, towar_id, ilosc, cena_netto, raw_name, towary(id, nazwa)')
      .in('faktura_id', invoiceIds)
      .limit(10000)

    if (e2) {
      errors.push(`Błąd pobierania pozycji: ${e2.message}`)
    } else {
      invoiceLines = lines ?? []
    }
  }

  return { invoices: safeInvoices, invoiceLines, productQuery: productQuery ?? null, errors }
}

export async function fetchAssistantProductPriceHistoryData({ workspaceId, productQuery }) {
  if (!workspaceId) {
    return { invoices: [], invoiceLines: [], productQuery, errors: ['Brak aktywnego workspace'] }
  }

  if (!productQuery) {
    return { invoices: [], invoiceLines: [], productQuery: null, errors: [] }
  }

  const errors = []
  const dateFrom = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10)

  const { data: invoices, error: e1 } = await supabase
    .from('faktury')
    .select('id, numer, data_zakupu, kontrahent_id, kontrahenci(id, nazwa)')
    .eq('workspace_id', workspaceId)
    .eq('typ', 'zakup')
    .neq('status', 'anulowana')
    .gte('data_zakupu', dateFrom)
    .order('data_zakupu', { ascending: true })
    .limit(500)

  if (e1) {
    errors.push(`Błąd pobierania faktur: ${e1.message}`)
    return { invoices: [], invoiceLines: [], productQuery, errors }
  }

  const safeInvoices = invoices ?? []
  let invoiceLines = []

  if (safeInvoices.length > 0) {
    const invoiceIds = safeInvoices.map(f => f.id)
    const { data: lines, error: e2 } = await supabase
      .from('pozycje_faktury')
      .select('id, faktura_id, towar_id, ilosc, cena_netto, raw_name, towary(id, nazwa)')
      .in('faktura_id', invoiceIds)
      .limit(10000)

    if (e2) {
      errors.push(`Błąd pobierania pozycji: ${e2.message}`)
    } else {
      invoiceLines = lines ?? []
    }
  }

  return { invoices: safeInvoices, invoiceLines, productQuery, errors }
}

export async function fetchAssistantInvoicesNeedingReviewData({ workspaceId }) {
  if (!workspaceId) {
    return { invoices: [], invoiceLines: [], errors: ['Brak aktywnego workspace'] }
  }

  const errors = []
  const dateFrom = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)

  const { data: invoices, error: e1 } = await supabase
    .from('faktury')
    .select('id, numer, data_zakupu, typ, status, kontrahent_id, magazyn_id, kontrahenci(id, nazwa)')
    .eq('workspace_id', workspaceId)
    .neq('status', 'anulowana')
    .gte('data_zakupu', dateFrom)
    .order('data_zakupu', { ascending: false })
    .limit(200)

  if (e1) {
    errors.push(`Błąd pobierania faktur: ${e1.message}`)
    return { invoices: [], invoiceLines: [], errors }
  }

  const safeInvoices = invoices ?? []
  let invoiceLines = []

  if (safeInvoices.length > 0) {
    const invoiceIds = safeInvoices.map(f => f.id)
    const { data: lines, error: e2 } = await supabase
      .from('pozycje_faktury')
      .select('id, faktura_id, towar_id, ilosc, cena_netto, vat_procent, raw_name, towary(id, nazwa)')
      .in('faktura_id', invoiceIds)
      .limit(5000)

    if (e2) {
      errors.push(`Błąd pobierania pozycji: ${e2.message}`)
    } else {
      invoiceLines = lines ?? []
    }
  }

  return { invoices: safeInvoices, invoiceLines, errors }
}

export async function fetchAssistantLowStockData({ workspaceId }) {
  if (!workspaceId) {
    return { products: [], stockRows: [], recentInvoiceLines: [], recentInvoices: [], errors: ['Brak aktywnego workspace'] }
  }

  const errors = []

  const { data: products, error: e1 } = await supabase
    .from('towary')
    .select('id, nazwa, jednostka, stan_minimalny, kategorie(nazwa)')
    .eq('workspace_id', workspaceId)
    .eq('aktywny', true)
    .order('nazwa')
    .limit(1000)

  if (e1) {
    errors.push(`Błąd pobierania towarów: ${e1.message}`)
    return { products: [], stockRows: [], recentInvoiceLines: [], recentInvoices: [], errors }
  }

  const { data: stockRows, error: e2 } = await supabase
    .from('stany_magazynowe')
    .select('towar_id, ilosc, magazyn_id, magazyny(id, nazwa)')
    .eq('workspace_id', workspaceId)
    .limit(2000)

  if (e2) {
    errors.push(`Błąd pobierania stanów: ${e2.message}`)
  }

  const dateFrom = new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10)
  const { data: recentInvoices, error: e3 } = await supabase
    .from('faktury')
    .select('id, numer, data_zakupu, kontrahent_id, kontrahenci(id, nazwa)')
    .eq('workspace_id', workspaceId)
    .eq('typ', 'zakup')
    .neq('status', 'anulowana')
    .gte('data_zakupu', dateFrom)
    .order('data_zakupu', { ascending: false })
    .limit(200)

  if (e3) {
    errors.push(`Błąd pobierania faktur: ${e3.message}`)
  }

  const safeInvoices = recentInvoices ?? []
  let recentInvoiceLines = []

  if (safeInvoices.length > 0) {
    const invoiceIds = safeInvoices.map(f => f.id)
    const { data: lines, error: e4 } = await supabase
      .from('pozycje_faktury')
      .select('id, faktura_id, towar_id, ilosc, cena_netto, raw_name, towary(id, nazwa)')
      .in('faktura_id', invoiceIds)
      .limit(5000)

    if (e4) {
      errors.push(`Błąd pobierania pozycji: ${e4.message}`)
    } else {
      recentInvoiceLines = lines ?? []
    }
  }

  return {
    products: products ?? [],
    stockRows: stockRows ?? [],
    recentInvoiceLines,
    recentInvoices: safeInvoices,
    errors,
  }
}

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

export async function fetchAssistantInvoiceComparisonData({ workspaceId, invoiceNumbers }) {
  if (!workspaceId) {
    return { invoiceA: null, invoiceB: null, invoiceALines: [], invoiceBLines: [], errors: ['Brak aktywnego workspace'] }
  }

  const errors = []

  let invoicesQuery = supabase
    .from('faktury')
    .select('id, numer, data_zakupu, typ, status, kontrahent_id, kontrahenci(id, nazwa)')
    .eq('workspace_id', workspaceId)
    .eq('typ', 'zakup')
    .neq('status', 'anulowana')
    .order('data_zakupu', { ascending: false })
    .order('id', { ascending: false })
    .limit(2)

  if (invoiceNumbers && invoiceNumbers.length >= 2) {
    invoicesQuery = supabase
      .from('faktury')
      .select('id, numer, data_zakupu, typ, status, kontrahent_id, kontrahenci(id, nazwa)')
      .eq('workspace_id', workspaceId)
      .eq('typ', 'zakup')
      .neq('status', 'anulowana')
      .in('numer', invoiceNumbers)
      .order('data_zakupu', { ascending: false })
  }

  const { data: invoices, error: e1 } = await invoicesQuery

  if (e1) {
    errors.push(`Błąd pobierania faktur: ${e1.message}`)
    return { invoiceA: null, invoiceB: null, invoiceALines: [], invoiceBLines: [], errors }
  }

  if (!invoices || invoices.length < 2) {
    return { invoiceA: null, invoiceB: null, invoiceALines: [], invoiceBLines: [], errors }
  }

  // invoiceB = newest (index 0, desc order), invoiceA = older (index 1)
  const invoiceB = invoices[0]
  const invoiceA = invoices[1]

  const { data: allLines, error: e2 } = await supabase
    .from('pozycje_faktury')
    .select('id, faktura_id, towar_id, ilosc, cena_netto, vat_procent, raw_name, towary(id, nazwa, jednostka)')
    .in('faktura_id', [invoiceA.id, invoiceB.id])
    .limit(2000)

  if (e2) {
    errors.push(`Błąd pobierania pozycji faktur: ${e2.message}`)
  }

  const safe = allLines ?? []
  return {
    invoiceA,
    invoiceB,
    invoiceALines: safe.filter(l => l.faktura_id === invoiceA.id),
    invoiceBLines: safe.filter(l => l.faktura_id === invoiceB.id),
    errors,
  }
}

export async function fetchAssistantProductSearchData({ workspaceId, query }) {
  if (!workspaceId) {
    return { results: [], query, errors: ['Brak aktywnego workspace'] }
  }

  const errors = []

  const { data: products, error: e1 } = await supabase
    .from('towary')
    .select('id, nazwa, jednostka, stan_minimalny, kategorie(nazwa)')
    .eq('workspace_id', workspaceId)
    .eq('aktywny', true)
    .order('nazwa')
    .limit(500)

  if (e1) {
    errors.push(`Błąd pobierania towarów: ${e1.message}`)
    return { results: [], query, errors }
  }

  const safeProducts = products ?? []
  if (safeProducts.length === 0) return { results: [], query, errors }

  const { data: stockRows, error: e2 } = await supabase
    .from('stany_magazynowe')
    .select('towar_id, ilosc, magazyn_id, magazyny(id, nazwa)')
    .eq('workspace_id', workspaceId)
    .limit(2000)

  if (e2) errors.push(`Błąd pobierania stanów: ${e2.message}`)
  const safeStock = stockRows ?? []

  const stockByProduct = {}
  for (const row of safeStock) {
    if (!stockByProduct[row.towar_id]) stockByProduct[row.towar_id] = []
    stockByProduct[row.towar_id].push(row)
  }

  // TF-IDF pre-filter (top 20) + combined scoring for abbreviation/fuzzy support
  const index = buildTfIdfIndex(safeProducts)
  const tfidfTop = queryTfIdf(query, index, 20)

  const scored = safeProducts.map(p => ({
    product: p,
    score: combinedProductScore(query, p.nazwa ?? ''),
    stock: stockByProduct[p.id] ?? [],
  }))

  // Boost products found by both systems
  for (const item of scored) {
    const tfidfMatch = tfidfTop.find(t => (t.product?.id ?? t.productId) === item.product.id)
    if (tfidfMatch) item.score = Math.max(item.score, tfidfMatch.score * 0.8, item.score + 0.1)
  }

  const results = scored
    .filter(r => r.score > 0.12)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  return { results, query, errors }
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

export async function fetchAssistantContractorSearchData({ workspaceId, query }) {
  if (!workspaceId) return { results: [], query, errors: ['Brak aktywnego workspace'] }
  const errors = []

  const { data: contractors, error: e1 } = await supabase
    .from('kontrahenci')
    .select('id, nazwa, nip')
    .eq('workspace_id', workspaceId)
    .limit(200)

  if (e1) {
    errors.push(`Błąd: ${e1.message}`)
    return { results: [], query, errors }
  }

  const safe = contractors ?? []
  if (safe.length === 0) return { results: [], query, errors }

  const scored = safe
    .map(c => ({ contractor: c, score: combinedProductScore(query, c.nazwa ?? '') }))
    .filter(r => r.score > 0.15)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  if (scored.length === 0) return { results: [], query, errors }

  const contractorIds = scored.map(s => s.contractor.id)
  const dateFrom = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10)

  const { data: invoices, error: e2 } = await supabase
    .from('faktury')
    .select('id, numer, data_zakupu, typ, status, kontrahent_id')
    .eq('workspace_id', workspaceId)
    .in('kontrahent_id', contractorIds)
    .neq('status', 'anulowana')
    .gte('data_zakupu', dateFrom)
    .order('data_zakupu', { ascending: false })
    .limit(100)

  if (e2) errors.push(`Błąd faktur: ${e2.message}`)
  const safeInv = invoices ?? []

  const totalsByContractor = {}
  if (safeInv.length > 0) {
    const invIds = safeInv.map(f => f.id)
    const { data: lines } = await supabase
      .from('pozycje_faktury')
      .select('faktura_id, cena_netto, ilosc')
      .in('faktura_id', invIds)
      .limit(5000)

    const invToContractor = {}
    for (const inv of safeInv) invToContractor[inv.id] = inv.kontrahent_id
    for (const line of (lines ?? [])) {
      const cid = invToContractor[line.faktura_id]
      if (!cid) continue
      totalsByContractor[cid] = (totalsByContractor[cid] ?? 0) + (line.cena_netto ?? 0) * (line.ilosc ?? 1)
    }
  }

  const results = scored.map(({ contractor, score }) => {
    const cInvoices = safeInv.filter(f => f.kontrahent_id === contractor.id)
    return {
      contractor,
      invoiceCount: cInvoices.length,
      totalSpent: totalsByContractor[contractor.id] ?? 0,
      lastInvoice: cInvoices[0] ?? null,
      score,
    }
  })

  return { results, query, errors }
}
