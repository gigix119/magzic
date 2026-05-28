import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Lock, Unlock, Mail, ShieldOff,
  CheckSquare, Square, Clock,
} from 'lucide-react'
import { supabase } from '../../supabase'
import {
  trackAdminAudit, formatDate, timeAgo,
  ROLE_LABELS, STATUS_LABELS, MODULES,
} from '../../utils/adminHelpers'
import { useToast } from '../../context/ToastContext'

const ROLE_COLORS   = { owner: '#7c3aed', admin: '#3b82f6', user: '#6b7280' }
const STATUS_COLORS = { active: '#16a34a', blocked: '#ef4444', pending: '#d97706' }
const EVENT_COLORS  = { auth_login: '#16a34a', permission_denied: '#ef4444', error: '#dc2626', page_view: '#3b82f6' }

function Badge({ label, color }) {
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ background: `${color}18`, color }}>
      {label}
    </span>
  )
}

function Section({ title, children }) {
  return (
    <div className="rounded-xl mb-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      <div className="px-5 py-3.5" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{title}</span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

export default function BackendUserDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { addToast } = useToast()

  const [profile, setProfile]       = useState(null)
  const [, setPerms]                 = useState([])
  const [activity, setActivity]     = useState([])
  const [auditLog, setAuditLog]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [tab, setTab]               = useState('activity')
  const [saving, setSaving]         = useState(false)
  const [localPerms, setLocalPerms] = useState({})

  async function loadAll() {
    setLoading(true)
    try {
      const [
        { data: prof },
        { data: perms },
        { data: events },
        { data: audit },
      ] = await Promise.all([
        supabase.from('profiles')
          .select('id, email, first_name, last_name, display_name, role, status, created_at, last_login_at, last_seen_at')
          .eq('id', id).maybeSingle(),
        supabase.from('user_permissions')
          .select('module_key, can_view, can_create, can_edit, can_delete')
          .eq('user_id', id),
        supabase.from('app_events')
          .select('id, event_type, module_key, action, entity_type, created_at, metadata')
          .eq('user_id', id)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase.from('admin_audit_logs')
          .select('id, action, metadata, created_at, profiles!admin_audit_logs_admin_user_id_fkey(email)')
          .eq('target_user_id', id)
          .order('created_at', { ascending: false })
          .limit(30),
      ])

      setProfile(prof)
      setPerms(perms ?? [])
      setActivity(events ?? [])
      setAuditLog(audit ?? [])

      const permsMap = {}
      for (const p of perms ?? []) {
        permsMap[p.module_key] = { can_view: p.can_view, can_create: p.can_create, can_edit: p.can_edit, can_delete: p.can_delete }
      }
      setLocalPerms(permsMap)
    } catch (err) {
      console.error('[BackendUserDetail] loadAll error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleBlock() {
    if (!profile) return
    const newStatus = profile.status === 'blocked' ? 'active' : 'blocked'
    setSaving(true)
    const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('id', id)
    setSaving(false)
    if (error) { addToast('Błąd: ' + error.message, 'error'); return }
    await trackAdminAudit({
      action: newStatus === 'blocked' ? 'user_blocked' : 'user_unblocked',
      targetUserId: id,
      metadata: { previousStatus: profile.status, newStatus, email: profile.email },
    })
    setProfile(p => ({ ...p, status: newStatus }))
    addToast(newStatus === 'blocked' ? 'Konto zablokowane.' : 'Konto odblokowane.', 'success')
  }

  async function handleRoleChange(newRole) {
    if (!profile || newRole === profile.role) return
    setSaving(true)
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', id)
    setSaving(false)
    if (error) { addToast('Błąd: ' + error.message, 'error'); return }
    await trackAdminAudit({
      action: 'role_changed',
      targetUserId: id,
      metadata: { previousRole: profile.role, newRole, email: profile.email },
    })
    setProfile(p => ({ ...p, role: newRole }))
    addToast(`Rola zmieniona na: ${ROLE_LABELS[newRole]}`, 'success')
  }

  async function handlePasswordReset() {
    if (!profile?.email) return
    setSaving(true)
    const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
      redirectTo: window.location.origin + '/login',
    })
    setSaving(false)
    if (error) { addToast('Błąd: ' + error.message, 'error'); return }
    await trackAdminAudit({
      action: 'password_reset_link_sent',
      targetUserId: id,
      metadata: { email: profile.email },
    })
    addToast('Link resetowania hasła wysłany na ' + profile.email, 'success')
  }

  async function handleSavePermissions() {
    setSaving(true)
    const upserts = MODULES.map(m => ({
      user_id:    id,
      module_key: m.key,
      can_view:   localPerms[m.key]?.can_view   ?? false,
      can_create: localPerms[m.key]?.can_create ?? false,
      can_edit:   localPerms[m.key]?.can_edit   ?? false,
      can_delete: localPerms[m.key]?.can_delete ?? false,
    }))

    const { error } = await supabase.from('user_permissions').upsert(upserts, { onConflict: 'user_id,module_key' })
    setSaving(false)
    if (error) { addToast('Błąd: ' + error.message, 'error'); return }
    await trackAdminAudit({
      action: 'permissions_changed',
      targetUserId: id,
      metadata: { permissions: localPerms, email: profile?.email },
    })
    addToast('Uprawnienia zapisane.', 'success')
  }

  function togglePerm(moduleKey, perm) {
    setLocalPerms(prev => ({
      ...prev,
      [moduleKey]: {
        ...(prev[moduleKey] ?? {}),
        [perm]: !(prev[moduleKey]?.[perm] ?? false),
      },
    }))
  }

  function displayName(p) {
    if (!p) return '—'
    if (p.display_name) return p.display_name
    return [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email
  }

  if (loading) {
    return <div className="py-20 text-center text-sm" style={{ color: 'var(--muted)' }}>Ładowanie…</div>
  }

  if (!profile) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>Nie znaleziono użytkownika.</p>
        <button onClick={() => navigate('/backend/users')} className="text-sm" style={{ color: '#7c3aed' }}>← Wróć do listy</button>
      </div>
    )
  }

  return (
    <div>
      <button onClick={() => navigate('/backend/users')}
        className="flex items-center gap-1.5 text-sm mb-4 hover:opacity-70 transition-opacity"
        style={{ color: 'var(--text-2)' }}>
        <ArrowLeft size={14} /> Wróć do listy
      </button>

      {/* User header */}
      <div className="rounded-xl p-5 mb-4 flex flex-wrap items-start gap-4"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-center rounded-full font-bold text-white text-xl flex-shrink-0"
          style={{ width: 56, height: 56, background: '#7c3aed', fontFamily: 'DM Mono, monospace' }}>
          {(profile.email?.[0] ?? '?').toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold text-base" style={{ color: 'var(--text)' }}>{displayName(profile)}</span>
            <Badge label={ROLE_LABELS[profile.role] ?? profile.role} color={ROLE_COLORS[profile.role] ?? '#6b7280'} />
            <Badge label={STATUS_LABELS[profile.status] ?? profile.status} color={STATUS_COLORS[profile.status] ?? '#6b7280'} />
          </div>
          <p className="text-sm font-mono" style={{ color: 'var(--muted)' }}>{profile.email}</p>
          <div className="flex gap-4 mt-2 text-xs" style={{ color: 'var(--muted)' }}>
            <span className="flex items-center gap-1"><Clock size={11} /> Założone: {formatDate(profile.created_at)}</span>
            <span className="flex items-center gap-1"><Clock size={11} /> Logowanie: {timeAgo(profile.last_login_at)}</span>
            <span className="flex items-center gap-1"><Clock size={11} /> Aktywność: {timeAgo(profile.last_seen_at)}</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <button onClick={handleBlock} disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            style={profile.status === 'blocked'
              ? { background: 'rgba(22,163,74,0.1)', color: '#16a34a' }
              : { background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
            {profile.status === 'blocked' ? <Unlock size={13} /> : <Lock size={13} />}
            {profile.status === 'blocked' ? 'Odblokuj' : 'Zablokuj'}
          </button>

          <select value={profile.role} onChange={e => handleRoleChange(e.target.value)} disabled={saving}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border-0 disabled:opacity-50"
            style={{ background: 'rgba(124,58,237,0.1)', color: '#7c3aed', cursor: 'pointer' }}>
            <option value="user">Zmień rolę → User</option>
            <option value="admin">Zmień rolę → Admin</option>
            <option value="owner">Zmień rolę → Owner</option>
          </select>

          <button onClick={handlePasswordReset} disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>
            <Mail size={13} /> Wyślij reset hasła
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        {[['activity', 'Historia aktywności'], ['permissions', 'Uprawnienia'], ['admin-log', 'Zmiany administratora']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
            style={tab === key
              ? { background: 'rgba(124,58,237,0.12)', color: '#7c3aed' }
              : { color: 'var(--text-2)', background: 'transparent' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Activity tab */}
      {tab === 'activity' && (
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          {activity.length === 0 ? (
            <div className="py-16 text-center text-sm" style={{ color: 'var(--muted)' }}>Brak aktywności.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Typ', 'Moduł', 'Akcja', 'Encja', 'Kiedy'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left font-medium" style={{ color: 'var(--muted)', fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activity.map(ev => (
                  <tr key={ev.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ background: `${EVENT_COLORS[ev.event_type] ?? '#6b7280'}18`, color: EVENT_COLORS[ev.event_type] ?? '#6b7280' }}>
                        {ev.event_type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--muted)' }}>{ev.module_key ?? '—'}</td>
                    <td className="px-4 py-2.5 text-xs font-mono" style={{ color: 'var(--text-2)' }}>{ev.action}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--muted)' }}>{ev.entity_type ?? '—'}</td>
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ color: 'var(--muted)' }}>{timeAgo(ev.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Permissions tab */}
      {tab === 'permissions' && (
        <Section title="Uprawnienia do modułów">
          {profile.role === 'owner' && (
            <div className="rounded-lg p-3 mb-4 flex items-center gap-2 text-sm"
              style={{ background: 'rgba(124,58,237,0.08)', color: '#7c3aed' }}>
              <ShieldOff size={14} />
              Konto Owner ma zawsze pełne uprawnienia i nie wymaga ręcznej konfiguracji.
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th className="text-left py-2 pr-4 font-medium" style={{ color: 'var(--muted)', fontSize: 12 }}>Moduł</th>
                  {['Widok', 'Tworzenie', 'Edycja', 'Usuwanie'].map(h => (
                    <th key={h} className="text-center py-2 px-3 font-medium" style={{ color: 'var(--muted)', fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MODULES.map(m => (
                  <tr key={m.key} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="py-2.5 pr-4 font-medium text-sm" style={{ color: 'var(--text)' }}>{m.label}</td>
                    {['can_view', 'can_create', 'can_edit', 'can_delete'].map(perm => {
                      const checked = localPerms[m.key]?.[perm] ?? false
                      return (
                        <td key={perm} className="text-center py-2.5 px-3">
                          <button onClick={() => togglePerm(m.key, perm)} disabled={profile.role === 'owner'}
                            className="inline-flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed">
                            {checked
                              ? <CheckSquare size={18} style={{ color: '#7c3aed' }} />
                              : <Square size={18} style={{ color: 'var(--muted)' }} />}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-end">
            <button onClick={handleSavePermissions} disabled={saving || profile.role === 'owner'}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              style={{ background: '#7c3aed', color: '#fff' }}>
              {saving ? 'Zapisywanie…' : 'Zapisz uprawnienia'}
            </button>
          </div>
        </Section>
      )}

      {/* Admin log tab */}
      {tab === 'admin-log' && (
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          {auditLog.length === 0 ? (
            <div className="py-16 text-center text-sm" style={{ color: 'var(--muted)' }}>Brak zmian administratora.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Administrator', 'Akcja', 'Szczegóły', 'Kiedy'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left font-medium" style={{ color: 'var(--muted)', fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {auditLog.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="px-4 py-2.5 text-xs font-mono" style={{ color: 'var(--text-2)' }}>{log.profiles?.email ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ background: 'rgba(124,58,237,0.1)', color: '#7c3aed' }}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--muted)' }}>
                      {Object.keys(log.metadata ?? {}).length > 0
                        ? Object.entries(log.metadata).map(([k, v]) => `${k}: ${v}`).join(', ')
                        : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ color: 'var(--muted)' }}>{timeAgo(log.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
