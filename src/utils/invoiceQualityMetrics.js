export function calculateInvoiceQualityMetrics(result) {
  const pozycje = result.fields?.pozycje || []
  const inventoryItems = pozycje.filter(p => p.itemType === 'inventory_item')
  const serviceItems = pozycje.filter(p => p.itemType === 'service_item')
  const unknownItems = pozycje.filter(p => !p.itemType || p.itemType === 'unknown')
  const matchedItems = pozycje.filter(p => p.matchedProductId)
  const strongMatches = pozycje.filter(p => p.matchScore >= 0.85)
  const reviewMatches = pozycje.filter(p => p.matchScore >= 0.65 && p.matchScore < 0.85)

  return {
    id: crypto.randomUUID(),
    parserVersion: '1.0',
    source: result.source || 'manual',
    documentType: result.documentType || 'unknown',
    confidence: result.confidence || 0,
    suggestedAction: result.validation?.suggestedAction || 'manual_required',
    itemCount: pozycje.length,
    inventoryItemCount: inventoryItems.length,
    serviceItemCount: serviceItems.length,
    unknownItemCount: unknownItems.length,
    warningsCount: result.validation?.warnings?.length || 0,
    errorsCount: result.validation?.errors?.length || 0,
    matchedProductCount: matchedItems.length,
    strongMatchCount: strongMatches.length,
    reviewMatchCount: reviewMatches.length,
    weakMatchCount: matchedItems.length - strongMatches.length - reviewMatches.length,
    mathValid: result.validation?.errors?.length === 0,
    totalsValid: !result.validation?.warnings?.some(w => w.includes('Suma')),
    usedAi: result.source === 'ai' || result.source?.includes('ai'),
    createdAt: new Date().toISOString(),
  }
}

export function getQualityBadge(metrics) {
  if (
    metrics.documentType === 'telecom_invoice' ||
    metrics.documentType === 'utility_invoice' ||
    metrics.documentType === 'service_cost_invoice'
  ) {
    return { label: 'Faktura usługowa', color: '#92400e', bg: '#fef3c7' }
  }
  if (metrics.errorsCount > 0 || metrics.confidence < 60) {
    return { label: 'Ręczne uzupełnienie', color: '#991b1b', bg: '#fef2f2' }
  }
  if (metrics.confidence < 85 || metrics.unknownItemCount > 0 || !metrics.mathValid) {
    return { label: 'Wymaga sprawdzenia', color: '#92400e', bg: '#fffbeb' }
  }
  if (metrics.documentType === 'inventory_purchase_invoice') {
    return { label: 'Faktura magazynowa', color: '#166534', bg: '#f0fdf4' }
  }
  return { label: 'Bardzo dobry odczyt', color: '#166534', bg: '#f0fdf4' }
}

export function shouldRequireManualReview(metrics) {
  return (
    metrics.errorsCount > 0 ||
    metrics.unknownItemCount > 0 ||
    !metrics.mathValid ||
    metrics.documentType === 'unknown' ||
    metrics.confidence < 85
  )
}
