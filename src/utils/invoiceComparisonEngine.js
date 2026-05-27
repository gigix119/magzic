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

function lineKey(line) {
  if (line.towar_id) return `id:${line.towar_id}`
  const nk = normalizeKey(line.raw_name ?? line.towary?.nazwa ?? '')
  return nk ? `raw:${nk}` : null
}

function lineName(line) {
  return line.towary?.nazwa ?? line.raw_name ?? '—'
}

function computeLineNetto(line) {
  return safeNum(line.ilosc) * safeNum(line.cena_netto)
}

function computeLineBrutto(line) {
  const netto = computeLineNetto(line)
  const vat = line.vat_procent != null ? safeNum(line.vat_procent) : 23
  return netto * (1 + vat / 100)
}

function aggregateLines(lines) {
  const map = {}
  for (const line of lines) {
    const key = lineKey(line)
    if (!key) continue
    if (!map[key]) {
      map[key] = {
        key,
        name: lineName(line),
        unit: line.towary?.jednostka ?? null,
        totalIlosc: 0,
        totalNetto: 0,
        totalBrutto: 0,
        firstPrice: null,
        lines: [],
      }
    }
    const entry = map[key]
    entry.totalIlosc += safeNum(line.ilosc)
    entry.totalNetto += computeLineNetto(line)
    entry.totalBrutto += computeLineBrutto(line)
    if (entry.firstPrice === null && safeNum(line.cena_netto) > 0) {
      entry.firstPrice = safeNum(line.cena_netto)
    }
    entry.lines.push(line)
  }
  return map
}

function sumLines(lines) {
  let netto = 0
  let brutto = 0
  for (const line of lines) {
    netto += computeLineNetto(line)
    brutto += computeLineBrutto(line)
  }
  return { netto, brutto }
}

const EMPTY = {
  summaryText: 'Nie mam jeszcze dwóch faktur zakupowych do porównania w tym workspace.',
  kpis: null,
  invoiceAInfo: null,
  invoiceBInfo: null,
  totalsDiff: null,
  matchedLines: [],
  onlyInA: [],
  onlyInB: [],
  priceChanges: [],
  quantityChanges: [],
  warnings: [],
  chartData: [],
  hasEnoughData: false,
}

