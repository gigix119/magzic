const KEYS = {
  aliases: 'magzic_product_aliases',
  supplierMappings: 'magzic_supplier_item_mappings',
  typicalPrices: 'magzic_typical_prices',
}

function getStore(key) {
  try { return JSON.parse(localStorage.getItem(key) || '{}') } catch { return {} }
}

function saveStore(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)) } catch { /* quota */ }
}

export function rememberProductAlias(rawName, productId) {
  if (!rawName || !productId) return
  const aliases = getStore(KEYS.aliases)
  aliases[rawName.toLowerCase().trim()] = { productId, addedAt: new Date().toISOString() }
  saveStore(KEYS.aliases, aliases)
}

export function findProductByAlias(rawName) {
  if (!rawName) return null
  try {
    const aliases = getStore(KEYS.aliases)
    return aliases[rawName.toLowerCase().trim()]?.productId || null
  } catch { return null }
}

export function rememberSupplierItemName(supplierNip, rawName, productId) {
  if (!supplierNip || !rawName || !productId) return
  const mappings = getStore(KEYS.supplierMappings)
  if (!mappings[supplierNip]) mappings[supplierNip] = {}
  mappings[supplierNip][rawName.toLowerCase().trim()] = productId
  saveStore(KEYS.supplierMappings, mappings)
}

export function getSupplierItemMapping(supplierNip, rawName) {
  if (!supplierNip || !rawName) return null
  try {
    const mappings = getStore(KEYS.supplierMappings)
    return mappings[supplierNip]?.[rawName.toLowerCase().trim()] || null
  } catch { return null }
}

export function rememberTypicalPrice(productId, supplierId, price) {
  if (!productId || !supplierId || !price) return
  const prices = getStore(KEYS.typicalPrices)
  const key = `${productId}_${supplierId}`
  if (!prices[key]) prices[key] = []
  prices[key].push({ price: Number(price), date: new Date().toISOString() })
  if (prices[key].length > 10) prices[key] = prices[key].slice(-10)
  saveStore(KEYS.typicalPrices, prices)
}

export function getTypicalPrice(productId, supplierId) {
  if (!productId || !supplierId) return null
  try {
    const prices = getStore(KEYS.typicalPrices)
    const history = prices[`${productId}_${supplierId}`] || []
    if (!history.length) return null
    const avg = history.reduce((s, h) => s + h.price, 0) / history.length
    return { avg, last: history[history.length - 1].price, count: history.length }
  } catch { return null }
}
