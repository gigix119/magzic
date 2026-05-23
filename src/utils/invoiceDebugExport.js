import { anonymizeInvoiceText } from './invoiceDatasetBuilder.js'

export function redactDebugText(text) {
  if (!text) return ''
  return anonymizeInvoiceText(String(text))
}

export function summarizeLayoutLines(lines) {
  if (!Array.isArray(lines)) return []
  return lines.map((line, idx) => ({
    idx,
    y: line.y,
    text: redactDebugText(line.text || ''),
    itemCount: (line.items || []).length,
    hasPrice: /\d+[.,]\d{2}/.test(line.text || ''),
    hasNumber: /\d/.test(line.text || ''),
  }))
}

export function buildInvoiceDebugExport(extractionResult) {
  if (!extractionResult) return null

  const rawText = extractionResult.rawText || ''
  let rawTextHash = 0
  for (let i = 0; i < Math.min(rawText.length, 1000); i++) {
    rawTextHash = ((rawTextHash * 31) + rawText.charCodeAt(i)) >>> 0
  }

  const layout = extractionResult._debugLayout || null
  const pages = layout?.pages || []

  return {
    parserVersion: '2.1.0',
    exportedAt: new Date().toISOString(),
    fileName: extractionResult._fileName || 'unknown',
    documentType: extractionResult.documentType || 'unknown',
    confidence: extractionResult.confidence || 0,
    rawTextHash: rawTextHash.toString(16),
    pagesCount: pages.length || extractionResult.debug?.pages || 0,
    source: extractionResult.source || 'unknown',

    fields: {
      hasNumer: !!extractionResult.fields?.numer,
      hasDataZakupu: !!extractionResult.fields?.data_zakupu,
      hasNip: !!extractionResult.fields?.kontrahent_nip,
      pozycjeCount: (extractionResult.fields?.pozycje || []).length,
    },

    layoutSummary: pages.map(page => ({
      pageNum: page.pageNum,
      lineCount: (page.lines || []).length,
      lines: summarizeLayoutLines(page.lines || []),
    })),

    parsedItems: (extractionResult.fields?.pozycje || []).map((item, i) => ({
      idx: i,
      rawName: item.rawName || item.nazwa || '',
      itemType: item.itemType,
      cenaNetto: item.cenaNetto || item.unitPriceNet || 0,
      ilosc: item.ilosc || item.quantity,
      jednostka: item.jednostka || item.unit,
      confidence: item.confidence,
      warnings: item.warnings || [],
      recoveredAmount: item.recoveredAmount || false,
      shouldAffectInventory: item.shouldAffectInventory,
      source: item.source || 'standard',
    })),

    debug: {
      tableCandidatesCount: extractionResult.debug?.tableCandidates || 0,
      tableSelected: extractionResult.debug?.tableSelected || null,
      columnMap: extractionResult.debug?.columnMap || {},
      rowParseErrors: extractionResult.debug?.rowParseErrors || 0,
      usedTemplate: extractionResult.debug?.usedTemplate || null,
      ksefComarchDetected: extractionResult.debug?.ksefComarchDetected || false,
      ksefItemsFound: extractionResult.debug?.ksefItemsFound || 0,
      amountRecoveryAttempts: extractionResult.debug?.amountRecoveryAttempts || 0,
    },

    ignoredLines: (extractionResult.debug?.ignoredLines || []).map(l =>
      typeof l === 'string'
        ? { text: redactDebugText(l), reason: 'forbidden' }
        : { text: redactDebugText(l.text || ''), reason: l.reason || 'forbidden' }
    ),

    validation: {
      errors: extractionResult.validation?.errors || [],
      warnings: extractionResult.validation?.warnings || [],
      suggestedAction: extractionResult.validation?.suggestedAction || null,
    },
  }
}

export function downloadInvoiceDebugJson(debugData, fileName) {
  if (!debugData) return
  const json = JSON.stringify(debugData, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `invoice-debug-${(fileName || 'export').replace(/[^a-z0-9]/gi, '_')}-${Date.now()}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