export function compareInvoices({ invoiceA, invoiceB, invoiceALines = [], invoiceBLines = [] } = {}) {
  if (!invoiceA || !invoiceB) return EMPTY

  const warnings = []

  const totalsA = sumLines(invoiceALines)
  const totalsB = sumLines(invoiceBLines)

  const contractorA = invoiceA.kontrahenci?.nazwa ?? 'Nieznany'
  const contractorB = invoiceB.kontrahenci?.nazwa ?? 'Nieznany'

  const invoiceAInfo = {
    id: invoiceA.id,
    numer: invoiceA.numer ?? '—',
    date: (invoiceA.data_zakupu ?? '').slice(0, 10),
    contractor: contractorA,
    netto: totalsA.netto,
    brutto: totalsA.brutto,
    lineCount: invoiceALines.length,
  }

  const invoiceBInfo = {
    id: invoiceB.id,
    numer: invoiceB.numer ?? '—',
    date: (invoiceB.data_zakupu ?? '').slice(0, 10),
    contractor: contractorB,
    netto: totalsB.netto,
    brutto: totalsB.brutto,
    lineCount: invoiceBLines.length,
  }

  if (
    invoiceA.kontrahent_id &&
    invoiceB.kontrahent_id &&
    invoiceA.kontrahent_id !== invoiceB.kontrahent_id
  ) {
    warnings.push(`Faktury pochodzą od różnych kontrahentów: ${contractorA} vs ${contractorB}.`)
  }

  if (!invoiceALines.length || !invoiceBLines.length) {
    warnings.push('Jedna lub obie faktury nie mają pozycji — porównanie pozycji niedostępne.')
  }

  const diffNetto = totalsB.netto - totalsA.netto
  const diffBrutto = totalsB.brutto - totalsA.brutto
  const diffNettoPct = totalsA.netto > 0 ? (diffNetto / totalsA.netto) * 100 : 0
  const diffBruttoPct = totalsA.brutto > 0 ? (diffBrutto / totalsA.brutto) * 100 : 0

  const totalsDiff = { netto: diffNetto, brutto: diffBrutto, nettoPct: diffNettoPct, bruttoPct: diffBruttoPct }

  const mapA = aggregateLines(invoiceALines)
  const mapB = aggregateLines(invoiceBLines)
  const allKeys = new Set([...Object.keys(mapA), ...Object.keys(mapB)])

  const matchedLines = []
  const onlyInA = []
  const onlyInB = []

  for (const key of allKeys) {
    const a = mapA[key]
    const b = mapB[key]

    if (a && b) {
      const priceA = a.firstPrice ?? 0
      const priceB = b.firstPrice ?? 0
      const priceDiff = priceB - priceA
      const priceDiffPct = priceA > 0 ? (priceDiff / priceA) * 100 : 0

      matchedLines.push({
        key,
        name: b.name || a.name,
        unit: b.unit || a.unit,
        iloscA: a.totalIlosc,
        iloscB: b.totalIlosc,
        priceA,
        priceB,
        priceDiff,
        priceDiffPct,
        valueA: a.totalNetto,
        valueB: b.totalNetto,
        valueDiff: b.totalNetto - a.totalNetto,
      })
    } else if (a) {
      onlyInA.push({
        key,
        name: a.name,
        unit: a.unit,
        ilosc: a.totalIlosc,
        price: a.firstPrice ?? 0,
        totalNetto: a.totalNetto,
        totalBrutto: a.totalBrutto,
      })
    } else {
      onlyInB.push({
        key,
        name: b.name,
        unit: b.unit,
        ilosc: b.totalIlosc,
        price: b.firstPrice ?? 0,
        totalNetto: b.totalNetto,
        totalBrutto: b.totalBrutto,
      })
    }
  }

  const priceChanges = matchedLines
    .filter(l => Math.abs(l.priceDiff) > 0.001)
    .sort((a, b) => Math.abs(b.priceDiffPct) - Math.abs(a.priceDiffPct))
    .slice(0, 10)

  const quantityChanges = matchedLines
    .filter(l => Math.abs(l.iloscA - l.iloscB) > 0.001)

  const totalUnmatched = onlyInA.length + onlyInB.length
  if (totalUnmatched > 5 && matchedLines.length < totalUnmatched) {
    warnings.push(`Wiele pozycji nie zostało dopasowanych (${totalUnmatched}) — możliwe różne opisy produktów.`)
  }

  const topPriceChange = priceChanges[0] ?? null

  const kpis = {
    bruttoA: totalsA.brutto,
    bruttoB: totalsB.brutto,
    diffBrutto,
    diffBruttoPct,
    lineCountA: invoiceALines.length,
    lineCountB: invoiceBLines.length,
    matchedCount: matchedLines.length,
    onlyBCount: onlyInB.length,
    onlyACount: onlyInA.length,
    topPriceChangeName: topPriceChange?.name ?? null,
    topPriceChangePct: topPriceChange?.priceDiffPct ?? 0,
  }

  const chartData = [
    { name: 'Poprzednia', value: totalsA.brutto },
    { name: 'Ostatnia', value: totalsB.brutto },
  ]

  // Polish-locale helpers for summaryText
  const fmtPLN = v =>
    safeNum(v).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' zł'
  const fmtPct = v =>
    Math.abs(v).toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'

  const diffLabel = diffBrutto > 0.005 ? 'droższa' : diffBrutto < -0.005 ? 'tańsza' : 'o tej samej wartości'
  let summaryText = `Ostatnia faktura (${invoiceBInfo.numer}) jest ${diffLabel}`
  if (Math.abs(diffBrutto) > 0.005) {
    summaryText += ` o ${fmtPLN(Math.abs(diffBrutto))} brutto (${fmtPct(diffBruttoPct)}).`
  } else {
    summaryText += '.'
  }

  if (matchedLines.length > 0) {
    summaryText += ` Dopasowałem ${matchedLines.length} pozycji.`
  }
  if (onlyInB.length > 0) {
    summaryText += ` Nowe pozycje: ${onlyInB.length}.`
  }
  if (onlyInA.length > 0) {
    summaryText += ` Brakuje ${onlyInA.length} pozycji z poprzedniej.`
  }
  if (topPriceChange) {
    const sign = topPriceChange.priceDiff >= 0 ? '+' : ''
    summaryText += ` Największa zmiana ceny: ${topPriceChange.name} — ${sign}${fmtPct(topPriceChange.priceDiffPct)}.`
  }

  return {
    summaryText,
    kpis,
    invoiceAInfo,
    invoiceBInfo,
    totalsDiff,
    matchedLines,
    onlyInA,
    onlyInB,
    priceChanges,
    quantityChanges,
    warnings,
    chartData,
    hasEnoughData: true,
  }
}
