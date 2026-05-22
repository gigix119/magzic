// SECURITY: This file no longer contains any API keys or direct AI calls.
// AI analysis is done through invoiceAiAdapter.js which uses a server-side endpoint only.
// The old VITE_ANTHROPIC_API_KEY pattern has been removed.

import { extractFromFile } from './invoiceExtractor.js'
import { analyzeInvoiceWithAi, isInvoiceAiAvailable } from './invoiceAiAdapter.js'
import { sanitizeAiInvoiceResult, validateAiInvoiceSchema, mergeLocalAndAiResult, rejectUnsafeAiInventoryEffects, capConfidenceIfNeeded, guardAgainstServiceToInventoryMatch } from './invoiceAiResultGuard.js'
import { validateInvoiceExtraction, calculateConfidence } from './invoiceValidation.js'

const AI_CONFIDENCE_THRESHOLD = 60

export async function readInvoiceAI(file) {
  // Step 1: always run local parser first
  const localResult = await extractFromFile(file)

  // Step 2: if AI endpoint not configured, return local result with note
  if (!isInvoiceAiAvailable()) {
    if (!localResult.warnings) localResult.warnings = []
    localResult.warnings.push('AI premium nie jest skonfigurowane. Użyto lokalnego parsera i walidacji.')
    return localResult
  }

  // Step 3: if local confidence is sufficient, skip AI
  if (localResult.confidence >= AI_CONFIDENCE_THRESHOLD && !localResult.validation?.errors?.length) {
    return localResult
  }

  // Step 4: send sanitized local result to AI backend
  try {
    const aiInput = {
      parserVersion: '2.0',
      documentText: localResult.rawText?.slice(0, 8000) || '',
      localExtraction: {
        documentType: localResult.documentType,
        confidence: localResult.confidence,
        fields: localResult.fields,
        warnings: localResult.warnings,
      },
      task: 'classify_and_correct_invoice',
    }

    const aiResponse = await analyzeInvoiceWithAi(aiInput)

    if (!aiResponse.available || !aiResponse.result) {
      localResult.warnings.push(`AI niedostępne — ${aiResponse.reason || 'nieznany błąd'}. Użyto lokalnego parsera.`)
      return localResult
    }

    // Step 5: validate and guard AI result
    const raw = sanitizeAiInvoiceResult(aiResponse.result)
    const { valid, errors } = validateAiInvoiceSchema(raw)
    if (!valid) {
      localResult.warnings.push(`AI zwróciło nieprawidłowy wynik (${errors.join(', ')}). Użyto lokalnego parsera.`)
      return localResult
    }

    const guarded = guardAgainstServiceToInventoryMatch(raw)
    const safe = rejectUnsafeAiInventoryEffects(guarded)
    const capped = capConfidenceIfNeeded(safe)

    // Step 6: merge with local result, run local validation again
    const merged = mergeLocalAndAiResult(localResult, capped)
    validateInvoiceExtraction(merged)
    merged.confidence = calculateConfidence(merged, merged.documentType)
    capConfidenceIfNeeded(merged)

    return merged
  } catch (err) {
    localResult.warnings.push(`Błąd warstwy AI: ${err.message}. Użyto lokalnego parsera.`)
    return localResult
  }
}
