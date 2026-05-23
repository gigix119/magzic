export function calculateInvoiceQualityMetrics(result) {
  const pozycje = result.fields?.pozycje || []
  const inventoryItems = pozycje.filter(p => p.itemType === 'inventory_item')
  const serviceItems = pozycje.filter(p => p.itemType === 'service_item')
  const costItems = pozycje.filter(p => p.itemType === 'cost_item')
  const unknownItems = pozycje.filter(p => !p.itemType || p.itemType === 'unknown')
  const matchedItems = pozycje.filter(p => p.matchedProductId)
  const strongMatches = pozycje.filter(p => p.matchScore >= 0.85)
  const reviewMatches = pozycje.filter(p => p.matchScore >= 0.65 && p.matchScore < 0.85)

  // Count item-level guard warnings from AI result guard layer
  const aiGuardWarningsCount = pozycje.reduce((sum, p) => {
    const guardWarns = (p.warnings || []).filter(w => String(w).startsWith('Guard:'))
    return sum + guardWarns.length
  }, 0)

  const source = result.source || 'manual'
  const usedAi = source === 'ai' || source.includes('ai')

  return {
    id: crypto.randomUUID(),
    parserVersion: '2.0',
    source,
    documentType: result.documentType || 'unknown',
    confidence: result.confidence || 0,
    suggestedAction: result.validation?.suggestedAction || 'manual_required',
    itemCount: pozycje.length,
    inventoryItemCount: inventoryItems.length,
    serviceItemCount: serviceItems.length,
    costItemCount: costItems.length,
    unknownItemCount: unknownItems.length,
    warningsCount: result.validation?.warnings?.length || 0,
    errorsCount: result.validation?.errors?.length || 0,
    matchedProductCount: matchedItems.length,
    strongMatchCount: strongMatches.length,
    reviewMatchCount: reviewMatches.length,
    weakMatchCount: matchedItems.length - strongMatches.length - reviewMatches.length,
    mathValid: (result.validation?.errors?.length ?? 0) === 0,
    totalsValid: !(result.validation?.warnings || []).some(w => w.includes('Suma')),
    hasSupplierTemplate: !!result.supplierTemplate,
    usedSupplierTemplate: !!result.supplierTemplate,
    supplierTemplate: result.supplierTemplate || null,
    usedAi,
    aiAvailable: usedAi,
    aiGuardWarningsCount,
    createdAt: new Date().toISOString(),
  }
}

export function summarizeQuality(metrics) {
  const lines = []
  if (metrics.confidence >= 85 && metrics.errorsCount === 0 && metrics.unknownItemCount === 0 && metrics.mathValid) {
    lines.push(`Odczyt pewny (${metrics.confidence}%).`)
  } else if (metrics.confidence >= 60) {
    lines.push(`Odczyt częściowy (${metrics.confidence}%) — sprawdź dane.`)
  } else {
    lines.push(`Niska pewność (${metrics.confidence}%) — zalecane ręczne uzupełnienie.`)
  }
  if (metrics.itemCount > 0) {
    lines.push(`${metrics.itemCount} pozycji: ${metrics.inventoryItemCount} towarowych, ${metrics.serviceItemCount} usługowych${metrics.unknownItemCount ? `, ${metrics.unknownItemCount} niepewnych` : ''}.`)
  }
  if (!metrics.mathValid) lines.push('Matematyka: niezgodność — sprawdź wartości.')
  if (metrics.hasSupplierTemplate) lines.push(`Reguły dostawcy: ${metrics.supplierTemplate?.name || 'tak'}.`)
  if (metrics.usedAi) lines.push('Odczyt wspomagany AI.')
  return lines.join(' ')
}

export function getQualityBadge(metrics) {
  if (
    metrics.documentType === 'telecom_invoice' ||
    metrics.documentType === 'utility_invoice' ||
    metrics.documentType === 'service_cost_invoice'
  ) {
    return {
      label: 'Faktura usługowa',
      tone: 'info',
      description: 'Dokument usługowy — pozycje nie trafiają do magazynu.',
      color: '#92400e', bg: '#fef3c7',
    }
  }
  if (metrics.errorsCount > 0 || metrics.confidence < 60) {
    return {
      label: 'Ręczne uzupełnienie',
      tone: 'danger',
      description: 'Błędy lub niska pewność — wymagane ręczne uzupełnienie danych.',
      color: '#991b1b', bg: '#fef2f2',
    }
  }
  if (metrics.confidence < 85 || metrics.unknownItemCount > 0 || !metrics.mathValid) {
    return {
      label: 'Wymaga sprawdzenia',
      tone: 'warning',
      description: 'Dane odczytane, ale wymagają weryfikacji przed zatwierdzeniem.',
      color: '#92400e', bg: '#fffbeb',
    }
  }
  if (metrics.documentType === 'inventory_purchase_invoice') {
    return {
      label: 'Faktura magazynowa',
      tone: 'success',
      description: 'Wszystkie pozycje odczytane poprawnie. Sprawdź przed zatwierdzeniem.',
      color: '#166534', bg: '#f0fdf4',
    }
  }
  return {
    label: 'Bardzo dobry odczyt',
    tone: 'success',
    description: 'Dane odczytane z wysoką pewnością.',
    color: '#166534', bg: '#f0fdf4',
  }
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

export function getQualityWarnings(metrics) {
  const warnings = []
  if (metrics.errorsCount > 0) warnings.push(`${metrics.errorsCount} błąd(ów) walidacji — sprawdź pozycje`)
  if (metrics.unknownItemCount > 0) warnings.push(`${metrics.unknownItemCount} pozycja(e) o nieznanym typie`)
  if (!metrics.mathValid) warnings.push('Niezgodność matematyczna — sprawdź wartości netto')
  if (!metrics.totalsValid) warnings.push('Sumy pozycji nie zgadzają się z sumą faktury')
  if (metrics.documentType === 'unknown') warnings.push('Nieznany typ dokumentu — klasyfikuj ręcznie')
  if (metrics.confidence < 60) warnings.push(`Bardzo niska pewność odczytu (${metrics.confidence}%)`)
  else if (metrics.confidence < 85) warnings.push(`Niska pewność odczytu (${metrics.confidence}%)`)
  if (metrics.aiGuardWarningsCount > 0) warnings.push(`${metrics.aiGuardWarningsCount} ostrzeżeń guard warstwy AI`)
  return warnings
}
