export function fmtNum(v) {
  if (v == null) return '—'
  const n = Number(v)
  return isFinite(n) ? n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'
}

export function fmtPct(v) {
  const n = Number(v)
  if (!isFinite(n)) return '0%'
  const sign = n > 0 ? '+' : ''
  return sign + n.toFixed(1) + '%'
}

export function formatDatePL(isoDate) {
  if (!isoDate || isoDate.length < 10) return isoDate || '—'
  const [year, month, day] = isoDate.slice(0, 10).split('-')
  return `${day}.${month}.${year}`
}
