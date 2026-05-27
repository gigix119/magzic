function safeNum(v) {
  const n = Number(v)
  return isFinite(n) ? n : 0
}

function normalizeForSearch(s) {
  if (!s) return ''
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

function fmtPLN(v) {
  return safeNum(v).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' zł'
}

function pluralPurchases(n) {
  if (n === 1) return '1 zakup'
  if (n >= 2 && n <= 4) return `${n} zakupy`
  return `${n} zakupów`
}

function emptyKpis() {
  return {
    purchaseCount: 0,
    firstPrice: null,
    lastPrice: null,
    minPrice: null,
    maxPrice: null,
    avgPrice: null,
    diffPLN: null,
    diffPct: null,
    lastSupplier: null,
    topSupplier: null,
    firstDate: null,
    lastDate: null,
  }
}

export function buildProductPriceHistory({
  invoices = [],
  invoiceLines = [],
  productQuery = null,
} = {}) {
  if (!productQuery) {
    return {
      summaryText: "Podaj nazwę produktu, np. 'historia ceny Domestos'.",
      kpis: emptyKpis(),
      productQuery: null,
      matchedProductName: null,
      matchedProductId: null,
      priceHistory: [],
      supplierBreakdown: [],
      chartData: [],
      warnings: [],
      hasEnoughData: false,
    }
  }

  // Build invoice lookup: id → { date, numer, contractor }
  const invoiceMap = {}
  for (const inv of invoices) {
    invoiceMap[inv.id] = {
      date: inv.data_zakupu ?? '',
      numer: inv.numer ?? '',
      contractor: inv.kontrahenci?.nazwa ?? null,
    }
  }

  const queryNorm = normalizeForSearch(productQuery)

  const matchedLines = []
  const matchedProductNames = new Set()
  const matchedProductIds = new Set()

  for (const line of invoiceLines) {
    const price = safeNum(line.cena_netto)
    if (price <= 0) continue

    const inv = invoiceMap[line.faktura_id]
    if (!inv || !inv.date) continue

    const towarName = line.towary?.nazwa ?? ''
    const rawName = line.raw_name ?? ''

    const towarNorm = normalizeForSearch(towarName)
    const rawNorm = normalizeForSearch(rawName)

    const matchesName = towarNorm && towarNorm.includes(queryNorm)
    const matchesRaw = rawNorm && rawNorm.includes(queryNorm)

    if (!matchesName && !matchesRaw) continue

    const displayName = towarName || rawName || productQuery
    matchedProductNames.add(displayName)
    if (line.towar_id) matchedProductIds.add(line.towar_id)

    matchedLines.push({
      date: inv.date,
      numer: inv.numer,
      contractor: inv.contractor,
      qty: safeNum(line.ilosc),
      price,
      totalNetto: Math.round(price * safeNum(line.ilosc) * 100) / 100,
      name: displayName,
      towarId: line.towar_id ?? null,
      rawName: rawName || null,
    })
  }

  const warnings = []
  if (matchedProductNames.size > 3) {
    warnings.push(`Znaleziono ${matchedProductNames.size} różnych pozycji pasujących do zapytania — wyniki mogą zawierać różne produkty.`)
  }

  if (!matchedLines.length) {
    return {
      summaryText: `Nie znalazłem historii ceny dla produktu „${productQuery}".`,
      kpis: emptyKpis(),
      productQuery,
      matchedProductName: null,
      matchedProductId: null,
      priceHistory: [],
      supplierBreakdown: [],
      chartData: [],
      warnings,
      hasEnoughData: false,
    }
  }

  // Sort ascending by date
  matchedLines.sort((a, b) => a.date.localeCompare(b.date))

  // Most frequent product name
  const nameCount = {}
  for (const l of matchedLines) {
    nameCount[l.name] = (nameCount[l.name] ?? 0) + 1
  }
  const matchedProductName = Object.entries(nameCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? productQuery
  const matchedProductId = matchedProductIds.size === 1 ? [...matchedProductIds][0] : null

  const prices = matchedLines.map(l => l.price)
  const firstPrice = prices[0]
  const lastPrice = prices[prices.length - 1]
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  const avgPrice = Math.round((prices.reduce((s, p) => s + p, 0) / prices.length) * 100) / 100
  const diffPLN = Math.round((lastPrice - firstPrice) * 100) / 100
  const diffPct = firstPrice > 0 ? Math.round(((diffPLN / firstPrice) * 100) * 10) / 10 : 0

  // Supplier breakdown
  const supplierMap = {}
  for (const l of matchedLines) {
    const key = l.contractor ?? 'Nieznany dostawca'
    if (!supplierMap[key]) {
      supplierMap[key] = { supplier: key, count: 0, prices: [], lastDate: '', lastPrice: null }
    }
    supplierMap[key].count++
    supplierMap[key].prices.push(l.price)
    if (!supplierMap[key].lastDate || l.date >= supplierMap[key].lastDate) {
      supplierMap[key].lastDate = l.date
      supplierMap[key].lastPrice = l.price
    }
  }

  const supplierBreakdown = Object.values(supplierMap)
    .map(s => ({
      supplier: s.supplier,
      count: s.count,
      avgPrice: Math.round((s.prices.reduce((a, b) => a + b, 0) / s.prices.length) * 100) / 100,
      minPrice: Math.min(...s.prices),
      maxPrice: Math.max(...s.prices),
      lastPrice: s.lastPrice,
      lastDate: s.lastDate,
    }))
    .sort((a, b) => b.count - a.count)

  const lastEntry = matchedLines[matchedLines.length - 1]
  const lastSupplier = lastEntry.contractor ?? null
  const topSupplier = supplierBreakdown[0]?.supplier ?? null

  if (matchedLines.length === 1) {
    warnings.push('Tylko jeden zakup — brak danych do analizy trendu.')
  }

  const kpis = {
    purchaseCount: matchedLines.length,
    firstPrice,
    lastPrice,
    minPrice,
    maxPrice,
    avgPrice,
    diffPLN,
    diffPct,
    lastSupplier,
    topSupplier,
    firstDate: matchedLines[0].date,
    lastDate: lastEntry.date,
  }

  const chartData = matchedLines.map(l => ({
    date: l.date,
    price: l.price,
    supplier: l.contractor ?? 'Nieznany',
    numer: l.numer,
    name: l.date,
  }))

  // Summary text
  const n = matchedLines.length
  let summaryText = `Znalazłem ${pluralPurchases(n)} dla produktu ${matchedProductName}.`

  if (n >= 2) {
    if (Math.abs(diffPLN) > 0.005) {
      const dir = diffPLN > 0 ? 'wzrosła' : 'spadła'
      const sign = diffPLN > 0 ? '+' : ''
      summaryText += ` Cena ${dir} z ${fmtPLN(firstPrice)} do ${fmtPLN(lastPrice)}, czyli o ${fmtPLN(Math.abs(diffPLN))} (${sign}${safeNum(diffPct).toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%).`
    } else {
      summaryText += ` Cena nie zmieniła się: ${fmtPLN(lastPrice)}.`
    }
  } else {
    summaryText += ` Tylko jeden zakup — nie da się policzyć trendu. Cena: ${fmtPLN(lastPrice)}.`
  }

  if (minPrice < maxPrice) {
    summaryText += ` Najtaniej: ${fmtPLN(minPrice)}, najdrożej: ${fmtPLN(maxPrice)}.`
  }

  if (lastSupplier) {
    summaryText += ` Ostatni dostawca: ${lastSupplier}.`
  }

  return {
    summaryText,
    kpis,
    productQuery,
    matchedProductName,
    matchedProductId,
    priceHistory: matchedLines,
    supplierBreakdown,
    chartData,
    warnings,
    hasEnoughData: true,
  }
}
