import { Sparkles } from 'lucide-react'
import PurchaseDashboardResult from './results/PurchaseDashboardResult'
import PriceChangesResult from './results/PriceChangesResult'
import CompareInvoicesResult from './results/CompareInvoicesResult'
import LowStockResult from './results/LowStockResult'
import OrderRecommendationResult from './results/OrderRecommendationResult'
import InvoicesNeedingReviewResult from './results/InvoicesNeedingReviewResult'
import ProductPriceHistoryResult from './results/ProductPriceHistoryResult'
import SupplierComparisonResult from './results/SupplierComparisonResult'
import ProductSearchResult from './results/ProductSearchResult'
import CreatePriceAlertResult from './results/CreatePriceAlertResult'
import ContractorSearchResult from './results/ContractorSearchResult'

const INTENT_LABELS = {
  purchase_dashboard: 'Dashboard zakupów',
  compare_invoices: 'Porównanie faktur',
  latest_price_changes: 'Zmiany cen',
  product_price_history: 'Historia ceny',
  compare_suppliers: 'Porównanie dostawców',
  invoices_needing_review: 'Faktury do weryfikacji',
  low_stock: 'Niskie stany',
  order_recommendation: 'Rekomendacja zamówień',
  product_search: 'Wyszukiwarka towarów',
  create_price_alert: 'Alert cenowy',
  contractor_search: 'Wyszukiwarka kontrahentów',
  unknown: null,
}

export default function AssistantResult({ intent, text, structuredData }) {
  if (structuredData) {
    if (intent === 'purchase_dashboard') return <PurchaseDashboardResult dashboard={structuredData} text={text} />
    if (intent === 'latest_price_changes') return <PriceChangesResult priceChanges={structuredData} text={text} />
    if (intent === 'compare_invoices') return <CompareInvoicesResult comparison={structuredData} text={text} />
    if (intent === 'low_stock') return <LowStockResult analysis={structuredData} text={text} />
    if (intent === 'order_recommendation') return <OrderRecommendationResult recommendations={structuredData} text={text} />
    if (intent === 'invoices_needing_review') return <InvoicesNeedingReviewResult review={structuredData} text={text} />
    if (intent === 'product_price_history') return <ProductPriceHistoryResult history={structuredData} text={text} />
    if (intent === 'compare_suppliers') return <SupplierComparisonResult comparison={structuredData} text={text} />
    if (intent === 'product_search') return <ProductSearchResult data={structuredData} />
    if (intent === 'create_price_alert') return <CreatePriceAlertResult data={structuredData} />
    if (intent === 'contractor_search') return <ContractorSearchResult data={structuredData} />
  }

  const label = INTENT_LABELS[intent]
  return (
    <div className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>
      {label && (
        <div className="flex items-center gap-1.5 mb-1.5">
          <Sparkles size={11} style={{ color: '#f59e0b', flexShrink: 0 }} />
          <span className="text-xs font-medium" style={{ color: '#f59e0b' }}>{label}</span>
        </div>
      )}
      <span>{text}</span>
    </div>
  )
}
