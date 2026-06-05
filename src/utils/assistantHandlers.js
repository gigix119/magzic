import {
  fetchAssistantPurchaseDashboardData,
  fetchAssistantPriceChangesData,
  fetchAssistantInvoiceComparisonData,
  fetchAssistantLowStockData,
  fetchAssistantOrderRecommendationData,
  fetchAssistantInvoicesNeedingReviewData,
  fetchAssistantProductPriceHistoryData,
  fetchAssistantSupplierComparisonData,
  fetchAssistantProductSearchData,
  fetchAssistantContractorSearchData,
} from './assistantQueryEngine'
import { buildPurchaseDashboard } from './purchaseAnalyticsEngine'
import { buildLatestPriceChanges } from './priceAnalyticsEngine'
import { compareInvoices } from './invoiceComparisonEngine'
import { buildLowStockAnalysis } from './lowStockAnalyticsEngine'
import { buildOrderRecommendations } from './orderRecommendationEngine'
import { buildInvoicesNeedingReview } from './invoiceReviewEngine'
import { buildProductPriceHistory } from './productPriceHistoryEngine'
import { buildSupplierComparison } from './supplierComparisonEngine'
import {
  formatPurchaseDashboardResponse,
  formatLatestPriceChangesResponse,
  formatInvoiceComparisonResponse,
  formatLowStockResponse,
  formatOrderRecommendationResponse,
  formatInvoicesNeedingReviewResponse,
  formatProductPriceHistoryResponse,
  formatSupplierComparisonResponse,
} from './assistantResponseFormatter'
import { getAssistantResponse, getSmartFallbackSuggestions } from './assistantIntentParser'

async function handlePurchaseDashboard({ workspaceId, entities }) {
  const rawData = await fetchAssistantPurchaseDashboardData({
    workspaceId,
    dateRange: entities?.dateRange ?? {},
  })
  if (rawData.errors.length > 0) {
    return { text: `Błąd pobierania danych: ${rawData.errors.join(' ')}`, structuredData: null }
  }
  if (!rawData.invoices.length) {
    return { text: 'Nie znalazłem faktur zakupowych z ostatnich 30 dni dla tego workspace.', structuredData: null }
  }
  const dashboard = buildPurchaseDashboard(rawData)
  return { text: formatPurchaseDashboardResponse(dashboard), structuredData: dashboard }
}

async function handleLatestPriceChanges({ workspaceId, entities }) {
  const rawData = await fetchAssistantPriceChangesData({
    workspaceId,
    dateRange: entities?.dateRange ?? {},
  })
  if (rawData.errors.length > 0) {
    return { text: `Błąd pobierania danych: ${rawData.errors.join(' ')}`, structuredData: null }
  }
  if (!rawData.invoices.length) {
    return { text: 'Nie znalazłem faktur zakupowych z ostatnich 180 dni dla tego workspace.', structuredData: null }
  }
  const priceChanges = buildLatestPriceChanges(rawData)
  return { text: formatLatestPriceChangesResponse(priceChanges), structuredData: priceChanges }
}

async function handleCompareInvoices({ workspaceId, entities }) {
  const rawData = await fetchAssistantInvoiceComparisonData({
    workspaceId,
    invoiceNumbers: entities?.invoiceNumbers ?? null,
  })
  if (rawData.errors.length > 0) {
    return { text: `Błąd pobierania danych: ${rawData.errors.join(' ')}`, structuredData: null }
  }
  if (!rawData.invoiceA || !rawData.invoiceB) {
    return { text: 'Nie mam jeszcze dwóch faktur zakupowych do porównania w tym workspace.', structuredData: null }
  }
  const comparison = compareInvoices(rawData)
  return { text: formatInvoiceComparisonResponse(comparison), structuredData: comparison }
}

async function handleLowStock({ workspaceId }) {
  const rawData = await fetchAssistantLowStockData({ workspaceId })
  if (rawData.errors.length > 0) {
    return { text: `Błąd pobierania danych: ${rawData.errors.join(' ')}`, structuredData: null }
  }
  if (!rawData.products.length) {
    return { text: 'Nie znalazłem aktywnych towarów w tym workspace.', structuredData: null }
  }
  const analysis = buildLowStockAnalysis(rawData)
  return { text: formatLowStockResponse(analysis), structuredData: analysis }
}

async function handleOrderRecommendation({ workspaceId }) {
  const rawData = await fetchAssistantOrderRecommendationData({ workspaceId })
  if (rawData.errors.length > 0) {
    return { text: `Błąd pobierania danych: ${rawData.errors.join(' ')}`, structuredData: null }
  }
  if (!rawData.products.length) {
    return { text: 'Nie znalazłem aktywnych towarów w tym workspace.', structuredData: null }
  }
  const recommendations = buildOrderRecommendations(rawData)
  return { text: formatOrderRecommendationResponse(recommendations), structuredData: recommendations }
}

async function handleInvoicesNeedingReview({ workspaceId }) {
  const rawData = await fetchAssistantInvoicesNeedingReviewData({ workspaceId })
  if (rawData.errors.length > 0) {
    return { text: `Błąd pobierania danych: ${rawData.errors.join(' ')}`, structuredData: null }
  }
  if (!rawData.invoices.length) {
    return { text: 'Nie znalazłem faktur do analizy w tym workspace.', structuredData: null }
  }
  const review = buildInvoicesNeedingReview(rawData)
  return { text: formatInvoicesNeedingReviewResponse(review), structuredData: review }
}

