import { Sparkles, TrendingUp, TrendingDown, Package, AlertTriangle } from 'lucide-react'
import AssistantKpiCards from './AssistantKpiCards'
import AssistantDataTable from './AssistantDataTable'
import AssistantChart from './AssistantChart'
import { formatPLN } from '../../utils/assistantResponseFormatter'

const INTENT_LABELS = {
  purchase_dashboard: 'Dashboard zakupów',
  compare_invoices: 'Porównanie faktur',
  latest_price_changes: 'Zmiany cen',
  product_price_history: 'Historia ceny',
  compare_suppliers: 'Porównanie dostawców',
  invoices_needing_review: 'Faktury do weryfikacji',
  low_stock: 'Niskie stany',
  order_recommendation: 'Rekomendacja zamówień',
  unknown: null,
}

const SUPPLIER_COLS = [
  { key: 'name',                label: 'Dostawca',   color: 'var(--text)', maxWidth: 160 },
  { key: 'invoiceCount',        label: 'Fakt.',  align: 'right', mono: true },
  { key: 'totalNettoFormatted', label: 'Netto',  align: 'right', mono: true, hideOnMobile: true },
  { key: 'shareFormatted',      label: 'Udział', align: 'right', mono: true },
]

const PRODUCT_COLS = [
  { key: 'name',                label: 'Produkt / Pozycja', color: 'var(--text)', maxWidth: 180 },
  { key: 'totalNettoFormatted', label: 'Netto',   align: 'right', mono: true },
  { key: 'purchaseCount',       label: 'Zakupów', align: 'right', mono: true, hideOnMobile: true },
]

function PurchaseDashboardResult({ dashboard, text }) {
  const { kpis, supplierBreakdown, topProductsBySpend, purchasesOverTime, warnings } = dashboard

  const hasLines = kpis.lineCount > 0
  const chartDataKey = hasLines ? 'totalNetto' : 'invoiceCount'
  const chartTitle = hasLines ? 'Zakupy w czasie (netto)' : 'Faktury w czasie (liczba)'

  const supplierRows = (supplierBreakdown ?? []).map(s => ({
    ...s,
    totalNettoFormatted: formatPLN(s.totalNetto),
    shareFormatted: (s.share ?? 0).toFixed(1) + '%',
  }))

  const productRows = (topProductsBySpend ?? []).map(p => ({
    ...p,
    totalNettoFormatted: formatPLN(p.totalNetto),
  }))

  return (
    <div className="space-y-3" style={{ maxWidth: '100%', overflow: 'hidden' }}>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>{text}</p>

      {(warnings ?? []).map((w, i) => (
        <div
          key={i}
          className="rounded-lg px-3 py-2 text-xs"
          style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)', color: '#ca8a04' }}
        >
          {w}
        </div>
      ))}

      <AssistantKpiCards kpis={kpis} />

      {supplierRows.length > 0 && (
        <AssistantDataTable
          title="Top dostawcy"
          columns={SUPPLIER_COLS}
          rows={supplierRows}
          emptyMessage="Brak dostawców"
        />
      )}

      {productRows.length > 0 && (
        <AssistantDataTable
          title="Top produkty kosztowo"
          columns={PRODUCT_COLS}
          rows={productRows}
          emptyMessage="Brak pozycji faktur"
        />
      )}

      {(purchasesOverTime ?? []).length > 0 && (
        <AssistantChart
          data={purchasesOverTime}
          dataKey={chartDataKey}
          title={chartTitle}
        />
      )}
    </div>
  )
}

const PRICE_CHANGE_COLS = [
  { key: 'name',         label: 'Produkt',  color: 'var(--text)', maxWidth: 150 },
  { key: 'prevFmt',      label: 'Poprz.',   align: 'right', mono: true, hideOnMobile: true },
  { key: 'lastFmt',      label: 'Obecna',   align: 'right', mono: true },
  { key: 'diffPctFmt',   label: 'Zmiana',   align: 'right', mono: true },
]

function fmtPct(v) {
  const sign = v > 0 ? '+' : ''
  return sign + v.toFixed(1) + '%'
}

