function safeNum(v) {
  const n = Number(v)
  return isFinite(n) ? n : 0
}

function formatDay(iso) {
  if (!iso || iso.length < 10) return iso ?? ''
  const parts = iso.slice(0, 10).split('-')
  return `${parts[2]}.${parts[1]}`
}

function emptyKpis() {
  return {
    totalNetto: 0, totalBrutto: 0,
    invoiceCount: 0, lineCount: 0, supplierCount: 0, avgInvoice: 0,
    topSupplierName: null, topSupplierShare: 0,
    topProductName: null, topProductSpend: 0,
  }
}

export function buildPurchaseDashboard({ invoices = [], invoiceLines = [] }) {
  const warnings = []

  if (!invoices.length) {
    return {
      summaryText: '',
      kpis: emptyKpis(),
      supplierBreakdown: [],
      topProductsBySpend: [],
      purchasesOverTime: [],
      warnings,
      hasEnoughData: false,
    }
  }

  if (!invoiceLines.length) {
    warnings.push('Faktury nie zawierają pozycji — analiza produktów i kwot zakupów niedostępna')
  }

  // Build fast lookups
  const invoiceSupplierMap = {}
  const invoiceDateMap = {}
  for (const inv of invoices) {
    invoiceSupplierMap[inv.id] = inv.kontrahent_id
    invoiceDateMap[inv.id] = (inv.data_zakupu ?? '').slice(0, 10)
  }

  // --- Totals ---
  let totalNetto = 0
  let totalBrutto = 0
  for (const line of invoiceLines) {
    const netto = safeNum(line.ilosc) * safeNum(line.cena_netto)
    const vatRate = (safeNum(line.vat_procent) || 23) / 100
    totalNetto += netto
    totalBrutto += netto * (1 + vatRate)
  }

  // --- Supplier breakdown ---
  const supplierMap = {}
  for (const inv of invoices) {
    const sid = inv.kontrahent_id ?? '__unknown__'
    const sname = inv.kontrahenci?.nazwa ?? 'Nieznany dostawca'
    if (!supplierMap[sid]) supplierMap[sid] = { name: sname, invoiceCount: 0, totalNetto: 0, totalBrutto: 0 }
    supplierMap[sid].invoiceCount++
  }

  for (const line of invoiceLines) {
    const sid = invoiceSupplierMap[line.faktura_id] ?? '__unknown__'
    if (!supplierMap[sid]) continue
    const netto = safeNum(line.ilosc) * safeNum(line.cena_netto)
    const vatRate = (safeNum(line.vat_procent) || 23) / 100
    supplierMap[sid].totalNetto += netto
    supplierMap[sid].totalBrutto += netto * (1 + vatRate)
  }

  const supplierBreakdown = Object.values(supplierMap)
    .sort((a, b) => b.totalNetto - a.totalNetto)
    .slice(0, 10)
    .map(s => ({
      ...s,
      share: totalNetto > 0 ? (s.totalNetto / totalNetto * 100) : 0,
    }))

  // --- Products by spend ---
  const productMap = {}
  for (const line of invoiceLines) {
    const pname = line.towary?.nazwa ?? line.raw_name ?? null
    if (!pname) continue
    const pid = line.towar_id ?? `raw:${pname.trim().toLowerCase()}`
    if (!productMap[pid]) {
      productMap[pid] = { name: pname, totalNetto: 0, totalBrutto: 0, quantity: 0, purchaseCount: 0, lastPrice: 0 }
    }
    const netto = safeNum(line.ilosc) * safeNum(line.cena_netto)
    const vatRate = (safeNum(line.vat_procent) || 23) / 100
    productMap[pid].totalNetto += netto
    productMap[pid].totalBrutto += netto * (1 + vatRate)
    productMap[pid].quantity += safeNum(line.ilosc)
    productMap[pid].purchaseCount++
    if (safeNum(line.cena_netto) > 0) productMap[pid].lastPrice = safeNum(line.cena_netto)
  }

  const topProductsBySpend = Object.values(productMap)
    .sort((a, b) => b.totalNetto - a.totalNetto)
    .slice(0, 10)

  // --- Purchases over time ---
  const dateAggMap = {}
  for (const inv of invoices) {
    const day = (inv.data_zakupu ?? '').slice(0, 10)
    if (!day) continue
    if (!dateAggMap[day]) {
      dateAggMap[day] = { date: formatDay(day), isoDate: day, totalNetto: 0, totalBrutto: 0, invoiceCount: 0 }
    }
    dateAggMap[day].invoiceCount++
  }
  for (const line of invoiceLines) {
    const day = invoiceDateMap[line.faktura_id]
    if (!day || !dateAggMap[day]) continue
    const netto = safeNum(line.ilosc) * safeNum(line.cena_netto)
    const vatRate = (safeNum(line.vat_procent) || 23) / 100
    dateAggMap[day].totalNetto += netto
    dateAggMap[day].totalBrutto += netto * (1 + vatRate)
  }

  const purchasesOverTime = Object.values(dateAggMap)
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate))

  // --- KPIs ---
  const invoiceCount = invoices.length
  const supplierCount = new Set(invoices.map(f => f.kontrahent_id).filter(Boolean)).size
  const avgInvoice = invoiceCount > 0 ? totalNetto / invoiceCount : 0
  const topSupplier = supplierBreakdown[0]
  const topProduct = topProductsBySpend[0]

  const kpis = {
    totalNetto,
    totalBrutto,
    invoiceCount,
    lineCount: invoiceLines.length,
    supplierCount,
    avgInvoice,
    topSupplierName: topSupplier?.name ?? null,
    topSupplierShare: topSupplier?.share ?? 0,
    topProductName: topProduct?.name ?? null,
    topProductSpend: topProduct?.totalNetto ?? 0,
  }

  return {
    summaryText: '',
    kpis,
    supplierBreakdown,
    topProductsBySpend,
    purchasesOverTime,
    warnings,
    hasEnoughData: true,
  }
}
