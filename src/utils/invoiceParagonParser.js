import { normalizePolishNumber } from './polishInvoicePatterns.js'
import { roundMoney } from './invoiceMath.js'

// Polish fiscal receipt VAT letter → rate mapping
const VAT_LETTERS = { A: 23, B: 8, C: 5, D: 0, E: 0 }

// Parse a Polish fiscal receipt (PARAGON FISKALNY) text extracted from PDF.
// Returns an object compatible with EMPTY_RESULT().fields + extra receipt fields.
export function parseParagon(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  const items = []
  let totalGross = 0
  let totalVat = 0
  let sellerName = ''
  let sellerNip = ''
  let buyerNip = ''
  let docDate = ''
  let docNumber = ''

  const paragonStart = lines.findIndex(l => /PARAGON\s+FISKALNY/i.test(l))

  // Seller info from lines before "PARAGON FISKALNY"
  for (let i = 0; i < Math.max(paragonStart, 0); i++) {
    const nipMatch = lines[i].match(/NIP[:\s]*([\d-]+)/)
    if (nipMatch) {
      sellerNip = nipMatch[1].replace(/-/g, '')
    } else if (!sellerName && lines[i].length > 3 && !/^\d/.test(lines[i]) && !/^[WB]D/.test(lines[i])) {
      sellerName = lines[i]
    }
  }

  // Item pattern: "NAZWA QTY szt.*PRICE VALUE+LETTER"
  // e.g. "ZAMEK 2 szt.*6.00   12.00A" or "ZAMEK 2 szt.* 6,00 12,00 A"
  const itemRe = /^(.+?)\s+(\d+(?:[.,]\d+)?)\s+szt\.?\s*\*\s*([\d]+[.,]\d{2})\s+([\d\s]+[.,]\d{2})\s*([A-E])$/i

  for (const line of lines) {
    const m = line.match(itemRe)
    if (m) {
      const name = m[1].trim()
      const quantity = parseFloat(m[2].replace(',', '.'))
      const unitPrice = normalizePolishNumber(m[3]) || 0
      const lineTotal = normalizePolishNumber(m[4].replace(/\s+/g, '')) || 0
      const vatLetter = m[5].toUpperCase()
      const vatRate = VAT_LETTERS[vatLetter] ?? 23

      const lineTotalNet = roundMoney(lineTotal / (1 + vatRate / 100))
      const vatAmount = roundMoney(lineTotal - lineTotalNet)
      const unitPriceNet = roundMoney(unitPrice / (1 + vatRate / 100))

      items.push({
        rawName: name,
        nazwa: name,
        jednostka: 'szt',
        unit: 'szt',
        ilosc: quantity,
        quantity,
        unitPriceGross: unitPrice,
        unitPriceNet,
        cenaBrutto: unitPrice,
        cenaNetto: unitPriceNet,
        lineTotalGross: lineTotal,
        lineTotalNet,
        wartoscBrutto: lineTotal,
        wartoscNetto: lineTotalNet,
        totalGross: lineTotal,
        totalNet: lineTotalNet,
        vat: vatRate,
        vatAmount,
        priceSource: 'gross',
        mathValid: Math.abs(quantity * unitPrice - lineTotal) <= 0.02,
        confidence: 0.85,
        warnings: [],
        itemType: 'inventory_item',
        shouldAffectInventory: null,
        matchedProductId: null,
      })
      continue
    }

    // Total gross
    const sumaM = line.match(/(?:DO\s+ZAP[ŁL]ATY|SUMA)\s*:\s*(?:PLN\s*)?([\d\s,.]+)/i)
    if (sumaM) {
      const v = normalizePolishNumber(sumaM[1].replace(/\s+/g, ''))
      if (v && v > 0) totalGross = v
    }

    // VAT total per letter: "Kwota PTU A 23% 3.18"
    const vatM = line.match(/Kwota\s+PTU\s+[A-E]\s+\d+%\s+([\d,.]+)/i)
    if (vatM) totalVat = roundMoney(totalVat + (normalizePolishNumber(vatM[1]) || 0))

    // Buyer NIP (may appear on its own line after "NIP nabywcy:")
    const buyerNipM = line.match(/NIP\s+nabywcy[:\s]*([\d]+)/i)
    if (buyerNipM) buyerNip = buyerNipM[1]
    // Also handle bare NIP line following "NIP nabywcy:" on the previous line
    if (!buyerNip && /^\d{10}$/.test(line) && lines.indexOf(line) > 0) {
      const prev = lines[lines.indexOf(line) - 1]
      if (/NIP\s+nabywcy/i.test(prev)) buyerNip = line
    }

    // Date: DD-MM-YYYY HH:MM
    const dateM = line.match(/(\d{2}-\d{2}-\d{4})\s+\d{2}:\d{2}/)
    if (dateM) {
      const [d, mo, y] = dateM[1].split('-')
      docDate = `${y}-${mo}-${d}`
    }

    // Receipt number
    const numM = line.match(/Nr\s+Sys\.?\s*:\s*(.+)/i)
    if (numM) docNumber = numM[1].trim()
  }

  const computedGross = roundMoney(items.reduce((s, i) => s + i.lineTotalGross, 0))
  const computedNet = roundMoney(items.reduce((s, i) => s + i.lineTotalNet, 0))

  return {
    invoiceNumber: docNumber || 'Paragon',
    documentType: 'paragon',
    priceMode: 'gross',
    sellerName,
    sellerNip,
    buyerNip,
    invoiceDate: docDate,
    lines: items,
    pozycje: items,
    totalNet: computedNet,
    totalVat: totalVat || roundMoney(computedGross - computedNet),
    totalGross: totalGross || computedGross,
    amountDue: totalGross || computedGross,
    currency: 'PLN',
    parserWarnings: [],
    confidence: items.length > 0 ? 85 : 30,
    mathValid: true,
  }
}
