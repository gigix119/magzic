import { supabase } from '../supabase'

export function isOwner(profile) {
  return profile?.role === 'owner' && profile?.status === 'active'
}

export function getDisplayName(profile) {
  if (!profile) return 'Nieznany'
  if (profile.display_name) return profile.display_name
  const full = [profile.first_name, profile.last_name].filter(Boolean).join(' ')
  return full || profile.email || 'Nieznany'
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('pl-PL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function formatDateShort(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('pl-PL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

export function timeAgo(dateStr) {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'przed chwilą'
  if (mins < 60) return `${mins} min temu`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} godz. temu`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days} dni temu`
  return formatDateShort(dateStr)
}

export async function trackEvent({
  eventType,
  moduleKey = null,
  action,
  entityType = null,
  entityId = null,
  metadata = {},
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('app_events').insert({
      user_id: user?.id ?? null,
      event_type: eventType,
      module_key: moduleKey,
      action,
      entity_type: entityType,
      entity_id: entityId ? String(entityId) : null,
      metadata,
    })
  } catch {
    // Tracking failures must never break the app
  }
}

export async function trackAdminAudit({
  action,
  targetUserId = null,
  metadata = {},
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('admin_audit_logs').insert({
      admin_user_id: user.id,
      target_user_id: targetUserId ?? null,
      action,
      metadata,
    })
  } catch {
    // Tracking failures must never break the app
  }
}

export async function trackError({
  errorType,
  message,
  moduleKey = null,
  action = null,
  metadata = {},
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('app_error_logs').insert({
      user_id: user?.id ?? null,
      error_type: errorType,
      message: String(message).slice(0, 2000),
      module_key: moduleKey,
      action,
      metadata,
    })
  } catch {
    // Tracking failures must never break the app
  }
}

export const MODULES = [
  { key: 'dashboard',   label: 'Dashboard' },
  { key: 'invoices',    label: 'Faktury' },
  { key: 'inventory',   label: 'Magazyn' },
  { key: 'contractors', label: 'Kontrahenci' },
  { key: 'reports',     label: 'Raporty' },
  { key: 'settings',    label: 'Ustawienia' },
  { key: 'backend',     label: 'Backend' },
]

export const ROLE_LABELS = {
  owner: 'Owner',
  admin: 'Admin',
  user: 'Użytkownik',
}

export const STATUS_LABELS = {
  active:  'Aktywny',
  blocked: 'Zablokowany',
  pending: 'Oczekuje',
}
