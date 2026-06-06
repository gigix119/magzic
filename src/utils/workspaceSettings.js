export const DEFAULT_SETTINGS = {
  default_unit: 'szt.',
  low_stock_threshold: 5,
  dead_stock_days: 30,
  price_display: 'netto',
  default_vat_rate: 23,
  currency: 'PLN',
  alert_low_stock: true,
  alert_price_changes: true,
  alert_price_change_percent: 10,
  alert_dead_stock: true,
  alert_invoice_review: true,
  briefing_on_dashboard: true,
  weekly_report_on_dashboard: true,
  compact_mode: false,
  show_stat_cards: true,
  show_chart: true,
  show_attention_list: true,
}

export function getWorkspaceSetting(workspace, key) {
  return workspace?.settings?.[key] ?? DEFAULT_SETTINGS[key]
}

export function getAllSettings(workspace) {
  return { ...DEFAULT_SETTINGS, ...(workspace?.settings || {}) }
}
