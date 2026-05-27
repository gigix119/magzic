export function formatLowStockResponse(analysis) {
  if (!analysis?.hasEnoughData) {
    return 'Nie znalazłem produktów poniżej minimum magazynowego. Sprawdź, czy towary mają ustawione minimum.'
  }

  const { kpis } = analysis
  const parts = []

  parts.push(`Poniżej minimum: ${kpis.belowCount} produkt${kpis.belowCount === 1 ? '' : 'ów'}.`)

  if ((kpis.criticalCount ?? 0) > 0) {
    parts.push(`Krytyczne: ${kpis.criticalCount}.`)
  }

  if (kpis.topMissingName) {
    parts.push(`Największy brak: ${kpis.topMissingName} — brakuje ${kpis.topMissingQty.toLocaleString('pl-PL')} szt.`)
  }

  if (kpis.estimatedRestockCost != null && kpis.estimatedRestockCost > 0) {
    parts.push(`Szacowany koszt uzupełnienia: ${formatPLN(kpis.estimatedRestockCost)}.`)
  }

  return parts.join(' ')
}

export function formatPLN(value) {
  const n = typeof value === 'number' && isFinite(value) ? value : 0
  return n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' zł'
}

function invoicePluralLabel(n) {
  if (n === 1) return 'fakturze'
  return 'fakturach'
}

export function formatInvoiceComparisonResponse(comparison) {
  if (!comparison?.hasEnoughData) {
    return 'Nie mam jeszcze dwóch faktur zakupowych do porównania w tym workspace.'
  }

  const { kpis, invoiceAInfo, invoiceBInfo, priceChanges = [] } = comparison
  const parts = []

  const diffAbs = Math.abs(kpis.diffBrutto)
  const diffPctAbs = Math.abs(kpis.diffBruttoPct)
  const diffLabel = kpis.diffBrutto > 0.005 ? 'droższa' : kpis.diffBrutto < -0.005 ? 'tańsza' : 'o tej samej wartości'

  let line = `Ostatnia faktura (${invoiceBInfo.numer}) jest ${diffLabel}`
  if (Math.abs(kpis.diffBrutto) > 0.005) {
    line += ` o ${formatPLN(diffAbs)} brutto (${diffPctAbs.toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%).`
  } else {
    line += '.'
  }
  parts.push(line)

  if ((kpis.matchedCount ?? 0) > 0) parts.push(`Dopasowałem ${kpis.matchedCount} pozycji.`)
  if ((kpis.onlyBCount ?? 0) > 0) parts.push(`Nowe pozycje: ${kpis.onlyBCount}.`)
  if ((kpis.onlyACount ?? 0) > 0) parts.push(`Brakuje ${kpis.onlyACount} pozycji z poprzedniej.`)

  if (priceChanges.length > 0) {
    const top = priceChanges[0]
    const sign = top.priceDiffPct >= 0 ? '+' : ''
    parts.push(
      `Największa zmiana ceny: ${top.name} — ${sign}${top.priceDiffPct.toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%.`
    )
  }

  return parts.join(' ')
}

export function formatLatestPriceChangesResponse(priceChanges, periodLabel = 'ostatnich 180 dniach') {
  if (!priceChanges?.hasEnoughData) {
    return `Nie znalazłem wystarczających danych do analizy zmian cen w ${periodLabel}. Potrzebne są co najmniej 2 zakupy tego samego produktu.`
  }

  const { kpis } = priceChanges
  const parts = []

  parts.push(
    `W ${periodLabel} śledziłem ${kpis.totalTracked} produkt${kpis.totalTracked === 1 ? '' : 'ów'} z historią cen.`
  )

  if (kpis.increaseCount > 0) {
    parts.push(`Zdrożało: ${kpis.increaseCount} produkt${kpis.increaseCount === 1 ? '' : 'ów'}.`)
  }
  if (kpis.decreaseCount > 0) {
    parts.push(`Potaniało: ${kpis.decreaseCount} produkt${kpis.decreaseCount === 1 ? '' : 'ów'}.`)
  }
  if (kpis.anomalyCount > 0) {
    parts.push(`Anomalie cenowe (>15%): ${kpis.anomalyCount}.`)
  }
  if (kpis.maxIncreasePct > 0) {
    parts.push(`Największy wzrost: +${kpis.maxIncreasePct.toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%.`)
  }

  return parts.join(' ')
}

export function formatPurchaseDashboardResponse(dashboard, periodLabel = 'ostatnich 30 dniach') {
  if (!dashboard?.hasEnoughData) {
    return `Nie znalazłem faktur zakupowych w ${periodLabel}. Sprawdź, czy faktury zostały dodane i nie są anulowane.`
  }

  const { kpis, warnings = [] } = dashboard
  const parts = []

  const bruttoStr = formatPLN(kpis.totalBrutto)
  const nettoStr = formatPLN(kpis.totalNetto)
  const hasBothAmounts = Math.abs((kpis.totalBrutto ?? 0) - (kpis.totalNetto ?? 0)) > 0.01

  parts.push(
    `W ${periodLabel} zakupy wyniosły ${bruttoStr} brutto` +
    (hasBothAmounts ? ` (${nettoStr} netto)` : '') +
    ` na ${kpis.invoiceCount} ${invoicePluralLabel(kpis.invoiceCount)}.`
  )

  if ((kpis.supplierCount ?? 0) > 0) {
    const label = kpis.supplierCount === 1 ? 'dostawcy' : 'dostawców'
    parts.push(`Zakupy od ${kpis.supplierCount} ${label}.`)
  }

  if (kpis.topSupplierName) {
    parts.push(`Największy dostawca: ${kpis.topSupplierName} — ${(kpis.topSupplierShare ?? 0).toFixed(1)}% wartości.`)
  }

  if (kpis.topProductName) {
    parts.push(`Największa pozycja kosztowo: ${kpis.topProductName} — ${formatPLN(kpis.topProductSpend)}.`)
  }

  if (warnings.length > 0) {
    parts.push(`Uwaga: ${warnings.join(' ')}`)
  }

  return parts.join(' ')
}
