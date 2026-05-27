function safeNum(v) {
  const n = Number(v)
  return isFinite(n) ? n : 0
}

const ISSUE_LABELS = {
  missing_invoice_number: 'Brak numeru faktury',
  missing_invoice_date: 'Brak daty zakupu',
  missing_contractor: 'Brak kontrahenta',
  missing_lines: 'Brak pozycji',
  unmatched_lines: 'Pozycje bez towaru',
  missing_price: 'Pozycje bez ceny',
  missing_quantity: 'Pozycje bez ilości',
  draft_or_incomplete: 'Status roboczy',
}

function detectIssues(invoice, lines) {
  const issues = []

  if (!invoice.numer || !String(invoice.numer).trim()) {
    issues.push({ type: 'missing_invoice_number', count: 1 })
  }

  if (!invoice.data_zakupu) {
    issues.push({ type: 'missing_invoice_date', count: 1 })
  }

  if (!invoice.kontrahent_id) {
    issues.push({ type: 'missing_contractor', count: 1 })
  }

  if (!lines || lines.length === 0) {
    issues.push({ type: 'missing_lines', count: 1 })
    return issues
  }

  const unmatchedCount = lines.filter(l => !l.towar_id).length
  if (unmatchedCount > 0) {
    issues.push({ type: 'unmatched_lines', count: unmatchedCount })
  }

  const noPriceCount = lines.filter(l => safeNum(l.cena_netto) <= 0).length
  if (noPriceCount > 0) {
    issues.push({ type: 'missing_price', count: noPriceCount })
  }

  const noQtyCount = lines.filter(l => safeNum(l.ilosc) <= 0).length
  if (noQtyCount > 0) {
    issues.push({ type: 'missing_quantity', count: noQtyCount })
  }

  if (invoice.status === 'robocza') {
    issues.push({ type: 'draft_or_incomplete', count: 1 })
  }

  return issues
}

function computeSeverity(issues, lines) {
  if (!issues.length) return null

  const types = new Set(issues.map(i => i.type))
  const totalLines = lines?.length ?? 0

  if (types.has('missing_lines')) return 'critical'

  const unmatchedIssue = issues.find(i => i.type === 'unmatched_lines')
  if (unmatchedIssue && totalLines > 0 && unmatchedIssue.count / totalLines >= 0.5) return 'critical'

  const noPriceIssue = issues.find(i => i.type === 'missing_price')
  if (noPriceIssue && totalLines > 0 && noPriceIssue.count / totalLines >= 0.5) return 'critical'

  if (types.has('missing_contractor') || types.has('missing_invoice_number') || types.has('missing_invoice_date')) {
    return 'warning'
  }

  if (types.has('unmatched_lines') || types.has('missing_price') || types.has('missing_quantity')) {
    return 'warning'
  }

  return 'info'
}

function buildSuggestedAction(issues) {
  const types = new Set(issues.map(i => i.type))

  if (types.has('missing_lines')) return 'Dodaj pozycje do faktury.'
  if (types.has('missing_price') && types.has('unmatched_lines')) {
    return 'Uzupełnij ceny i dopasuj towary do pozycji.'
  }
  if (types.has('unmatched_lines')) return 'Uzupełnij brakujące dopasowania towarów.'
  if (types.has('missing_price')) return 'Sprawdź ceny pozycji (cena = 0).'
  if (types.has('missing_quantity')) return 'Uzupełnij ilości pozycji.'
  if (types.has('missing_contractor')) return 'Przypisz kontrahenta do faktury.'
  if (types.has('missing_invoice_number') || types.has('missing_invoice_date')) {
    return 'Uzupełnij numer i datę faktury.'
  }
  if (types.has('draft_or_incomplete')) return 'Sprawdź i zatwierdź fakturę.'
  return 'Zweryfikuj fakturę przed zatwierdzeniem.'
}

function emptyKpis() {
  return {
    reviewedCount: 0,
    reviewCount: 0,
    criticalCount: 0,
    totalIssues: 0,
    unmatchedLinesCount: 0,
    noPriceCount: 0,
    noQtyCount: 0,
    mostCommonIssue: null,
    reviewRatio: 0,
  }
}

