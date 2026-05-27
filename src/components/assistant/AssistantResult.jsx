import { Sparkles, TrendingUp, TrendingDown } from 'lucide-react'
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
