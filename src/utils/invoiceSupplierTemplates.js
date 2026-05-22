const STORAGE_KEY = 'magzic_invoice_supplier_templates'

export function getTemplates() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}

function saveTemplates(templates) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(templates)) } catch { /* quota */ }
}

export function getTemplateForSupplier(nip, name) {
  const templates = getTemplates()
  if (nip) {
    const byNip = templates.find(t => t.supplierNip === nip)
    if (byNip) return byNip
  }
  if (name) {
    const byName = templates.find(t =>
      t.supplierName?.toLowerCase() === name?.toLowerCase()
    )
    if (byName) return byName
  }
  return null
}

export function saveTemplateFromExtraction(result) {
  try {
    if (result.confidence < 70) return null
    if (!result.fields.pozycje.length) return null

    const nip = result.fields.sprzedawca_nip || result.fields.kontrahent_nip
    const name = result.fields.sprzedawca_nazwa || result.fields.kontrahent_nazwa
    if (!nip && !name) return null

    const templates = getTemplates()
    const existing = templates.findIndex(t => t.supplierNip === nip)

    const template = {
      id: existing >= 0 ? templates[existing].id : crypto.randomUUID(),
      supplierNip: nip,
      supplierName: name,
      columnMap: result.debug?.columnMap || {},
      successCount: (templates[existing]?.successCount || 0) + 1,
      lastUsedAt: new Date().toISOString(),
      createdAt: templates[existing]?.createdAt || new Date().toISOString(),
    }

    if (existing >= 0) templates[existing] = template
    else templates.push(template)

    saveTemplates(templates)
    return template
  } catch { return null }
}

export function updateTemplateStats(supplierNip, success) {
  try {
    const templates = getTemplates()
    const idx = templates.findIndex(t => t.supplierNip === supplierNip)
    if (idx < 0) return
    if (success) templates[idx].successCount = (templates[idx].successCount || 0) + 1
    else templates[idx].failureCount = (templates[idx].failureCount || 0) + 1
    saveTemplates(templates)
  } catch { /* ignore */ }
}
