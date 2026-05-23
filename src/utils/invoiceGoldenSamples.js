const GOLDEN_KEY = 'magzic_invoice_golden_samples'

export function validateGoldenSample(sample) {
  if (!sample.name) return { valid: false, error: 'Brak nazwy' }
  if (!sample.documentType) return { valid: false, error: 'Brak documentType' }
  if (!sample.expectedOutput) return { valid: false, error: 'Brak expectedOutput' }
  if (!Array.isArray(sample.expectedOutput?.pozycje)) return { valid: false, error: 'expectedOutput.pozycje musi być tablicą' }
  for (let i = 0; i < (sample.expectedOutput?.pozycje || []).length; i++) {
    const poz = sample.expectedOutput.pozycje[i]
    if (poz.expectedShouldAffectInventory !== undefined && poz.expectedShouldAffectInventory !== null
        && typeof poz.expectedShouldAffectInventory !== 'boolean') {
      return { valid: false, error: `pozycje[${i}].expectedShouldAffectInventory musi być boolean lub null` }
    }
  }
  return { valid: true }
}

export function saveGoldenSample(sample) {
  const samples = getGoldenSamples()
  const validated = validateGoldenSample(sample)
  if (!validated.valid) return { success: false, error: validated.error }

  const newSample = {
    id: sample.id || crypto.randomUUID(),
    name: sample.name,
    supplierName: sample.supplierName,
    supplierNip: sample.supplierNip,
    documentType: sample.documentType,
    category: sample.category,
    inputSample: sample.inputSample || null,
    evaluationHints: sample.evaluationHints || null,
    expectedOutput: {
      documentType: sample.expectedOutput?.documentType,
      pozycjeCount: sample.expectedOutput?.pozycje?.length || 0,
      pozycje: (sample.expectedOutput?.pozycje || []).map(p => ({
        nazwa: p.nazwa,
        rawName: p.rawName || null,
        ilosc: p.ilosc,
        jednostka: p.jednostka,
        cenaNetto: p.cenaNetto,
        // Extended evaluation fields
        expectedItemType: p.expectedItemType || p.itemType || null,
        expectedShouldAffectInventory: p.expectedShouldAffectInventory ?? p.shouldAffectInventory ?? null,
        expectedProductId: p.expectedProductId || null,
        expectedQuantity: p.expectedQuantity ?? p.ilosc ?? null,
        expectedUnit: p.expectedUnit ?? p.jednostka ?? null,
        expectedUnitPriceNet: p.expectedUnitPriceNet ?? p.cenaNetto ?? null,
        expectedVat: p.expectedVat ?? p.vat ?? null,
        expectedTotalNet: p.expectedTotalNet ?? p.wartoscNetto ?? null,
        expectedTotalGross: p.expectedTotalGross ?? p.wartoscBrutto ?? null,
        // Legacy (backward compat)
        itemType: p.itemType || p.expectedItemType || null,
        shouldAffectInventory: p.shouldAffectInventory ?? p.expectedShouldAffectInventory ?? null,
      })),
    },
    tags: sample.tags || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  const idx = samples.findIndex(s => s.id === newSample.id)
  if (idx >= 0) samples[idx] = newSample
  else samples.push(newSample)

  localStorage.setItem(GOLDEN_KEY, JSON.stringify(samples))
  return { success: true, sample: newSample }
}

export function getGoldenSamples() {
  try { return JSON.parse(localStorage.getItem(GOLDEN_KEY) || '[]') } catch { return [] }
}

export function deleteGoldenSample(id) {
  const samples = getGoldenSamples().filter(s => s.id !== id)
  localStorage.setItem(GOLDEN_KEY, JSON.stringify(samples))
}

export function exportGoldenSamples() {
  return JSON.stringify(getGoldenSamples(), null, 2)
}

export function importGoldenSamples(json) {
  try {
    const data = JSON.parse(json)
    if (!Array.isArray(data)) return { success: false, error: 'Oczekiwano tablicy' }
    localStorage.setItem(GOLDEN_KEY, JSON.stringify(data))
    return { success: true, count: data.length }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

export function clearGoldenSamples() {
  try { localStorage.removeItem(GOLDEN_KEY) } catch { /* ignore */ }
}

export function saveGoldenSampleFromExtraction(result, name) {
  const category = result.documentType?.includes('inventory') ? 'inventory'
    : result.documentType?.includes('telecom') ? 'telecom'
    : result.documentType?.includes('service') ? 'service'
    : 'unknown'
  return saveGoldenSample({
    name: name || `Sample ${new Date().toLocaleDateString('pl-PL')}`,
    supplierName: result.fields?.kontrahent_nazwa,
    supplierNip: result.fields?.kontrahent_nip,
    documentType: result.documentType,
    category,
    evaluationHints: {
      supplierType: category,
      expectedProductMatchAvailable: false,
    },
    expectedOutput: {
      documentType: result.documentType,
      pozycje: (result.fields?.pozycje || []).map(p => ({
        ...p,
        rawName: p.rawName || p.nazwa || null,
        expectedItemType: p.itemType || null,
        expectedShouldAffectInventory: p.shouldAffectInventory ?? null,
        expectedProductId: p.matchedProductId || null,
      })),
    },
    tags: [result.source, `conf:${result.confidence}`],
  })
}
