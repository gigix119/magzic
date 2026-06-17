export const DEFAULT_CHECKLIST = [
  'Pościel zmieniona',
  'Ręczniki rozłożone',
  'Łazienka umyta',
  'Kuchnia czysta',
  'Lodówka pusta i czysta',
  'Podłogi umyte',
  'Kurz starty',
  'Śmieci wyniesione',
  'Okna zamknięte',
  'Termostat ustawiony',
  'Kosmetyki uzupełnione',
  'Drzwi zamknięte na klucz',
]

export function buildChecklistRows(zlecenieId, workspaceId) {
  return DEFAULT_CHECKLIST.map((label, i) => ({
    zlecenie_id: zlecenieId,
    workspace_id: workspaceId,
    label,
    sort_order: i,
  }))
}
