function safeNum(v) {
  const n = Number(v)
  return isFinite(n) ? n : 0
}

function normalizeKey(rawName) {
  if (!rawName) return ''
  return rawName
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[^a-ząćęłńóśźż0-9 ]/gi, '')
}

function median(arr) {
  if (!arr.length) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function emptyResult(productQuery, summaryText) {
  return {
    summaryText,
    kpis: {
      supplierCount: 0, comparableProductCount: 0,
      cheapestSupplier: null, cheapestPriceIndex: null,
      mostExpensiveSupplier: null, mostExpensivePriceIndex: null,
      biggestSupplierBySpend: null, biggestSupplierSpend: 0,
      maxPriceDiffProduct: null, maxPriceDiffPct: null,
      savingsCount: 0, totalSpend: 0,
    },
    supplierRanking: [],
    comparableProducts: [],
    savingsOpportunities: [],
    supplierSpendBreakdown: [],
    chartData: [],
    warnings: [],
    hasEnoughData: false,
    productQuery: productQuery ?? null,
  }
}

export function buildSupplierComparison({ invoices = [], invoiceLines = [], productQuery = null } = {}) {
  const warnings = []

  if (!invoices.length) {
    return emptyResult(productQuery, 'Brak faktur zakupowych w analizowanym okresie.')
  }

  // Build invoice lookup
  const invoiceMap = {}
  let missingContractorCount = 0
  for (const inv of invoices) {
    const contractorId = inv.kontrahent_id ?? null
    const contractor = inv.kontrahenci?.nazwa ?? null
    invoiceMap[inv.id] = {
      date: (inv.data_zakupu ?? '').slice(0, 10),
      numer: inv.numer ?? '',
      contractor,
      contractorId,
    }
    if (!contractor || !contractorId) missingContractorCount++
  }

  if (missingContractorCount > 0) {
    warnings.push(`${missingContractorCount} faktur${missingContractorCount === 1 ? 'a' : ''} bez kontrahenta — pominięte.`)
  }

  const queryNorm = productQuery ? normalizeKey(productQuery) : null

  // productGroups: { productKey → { key, name, towarId, purchases: [] } }
  const productGroups = {}
  // supplierSpendRaw: { contractorId → { name, totalSpend, invoiceIds: Set, lineCount, productKeys: Set } }
  const supplierSpendRaw = {}
  let noPriceCount = 0

  for (const line of invoiceLines) {
    const inv = invoiceMap[line.faktura_id]
    if (!inv || !inv.contractorId || !inv.contractor) continue

    const price = safeNum(line.cena_netto)
    if (price <= 0) { noPriceCount++; continue }

    const qty = safeNum(line.ilosc) || 1

    let productKey, productName, towarId
    if (line.towar_id) {
      productKey = `id:${line.towar_id}`
      productName = line.towary?.nazwa ?? line.raw_name ?? String(line.towar_id)
      towarId = line.towar_id
    } else {
      const nk = normalizeKey(line.raw_name)
      if (!nk) continue
      productKey = `raw:${nk}`
      productName = line.raw_name ?? nk
      towarId = null
    }

    // Optional product filter
    if (queryNorm) {
      const nameNorm = normalizeKey(productName)
      if (!nameNorm.includes(queryNorm)) continue
    }

    if (!productGroups[productKey]) {
      productGroups[productKey] = { key: productKey, name: productName, towarId, purchases: [] }
    }
    productGroups[productKey].purchases.push({
      price,
      date: inv.date,
      contractorId: inv.contractorId,
      contractor: inv.contractor,
      numer: inv.numer,
      qty,
      fakturaId: line.faktura_id,
    })

    // Supplier spend (all lines, after product filter)
    if (!supplierSpendRaw[inv.contractorId]) {
      supplierSpendRaw[inv.contractorId] = {
        name: inv.contractor, totalSpend: 0, invoiceIds: new Set(), lineCount: 0, productKeys: new Set(),
      }
    }
    supplierSpendRaw[inv.contractorId].totalSpend += price * qty
    supplierSpendRaw[inv.contractorId].invoiceIds.add(line.faktura_id)
    supplierSpendRaw[inv.contractorId].lineCount++
    supplierSpendRaw[inv.contractorId].productKeys.add(productKey)
  }

  if (noPriceCount > 0) {
    warnings.push(`${noPriceCount} pozycji bez ceny zostało pominiętych.`)
  }

  if (queryNorm && Object.keys(productGroups).length === 0) {
    return {
      ...emptyResult(productQuery, `Nie znalazłem zakupów pasujących do produktu „${productQuery}".`),
      warnings,
    }
  }

  // Per-product, per-supplier stats
  const productSupplierStats = {}
  for (const [productKey, group] of Object.entries(productGroups)) {
    const bySup = {}
    for (const p of group.purchases) {
      if (!bySup[p.contractorId]) {
        bySup[p.contractorId] = { name: p.contractor, entries: [] }
      }
      bySup[p.contractorId].entries.push({ price: p.price, date: p.date })
    }

    const supplierStats = {}
    for (const [sid, sd] of Object.entries(bySup)) {
      const sortedEntries = [...sd.entries].sort((a, b) => a.date.localeCompare(b.date))
      const prices = sd.entries.map(e => e.price)
      const avgPrice = prices.reduce((s, p) => s + p, 0) / prices.length
      const minPrice = Math.min(...prices)
      const maxPrice = Math.max(...prices)
      const lastEntry = sortedEntries[sortedEntries.length - 1]
      supplierStats[sid] = {
        name: sd.name,
        avgPrice,
        minPrice,
        maxPrice,
        lastPrice: lastEntry.price,
        lastDate: lastEntry.date,
        count: prices.length,
      }
    }
    productSupplierStats[productKey] = { name: group.name, towarId: group.towarId, suppliers: supplierStats }
  }

  // comparableProducts: products with >= 2 suppliers
  const comparableProducts = []
  for (const [, pstat] of Object.entries(productSupplierStats)) {
    const supKeys = Object.keys(pstat.suppliers)
    if (supKeys.length < 2) continue

    const supList = supKeys.map(sid => ({ id: sid, ...pstat.suppliers[sid] }))
    supList.sort((a, b) => a.avgPrice - b.avgPrice)
    const cheapest = supList[0]
    const mostExpensive = supList[supList.length - 1]
    const diffPLN = mostExpensive.avgPrice - cheapest.avgPrice
    const diffPct = cheapest.avgPrice > 0 ? (diffPLN / cheapest.avgPrice) * 100 : 0
    const purchaseCount = supList.reduce((s, su) => s + su.count, 0)

    comparableProducts.push({
      name: pstat.name,
      supplierCount: supKeys.length,
      cheapestSupplier: cheapest.name,
      mostExpensiveSupplier: mostExpensive.name,
      minAvgPrice: cheapest.avgPrice,
      maxAvgPrice: mostExpensive.avgPrice,
      diffPLN,
      diffPct,
      purchaseCount,
    })
  }
  comparableProducts.sort((a, b) => b.diffPLN - a.diffPLN)

  // Supplier priceIndex: for each comparable product compute median of supplier avgs,
  // then per-supplier priceIndex = supplierAvg / median
  const supplierPriceIndexContribs = {}
  const supplierNames = {}

  for (const [, pstat] of Object.entries(productSupplierStats)) {
    const supKeys = Object.keys(pstat.suppliers)
    if (supKeys.length < 2) continue

    const avgPrices = supKeys.map(sid => pstat.suppliers[sid].avgPrice)
    const med = median(avgPrices)
    if (med <= 0) continue

    for (const sid of supKeys) {
      const pi = pstat.suppliers[sid].avgPrice / med
      if (!supplierPriceIndexContribs[sid]) supplierPriceIndexContribs[sid] = []
      supplierPriceIndexContribs[sid].push(pi)
      supplierNames[sid] = pstat.suppliers[sid].name
    }
  }

  // Supplier ranking by average priceIndex
  const supplierRanking = Object.entries(supplierPriceIndexContribs).map(([sid, contribs]) => {
    const priceIndex = contribs.reduce((s, v) => s + v, 0) / contribs.length
    const spendData = supplierSpendRaw[sid]
    return {
      contractorId: sid,
      supplier: supplierNames[sid],
      priceIndex: Math.round(priceIndex * 1000) / 1000,
      comparableProductCount: contribs.length,
      purchaseCount: spendData?.lineCount ?? 0,
      totalSpend: spendData?.totalSpend ?? 0,
      invoiceCount: spendData?.invoiceIds?.size ?? 0,
    }
  }).sort((a, b) => a.priceIndex - b.priceIndex)

  // Supplier spend breakdown (all suppliers, including those with only 1 product)
  const supplierSpendBreakdown = Object.entries(supplierSpendRaw)
    .map(([sid, sd]) => ({
      contractorId: sid,
      supplier: sd.name,
      totalSpend: sd.totalSpend,
      invoiceCount: sd.invoiceIds.size,
      lineCount: sd.lineCount,
      productCount: sd.productKeys.size,
    }))
    .sort((a, b) => b.totalSpend - a.totalSpend)

  // Savings opportunities: comparable products with diff > 10% or > 2 PLN
  const savingsOpportunities = comparableProducts
    .filter(p => p.diffPct > 10 || p.diffPLN > 2)
    .map(p => ({
      ...p,
      suggestion: `Rozważ zakup u ${p.cheapestSupplier} zamiast ${p.mostExpensiveSupplier}`,
    }))

  // KPIs
  const totalSpend = supplierSpendBreakdown.reduce((s, sd) => s + sd.totalSpend, 0)
  const cheapestRanked = supplierRanking[0] ?? null
  const mostExpensiveRanked = supplierRanking[supplierRanking.length - 1] ?? null
  const biggestBySpend = supplierSpendBreakdown[0] ?? null
  const maxDiffProduct = comparableProducts[0] ?? null

  const kpis = {
    supplierCount: supplierSpendBreakdown.length,
    comparableProductCount: comparableProducts.length,
    cheapestSupplier: cheapestRanked?.supplier ?? null,
    cheapestPriceIndex: cheapestRanked?.priceIndex ?? null,
    mostExpensiveSupplier: mostExpensiveRanked?.supplier ?? null,
    mostExpensivePriceIndex: mostExpensiveRanked?.priceIndex ?? null,
    biggestSupplierBySpend: biggestBySpend?.supplier ?? null,
    biggestSupplierSpend: biggestBySpend?.totalSpend ?? 0,
    maxPriceDiffProduct: maxDiffProduct?.name ?? null,
    maxPriceDiffPct: maxDiffProduct?.diffPct ?? null,
    savingsCount: savingsOpportunities.length,
    totalSpend,
  }

  const chartData = supplierRanking.map(s => ({
    name: s.supplier.length > 20 ? s.supplier.slice(0, 18) + '…' : s.supplier,
    fullName: s.supplier,
    priceIndex: s.priceIndex,
  }))

  const hasEnoughData = comparableProducts.length > 0

  // Summary text
  let summaryText
  if (!hasEnoughData) {
    if (queryNorm) {
      summaryText = `Nie znalazłem produktu „${productQuery}" kupowanego u minimum dwóch dostawców — brak danych do porównania.`
    } else {
      summaryText = 'Nie mam wystarczających danych do uczciwego porównania dostawców. Potrzebuję produktów kupowanych u minimum dwóch dostawców.'
    }
  } else if (queryNorm) {
    const prod = comparableProducts[0]
    const minFmt = prod.minAvgPrice.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const maxFmt = prod.maxAvgPrice.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const diffFmt = prod.diffPLN.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const diffPctFmt = prod.diffPct.toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    summaryText = `Dla produktu ${prod.name} znalazłem ${prod.supplierCount} dostawców. Najtańszy średnio: ${prod.cheapestSupplier} — ${minFmt} zł. Najdroższy: ${prod.mostExpensiveSupplier} — ${maxFmt} zł. Różnica: ${diffFmt} zł (+${diffPctFmt}%).`
  } else {
    const cnt = supplierRanking.length
    const pcnt = comparableProducts.length
    let text = `Porównałem ${cnt} dostawców na podstawie ${pcnt} produkt${pcnt === 1 ? 'u' : 'ów'} kupowanych u minimum dwóch dostawców.`
    if (cheapestRanked) {
      const pi = cheapestRanked.priceIndex.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      text += ` Najtańszy wg indeksu cenowego: ${cheapestRanked.supplier} — ${pi} względem mediany.`
    }
    if (mostExpensiveRanked && mostExpensiveRanked.contractorId !== cheapestRanked?.contractorId) {
      const pi = mostExpensiveRanked.priceIndex.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      text += ` Najdroższy: ${mostExpensiveRanked.supplier} — ${pi}.`
    }
    if (maxDiffProduct) {
      const minFmt = maxDiffProduct.minAvgPrice.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      const maxFmt = maxDiffProduct.maxAvgPrice.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      const pctFmt = maxDiffProduct.diffPct.toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
      text += ` Największa różnica cen: ${maxDiffProduct.name} — ${minFmt} zł vs ${maxFmt} zł (+${pctFmt}%).`
    }
    summaryText = text
  }

  if (invoiceLines.length >= 9000) {
    warnings.push('Pobrano limit pozycji — analiza może być niekompletna.')
  }
  if (invoices.length >= 900) {
    warnings.push('Pobrano limit faktur — analiza może być niekompletna.')
  }

  return {
    summaryText,
    kpis,
    supplierRanking,
    comparableProducts,
    savingsOpportunities,
    supplierSpendBreakdown,
    chartData,
    warnings,
    hasEnoughData,
    productQuery: productQuery ?? null,
  }
}