function getBarColor(entry) {
  return entry.diffPct >= 0 ? '#ef4444' : '#22c55e'
}

function PriceChangesResult({ priceChanges, text }) {
  const { kpis, increases, decreases, anomalies, chartData, warnings } = priceChanges

  const kpiCards = [
    { label: 'Śledzonych produktów', value: String(kpis.totalTracked),      color: 'var(--text)' },
    { label: 'Wzrosty cen',          value: String(kpis.increaseCount),      color: '#ef4444' },
    { label: 'Spadki cen',           value: String(kpis.decreaseCount),      color: '#22c55e' },
    { label: 'Anomalie (>15%)',       value: String(kpis.anomalyCount),       color: '#f59e0b' },
    { label: 'Śr. zmiana',           value: fmtPct(kpis.avgChangePct),       color: kpis.avgChangePct >= 0 ? '#ef4444' : '#22c55e' },
    { label: 'Max. wzrost',          value: '+' + kpis.maxIncreasePct.toFixed(1) + '%', color: '#ef4444' },
  ]

  function makeRows(list) {
    return list.map(e => ({
      ...e,
      prevFmt: formatPLN(e.prevPrice),
      lastFmt: formatPLN(e.lastPrice),
      diffPctFmt: fmtPct(e.diffPct),
    }))
  }

  return (
    <div className="space-y-3" style={{ maxWidth: '100%', overflow: 'hidden' }}>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>{text}</p>

      {(warnings ?? []).map((w, i) => (
        <div
          key={i}
          className="rounded-lg px-3 py-2 text-xs"
          style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)', color: '#ca8a04' }}
        >
          {w}
        </div>
      ))}

      <AssistantKpiCards cards={kpiCards} />

      {anomalies.length > 0 && (
        <AssistantDataTable
          title="Anomalie cenowe (zmiana > 15%)"
          columns={PRICE_CHANGE_COLS}
          rows={makeRows(anomalies)}
          emptyMessage="Brak anomalii"
        />
      )}

      {increases.length > 0 && (
        <AssistantDataTable
          title={<span className="flex items-center gap-1.5"><TrendingUp size={13} style={{ color: '#ef4444' }} />Wzrosty cen</span>}
          columns={PRICE_CHANGE_COLS}
          rows={makeRows(increases.slice(0, 10))}
          emptyMessage="Brak wzrostów"
        />
      )}

      {decreases.length > 0 && (
        <AssistantDataTable
          title={<span className="flex items-center gap-1.5"><TrendingDown size={13} style={{ color: '#22c55e' }} />Spadki cen</span>}
          columns={PRICE_CHANGE_COLS}
          rows={makeRows(decreases.slice(0, 10))}
          emptyMessage="Brak spadków"
        />
      )}

      {chartData.length > 0 && (
        <AssistantChart
          data={chartData}
          dataKey="diffPct"
          xAxisKey="name"
          title="Zmiany cen (%) — top produkty"
          getBarColor={getBarColor}
          tooltipSuffix="%"
          tooltipDecimals={1}
        />
      )}
    </div>
  )
}

const MATCHED_COLS = [
  { key: 'name',           label: 'Produkt',     color: 'var(--text)', maxWidth: 130 },
  { key: 'iloscAFmt',      label: 'Szt. poprz.', align: 'right', mono: true, hideOnMobile: true },
  { key: 'iloscBFmt',      label: 'Szt. ost.',   align: 'right', mono: true, hideOnMobile: true },
  { key: 'priceAFmt',      label: 'Cena poprz.', align: 'right', mono: true, hideOnMobile: true },
  { key: 'priceBFmt',      label: 'Cena ost.',   align: 'right', mono: true },
  { key: 'priceDiffFmt',   label: 'Δ PLN',       align: 'right', mono: true },
  { key: 'priceDiffPctFmt',label: 'Δ%',          align: 'right', mono: true },
]

