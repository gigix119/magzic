const BOM = '﻿'

function escapeCsvValue(value, sep) {
  if (value == null) return ''
  const str = typeof value === 'object' ? JSON.stringify(value) : String(value)
  if (str.includes(sep) || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

export function toCsv(rows, columns, options = {}) {
  const sep = options.separator ?? ';'
  const header = columns.map(col => escapeCsvValue(col.label ?? col.key ?? '', sep)).join(sep)
  const dataRows = (rows ?? []).map(row =>
    columns.map(col => escapeCsvValue(row[col.key], sep)).join(sep)
  )
  return [header, ...dataRows].join('\n')
}

export function downloadCsv(filename, rows, columns, options = {}) {
  const content = BOM + toCsv(rows, columns, options)
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = sanitizeCsvFilename(filename)
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function sanitizeCsvFilename(name) {
  if (!name) return 'export.csv'
  let safe = String(name)
    .replace(/[/\\:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!safe) return 'export.csv'
  if (!safe.toLowerCase().endsWith('.csv')) safe += '.csv'
  return safe
}
