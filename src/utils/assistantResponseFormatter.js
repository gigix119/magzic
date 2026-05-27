export function formatPLN(value) {
  const n = typeof value === 'number' && isFinite(value) ? value : 0
  return n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' zł'
}

function invoicePluralLabel(n) {
  if (n === 1) return 'fakturze'
  return 'fakturach'
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
