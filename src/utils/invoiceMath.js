import { normalizePolishNumber } from './polishInvoicePatterns.js'

export function parseMoney(value) {
  return normalizePolishNumber(value)
}

// Polish invoices use period as decimal in quantities: "50.000" = 50, not 50000.
// If all digits after the period are zeros → integer. Otherwise treat as float.
export function parseQuantity(value) {
  if (value === null || value === undefined || value === '') return NaN
  const s = String(value).trim()
  const dotMatch = s.match(/^(\d+)\.(\d+)$/)
  if (dotMatch) {
    const [, intPart, fracPart] = dotMatch
    if (/^0+$/.test(fracPart)) return parseInt(intPart, 10)
    return parseFloat(s)
  }
  return normalizePolishNumber(s)
}

export function normalizeVatRate(input) {
  if (input === null || input === undefined || input === '') return null
  const s = String(input).trim()
  if (/^(zw|zwoln|np)/i.test(s)) return 0
  const numMatch = s.match(/^(\d+(?:[.,]\d+)?)/)
  if (numMatch) {
    const num = parseFloat(numMatch[1].replace(',', '.'))
    if (num <= 100) return num
  }
  return null
}

export function roundMoney(value) {
  return Math.round(value * 100) / 100
}

export function calculateFromNet(unitPriceNet, quantity, vatRate) {
  const lineTotalNet = roundMoney(unitPriceNet * quantity)
  const vatAmount = roundMoney(lineTotalNet * vatRate / 100)
  const lineTotalGross = roundMoney(lineTotalNet + vatAmount)
  const unitPriceGross = roundMoney(unitPriceNet * (1 + vatRate / 100))
  return { unitPriceNet, unitPriceGross, lineTotalNet, lineTotalGross, vatAmount }
}

export function calculateFromGross(unitPriceGross, quantity, vatRate) {
  const lineTotalGross = roundMoney(unitPriceGross * quantity)
  const lineTotalNet = roundMoney(lineTotalGross / (1 + vatRate / 100))
  const vatAmount = roundMoney(lineTotalGross - lineTotalNet)
  const unitPriceNet = roundMoney(unitPriceGross / (1 + vatRate / 100))
  return { unitPriceNet, unitPriceGross, lineTotalNet, lineTotalGross, vatAmount }
}

function _normHeader(s) {
  return String(s).toLowerCase()
    .replace(/[ąćęłńóśźż]/g, c => ({ ą:'a',ć:'c',ę:'e',ł:'l',ń:'n',ó:'o',ś:'s',ź:'z',ż:'z' })[c] || c)
    .trim()
}

export function inferPriceModeFromHeaders(headers) {
  let hasNetto = false
  let hasBrutto = false
  for (const h of (headers || [])) {
    const n = _normHeader(h)
    if (n.includes('netto')) hasNetto = true
    if (n.includes('brutto')) hasBrutto = true
  }
  if (hasNetto && hasBrutto) return 'mixed'
  if (hasNetto) return 'net'
  if (hasBrutto) return 'gross'
  return 'unknown'
}

export function validateLineMath(line) {
  const qty = line.quantity ?? line.ilosc ?? 0
  const unitNet = line.unitPriceNet ?? line.cenaNetto ?? 0
  const totalNet = line.lineTotalNet ?? line.wartoscNetto ?? 0
  if (!qty || !unitNet) return { valid: false, expectedTotal: 0, actualTotal: totalNet, diff: 0 }
  const expectedTotal = roundMoney(qty * unitNet)
  const diff = Math.abs(expectedTotal - totalNet)
  return { valid: diff <= 0.02, expectedTotal, actualTotal: totalNet, diff }
}

export function validateInvoiceTotals(lines, summaryTotals) {
  let sumNet = 0, sumGross = 0, sumVat = 0
  for (const l of (lines || [])) {
    sumNet  += l.lineTotalNet  ?? l.wartoscNetto ?? 0
    sumGross += l.lineTotalGross ?? 0
    sumVat  += l.vatAmount ?? 0
  }
  sumNet   = roundMoney(sumNet)
  sumGross = roundMoney(sumGross)
  sumVat   = roundMoney(sumVat)

  const diffs = {
    net:   roundMoney(Math.abs(sumNet   - (summaryTotals.totalNet   || 0))),
    gross: roundMoney(Math.abs(sumGross - (summaryTotals.totalGross || 0))),
    vat:   roundMoney(Math.abs(sumVat   - (summaryTotals.totalVat   || 0))),
  }

  const tol = 0.05
  const valid = diffs.net <= tol && (sumGross === 0 || diffs.gross <= tol)
  return { valid, sumNet, sumGross, sumVat, diffs }
}