const ONLY_COLS = [
  { key: 'name',         label: 'Produkt', color: 'var(--text)', maxWidth: 180 },
  { key: 'iloscFmt',     label: 'Ilość',   align: 'right', mono: true, hideOnMobile: true },
  { key: 'priceFmt',     label: 'Cena',    align: 'right', mono: true, hideOnMobile: true },
  { key: 'nettoFmt',     label: 'Netto',   align: 'right', mono: true },
]

const COMP_PRICE_COLS = [
  { key: 'name',           label: 'Produkt',  color: 'var(--text)', maxWidth: 150 },
  { key: 'priceAFmt',      label: 'Poprz.',   align: 'right', mono: true, hideOnMobile: true },
  { key: 'priceBFmt',      label: 'Ost.',     align: 'right', mono: true },
  { key: 'priceDiffFmt',   label: 'Δ PLN',    align: 'right', mono: true },
  { key: 'priceDiffPctFmt',label: 'Δ%',       align: 'right', mono: true },
]

function fmtNum(v) {
  const n = Number(v)
  return isFinite(n) ? n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'
}

function InvoiceInfoBlock({ infoA, infoB }) {
  const LABEL_STYLE = { color: 'var(--muted)', fontSize: 11, fontWeight: 500 }
  const CARD_STYLE = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px', minWidth: 0 }

  function InfoCard({ label, info, accentColor }) {
    return (
      <div style={CARD_STYLE}>
        <p style={{ ...LABEL_STYLE, marginBottom: 6 }}>{label}</p>
        <p className="font-semibold" style={{ color: 'var(--text)', fontSize: 13, wordBreak: 'break-all' }}>{info.numer}</p>
        <p className="mt-1" style={{ color: 'var(--text-2)', fontSize: 11 }}>{info.date}</p>
        <p style={{ color: 'var(--text-2)', fontSize: 11 }}>{info.contractor}</p>
        <p className="mt-1.5" style={{ color: accentColor, fontSize: 12, fontFamily: 'DM Mono, monospace', fontWeight: 600 }}>
          {formatPLN(info.brutto)}
        </p>
        <p style={{ color: 'var(--muted)', fontSize: 11 }}>brutto</p>
      </div>
    )
  }

  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
      <InfoCard label="Poprzednia faktura" info={infoA} accentColor="#6366f1" />
      <InfoCard label="Ostatnia faktura" info={infoB} accentColor={infoB.brutto >= infoA.brutto ? '#ef4444' : '#22c55e'} />
    </div>
  )
}

