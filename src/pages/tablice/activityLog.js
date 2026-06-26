import { supabase } from '../../supabase'

function displayName(profile, user) {
  if (profile?.first_name || profile?.last_name) {
    return `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
  }
  if (profile?.display_name) return profile.display_name
  return user?.email || 'Użytkownik'
}

/** Fire-and-forget insert do aktywnosc_kart — nigdy nie blokuje/nie rzuca błędu w UI. */
export function logActivity({ workspaceId, kartaId, tablicaId, user, profile, typ, opis, dane }) {
  if (!workspaceId || !tablicaId) return
  supabase.from('aktywnosc_kart').insert([{
    workspace_id: workspaceId,
    karta_id: kartaId || null,
    tablica_id: tablicaId,
    uzytkownik_id: user?.id || null,
    autor_nazwa: displayName(profile, user),
    typ,
    opis,
    dane: dane || {},
  }]).then(({ error }) => { if (error) console.warn('logActivity:', error.message) })
}

export function logActivityBatch(rows) {
  if (!rows.length) return
  supabase.from('aktywnosc_kart').insert(rows).then(({ error }) => { if (error) console.warn('logActivity batch:', error.message) })
}
