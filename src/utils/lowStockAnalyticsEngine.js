function safeNum(v) {
  const n = Number(v)
  return isFinite(n) ? n : 0
}

function normalizeKey(str) {
  if (!str) return ''
  return str
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[^a-ząćęłńóśźż0-9 ]/gi, '')
}

function emptyKpis() {
  return {
    belowCount: 0,
    criticalCount: 0,
    nearCount: 0,
    totalMissing: 0,
    estimatedRestockCost: null,
    topMissingName: null,
    topMissingQty: 0,
    topCostName: null,
    topCostValue: null,
  }
}

export function buildLowStockAnalysis({
  products = [],
  stockRows = [],
  recentInvoiceLines = [],
  recentInvoices = [],
} = {}) {
  if (!products.length) {
    return {
      summaryText: 'Nie znalazłem produktów z ustawionym minimum magazynowym albo nie mam aktualnych stanów do analizy.',
      kpis: emptyKpis(),
      belowMinimum: [],
      nearMinimum: [],
      criticalItems: [],
      chartData: [],
      warnings: ['Brak aktywnych towarów w workspace.'],
      hasEnoughData: false,
    }
  }

  const warnings = []

  // Build stock map — sum across all warehouses
  const stanMap = {}
  for (const row of stockRows) {
    stanMap[row.towar_id] = (stanMap[row.towar_id] || 0) + safeNum(row.ilosc)
  }

  // Build warehouse display name map (first warehouse per towar)
  const magazynMap = {}
  for (const row of stockRows) {
    if (!magazynMap[row.towar_id] && row.magazyny?.nazwa) {
      magazynMap[row.towar_id] = row.magazyny.nazwa
    }
  }

  // Build last purchase price / supplier map from recent invoice lines
  // Sort descending by invoice date so first encountered = most recent
  const invoiceDateMap = {}
  for (const inv of recentInvoices) {
    invoiceDateMap[inv.id] = inv.data_zakupu ?? ''
  }
  const invoiceContractorMap = {}
  for (const inv of recentInvoices) {
    invoiceContractorMap[inv.id] = inv.kontrahenci?.nazwa ?? null
  }

  const sortedLines = [...recentInvoiceLines].sort(
    (a, b) => (invoiceDateMap[b.faktura_id] ?? '').localeCompare(invoiceDateMap[a.faktura_id] ?? '')
  )

  const lastPriceById = {}
  const lastPriceByName = {}

  for (const line of sortedLines) {
    const price = safeNum(line.cena_netto)
    if (price <= 0) continue
    const supplier = invoiceContractorMap[line.faktura_id] ?? null

    if (line.towar_id && !lastPriceById[line.towar_id]) {
      lastPriceById[line.towar_id] = { price, supplier }
    }

    const nk = normalizeKey(line.raw_name ?? line.towary?.nazwa ?? '')
    if (nk && !lastPriceByName[nk]) {
      lastPriceByName[nk] = { price, supplier }
    }
  }

  // Only products with a meaningful minimum
  const productsWithMin = products.filter(p => p.stan_minimalny != null && safeNum(p.stan_minimalny) > 0)

  if (!productsWithMin.length) {
    if (!stockRows.length) warnings.push('Brak aktualnych stanów magazynowych.')
    return {
      summaryText: 'Nie znalazłem produktów z ustawionym minimum magazynowym.',
      kpis: emptyKpis(),
      belowMinimum: [],
      nearMinimum: [],
      criticalItems: [],
      chartData: [],
      warnings: [...warnings, 'Żaden aktywny towar nie ma ustawionego minimum magazynowego.'],
      hasEnoughData: false,
    }
  }

  if (!stockRows.length) {
    warnings.push('Brak danych o aktualnych stanach magazynowych — stany mogą wynosić 0.')
  }
  if (!recentInvoiceLines.length) {
    warnings.push('Brak historii zakupów z ostatnich 180 dni — ceny uzupełnienia niedostępne.')
  }

  const analyzed = []

  for (const product of productsWithMin) {
    const stan = stanMap[product.id] ?? 0
    const min = safeNum(product.stan_minimalny)
    const missing = Math.max(0, min - stan)
    const fillPct = min > 0 ? (stan / min) * 100 : 0

    const priceInfo = lastPriceById[product.id] ?? lastPriceByName[normalizeKey(product.nazwa)] ?? null
    const lastPrice = priceInfo?.price ?? null
    const lastSupplier = priceInfo?.supplier ?? null
    const estimatedCost = lastPrice != null && missing > 0 ? lastPrice * missing : null

    let priority = 'ok'
    let isCritical = false
    let isBelowMinimum = false
    let isNearMinimum = false

    if (min > 0 && stan === 0) {
      priority = 'critical'; isCritical = true; isBelowMinimum = true
    } else if (stan > 0 && stan < min * 0.25) {
      priority = 'critical'; isCritical = true; isBelowMinimum = true
    } else if (stan < min) {
      priority = 'high'; isBelowMinimum = true
    } else if (stan <= min * 1.2) {
      priority = 'medium'; isNearMinimum = true
    }

    analyzed.push({
      id: product.id,
      name: product.nazwa,
      unit: product.jednostka ?? 'szt.',
      category: product.kategorie?.nazwa ?? null,
      magazyn: magazynMap[product.id] ?? null,
      stan,
      min,
      missing,
      fillPct,
      priority,
      isCritical,
      isBelowMinimum,
      isNearMinimum,
      lastPrice,
      lastSupplier,
      estimatedCost,
    })
  }

  const belowMinimum = analyzed
    .filter(p => p.isBelowMinimum)
    .sort((a, b) => b.missing - a.missing)

  const nearMinimum = analyzed
    .filter(p => p.isNearMinimum)
    .sort((a, b) => (b.min - b.stan) - (a.min - a.stan))

  const criticalItems = analyzed
    .filter(p => p.isCritical)
    .sort((a, b) => b.missing - a.missing)

  const chartData = [...belowMinimum]
    .slice(0, 10)
    .map(p => ({
      name: p.name.length > 18 ? p.name.slice(0, 16) + '…' : p.name,
      fullName: p.name,
      missing: p.missing,
      stan: p.stan,
      min: p.min,
    }))

  const totalMissing = belowMinimum.reduce((s, p) => s + p.missing, 0)
  const withCost = belowMinimum.filter(p => p.estimatedCost != null)
  const totalEstimatedCost = withCost.reduce((s, p) => s + safeNum(p.estimatedCost), 0)
  const hasCostEstimate = withCost.length > 0

  const topMissing = belowMinimum[0] ?? null
  const topCost = hasCostEstimate
    ? [...belowMinimum].sort((a, b) => safeNum(b.estimatedCost) - safeNum(a.estimatedCost))[0]
    : null

  const kpis = {
    belowCount: belowMinimum.length,
    criticalCount: criticalItems.length,
    nearCount: nearMinimum.length,
    totalMissing,
    estimatedRestockCost: hasCostEstimate ? totalEstimatedCost : null,
    topMissingName: topMissing?.name ?? null,
    topMissingQty: topMissing?.missing ?? 0,
    topCostName: topCost?.name ?? null,
    topCostValue: topCost?.estimatedCost ?? null,
  }

  // Summary text
  const fmtPLN = v => safeNum(v).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' zł'

  let summaryText = ''
  if (belowMinimum.length === 0) {
    summaryText = 'Nie znalazłem produktów poniżej minimum magazynowego.'
    if (nearMinimum.length > 0) {
      summaryText += ` ${nearMinimum.length} produkt${nearMinimum.length === 1 ? '' : 'ów'} jest blisko progu.`
    }
  } else {
    summaryText = `Znalazłem ${belowMinimum.length} produkt${belowMinimum.length === 1 ? '' : 'ów'} poniżej minimum.`
    if (criticalItems.length > 0) {
      summaryText += ` ${criticalItems.length} ${criticalItems.length === 1 ? 'jest krytyczny' : 'są krytyczne'}.`
    }
    if (topMissing) {
      summaryText += ` Największy brak: ${topMissing.name} — stan ${topMissing.stan} ${topMissing.unit} przy minimum ${topMissing.min} ${topMissing.unit}, brakuje ${topMissing.missing} ${topMissing.unit}.`
    }
    if (hasCostEstimate && totalEstimatedCost > 0) {
      summaryText += ` Szacowany koszt uzupełnienia: ${fmtPLN(totalEstimatedCost)}.`
    }
  }

  return {
    summaryText,
    kpis,
    belowMinimum,
    nearMinimum,
    criticalItems,
    chartData,
    warnings,
    hasEnoughData: belowMinimum.length > 0 || nearMinimum.length > 0,
  }
}
