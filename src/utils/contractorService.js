import { supabase } from '../supabase'
import { normalizeNip, normalizeContractorName, isSameNip } from './contractorMatcher'

/**
 * Creates a contractor if no duplicate exists (by NIP or by normalized name).
 * Returns { id, created: boolean, reusedExisting?: boolean, contractor?: object }
 */
export async function createContractorIfNeeded(candidate, contractors, wsDataFn) {
  if (!candidate?.nazwa?.trim()) {
    throw new Error('Nazwa kontrahenta jest wymagana')
  }

  // Anti-duplicate: NIP check first
  if (candidate.nip) {
    const existing = contractors.find(c => isSameNip(c.nip, candidate.nip))
    if (existing) {
      return { id: existing.id, created: false, reusedExisting: true, contractor: existing }
    }
  }

  // Anti-duplicate: normalized name check
  if (candidate.nazwa) {
    const normName = normalizeContractorName(candidate.nazwa)
    if (normName.length >= 3) {
      const existingByName = contractors.find(c => normalizeContractorName(c.nazwa) === normName)
      if (existingByName) {
        return { id: existingByName.id, created: false, reusedExisting: true, contractor: existingByName }
      }
    }
  }

  const payload = {
    nazwa: candidate.nazwa.trim(),
    nip: normalizeNip(candidate.nip) || null,
    email: candidate.email?.trim() || null,
    telefon: candidate.telefon?.trim() || null,
    adres: candidate.adres?.trim() || null,
    aktywny: true,
    ...wsDataFn(),
  }

  const { data, error } = await supabase
    .from('kontrahenci')
    .insert([payload])
    .select('id, nazwa, nip, email, telefon, adres, aktywny')
    .single()

  if (error) throw error
  return { id: data.id, created: true, contractor: data }
}

/**
 * Resolves the kontrahent_id for an invoice save:
 * - If existingId provided → use it
 * - If candidateContractor provided → create (or reuse by NIP)
 * - Otherwise → throws
 */
export async function ensureContractorForInvoice({
  selectedContractorId,
  candidateContractor,
  contractors,
  wsDataFn,
}) {
  if (selectedContractorId) {
    return { id: selectedContractorId, created: false }
  }

  if (candidateContractor?.nazwa?.trim()) {
    return createContractorIfNeeded(candidateContractor, contractors, wsDataFn)
  }

  throw new Error('Wybierz kontrahenta lub wpisz nazwę nowego kontrahenta')
}