export function buildInvoicesNeedingReview({
  invoices = [],
  invoiceLines = [],
} = {}) {
  if (!invoices.length) {
    return {
      summaryText: 'Nie znalazłem faktur do analizy w tym workspace.',
      kpis: emptyKpis(),
      invoicesToReview: [],
      criticalInvoices: [],
      issueBreakdown: [],
      topIssues: [],
      chartData: [],
      warnings: [],
      hasEnoughData: false,
    }
  }

  // Group lines by faktura_id
  const linesByInvoice = {}
  for (const line of invoiceLines) {
    if (!linesByInvoice[line.faktura_id]) linesByInvoice[line.faktura_id] = []
    linesByInvoice[line.faktura_id].push(line)
  }

  const reviewed = []
  const issueCountMap = {}

  for (const invoice of invoices) {
    const lines = linesByInvoice[invoice.id] ?? []
    const issues = detectIssues(invoice, lines)
    const severity = computeSeverity(issues, lines)

    if (!severity) continue

    for (const issue of issues) {
      issueCountMap[issue.type] = (issueCountMap[issue.type] ?? 0) + issue.count
    }

    const contractorName = invoice.kontrahenci?.nazwa ?? null

    reviewed.push({
      id: invoice.id,
      numer: invoice.numer || '(brak numeru)',
      date: invoice.data_zakupu || null,
      contractor: contractorName,
      status: invoice.status,
      typ: invoice.typ,
      lineCount: lines.length,
      issueCount: issues.length,
      issues,
      severity,
      suggestedAction: buildSuggestedAction(issues),
    })
  }

  reviewed.sort((a, b) => {
    const rank = { critical: 0, warning: 1, info: 2 }
    if (rank[a.severity] !== rank[b.severity]) return rank[a.severity] - rank[b.severity]
    return b.issueCount - a.issueCount
  })

  const criticalInvoices = reviewed.filter(i => i.severity === 'critical')

  const issueBreakdown = Object.entries(issueCountMap)
    .map(([type, count]) => ({ type, count, label: ISSUE_LABELS[type] ?? type }))
    .sort((a, b) => b.count - a.count)

  const topIssues = issueBreakdown.slice(0, 5)

  const mostCommonIssue = issueBreakdown[0] ?? null

  const totalUnmatched = issueCountMap['unmatched_lines'] ?? 0
  const totalNoPrice = issueCountMap['missing_price'] ?? 0
  const totalNoQty = issueCountMap['missing_quantity'] ?? 0
  const totalIssues = Object.values(issueCountMap).reduce((s, v) => s + v, 0)

  const kpis = {
    reviewedCount: invoices.length,
    reviewCount: reviewed.length,
    criticalCount: criticalInvoices.length,
    totalIssues,
    unmatchedLinesCount: totalUnmatched,
    noPriceCount: totalNoPrice,
    noQtyCount: totalNoQty,
    mostCommonIssue: mostCommonIssue?.label ?? null,
    reviewRatio: invoices.length > 0 ? Math.round((reviewed.length / invoices.length) * 100) : 0,
  }

  const chartData = [
    { name: 'Krytyczne', value: criticalInvoices.length },
    { name: 'Ostrzeżenia', value: reviewed.filter(i => i.severity === 'warning').length },
    { name: 'Informacje', value: reviewed.filter(i => i.severity === 'info').length },
  ].filter(d => d.value > 0)

  let summaryText = `Przeanalizowałem ${invoices.length} faktur.`
  if (reviewed.length === 0) {
    summaryText += ' Wszystkie faktury wyglądają poprawnie — brak pozycji do weryfikacji.'
  } else {
    summaryText += ` ${reviewed.length} wymaga weryfikacji`
    if (criticalInvoices.length > 0) {
      summaryText += `, w tym ${criticalInvoices.length} krytyczn${criticalInvoices.length === 1 ? 'a' : 'ych'}`
    }
    summaryText += '.'
    if (mostCommonIssue) {
      summaryText += ` Najczęstszy problem: ${mostCommonIssue.label.toLowerCase()} — ${mostCommonIssue.count} wystąpień.`
    }
    const top = reviewed[0]
    if (top) {
      summaryText += ` Najpilniej sprawdź: ${top.numer}${top.contractor ? ` (${top.contractor})` : ''}.`
    }
  }

  return {
    summaryText,
    kpis,
    invoicesToReview: reviewed,
    criticalInvoices,
    issueBreakdown,
    topIssues,
    chartData,
    warnings: [],
    hasEnoughData: reviewed.length > 0,
  }
}