function CompareInvoicesResult({ comparison, text }) {
  const { kpis, invoiceAInfo, invoiceBInfo, matchedLines, onlyInA, onlyInB, priceChanges, chartData, warnings } = comparison

  const diffColor = kpis.diffBrutto > 0.005 ? '#ef4444' : kpis.diffBrutto < -0.005 ? '#22c55e' : 'var(--text)'
  const diffSign = kpis.diffBrutto > 0.005 ? '+' : ''

  const kpiCards = [
    { label: 'Poprzednia brutto',  value: formatPLN(kpis.bruttoA),    color: '#6366f1' },
    { label: 'Ostatnia brutto',    value: formatPLN(kpis.bruttoB),    color: kpis.diffBrutto > 0.005 ? '#ef4444' : '#22c55e' },
    { label: 'Różnica brutto',     value: `${diffSign}${formatPLN(kpis.diffBrutto)}`, color: diffColor },
    { label: 'Zmiana %',           value: `${diffSign}${Math.abs(kpis.diffBruttoPct).toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`, color: diffColor },
    { label: 'Dopasowane pozycje', value: String(kpis.matchedCount),   color: 'var(--text)' },
    { label: 'Nowe pozycje',       value: String(kpis.onlyBCount),    color: kpis.onlyBCount > 0 ? '#f59e0b' : 'var(--text-2)' },
    { label: 'Brakujące pozycje',  value: String(kpis.onlyACount),    color: kpis.onlyACount > 0 ? '#f59e0b' : 'var(--text-2)' },
    { label: 'Max. zmiana ceny',   value: kpis.topPriceChangeName ? `${kpis.topPriceChangePct > 0 ? '+' : ''}${fmtNum(kpis.topPriceChangePct)}%` : '—', color: kpis.topPriceChangePct > 0 ? '#ef4444' : '#22c55e' },
  ]

  const matchedRows = matchedLines.map(l => ({
    ...l,
    iloscAFmt: fmtNum(l.iloscA),
    iloscBFmt: fmtNum(l.iloscB),
    priceAFmt: formatPLN(l.priceA),
    priceBFmt: formatPLN(l.priceB),
    priceDiffFmt: (l.priceDiff > 0 ? '+' : '') + formatPLN(l.priceDiff),
    priceDiffPctFmt: fmtPct(l.priceDiffPct),
  }))

  const onlyBRows = onlyInB.map(l => ({
    ...l,
    iloscFmt: fmtNum(l.ilosc),
    priceFmt: formatPLN(l.price),
    nettoFmt: formatPLN(l.totalNetto),
  }))

  const onlyARows = onlyInA.map(l => ({
    ...l,
    iloscFmt: fmtNum(l.ilosc),
    priceFmt: formatPLN(l.price),
    nettoFmt: formatPLN(l.totalNetto),
  }))

  const priceChangeRows = priceChanges.map(l => ({
    ...l,
    priceAFmt: formatPLN(l.priceA),
    priceBFmt: formatPLN(l.priceB),
    priceDiffFmt: (l.priceDiff > 0 ? '+' : '') + formatPLN(l.priceDiff),
    priceDiffPctFmt: fmtPct(l.priceDiffPct),
  }))

  const bruttoA = invoiceAInfo.brutto
  const bruttoB = invoiceBInfo.brutto
  function getCompareBarColor(entry) {
    if (entry.name === 'Ostatnia') return bruttoB >= bruttoA ? '#ef4444' : '#22c55e'
    return '#6366f1'
  }

  return (
    <div className="space-y-3" style={{ maxWidth: '100%', overflow: 'hidden' }}>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>{text}</p>

      {(warnings ?? []).map((w, i) => (
        <div
          key={i}
          className="rounded-lg px-3 py-2 text-xs"
          style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)', color: '#ca8a04' }}
        >
          {w}
        </div>
      ))}

      <InvoiceInfoBlock infoA={invoiceAInfo} infoB={invoiceBInfo} />

      <AssistantKpiCards cards={kpiCards} />

      {chartData.length > 0 && (
        <AssistantChart
          data={chartData}
          dataKey="value"
          xAxisKey="name"
          title="Porównanie wartości brutto"
          getBarColor={getCompareBarColor}
        />
      )}

      {matchedRows.length > 0 && (
        <AssistantDataTable
          title="Dopasowane pozycje"
          columns={MATCHED_COLS}
          rows={matchedRows}
          emptyMessage="Brak dopasowanych pozycji"
        />
      )}

      {priceChangeRows.length > 0 && (
        <AssistantDataTable
          title="Największe zmiany cen"
          columns={COMP_PRICE_COLS}
          rows={priceChangeRows}
          emptyMessage="Brak zmian cen"
        />
      )}

      {onlyBRows.length > 0 && (
        <AssistantDataTable
          title={<span className="flex items-center gap-1.5"><TrendingUp size={12} style={{ color: '#f59e0b' }} />Nowe pozycje w ostatniej fakturze</span>}
          columns={ONLY_COLS}
          rows={onlyBRows}
          emptyMessage="Brak nowych pozycji"
        />
      )}

      {onlyARows.length > 0 && (
        <AssistantDataTable
          title={<span className="flex items-center gap-1.5"><TrendingDown size={12} style={{ color: '#6366f1' }} />Pozycje brakujące względem poprzedniej</span>}
          columns={ONLY_COLS}
          rows={onlyARows}
          emptyMessage="Brak brakujących pozycji"
        />
      )}
    </div>
  )
}