async function handleProductPriceHistory({ workspaceId, entities }) {
  const productQuery = entities?.productQuery ?? null
  if (!productQuery) {
    const noQuery = buildProductPriceHistory({ productQuery: null })
    return { text: noQuery.summaryText, structuredData: noQuery }
  }
  const rawData = await fetchAssistantProductPriceHistoryData({ workspaceId, productQuery })
  if (rawData.errors.length > 0) {
    return { text: `Błąd pobierania danych: ${rawData.errors.join(' ')}`, structuredData: null }
  }
  const history = buildProductPriceHistory(rawData)
  return { text: formatProductPriceHistoryResponse(history), structuredData: history }
}

async function handleSupplierComparison({ workspaceId, entities }) {
  const productQuery = entities?.productQuery ?? null
  const rawData = await fetchAssistantSupplierComparisonData({ workspaceId, productQuery })
  if (rawData.errors.length > 0) {
    return { text: `Błąd pobierania danych: ${rawData.errors.join(' ')}`, structuredData: null }
  }
  if (!rawData.invoices.length) {
    return { text: 'Nie znalazłem faktur zakupowych z ostatnich 12 miesięcy dla tego workspace.', structuredData: null }
  }
  const comparison = buildSupplierComparison(rawData)
  return { text: formatSupplierComparisonResponse(comparison), structuredData: comparison }
}

async function handleProductSearch({ workspaceId, entities }) {
  const query = entities?.searchQuery
  if (!query) return { text: 'Podaj nazwę towaru do wyszukania.', structuredData: null }
  const rawData = await fetchAssistantProductSearchData({ workspaceId, query })
  if (rawData.errors.length > 0) {
    return { text: `Błąd pobierania danych: ${rawData.errors.join(' ')}`, structuredData: null }
  }
  if (!rawData.results.length) {
    return { text: `Nie znalazłem towaru pasującego do „${query}".`, structuredData: { results: [], query } }
  }
  return {
    text: `Znalazłem ${rawData.results.length} towarów pasujących do „${query}".`,
    structuredData: { results: rawData.results, query },
  }
}

async function handleCreatePriceAlert({ workspaceId, entities }) {
  const alertProduct = entities?.alertProduct
  if (!alertProduct) return { text: 'Podaj nazwę towaru, dla którego chcesz ustawić alert cenowy.', structuredData: null }
  const threshold = entities?.alertThreshold ?? 10
  const rawData = await fetchAssistantProductSearchData({ workspaceId, query: alertProduct })
  if (rawData.errors.length > 0) {
    return { text: `Błąd pobierania danych: ${rawData.errors.join(' ')}`, structuredData: null }
  }
  const top = rawData.results[0]
  if (!top || top.score < 0.2) {
    return {
      text: `Nie znalazłem towaru „${alertProduct}". Sprawdź nazwę.`,
      structuredData: null,
    }
  }
  return {
    text: `Znalazłem: ${top.product.nazwa}. Możesz ustawić alert cenowy przy zmianie o ${threshold}%.`,
    structuredData: {
      matchedProduct: top.product,
      threshold,
      confirmed: false,
      workspaceId,
    },
  }
}

async function handleContractorSearch({ workspaceId, entities }) {
  const query = entities?.contractorQuery
  if (!query) return { text: 'Podaj nazwę kontrahenta lub dostawcy.', structuredData: null }
  const rawData = await fetchAssistantContractorSearchData({ workspaceId, query })
  if (rawData.errors.length > 0) {
    return { text: `Błąd: ${rawData.errors.join(' ')}`, structuredData: null }
  }
  if (!rawData.results.length) {
    return { text: `Nie znalazłem kontrahenta „${query}".`, structuredData: { results: [], query } }
  }
  return {
    text: `Znalazłem ${rawData.results.length} kontrahentów dla „${query}".`,
    structuredData: { results: rawData.results, query },
  }
}

const HANDLERS = {
  purchase_dashboard: handlePurchaseDashboard,
  latest_price_changes: handleLatestPriceChanges,
  compare_invoices: handleCompareInvoices,
  low_stock: handleLowStock,
  order_recommendation: handleOrderRecommendation,
  invoices_needing_review: handleInvoicesNeedingReview,
  product_price_history: handleProductPriceHistory,
  compare_suppliers: handleSupplierComparison,
  product_search: handleProductSearch,
  create_price_alert: handleCreatePriceAlert,
  contractor_search: handleContractorSearch,
}

export async function runAssistantIntent({ intentResult, workspaceId }) {
  const { intent, entities } = intentResult
  if (!workspaceId) {
    return { intent, text: 'Nie mogę wykonać analizy, bo nie wykryłem aktywnego workspace.', structuredData: null }
  }
  const handler = HANDLERS[intent]
  if (!handler) {
    const suggestions = getSmartFallbackSuggestions(intentResult.rawQuery)
    const fallbackText = suggestions.length > 0
      ? `Nie jestem pewien o co pytasz. Może chodziło Ci o:\n${suggestions.map(s => `• ${s}`).join('\n')}\n\nWpisz polecenie lub wybierz z szybkich analiz powyżej.`
      : getAssistantResponse(intentResult)
    return { intent, text: fallbackText, structuredData: null }
  }
  try {
    const result = await handler({ workspaceId, entities })
    return { intent, ...result }
  } catch (err) {
    console.error(`assistantHandlers ${intent}:`, err)
    return { intent, text: 'Wystąpił błąd podczas pobierania danych. Spróbuj ponownie za chwilę.', structuredData: null }
  }
}
