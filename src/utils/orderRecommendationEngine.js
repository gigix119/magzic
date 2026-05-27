import { buildLowStockAnalysis } from './lowStockAnalyticsEngine'

function safeNum(v) {
  const n = Number(v)
  return isFinite(n) ? n : 0
}

function emptyKpis() {
  return {
    orderCount: 0,
    criticalCount: 0,
    watchCount: 0,
    estimatedOrderCost: null,
    topItemName: null,
    topItemCost: null,
    topSupplierName: null,
    topSupplierCost: 0,
    noPriceCount: 0,
    noSupplierCount: 0,
  }
}

export function buildOrderRecommendations({
  products = [],
  stockRows = [],
  recentInvoiceLines = [],
  recentInvoices = [],
} = {}) {
  const lowStock = buildLowStockAnalysis({ products, stockRows, recentInvoiceLines, recentInvoices })

  // If nothing below minimum, return watchList only
  if (!lowStock.belowMinimum.length) {
    let summaryText = 'Nie znalazłem produktów poniżej minimum, więc nie mam teraz konkretnej listy do zamówienia.'
    if (lowStock.nearMinimum.length > 0) {
      summaryText += ` ${lowStock.nearMinimum.length} produkt${lowStock.nearMinimum.length === 1 ? '' : 'ów'} jest blisko progu — warto obserwować.`
    }
    return {
      summaryText,
      kpis: emptyKpis(),
      orderItems: [],
      criticalItems: [],
      supplierGroups: [],
      watchList: lowStock.nearMinimum,
      chartData: [],
      warnings: lowStock.warnings,
      hasEnoughData: false,
    }
  }

  // orderItems = belowMinimum with suggestedQty = missing
  const orderItems = lowStock.belowMinimum.map(p => ({
    ...p,
    suggestedQty: p.missing,
  }))

  const criticalItems = lowStock.criticalItems
  const watchList = lowStock.nearMinimum

  // Supplier grouping
  const supplierMap = {}
  for (const item of orderItems) {
    const key = item.lastSupplier ?? 'Nieznany dostawca'
    if (!supplierMap[key]) {
      supplierMap[key] = { supplier: key, count: 0, totalCost: 0, items: [] }
    }
    supplierMap[key].count++
    supplierMap[key].totalCost += safeNum(item.estimatedCost)
    supplierMap[key].items.push(item.name)
  }

  const supplierGroups = Object.values(supplierMap)
    .sort((a, b) => b.totalCost - a.totalCost)

  // Chart: top 10 by estimated cost or missing qty
  const withCost = orderItems.filter(p => p.estimatedCost != null && p.estimatedCost > 0)
  const useCost = withCost.length > 0

  const chartData = [...orderItems]
    .sort(useCost
      ? (a, b) => safeNum(b.estimatedCost) - safeNum(a.estimatedCost)
      : (a, b) => b.missing - a.missing)
    .slice(0, 10)
    .map(p => ({
      name: p.name.length > 18 ? p.name.slice(0, 16) + '…' : p.name,
      fullName: p.name,
      value: useCost ? safeNum(p.estimatedCost) : p.missing,
    }))

  // KPIs
  const totalCost = withCost.reduce((s, p) => s + safeNum(p.estimatedCost), 0)
  const noPriceCount = orderItems.filter(p => p.lastPrice == null).length
  const noSupplierCount = orderItems.filter(p => p.lastSupplier == null).length

  const topByOrder = [...orderItems].sort((a, b) => b.missing - a.missing)[0] ?? null
  const topSupplierGroup = supplierGroups[0] ?? null

  const kpis = {
    orderCount: orderItems.length,
    criticalCount: criticalItems.length,
    watchCount: watchList.length,
    estimatedOrderCost: totalCost > 0 ? totalCost : null,
    topItemName: topByOrder?.name ?? null,
    topItemCost: topByOrder?.estimatedCost ?? null,
    topSupplierName: topSupplierGroup?.supplier ?? null,
    topSupplierCost: topSupplierGroup?.totalCost ?? 0,
    noPriceCount,
    noSupplierCount,
  }

  const warnings = [...(lowStock.warnings ?? [])]
  if (noPriceCount > 0) {
    warnings.push(`${noPriceCount} produkt${noPriceCount === 1 ? '' : 'ów'} nie ma historii ceny zakupu.`)
  }
  if (noSupplierCount > 0) {
    warnings.push(`${noSupplierCount} produkt${noSupplierCount === 1 ? '' : 'ów'} nie ma przypisanego ostatniego dostawcy.`)
  }

  // Summary text
  const fmtPLN = v => safeNum(v).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' zł'

  let summaryText = `Do zamówienia mam ${orderItems.length} produkt${orderItems.length === 1 ? '' : 'ów'}`
  if (criticalItems.length > 0) {
    summaryText += `, z czego ${criticalItems.length} ${criticalItems.length === 1 ? 'jest krytyczny' : 'są krytyczne'}`
  }
  summaryText += '.'

  if (kpis.estimatedOrderCost != null) {
    summaryText += ` Szacowany koszt uzupełnienia: ${fmtPLN(kpis.estimatedOrderCost)}.`
  }

  if (topByOrder) {
    summaryText += ` Najpilniejsze: ${topByOrder.name} — brakuje ${topByOrder.missing} ${topByOrder.unit}.`
    if (topByOrder.lastSupplier) {
      summaryText += ` Ostatni dostawca: ${topByOrder.lastSupplier}.`
    }
  }

  return {
    summaryText,
    kpis,
    orderItems,
    criticalItems,
    supplierGroups,
    watchList,
    chartData,
    warnings,
    hasEnoughData: true,
  }
}
