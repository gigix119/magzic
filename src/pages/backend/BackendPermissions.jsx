import { useEffect, useState } from 'react'
import { CheckSquare, Square, ShieldOff, Save } from 'lucide-react'
import { supabase } from '../../supabase'
import { trackAdminAudit, MODULES, ROLE_LABELS, getDisplayName } from '../../utils/adminHelpers'
import { useToast } from '../../context/ToastContext'

const PERM_COLS = [
  { key: 'can_view',   label: 'Widok' },
  { key: 'can_create', label: 'Tworzenie' },
  { key: 'can_edit',   label: 'Edycja' },
  { key: 'can_delete', label: 'Usuwanie' },
]

export default function BackendPermissions() {
  const { addToast } = useToast()
  const [users, setUsers]           = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [perms, setPerms]           = useState({})
  const [selectedUser, setSelected] = useState(null)
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)

  async function loadUsers() {
    const { data } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, display_name, role')
      .order('email')
    setUsers(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadUsers()
  }, [])

  async function loadPermissions(userId) {
    const { data } = await supabase
      .from('user_permissions')
      .select('module_key, can_view, can_create, can_edit, can_delete')
      .eq('user_id', userId)

    const map = {}
    for (const p of data ?? []) {
      map[p.module_key] = { can_view: p.can_view, can_create: p.can_create, can_edit: p.can_edit, can_delete: p.can_delete }
    }
    setPerms(map)
  }

  async function handleSelectUser(userId) {
    setSelectedId(userId)
    const user = users.find(u => u.id === userId) ?? null
    setSelected(user)
    if (userId) await loadPermissions(userId)
    else setPerms({})
  }

  function toggle(moduleKey, permKey) {
    setPerms(prev => ({
      ...prev,
      [moduleKey]: {
        ...(prev[moduleKey] ?? {}),
        [permKey]: !(prev[moduleKey]?.[permKey] ?? false),
      },
    }))
  }

  function setAllForModule(moduleKey, value) {
    setPerms(prev => ({
      ...prev,
      [moduleKey]: { can_view: value, can_create: value, can_edit: value, can_delete: value },
    }))
  }

  async function handleSave() {
    if (!selectedId) return
    setSaving(true)
    const upserts = MODULES.map(m => ({
      user_id:    selectedId,
      module_key: m.key,
      can_view:   perms[m.key]?.can_view   ?? false,
      can_create: perms[m.key]?.can_create ?? false,
      can_edit:   perms[m.key]?.can_edit   ?? false,
      can_delete: perms[m.key]?.can_delete ?? false,
    }))

    const { error } = await supabase.from('user_permissions').upsert(upserts, { onConflict: 'user_id,module_key' })
    setSaving(false)

    if (error) { addToast('Błąd: ' + error.message, 'error'); return }

    await trackAdminAudit({
      action: 'permissions_changed',
      targetUserId: selectedId,
      metadata: { email: selectedUser?.email, modules: Object.keys(perms) },
    })
    addToast('Uprawnienia zapisane.', 'success')
  }

  const isOwnerSelected = selectedUser?.role === 'owner'

  return (
    <div>
      {/* User selector */}
      <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
          Wybierz użytkownika
        </label>
        {loading ? (
          <div className="text-sm" style={{ color: 'var(--muted)' }}>Ładowanie…</div>
        ) : (
          <select value={selectedId} onChange={e => handleSelectUser(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', maxWidth: 400 }}>
            <option value="">— Wybierz użytkownika —</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>
                {getDisplayName(u)} ({u.email}) — {ROLE_LABELS[u.role] ?? u.role}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Permissions matrix */}
      {selectedId && (
        <div className="rounded-xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid var(--border)' }}>
            <div>
              <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                Uprawnienia: {selectedUser?.email}
              </span>
              {isOwnerSelected && (
                <span className="ml-2 text-xs px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(124,58,237,0.12)', color: '#7c3aed' }}>
                  Owner — pełne uprawnienia
                </span>
              )}
            </div>
            <button onClick={handleSave} disabled={saving || isOwnerSelected}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40"
              style={{ background: '#7c3aed', color: '#fff' }}>
              <Save size={13} />
              {saving ? 'Zapisywanie…' : 'Zapisz'}
            </button>
          </div>

          {isOwnerSelected ? (
            <div className="p-5 flex items-center gap-2 text-sm" style={{ color: '#7c3aed' }}>
              <ShieldOff size={16} />
              Konto Owner ma zawsze pełne uprawnienia. Nie można ich ograniczyć.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th className="px-5 py-3 text-left font-medium" style={{ color: 'var(--muted)', fontSize: 12 }}>Moduł</th>
                    {PERM_COLS.map(c => (
                      <th key={c.key} className="px-4 py-3 text-center font-medium" style={{ color: 'var(--muted)', fontSize: 12 }}>{c.label}</th>
                    ))}
                    <th className="px-4 py-3 text-center font-medium" style={{ color: 'var(--muted)', fontSize: 12 }}>Wszystkie</th>
                  </tr>
                </thead>
                <tbody>
                  {MODULES.map(m => {
                    const allChecked = PERM_COLS.every(c => perms[m.key]?.[c.key])
                    return (
                      <tr key={m.key} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td className="px-5 py-3 font-medium" style={{ color: 'var(--text)' }}>{m.label}</td>
                        {PERM_COLS.map(c => {
                          const checked = perms[m.key]?.[c.key] ?? false
                          return (
                            <td key={c.key} className="px-4 py-3 text-center">
                              <button onClick={() => toggle(m.key, c.key)}>
                                {checked
                                  ? <CheckSquare size={18} style={{ color: '#7c3aed' }} />
                                  : <Square size={18} style={{ color: 'var(--muted)' }} />}
                              </button>
                            </td>
                          )
                        })}
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => setAllForModule(m.key, !allChecked)}>
                            {allChecked
                              ? <CheckSquare size={18} style={{ color: '#16a34a' }} />
                              : <Square size={18} style={{ color: 'var(--muted)' }} />}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!selectedId && !loading && (
        <div className="py-16 text-center text-sm" style={{ color: 'var(--muted)' }}>
          Wybierz użytkownika z listy powyżej, aby zarządzać jego uprawnieniami.
        </div>
      )}
    </div>
  )
}
