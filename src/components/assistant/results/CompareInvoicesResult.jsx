import { TrendingUp, TrendingDown } from 'lucide-react'
import AssistantKpiCards from '../AssistantKpiCards'
import AssistantDataTable from '../AssistantDataTable'
import AssistantChart from '../AssistantChart'
import AssistantWarnings from '../AssistantWarnings'
import AssistantResultActions from '../AssistantResultActions'
import { fmtNum, fmtPct, formatDatePL } from '../../../utils/assistantFormatters'
import { formatPLN } from '../../../utils/assistantResponseFormatter'

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

const INFO_LABEL_STYLE = { color: 'var(--muted)', fontSize: 11, fontWeight: 500 }
const INFO_CARD_STYLE = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px', minWidth: 0 }

function InfoCard({ label, info, accentColor }) {
  return (
    <div style={INFO_CARD_STYLE}>
      <p style={{ ...INFO_LABEL_STYLE, marginBottom: 6 }}>{label}</p>
      <p className="font-semibold" style={{ color: 'var(--text)', fontSize: 13, wordBreak: 'break-all' }}>{info.numer}</p>
      <p className="mt-1" style={{ color: 'var(--text-2)', fontSize: 11 }}>{formatDatePL(info.date)}</p>
      <p style={{ color: 'var(--text-2)', fontSize: 11 }}>{info.contractor}</p>
      <p className="mt-1.5" style={{ color: accentColor, fontSize: 12, fontFamily: 'DM Mono, monospace', fontWeight: 600 }}>
        {formatPLN(info.brutto)}
      </p>
      <p style={{ color: 'var(--muted)', fontSize: 11 }}>brutto</p>
    </div>
  )
}

function InvoiceInfoBlock({ infoA, infoB }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
      <InfoCard label="Poprzednia faktura" info={infoA} accentColor="#6366f1" />
      <InfoCard label="Ostatnia faktura" info={infoB} accentColor={infoB.brutto >= infoA.brutto ? '#ef4444' : '#22c55e'} />
    </div>
  )
}

export default function CompareInvoicesResult({ comparison, text }) {
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
    <div className="space-y-4" style={{ maxWidth: '100%', overflow: 'hidden' }}>
      {text && <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>{text}</p>}

      <AssistantWarnings warnings={warnings} />

      <AssistantResultActions summaryText={text} />

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
          exportable
          exportFilename="magzic-faktury-dopasowane.csv"
        />
      )}

      {priceChangeRows.length > 0 && (
        <AssistantDataTable
          title="Największe zmiany cen"
          columns={COMP_PRICE_COLS}
          rows={priceChangeRows}
          emptyMessage="Brak zmian cen"
          exportable
          exportFilename="magzic-faktury-zmiany-cen.csv"
        />
      )}

      {onlyBRows.length > 0 && (
        <AssistantDataTable
          title={<span className="flex items-center gap-1.5"><TrendingUp size={12} style={{ color: '#f59e0b' }} />Nowe pozycje w ostatniej fakturze</span>}
          columns={ONLY_COLS}
          rows={onlyBRows}
          emptyMessage="Brak nowych pozycji"
          exportable
          exportFilename="magzic-faktury-nowe-pozycje.csv"
        />
      )}

      {onlyARows.length > 0 && (
        <AssistantDataTable
          title={<span className="flex items-center gap-1.5"><TrendingDown size={12} style={{ color: '#6366f1' }} />Pozycje brakujące względem poprzedniej</span>}
          columns={ONLY_COLS}
          rows={onlyARows}
          emptyMessage="Brak brakujących pozycji"
          exportable
          exportFilename="magzic-faktury-brakujace-pozycje.csv"
        />
      )}
    </div>
  )
}
