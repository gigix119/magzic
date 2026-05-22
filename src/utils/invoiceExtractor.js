import * as pdfjs from 'pdfjs-dist'
pdfjs.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'

export async function extractFromFile(file) {
  const result = {
    rawText: '',
    fields: {
      numer: null,
      data_zakupu: null,
      kontrahent_nazwa: null,
      kontrahent_nip: null,
      pozycje: [],
    },
    confidence: 0,
    source: 'manual',
    warnings: [],
  }

  if (file.type === 'application/pdf') {
    try {
      const text = await extractPdfText(file)
      if (text && text.length > 50) {
        result.rawText = text
        result.source = 'pdf_text'
        parseInvoiceText(text, result)
        return result
      }
    } catch {
      result.warnings.push('Nie udało się odczytać tekstu z PDF')
    }
  }

  if (file.type.startsWith('image/')) {
    result.warnings.push(
      'Obrazy wymagają ręcznego uzupełnienia. ' +
      'Dla lepszego odczytu użyj PDF z warstwą tekstową.'
    )
    result.source = 'manual'
    return result
  }

  return result
}

async function extractPdfText(file) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise
  let fullText = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    fullText += content.items.map(item => item.str).join(' ') + '\n'
  }
  return fullText
}

export function parseInvoiceItems(text) {
  const items = []
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 3)

  for (const line of lines) {
    // Wzorzec pełny: nazwa + ilość + jednostka + cena
    const match = line.match(
      /^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(szt|opak|rolka|para|kpl|l|kg|ml)\s+(\d+(?:[.,]\d+)?)/i
    )
    if (match) {
      const ilosc = parseFloat(match[2].replace(',', '.'))
      const cena = parseFloat(match[4].replace(',', '.'))
      if (ilosc > 0 && cena > 0) {
        items.push({
          rawName: match[1].trim(),
          normalizedName: match[1].trim().toLowerCase(),
          quantity: ilosc,
          unit: match[3].toLowerCase(),
          unitPriceNet: cena,
          totalNet: ilosc * cena,
          confidence: 0.7,
          warnings: [],
          matchedProductId: null,
        })
        continue
      }
    }

    // Wzorzec uproszczony: nazwa + cena na końcu linii
    const simpleMatch = line.match(/^(.{5,50}?)\s+(\d+(?:[.,]\d+)?)\s*(?:zł|PLN)?$/)
    if (simpleMatch) {
      const cena = parseFloat(simpleMatch[2].replace(',', '.'))
      if (cena > 0 && cena < 100000) {
        items.push({
          rawName: simpleMatch[1].trim(),
          normalizedName: simpleMatch[1].trim().toLowerCase(),
          quantity: 1,
          unit: 'szt',
          unitPriceNet: cena,
          totalNet: cena,
          confidence: 0.4,
          warnings: ['Niska pewność — sprawdź ilość i jednostkę'],
          matchedProductId: null,
        })
      }
    }
  }

  return items
}

function parseInvoiceText(text, result) {
  const numerMatch = text.match(/(?:faktura|fv|nr|numer)[^\w]*([\w\/\-]+)/i)
  if (numerMatch) {
    result.fields.numer = numerMatch[1]
    result.confidence += 20
  }

  const dataMatch = text.match(/(\d{4}-\d{2}-\d{2}|\d{2}[.\/-]\d{2}[.\/-]\d{4})/)
  if (dataMatch) {
    const raw = dataMatch[1]
    if (raw.includes('-') && raw.indexOf('-') === 4) {
      result.fields.data_zakupu = raw
    } else {
      const parts = raw.split(/[.\/-]/)
      result.fields.data_zakupu = `${parts[2]}-${parts[1]}-${parts[0]}`
    }
    result.confidence += 20
  }

  const nipMatch = text.match(/NIP[:\s]*([\d\-]{10,13})/i)
  if (nipMatch) {
    result.fields.kontrahent_nip = nipMatch[1].replace(/\D/g, '')
    result.confidence += 15
  }

  const kwoty = [...text.matchAll(/(\d+[.,]\d{2})\s*(?:zł|PLN)?/g)]
    .map(m => parseFloat(m[1].replace(',', '.')))
    .filter(n => n > 0)

  if (kwoty.length > 0) result.confidence += 10

  if (result.confidence < 40) {
    result.warnings.push(
      'Nie udało się pewnie odczytać wszystkich pól. ' +
      'Sprawdź i uzupełnij dane ręcznie.'
    )
  }
}
