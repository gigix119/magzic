const MAX_SIZE = 10 * 1024 * 1024

const SYSTEM_PROMPT = `Jesteś precyzyjnym systemem OCR do odczytu polskich faktur VAT, paragonów i dokumentów WZ.
Przeanalizuj dokument i zwróć WYŁĄCZNIE surowy JSON bez markdown, bez komentarzy, bez backticks.

Format odpowiedzi:
{
  "numer": "numer faktury lub dokumentu",
  "data_zakupu": "YYYY-MM-DD",
  "kontrahent_nazwa": "pełna nazwa firmy dostawcy",
  "kontrahent_nip": "NIP bez kresek lub null",
  "kontrahent_email": "email lub null",
  "kontrahent_telefon": "telefon lub null",
  "kontrahent_adres": "pełny adres lub null",
  "typ": "faktura lub WZ lub paragon",
  "notatki": "dodatkowe uwagi z dokumentu lub null",
  "pozycje": [
    {
      "nazwa": "pełna nazwa towaru z faktury",
      "typ": "uproszczona nazwa typu np. papier toaletowy, żarówka G9, płyn do szyb",
      "ilosc": 10,
      "jednostka": "szt lub litr lub ml lub rolka lub opak lub kg lub para",
      "cena_netto": 5.50
    }
  ]
}

Zasady:
- data zawsze w formacie YYYY-MM-DD
- ilosc i cena_netto zawsze jako liczby (nie stringi)
- jednostka dobieraj na podstawie kontekstu towaru
- typ pozycji to uproszczona nazwa grupująca podobne produkty
- jeśli czegoś nie możesz odczytać wstaw null
- zwróć TYLKO JSON, absolutnie nic więcej`

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function readAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsText(file)
  })
}

export async function readInvoiceAI(file) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'TU_WKLEJ_NOWY_KLUCZ') {
    throw new Error('Brak klucza API. Sprawdź plik .env')
  }
  if (file.size > MAX_SIZE) {
    throw new Error('Plik jest za duży. Maksymalny rozmiar to 10MB.')
  }

  const ext = file.name.split('.').pop().toLowerCase()
  let content

  if (ext === 'csv' || ext === 'xlsx') {
    const text = await readAsText(file)
    content = [{ type: 'text', text: `Oto zawartość dokumentu:\n\n${text}` }]
  } else if (ext === 'pdf') {
    const dataUrl = await readAsDataURL(file)
    const base64 = dataUrl.split(',')[1]
    content = [{
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: base64 },
    }]
  } else if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
    const dataUrl = await readAsDataURL(file)
    const base64 = dataUrl.split(',')[1]
    const mediaType = (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' : `image/${ext}`
    content = [{
      type: 'image',
      source: { type: 'base64', media_type: mediaType, data: base64 },
    }]
  } else {
    throw new Error('Nieobsługiwany format pliku.')
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error?.message || `Błąd API: ${response.status}`)
  }

  const data = await response.json()
  const raw = (data.content?.[0]?.text || '').trim()

  try {
    const jsonStr = raw.startsWith('{') ? raw : raw.replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim()
    return JSON.parse(jsonStr)
  } catch {
    throw new Error('Nie udało się odczytać dokumentu automatycznie. Wypełnij dane ręcznie.')
  }
}
