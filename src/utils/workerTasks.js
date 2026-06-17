const PRIORITY_RANK = { pilny: 0, normalny: 1, niski: 2 }
const STATUS_RANK = { w_realizacji: 0, nowe: 1 }

/**
 * Sorts zlecenia for the worker "Dziś" view: urgent first, then in-progress, then new.
 * Pure function — no side effects.
 * @param {Array<{priorytet?: string, status?: string, created_at?: string}>} items
 */
export function sortWorkerTasks(items) {
  return [...items].sort((a, b) => {
    const pa = PRIORITY_RANK[a.priorytet] ?? 1
    const pb = PRIORITY_RANK[b.priorytet] ?? 1
    if (pa !== pb) return pa - pb
    const sa = STATUS_RANK[a.status] ?? 1
    const sb = STATUS_RANK[b.status] ?? 1
    if (sa !== sb) return sa - sb
    return (a.created_at || '').localeCompare(b.created_at || '')
  })
}

/**
 * Suggests a photo label based on checklist completion — early progress is "przed", later is "po".
 * @param {number} checklistPct - 0-100
 */
export function suggestPhotoLabel(checklistPct) {
  return checklistPct >= 50 ? 'po' : 'przed'
}