const STOCK_BELOW_COLS = [
  { key: 'name',          label: 'Towar',      color: 'var(--text)', maxWidth: 130 },
  { key: 'stanFmt',       label: 'Stan',        align: 'right', mono: true },
  { key: 'minFmt',        label: 'Min.',        align: 'right', mono: true, hideOnMobile: true },
  { key: 'missingFmt',    label: 'Brakuje',     align: 'right', mono: true },
  { key: 'unit',          label: 'Jedn.',       align: 'right', hideOnMobile: true },
  { key: 'lastPriceFmt',  label: 'Cena zakupu', align: 'right', mono: true, hideOnMobile: true },
  { key: 'costFmt',       label: 'Koszt uzup.', align: 'right', mono: true, hideOnMobile: true },
  { key: 'lastSupplier',  label: 'Dostawca',    maxWidth: 110,  hideOnMobile: true },
]

const STOCK_NEAR_COLS = [
  { key: 'name',      label: 'Towar',  color: 'var(--text)', maxWidth: 160 },
  { key: 'stanFmt',   label: 'Stan',    align: 'right', mono: true },
  { key: 'minFmt',    label: 'Min.',    align: 'right', mono: true },
  { key: 'unit',      label: 'Jedn.',   align: 'right', hideOnMobile: true },
  { key: 'magazyn',   label: 'Magazyn', hideOnMobile: true, maxWidth: 100 },
]

function makeStockRows(list) {
  return list.map(p => ({
    ...p,
    stanFmt: fmtNum(p.stan),
    minFmt: fmtNum(p.min),
    missingFmt: fmtNum(p.missing),
    lastPriceFmt: p.lastPrice != null ? formatPLN(p.lastPrice) : '—',
    costFmt: p.estimatedCost != null ? formatPLN(p.estimatedCost) : '—',
    lastSupplier: p.lastSupplier ?? '—',
    magazyn: p.magazyn ?? '—',
  }))
}

function LowStockResult({ analysis, text }) {
  const { kpis, belowMinimum, nearMinimum, criticalItems, chartData, warnings } = analysis

  const kpiCards = [
    { label: 'Poniżej minimum',   value: String(kpis.belowCount),   color: kpis.belowCount > 0 ? '#ef4444' : 'var(--text-2)' },
    { label: 'Krytyczne',         value: String(kpis.criticalCount), color: kpis.criticalCount > 0 ? '#dc2626' : 'var(--text-2)' },
    { label: 'Blisko minimum',    value: String(kpis.nearCount),     color: kpis.nearCount > 0 ? '#f59e0b' : 'var(--text-2)' },
    { label: 'Łączny brak [szt.]',value: fmtNum(kpis.totalMissing), color: 'var(--text)' },
    { label: 'Koszt uzupełnienia',value: kpis.estimatedRestockCost != null ? formatPLN(kpis.estimatedRestockCost) : '—', color: '#3b82f6' },
    { label: 'Największy brak',   value: kpis.topMissingName ?? '—', color: 'var(--text-2)' },
  ]

  return (
    <div className="space-y-3" style={{ maxWidth: '100%', overflow: 'hidden' }}>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>{text}</p>

      {(warnings ?? []).map((w, i) => (
        <div
          key={i}
          className="rounded-lg px-3 py-2 text-xs"
          style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)', color: '#ca8a04' }}
        >
          {w}
        </div>
      ))}

      <AssistantKpiCards cards={kpiCards} />

      {chartData.length > 0 && (
        <AssistantChart
          data={chartData}
          dataKey="missing"
          xAxisKey="name"
          title="Braki ilościowe — top produkty"
          getBarColor={() => '#ef4444'}
          tooltipSuffix=" szt."
          tooltipDecimals={0}
        />
      )}

      {criticalItems.length > 0 && (
        <AssistantDataTable
          title={<span className="flex items-center gap-1.5"><AlertTriangle size={12} style={{ color: '#dc2626' }} />Krytyczne — brakuje natychmiast</span>}
          columns={STOCK_BELOW_COLS}
          rows={makeStockRows(criticalItems)}
          emptyMessage="Brak"
        />
      )}

      {belowMinimum.length > 0 && (
        <AssistantDataTable
          title={<span className="flex items-center gap-1.5"><Package size={12} style={{ color: '#ef4444' }} />Poniżej minimum</span>}
          columns={STOCK_BELOW_COLS}
          rows={makeStockRows(belowMinimum)}
          emptyMessage="Brak produktów poniżej minimum"
        />
      )}

      {nearMinimum.length > 0 && (
        <AssistantDataTable
          title={<span className="flex items-center gap-1.5"><TrendingDown size={12} style={{ color: '#f59e0b' }} />Blisko minimum</span>}
          columns={STOCK_NEAR_COLS}
          rows={makeStockRows(nearMinimum)}
          emptyMessage="Brak"
        />
      )}
    </div>
  )
}

