/**
 * modelLogger.js
 * Logs invoice extraction events and user corrections to Supabase.
 * Called fire-and-forget — never throws, never blocks UI.
 *
 * Sensitive data rules (enforced here):
 *  - No passwords, tokens, API keys, session data
 *  - No full raw invoice text (only metadata/hashes)
 *  - No personally identifiable data beyond what's already in the invoice header
 */

import { supabase } from '../supabase'

/**
 * Log an invoice extraction attempt.
 * Call this after extraction is complete (success or failure).
 *
 * @param {object} opts
 * @param {string} [opts.invoiceId]        - Supabase invoice row id (if saved)
 * @param {string} [opts.fileName]         - Original file name
 * @param {string} [opts.supplierName]
 * @param {string} [opts.supplierNip]
 * @param {string} [opts.extractorVersion] - e.g. '2.0'
 * @param {string} [opts.modelVersion]     - e.g. '0.1.0'
 * @param {string} [opts.status]           - 'success'|'partial'|'failed'|'review_needed'
 * @param {number} [opts.confidenceTotal]  - 0–1
 * @param {object} [opts.confidenceByField]
 * @param {number} [opts.processingTimeMs]
 * @param {string} [opts.errorMessage]
 * @param {object} [opts.metadata]         - Extra non-sensitive data (no raw text, no secrets)
 * @returns {Promise<string|null>}         - Inserted row id or null on failure
 */
export async function logExtraction({
  invoiceId = null,
  fileName = null,
  supplierName = null,
  supplierNip = null,
  extractorVersion = null,
  modelVersion = null,
  status = 'success',
  confidenceTotal = null,
  confidenceByField = {},
  processingTimeMs = null,
  errorMessage = null,
  metadata = {},
} = {}) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('invoice_extraction_logs')
      .insert({
        user_id:             user.id,
        invoice_id:          invoiceId,
        file_name:           fileName,
        supplier_name:       supplierName,
        supplier_nip:        supplierNip,
        extractor_version:   extractorVersion,
        model_version:       modelVersion,
        extraction_status:   status,
        confidence_total:    typeof confidenceTotal === 'number' ? Math.round(confidenceTotal * 1000) / 1000 : null,
        confidence_by_field: confidenceByField ?? {},
        processing_time_ms:  processingTimeMs,
        error_message:       errorMessage ? String(errorMessage).slice(0, 500) : null,
        metadata:            sanitizeMetadata(metadata),
      })
      .select('id')
      .single()

    if (error) {
      console.warn('[modelLogger] logExtraction failed:', error.message)
      return null
    }
    return data?.id ?? null
  } catch {
    return null
  }
}

/**
 * Log a user correction to an extracted invoice.
 * Call after user saves manual corrections to extracted data.
 *
 * @param {object} opts
 * @param {string} [opts.invoiceId]
 * @param {string} [opts.extractionLogId]  - id from logExtraction()
 * @param {string} [opts.fieldKey]         - which field was corrected
 * @param {string} [opts.originalValue]    - value before correction
 * @param {string} [opts.correctedValue]   - value after correction
 * @param {object} [opts.originalData]     - full extracted row (no raw text)
 * @param {object} [opts.correctedData]    - full corrected row
 */
export async function logCorrection({
  invoiceId = null,
  extractionLogId = null,
  fieldKey = null,
  originalValue = null,
  correctedValue = null,
  originalData = {},
  correctedData = {},
} = {}) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('invoice_user_corrections')
      .insert({
        user_id:           user.id,
        invoice_id:        invoiceId,
        extraction_log_id: extractionLogId,
        field_key:         fieldKey,
        original_value:    originalValue ? String(originalValue).slice(0, 500) : null,
        corrected_value:   correctedValue ? String(correctedValue).slice(0, 500) : null,
        original_data:     sanitizeMetadata(originalData),
        corrected_data:    sanitizeMetadata(correctedData),
        correction_status: 'pending',
      })
      .select('id')
      .single()

    if (error) {
      console.warn('[modelLogger] logCorrection failed:', error.message)
      return null
    }
    return data?.id ?? null
  } catch {
    return null
  }
}

/**
 * Log a model training run (grid search result).
 * Call after owner runs training from the backend panel.
 *
 * @param {object} trainResult - result from trainInvoiceModel()
 * @param {object} config      - current model config
 */
export async function logModelRun(trainResult, config) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const metrics = trainResult?.trainedMetrics ?? trainResult?.baseMetrics ?? {}

    const { data, error } = await supabase
      .from('invoice_model_runs')
      .insert({
        model_version:             config?.version ?? null,
        extractor_version:         '2.0',
        status:                    trainResult?.success ? 'completed' : 'failed',
        training_examples_count:   trainResult?.datasetSize ?? null,
        final_accuracy:            metrics?.documentTypeAccuracy ?? null,
        metrics:                   sanitizeMetadata(metrics),
        started_by:                user.id,
        finished_at:               new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error) {
      console.warn('[modelLogger] logModelRun failed:', error.message)
      return null
    }
    return data?.id ?? null
  } catch {
    return null
  }
}

/**
 * Sync model config to Supabase invoice_model_settings.
 * Owner-only write — silently fails for non-owners.
 */
export async function syncModelConfigToSupabase(config) {
  try {
    const keys = [
      { key: 'model_config',   value: config },
      { key: 'model_version',  value: config?.version ?? '0.1.0' },
      { key: 'model_mode',     value: config?.mode ?? 'off' },
    ]
    for (const { key, value } of keys) {
      await supabase.from('invoice_model_settings').upsert(
        { key, value, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      )
    }
  } catch {
    // Silently fail — settings sync is best-effort
  }
}

/**
 * Add an entry to the review queue for low-confidence extractions.
 */
export async function addToReviewQueue({
  extractionLogId,
  userCorrectionId = null,
  reason,
  priority = 'normal',
} = {}) {
  try {
    await supabase.from('invoice_model_review_queue').insert({
      extraction_log_id:  extractionLogId,
      user_correction_id: userCorrectionId,
      reason,
      priority,
      status: 'pending',
    })
  } catch {
    // Silently fail
  }
}

// ── Private helpers ──────────────────────────────────────────────────────────

const SENSITIVE_KEYS = new Set([
  'password', 'token', 'secret', 'key', 'api_key', 'access_token',
  'refresh_token', 'session', 'cookie', 'authorization', 'private',
  'raw_text', 'fullText', 'raw_invoice_text',
])

function sanitizeMetadata(obj) {
  if (!obj || typeof obj !== 'object') return {}
  const result = {}
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(k.toLowerCase())) continue
    if (typeof v === 'string') {
      result[k] = v.slice(0, 1000)
    } else if (typeof v === 'number' || typeof v === 'boolean' || v === null) {
      result[k] = v
    } else if (typeof v === 'object') {
      result[k] = sanitizeMetadata(v)
    }
  }
  return result
}
