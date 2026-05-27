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

export function buildLatestPriceChanges({ invoices = [], invoiceLines = [], options = {} } = {}) {
  const anomalyThreshold = options.anomalyThreshold ?? 15
  const warnings = []

  if (!invoices.length || !invoiceLines.length) {
    return {
      increases: [],
      decreases: [],
      anomalies: [],
      chartData: [],
      kpis: { totalTracked: 0, increaseCount: 0, decreaseCount: 0, anomalyCount: 0, avgChangePct: 0, maxIncreasePct: 0 },
      warnings,
      hasEnoughData: false,
    }
  }

  // Build invoice date lookup
  const invoiceDateMap = {}
  for (const inv of invoices) {
    invoiceDateMap[inv.id] = inv.data_zakupu ?? ''
  }

  // Group positions by product key
  // Primary: towar_id; fallback: normalizeKey(raw_name)
  const groups = {}

  for (const line of invoiceLines) {
    const date = invoiceDateMap[line.faktura_id]
    if (!date) continue

    const price = safeNum(line.cena_netto)
    if (price <= 0) continue

    let key
    let name
    if (line.towar_id) {
      key = `id:${line.towar_id}`
      name = line.towary?.nazwa ?? line.raw_name ?? String(line.towar_id)
    } else {
      const nk = normalizeKey(line.raw_name)
      if (!nk) continue
      key = `raw:${nk}`
      name = line.raw_name ?? nk
    }

    if (!groups[key]) {
      groups[key] = { key, name, unit: line.towary?.jednostka ?? null, purchases: [] }
    }

    groups[key].purchases.push({ date, price, faktura_id: line.faktura_id })
  }

  const increases = []
  const decreases = []

  for (const group of Object.values(groups)) {
    // Sort ascending by date
    group.purchases.sort((a, b) => a.date.localeCompare(b.date))

    // Deduplicate consecutive same-date same-price entries
    const uniq = []
    for (const p of group.purchases) {
      const last = uniq[uniq.length - 1]
      if (last && last.date === p.date && last.price === p.price) continue
      uniq.push(p)
    }

    if (uniq.length < 2) continue

    const prev = uniq[uniq.length - 2]
    const last = uniq[uniq.length - 1]

    const diff = last.price - prev.price
    const diffPct = (diff / prev.price) * 100

    const entry = {
      key: group.key,
      name: group.name,
      unit: group.unit,
      prevPrice: prev.price,
      lastPrice: last.price,
      prevDate: prev.date,
      lastDate: last.date,
      diff,
      diffPct,
      purchaseCount: uniq.length,
    }

    if (diff > 0) increases.push(entry)
    else if (diff < 0) decreases.push(entry)
  }

  // Sort: increases desc by diffPct, decreases by most decrease first (asc diffPct)
  increases.sort((a, b) => b.diffPct - a.diffPct)
  decreases.sort((a, b) => a.diffPct - b.diffPct)

  const all = [...increases, ...decreases]
  const anomalies = all.filter(e => Math.abs(e.diffPct) > anomalyThreshold)
    .sort((a, b) => Math.abs(b.diffPct) - Math.abs(a.diffPct))

  // Top 10 by abs(diffPct) for chart
  const chartData = [...all]
    .sort((a, b) => Math.abs(b.diffPct) - Math.abs(a.diffPct))
    .slice(0, 10)
    .sort((a, b) => a.diffPct - b.diffPct)
    .map(e => ({
      name: e.name.length > 18 ? e.name.slice(0, 16) + '…' : e.name,
      fullName: e.name,
      diffPct: Math.round(e.diffPct * 10) / 10,
      diff: e.diff,
      lastPrice: e.lastPrice,
      prevPrice: e.prevPrice,
    }))

  const totalTracked = all.length
  const avgChangePct = totalTracked > 0
    ? all.reduce((s, e) => s + e.diffPct, 0) / totalTracked
    : 0
  const maxIncreasePct = increases.length > 0 ? increases[0].diffPct : 0

  if (invoiceLines.length >= 7000) {
    warnings.push('Pobrano limit pozycji faktur — najstarsze dane mogą być niekompletne.')
  }
  if (invoices.length >= 500) {
    warnings.push('Pobrano limit faktur — analiza obejmuje najnowsze 500 dokumentów z 180 dni.')
  }

  return {
    increases: increases.slice(0, 20),
    decreases: decreases.slice(0, 20),
    anomalies: anomalies.slice(0, 10),
    chartData,
    kpis: {
      totalTracked,
      increaseCount: increases.length,
      decreaseCount: decreases.length,
      anomalyCount: anomalies.length,
      avgChangePct: Math.round(avgChangePct * 10) / 10,
      maxIncreasePct: Math.round(maxIncreasePct * 10) / 10,
    },
    warnings,
    hasEnoughData: totalTracked > 0,
  }
}