const REVIEW_INVOICE_COLS = [
  { key: 'numer',           label: 'Numer',         color: 'var(--text)', maxWidth: 120, noWrap: true },
  { key: 'date',            label: 'Data',           align: 'right', mono: true, hideOnMobile: true },
  { key: 'contractor',      label: 'Kontrahent',     maxWidth: 120, hideOnMobile: true },
  { key: 'issueCountFmt',   label: 'Problemów',      align: 'right', mono: true },
  { key: 'severityFmt',     label: 'Pilność',        align: 'right' },
  { key: 'suggestedAction', label: 'Zalecenie',      maxWidth: 180, hideOnMobile: true },
]

const ISSUE_BREAKDOWN_COLS = [
  { key: 'label', label: 'Problem',      color: 'var(--text)', maxWidth: 200 },
  { key: 'count', label: 'Wystąpień',    align: 'right', mono: true },
]

function severityFmt(severity) {
  if (severity === 'critical') return '🔴 krytyczna'
  if (severity === 'warning') return '🟠 ostrzeżenie'
  return '🟡 info'
}

function makeReviewRows(list) {
  return list.map(inv => ({
    ...inv,
    date: inv.date ?? '—',
    contractor: inv.contractor ?? '—',
    issueCountFmt: String(inv.issueCount),
    severityFmt: severityFmt(inv.severity),
    suggestedAction: inv.suggestedAction ?? '—',
  }))
}

function InvoicesNeedingReviewResult({ review, text }) {
  const { kpis, invoicesToReview, criticalInvoices, issueBreakdown, chartData, warnings } = review

  const kpiCards = [
    { label: 'Przeanalizowanych', value: String(kpis.reviewedCount),   color: 'var(--text)' },
    { label: 'Do weryfikacji',    value: String(kpis.reviewCount),      color: kpis.reviewCount > 0 ? '#f59e0b' : 'var(--text-2)' },
    { label: 'Krytyczne',         value: String(kpis.criticalCount),    color: kpis.criticalCount > 0 ? '#dc2626' : 'var(--text-2)' },
    { label: 'Problemów łącznie', value: String(kpis.totalIssues),      color: kpis.totalIssues > 0 ? '#ef4444' : 'var(--text-2)' },
    { label: 'Bez towaru',        value: String(kpis.unmatchedLinesCount), color: kpis.unmatchedLinesCount > 0 ? '#f59e0b' : 'var(--text-2)' },
    { label: 'Bez ceny',          value: String(kpis.noPriceCount),     color: kpis.noPriceCount > 0 ? '#f59e0b' : 'var(--text-2)' },
  ]

  return (
    <div className="space-y-3" style={{ maxWidth: '100%', overflow: 'hidden' }}>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>{text}</p>

      {(warnings ?? []).map((w, i) => (
        <div
          key={i}
          className="rounded-lg px-3 py-2 text-xs"
          style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)', color: '#ca8a04' }}
        >
          {w}
        </div>
      ))}

      <AssistantKpiCards cards={kpiCards} />

      {chartData.length > 0 && (
        <AssistantChart
          data={chartData}
          dataKey="value"
          xAxisKey="name"
          title="Faktury wg pilności"
          getBarColor={entry => {
            if (entry.name === 'Krytyczne') return '#dc2626'
            if (entry.name === 'Ostrzeżenia') return '#f59e0b'
            return '#6366f1'
          }}
          tooltipSuffix=" faktur"
          tooltipDecimals={0}
        />
      )}

      {criticalInvoices.length > 0 && (
        <AssistantDataTable
          title={<span className="flex items-center gap-1.5"><AlertTriangle size={12} style={{ color: '#dc2626' }} />Krytyczne — wymagają natychmiastowej uwagi</span>}
          columns={REVIEW_INVOICE_COLS}
          rows={makeReviewRows(criticalInvoices)}
          emptyMessage="Brak"
        />
      )}

      {invoicesToReview.length > 0 && (
        <AssistantDataTable
          title={<span className="flex items-center gap-1.5"><Package size={12} style={{ color: '#f59e0b' }} />Wszystkie faktury do weryfikacji</span>}
          columns={REVIEW_INVOICE_COLS}
          rows={makeReviewRows(invoicesToReview)}
          emptyMessage="Brak faktur do weryfikacji"
        />
      )}

      {issueBreakdown.length > 0 && (
        <AssistantDataTable
          title="Najczęstsze problemy"
          columns={ISSUE_BREAKDOWN_COLS}
          rows={issueBreakdown}
          emptyMessage="Brak problemów"
        />
      )}
    </div>
  )
}

