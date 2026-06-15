import {
  ClipboardList, UtensilsCrossed, ShoppingCart, Package,
  Sparkles, Flower2, BedDouble, Brush, Wrench, Factory,
  HardHat, HeartPulse, Dumbbell,
  AlertCircle, Bell, FileText, CheckCircle2, TrendingUp,
  PackagePlus, BarChart2, CircleDollarSign, Sun,
  ChevronDown, ChevronUp,
} from 'lucide-react'

// Maps business_category → Lucide icon component for zlecenie nav item
const CATEGORY_ICON_MAP = {
  general:           ClipboardList,
  gastronomy:        UtensilsCrossed,
  retail:            ShoppingCart,
  ecommerce:         Package,
  beauty:            Sparkles,
  floristry_decor:   Flower2,
  hospitality:       BedDouble,
  cleaning_facility: Brush,
  workshop_service:  Wrench,
  production_craft:  Factory,
  construction:      HardHat,
  health_care:       HeartPulse,
  fitness_recreation: Dumbbell,
}

export function getZlecenieIcon(businessCategory) {
  return CATEGORY_ICON_MAP[businessCategory] || ClipboardList
}

// Maps briefing item type → { Icon, color }
const BRIEFING_ICON_MAP = {
  low_stock:      { Icon: AlertCircle,   color: 'var(--c-critical)' },
  price_increase: { Icon: Bell,          color: 'var(--c-attention)' },
  invoice_review: { Icon: FileText,      color: 'var(--c-attention)' },
  items_to_order: { Icon: ClipboardList, color: 'var(--c-attention)' },
  dead_stock:     { Icon: Package,       color: 'var(--muted)' },
  no_data:        { Icon: CheckCircle2,  color: 'var(--c-success)' },
}

export function getBriefingIcon(itemType) {
  return BRIEFING_ICON_MAP[itemType] || { Icon: Bell, color: 'var(--muted)' }
}

// Icons for weekly report sections
export const WeeklyIcons = {
  header:        BarChart2,
  spending:      CircleDollarSign,
  invoices:      FileText,
  inventory:     Package,
  orders:        ClipboardList,
  priceIncrease: TrendingUp,
  newProducts:   PackagePlus,
}

// Briefing card header icon
export { Sun as BriefingHeaderIcon }

// Collapse toggle icons
export { ChevronDown, ChevronUp }