const ORDER_ITEM_COLS = [
  { key: 'name',          label: 'Towar',       color: 'var(--text)', maxWidth: 130 },
  { key: 'priorityFmt',   label: 'Priorytet',   align: 'right' },
  { key: 'stanFmt',       label: 'Stan',         align: 'right', mono: true, hideOnMobile: true },
  { key: 'missingFmt',    label: 'Brakuje',      align: 'right', mono: true },
  { key: 'unit',          label: 'Jedn.',        align: 'right', hideOnMobile: true },
  { key: 'lastPriceFmt',  label: 'Cena zakupu',  align: 'right', mono: true, hideOnMobile: true },
  { key: 'costFmt',       label: 'Koszt uzup.',  align: 'right', mono: true, hideOnMobile: true },
  { key: 'lastSupplier',  label: 'Dostawca',     maxWidth: 110,  hideOnMobile: true },
]

const ORDER_SUPPLIER_COLS = [
  { key: 'supplier',        label: 'Dostawca',       color: 'var(--text)', maxWidth: 160 },
  { key: 'countFmt',        label: 'Pozycji',         align: 'right', mono: true },
  { key: 'totalCostFmt',    label: 'Koszt szac.',     align: 'right', mono: true },
]

const ORDER_WATCH_COLS = [
  { key: 'name',    label: 'Towar',  color: 'var(--text)', maxWidth: 160 },
  { key: 'stanFmt', label: 'Stan',    align: 'right', mono: true },
  { key: 'minFmt',  label: 'Min.',    align: 'right', mono: true },
  { key: 'unit',    label: 'Jedn.',   align: 'right', hideOnMobile: true },
]

function makeOrderItemRows(list) {
  return list.map(p => ({
    ...p,
    priorityFmt: p.priority === 'critical' ? '🔴 krytyczny' : p.priority === 'high' ? '🟠 wysoki' : '🟡 normalny',
    stanFmt: fmtNum(p.stan),
    minFmt: fmtNum(p.min),
    missingFmt: fmtNum(p.missing),
    lastPriceFmt: p.lastPrice != null ? formatPLN(p.lastPrice) : '—',
    costFmt: p.estimatedCost != null ? formatPLN(p.estimatedCost) : '—',
    lastSupplier: p.lastSupplier ?? '—',
  }))
}

function OrderRecommendationResult({ recommendations, text }) {
  const { kpis, orderItems, criticalItems, supplierGroups, watchList, chartData, warnings } = recommendations

  const kpiCards = [
    { label: 'Do zamówienia',      value: String(kpis.orderCount),   color: kpis.orderCount > 0 ? '#3b82f6' : 'var(--text-2)' },
    { label: 'Krytyczne',          value: String(kpis.criticalCount), color: kpis.criticalCount > 0 ? '#dc2626' : 'var(--text-2)' },
    { label: 'Obserwuj',           value: String(kpis.watchCount),    color: kpis.watchCount > 0 ? '#f59e0b' : 'var(--text-2)' },
    { label: 'Szac. koszt zamów.', value: kpis.estimatedOrderCost != null ? formatPLN(kpis.estimatedOrderCost) : '—', color: '#3b82f6' },
    { label: 'Brak ceny',          value: String(kpis.noPriceCount),  color: kpis.noPriceCount > 0 ? '#f59e0b' : 'var(--text-2)' },
    { label: 'Brak dostawcy',      value: String(kpis.noSupplierCount), color: kpis.noSupplierCount > 0 ? '#f59e0b' : 'var(--text-2)' },
  ]

  const supplierRows = (supplierGroups ?? []).map(g => ({
    ...g,
    countFmt: String(g.count),
    totalCostFmt: g.totalCost > 0 ? formatPLN(g.totalCost) : '—',
  }))

  return (
    <div className="space-y-3" style={{ maxWidth: '100%', overflow: 'hidden' }}>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>{text}</p>

      {(warnings ?? []).map((w, i) => (
        <div
          key={i}
          className="rounded-lg px-3 py-2 text-xs"
          style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)', color: '#ca8a04' }}
        >
          {w}
        </div>
      ))}

      <AssistantKpiCards cards={kpiCards} />

      {chartData.length > 0 && (
        <AssistantChart
          data={chartData}
          dataKey="value"
          xAxisKey="name"
          title="Top produkty do zamówienia"
          getBarColor={() => '#3b82f6'}
          tooltipSuffix=""
          tooltipDecimals={0}
        />
      )}

      {criticalItems.length > 0 && (
        <AssistantDataTable
          title={<span className="flex items-center gap-1.5"><AlertTriangle size={12} style={{ color: '#dc2626' }} />Krytyczne — zamów natychmiast</span>}
          columns={ORDER_ITEM_COLS}
          rows={makeOrderItemRows(criticalItems)}
          emptyMessage="Brak"
        />
      )}

      {orderItems.filter(p => p.priority !== 'critical').length > 0 && (
        <AssistantDataTable
          title={<span className="flex items-center gap-1.5"><Package size={12} style={{ color: '#3b82f6' }} />Lista zamówień</span>}
          columns={ORDER_ITEM_COLS}
          rows={makeOrderItemRows(orderItems.filter(p => p.priority !== 'critical'))}
          emptyMessage="Brak"
        />
      )}

      {supplierRows.length > 0 && (
        <AssistantDataTable
          title="Zamówienia według dostawcy"
          columns={ORDER_SUPPLIER_COLS}
          rows={supplierRows}
          emptyMessage="Brak dostawców"
        />
      )}

      {watchList.length > 0 && (
        <AssistantDataTable
          title={<span className="flex items-center gap-1.5"><TrendingDown size={12} style={{ color: '#f59e0b' }} />Obserwuj — blisko minimum</span>}
          columns={ORDER_WATCH_COLS}
          rows={makeStockRows(watchList)}
          emptyMessage="Brak"
        />
      )}
    </div>
  )
}

export default function AssistantResult({ intent, text, structuredData }) {
  if (structuredData && intent === 'purchase_dashboard') {
    return <PurchaseDashboardResult dashboard={structuredData} text={text} />
  }

  if (structuredData && intent === 'latest_price_changes') {
    return <PriceChangesResult priceChanges={structuredData} text={text} />
  }

  if (structuredData && intent === 'compare_invoices') {
    return <CompareInvoicesResult comparison={structuredData} text={text} />
  }

  if (structuredData && intent === 'low_stock') {
    return <LowStockResult analysis={structuredData} text={text} />
  }

  if (structuredData && intent === 'order_recommendation') {
    return <OrderRecommendationResult recommendations={structuredData} text={text} />
  }

  if (structuredData && intent === 'invoices_needing_review') {
    return <InvoicesNeedingReviewResult review={structuredData} text={text} />
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
