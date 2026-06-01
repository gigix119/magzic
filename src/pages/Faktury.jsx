/**
 * WYMAGANE jednorazowe uruchomienie w Supabase SQL Editor:
 *   ALTER TABLE faktury ADD COLUMN IF NOT EXISTS plik_url text;
 *
 * Oraz w Supabase Storage: utwórz bucket "faktury-pliki" (publiczny).
 */
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { useToast } from '../context/ToastContext'
import { useWorkspace } from '../context/WorkspaceContext'
import Modal from '../components/Modal'
import Spinner from '../components/Spinner'
import InvoiceUploader from '../components/InvoiceUploader'
import { zatwierdźFakturę, cofnijDoRoboczej } from '../utils/magazyn'
import { safeDeleteInvoice, countInvoiceMovements, deleteInvoiceWithInventoryRollback, deleteDraftInvoiceWithOrphanMovements } from '../utils/invoiceDeleteLogic'
import { getPriceHistoryCached, analyzePriceHistory, generatePriceAlerts } from '../utils/priceIntelligence'
import { findBestMatch, advancedSimilarity } from '../utils/productNormalizer'
import { findProductByAlias, rememberProductAlias, rememberSupplierItemName, rememberTypicalPrice, getSupplierItemMapping, rememberSupplierContractorMapping, findSupplierContractorMapping } from '../utils/invoiceLearning'
import { isInvoiceAiAvailable } from '../utils/invoiceAiAdapter'
import { calculateInvoiceQualityMetrics, getQualityBadge } from '../utils/invoiceQualityMetrics'
import { saveCorrectionEvent } from '../utils/invoiceCorrectionTracker'
import { logExtraction, addToReviewQueue } from '../utils/modelLogger'
import InvoiceLearningDebugPanel from '../components/InvoiceLearningDebugPanel'
import { getInvoiceModelConfig } from '../utils/invoiceModelConfig'
import { calculateItemConfidence } from '../utils/invoiceConfidenceEngine'
import { runShadowModelOnResult } from '../utils/invoiceScoringEngine'
import { getAssignmentStatus, isReadyToSave, preparePositionsForInvoiceSave, preparePositionsForInvoiceDraft, recalculateInvoiceLineStatus } from '../utils/invoicePositionValidator'
import { mapParsedPozycjaToFormPozycja, mapPositionToInsertPayload } from '../utils/invoiceLineMapper'
import { findMatchingContractor, prepareContractorFromInvoice } from '../utils/contractorMatcher'
import { ensureContractorForInvoice } from '../utils/contractorService'
import ContractorCombobox from '../components/ContractorCombobox'
import { validateContractorFromPdf } from '../utils/invoiceVerificationStatus'
import { lookupAliasesForItems, upsertAlias } from '../utils/invoiceAliasService'
import { Plus, Bot, TrendingUp, Trash2 } from 'lucide-react'

import { IS, emptyFak, emptyPoz, mkPos } from '../components/invoice/invoiceShared'
import InvoiceList from '../components/invoice/InvoiceList'
import InvoiceUpload from '../components/invoice/InvoiceUpload'
import InvoiceEditorModal from '../components/invoice/InvoiceEditorModal'
import InvoicePositionModal from '../components/invoice/InvoicePositionModal'
import InvoiceEditPositionModal from '../components/invoice/InvoiceEditPositionModal'
import InvoiceApproveModal from '../components/invoice/InvoiceApproveModal'
import InvoiceDeleteRollbackModal from '../components/invoice/InvoiceDeleteRollbackModal'
import InvoiceScoringPanel from '../components/invoice/InvoiceScoringPanel'
import InvoiceVerificationPanel from '../components/invoice/InvoiceVerificationPanel'

export default function Faktury() {
  const { addToast } = useToast()
  const { workspaceId, wsQuery, addWsFilter, wsData } = useWorkspace()
  const fileRef = useRef(null)

  const [faktury, setFaktury] = useState([])
  const [kontrahenci, setKontrahenci] = useState([])
  const [towary, setTowary] = useState([])
  const [magazyny, setMagazyny] = useState([])
  const [pozycje, setPozycje] = useState({})
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  // ── Edit modal (existing invoice) ─────────────────────────────
  const [showFakModal, setShowFakModal] = useState(false)
  const [editFak, setEditFak] = useState(null)
  const [fakForm, setFakForm] = useState(emptyFak)
  const [fakErrors, setFakErrors] = useState({})
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  // ── Add-position modal (existing invoice) ─────────────────────
  const [showPozModal, setShowPozModal] = useState(false)
  const [targetFakId, setTargetFakId] = useState(null)
  const [pozForm, setPozForm] = useState(emptyPoz)
  const [pozErrors, setPozErrors] = useState({})
  const [savingPoz, setSavingPoz] = useState(false)

  // ── New invoice modal ─────────────────────────────────────────
  const [showNModal, setShowNModal] = useState(false)
  const [nFile, setNFile] = useState(null)
  const [nAiLoading, setNAiLoading] = useState(false)
  const [nExtractStatus, setNExtractStatus] = useState('')
  const [nShowForm, setNShowForm] = useState(false)
  const [nAiCount, setNAiCount] = useState(0)
  const [nForm, setNForm] = useState(emptyFak)
  const [nFormErr, setNFormErr] = useState({})
  const [nPositions, setNPositions] = useState([])
  const [nSaving, setNSaving] = useState(false)
  const [nContractorValue, setNContractorValue] = useState(null)
  const [nExtractionLogId, setNExtractionLogId] = useState(null)
  const [nShadowResult, setNShadowResult] = useState(null)
  const [nPriceData, setNPriceData] = useState({})
  const [nExtractedItems, setNExtractedItems] = useState([])
  const [nShowExtracted, setNShowExtracted] = useState(false)
  const [nExtractionResult, setNExtractionResult] = useState(null)
  const [qualityMetrics, setQualityMetrics] = useState(null)
  const [extractedResult, setExtractedResult] = useState(null)
  const [showZatwierdzModal, setShowZatwierdzModal] = useState(false)
  const [zatwierdzFak, setZatwierdzFak] = useState(null)
  const [nDraftZeroPriceConfirmed, setNDraftZeroPriceConfirmed] = useState(false)
  const [nCreateProductFor, setNCreateProductFor] = useState(null)
  const [nNewProductForm, setNNewProductForm] = useState({ nazwa: '', jednostka: 'szt', typ: 'towar', kategoria_id: '' })
  const [nNewProductSaving, setNNewProductSaving] = useState(false)
  const [nNewProductDupeWarning, setNNewProductDupeWarning] = useState(null)
  const [nContractorNipWarning, setNContractorNipWarning] = useState(null)

  // ── Cofnij-i-usuń modal ───────────────────────────────────────
  const [showCofnijDeleteModal, setShowCofnijDeleteModal] = useState(false)
  const [cofnijDeleteFak, setCofnijDeleteFak] = useState(null)
  const [cofnijDeleteRuchyCount, setCofnijDeleteRuchyCount] = useState(0)
  const [cofnijDeleteConfirmed, setCofnijDeleteConfirmed] = useState(false)
  const [cofnijDeleting, setCofnijDeleting] = useState(false)

  // ── Edit position modal (existing invoice) ────────────────────
  const [showEditPozModal, setShowEditPozModal] = useState(false)
  const [editPozTarget, setEditPozTarget] = useState(null)
  const [editPozFak, setEditPozFak] = useState(null)
  const [editPozForm, setEditPozForm] = useState({})
  const [editPozSaving, setEditPozSaving] = useState(false)
  const [editPozErrors, setEditPozErrors] = useState({})
  const [editPozShowCreate, setEditPozShowCreate] = useState(false)
  const [editPozNewTowarForm, setEditPozNewTowarForm] = useState({ nazwa: '', typ: '', jednostka: 'szt', kategoria_id: '' })
  const [editPozNewTowarSaving, setEditPozNewTowarSaving] = useState(false)

  // ─────────────────────────────────────────────────────────────

  async function fetchData() {
    if (!workspaceId) { setLoading(false); return }
    const [{ data: f, error: e1 }, { data: k }, { data: t }, { data: m }, { data: p }] = await Promise.all([
      addWsFilter(wsQuery('faktury').select('*, kontrahenci(nazwa)')).order('data_zakupu', { ascending: false }),
      addWsFilter(wsQuery('kontrahenci').select('id, nazwa, nip')).eq('aktywny', true).order('nazwa'),
      addWsFilter(wsQuery('towary').select('id, nazwa, typ, jednostka')).eq('aktywny', true).order('nazwa'),
      addWsFilter(wsQuery('magazyny').select('id, nazwa')).eq('aktywny', true).order('nazwa'),
      addWsFilter(wsQuery('pozycje_faktury').select('*, towary(nazwa, jednostka), magazyny(nazwa)')),
    ])
    if (e1) { console.error(e1); addToast(e1.message, 'error') }
    setFaktury(f || [])
    setKontrahenci(k || [])
    setTowary(t || [])
    setMagazyny(m || [])
    const map = {}
    for (const poz of p || []) {
      if (!map[poz.faktura_id]) map[poz.faktura_id] = []
      map[poz.faktura_id].push(poz)
    }
    setPozycje(map)
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchData() }, [workspaceId])

  // ── Edit existing invoice ──────────────────────────────────────
  function openEditFak(fak) {
    setEditFak(fak)
    setFakForm({
      numer: fak.numer || '',
      kontrahent_id: fak.kontrahent_id || '',
      data_zakupu: fak.data_zakupu || '',
      typ: fak.typ || 'zakup',
      magazyn_id: fak.magazyn_id || '',
      notatki: fak.notatki || '',
    })
    setFakErrors({})
    setSelectedFile(null)
    setShowFakModal(true)
  }

  function validateFak() {
    const e = {}
    if (!fakForm.numer.trim()) e.numer = true
    if (!fakForm.data_zakupu) e.data_zakupu = true
    setFakErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSaveFak(ev) {
    ev.preventDefault()
    if (!validateFak()) return
    setSaving(true)

    const { data: dupCheck } = await supabase.from('faktury').select('id').eq('numer', fakForm.numer.trim()).neq('id', editFak.id).maybeSingle()
    if (dupCheck) { addToast('Faktura o tym numerze już istnieje', 'error'); setSaving(false); return }

    let plik_url = editFak?.plik_url || null
    if (selectedFile) {
      setUploading(true)
      const path = `${Date.now()}-${selectedFile.name.replace(/[^a-z0-9._-]/gi, '_')}`
      const { data: up, error: upErr } = await supabase.storage
        .from('faktury-pliki').upload(path, selectedFile, { upsert: false })
      setUploading(false)
      if (upErr) { console.error(upErr); addToast(`Upload: ${upErr.message}`, 'error') }
      else { const { data: u } = supabase.storage.from('faktury-pliki').getPublicUrl(up.path); plik_url = u.publicUrl }
    }

    const payload = {
      numer: fakForm.numer.trim(),
      kontrahent_id: fakForm.kontrahent_id || null,
      data_zakupu: fakForm.data_zakupu,
      typ: fakForm.typ,
      magazyn_id: fakForm.magazyn_id || null,
      notatki: fakForm.notatki || null,
      plik_url,
    }
    const { error } = await supabase.from('faktury').update(payload).eq('id', editFak.id)
    if (error) { console.error(error); addToast(error.message, 'error') }
    else { addToast('Faktura zaktualizowana', 'success'); setShowFakModal(false); fetchData() }
    setSaving(false)
  }

  async function handleDeleteFak(fak) {
    const { count, error: checkErr } = await countInvoiceMovements(fak.id, supabase)
    if (checkErr) { addToast('Błąd sprawdzania ruchów magazynowych. Spróbuj ponownie.', 'error'); return }

    if (count > 0) {
      setCofnijDeleteFak(fak)
      setCofnijDeleteRuchyCount(count)
      setCofnijDeleteConfirmed(false)
      setShowCofnijDeleteModal(true)
      return
    }

    if (!window.confirm(`Usunąć fakturę "${fak.numer}"? Usunie też wszystkie pozycje.`)) return
    const result = await safeDeleteInvoice(fak.id, supabase)
    if (!result.success) {
      console.error('[faktury] delete blocked:', result.error)
      addToast(result.error, 'error')
    } else {
      addToast('Faktura usunięta', 'success')
      fetchData()
    }
  }

  async function doDeleteWithRollback() {
    if (!cofnijDeleteFak || !cofnijDeleteConfirmed || cofnijDeleting) return
    setCofnijDeleting(true)
    const fakId = cofnijDeleteFak.id
    const fakStatus = cofnijDeleteFak.status
    const fakNumer = cofnijDeleteFak.numer

    let result
    if (fakStatus === 'robocza') {
      const draftResult = await deleteDraftInvoiceWithOrphanMovements(fakId, supabase)
      result = { ...draftResult, rolledBack: false }
    } else {
      result = await deleteInvoiceWithInventoryRollback(fakId, supabase, cofnijDoRoboczej)
    }

    setCofnijDeleting(false)
    setShowCofnijDeleteModal(false)
    setCofnijDeleteFak(null)
    setCofnijDeleteConfirmed(false)

    if (result.success) {
      addToast(
        fakStatus === 'robocza'
          ? `Faktura ${fakNumer} i powiązane ruchy magazynowe zostały usunięte.`
          : `Faktura ${fakNumer} została cofnięta i usunięta.`,
        'success'
      )
      fetchData()
    } else if (result.rolledBack) {
      addToast(result.error, 'error')
      fetchData()
    } else {
      addToast(result.error, 'error')
    }
  }

  // ── Add position to existing invoice ──────────────────────────
  function openAddPoz(fak) {
    setTargetFakId(fak.id)
    setPozForm({ ...emptyPoz, magazyn_id: fak.magazyn_id || '' })
    setPozErrors({})
    setShowPozModal(true)
  }

  function validatePoz() {
    const e = {}
    if (!pozForm.towar_id) e.towar_id = true
    if (!pozForm.ilosc || Number(pozForm.ilosc) < 0.01) e.ilosc = true
    if (pozForm.cena_netto === '' || pozForm.cena_netto === null || pozForm.cena_netto === undefined) e.cena_netto = true
    setPozErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSavePoz(ev) {
    ev.preventDefault()
    if (!validatePoz()) return
    setSavingPoz(true)

    const { error } = await supabase.from('pozycje_faktury').insert([{
      faktura_id: targetFakId,
      towar_id: pozForm.towar_id,
      magazyn_id: pozForm.magazyn_id || null,
      ilosc: Number(pozForm.ilosc),
      cena_netto: Number(pozForm.cena_netto),
      vat_procent: Number(pozForm.vat_procent) || 23,
      ...wsData(),
    }])
    if (error) { console.error(error); addToast(`Błąd zapisu pozycji: ${error.message}`, 'error'); setSavingPoz(false); return }

    addToast('Pozycja dodana', 'success')
    setShowPozModal(false)
    fetchData()
    setSavingPoz(false)
  }

  async function handleDeletePoz(poz) {
    if (!window.confirm('Usunąć tę pozycję?')) return
    const { error } = await supabase.from('pozycje_faktury').delete().eq('id', poz.id)
    if (error) { console.error(error); addToast(error.message, 'error') }
    else { addToast('Pozycja usunięta', 'success'); fetchData() }
  }

  function openEditPoz(poz, fak) {
    setEditPozTarget(poz)
    setEditPozFak(fak)
    setEditPozForm({
      towar_id: poz.towar_id || '',
      magazyn_id: poz.magazyn_id || fak.magazyn_id || '',
      ilosc: poz.ilosc ?? '',
      cena_netto: poz.cena_netto ?? '',
      vat_procent: poz.vat_procent ?? 23,
      is_service: !poz.towar_id && Number(poz.cena_netto) > 0,
    })
    setEditPozErrors({})
    setEditPozShowCreate(false)
    setEditPozNewTowarForm({ nazwa: poz.towary?.nazwa || '', typ: '', jednostka: 'szt', kategoria_id: '' })
    setShowEditPozModal(true)
  }

  async function handleSaveEditPoz() {
    const errors = {}
    const isService = editPozForm.is_service || (!editPozForm.towar_id && Number(editPozForm.ilosc) > 0)
    if (!isService && !editPozForm.towar_id) errors.towar_id = 'Wybierz towar lub oznacz jako usługę'
    if (!editPozForm.ilosc || Number(editPozForm.ilosc) < 0.001) errors.ilosc = 'Ilość wymagana'
    if (editPozForm.cena_netto === '' || editPozForm.cena_netto === null) errors.cena_netto = 'Cena wymagana'
    setEditPozErrors(errors)
    if (Object.keys(errors).length > 0) return

    setEditPozSaving(true)
    const { error } = await supabase.from('pozycje_faktury').update({
      towar_id: editPozForm.towar_id || null,
      magazyn_id: editPozForm.magazyn_id || null,
      ilosc: Number(editPozForm.ilosc),
      cena_netto: Number(editPozForm.cena_netto),
      vat_procent: Number(editPozForm.vat_procent) || 23,
    }).eq('id', editPozTarget.id)

    if (error) {
      addToast(`Błąd zapisu: ${error.message}`, 'error')
      setEditPozSaving(false)
      return
    }

    addToast('Pozycja zaktualizowana', 'success')
    setShowEditPozModal(false)
    setEditPozTarget(null)
    setEditPozFak(null)
    setEditPozSaving(false)
    fetchData()
  }

  async function handleCreateTowarInEditModal() {
    const { nazwa, typ, jednostka } = editPozNewTowarForm
    if (!nazwa || nazwa.trim().length < 2) { addToast('Podaj nazwę towaru (min. 2 znaki)', 'error'); return }
    setEditPozNewTowarSaving(true)
    const { data: created, error } = await supabase.from('towary').insert([{
      nazwa: nazwa.trim(),
      typ: typ.trim() || nazwa.trim(),
      jednostka: jednostka || 'szt',
      aktywny: true,
      ...wsData(),
    }]).select('id, nazwa, typ, jednostka').single()
    if (error) {
      addToast(`Błąd tworzenia towaru: ${error.message}`, 'error')
      setEditPozNewTowarSaving(false)
      return
    }
    rememberProductAlias(editPozNewTowarForm.nazwa, created.id)
    setTowary(prev => [...prev, created])
    setEditPozForm(f => ({ ...f, towar_id: created.id, is_service: false }))
    setEditPozShowCreate(false)
    setEditPozNewTowarSaving(false)
    addToast(`Towar "${created.nazwa}" utworzony i przypisany`, 'success')
  }

  function handleZatwierdz(fak) {
    if (fak.status === 'zatwierdzona') { addToast('Faktura już zatwierdzona', 'error'); return }
    const pozFaktury = pozycje[fak.id] || []
    if (pozFaktury.length === 0) { addToast('Dodaj najpierw pozycje do faktury', 'error'); return }
    setZatwierdzFak(fak)
    setShowZatwierdzModal(true)
  }

  async function doZatwierdz() {
    if (!zatwierdzFak) return
    const fak = zatwierdzFak
    setShowZatwierdzModal(false)
    setZatwierdzFak(null)
    const mag = magazyny.find(m => m.id === fak.magazyn_id)
    const result = await zatwierdźFakturę(fak.id)
    if (result.success) {
      const info = result.zaktualizowane?.length
        ? `zaktualizowano ${result.zaktualizowane.length} pozycji w ${mag?.nazwa || 'magazynie'}`
        : 'brak pozycji towarowych — faktura oznaczona jako zatwierdzona'
      addToast(`Faktura ${fak.numer} zatwierdzona — ${info}`, 'success')
      fetchData()
      savePriceAlertsForFaktura(fak).catch(err => console.error('savePriceAlerts:', err))
    } else {
      addToast(result.error || 'Błąd zatwierdzenia', 'error')
    }
  }

  async function handleCofnij(fak) {
    if (!window.confirm(`Cofnąć fakturę "${fak.numer}" do roboczej? Stany magazynowe zostaną odwrócone.`)) return
    const result = await cofnijDoRoboczej(fak.id)
    if (result.success) {
      addToast(`Faktura ${fak.numer} cofnięta do roboczej`, 'success')
      fetchData()
    } else {
      addToast(result.error || 'Błąd cofnięcia', 'error')
    }
  }

  function handleContractorChange(val) {
    setNContractorValue(val)
    setNForm(f => ({ ...f, kontrahent_id: val?.existingId || '' }))
  }

  // ── New invoice modal ─────────────────────────────────────────
  function openNewModal() {
    setNFile(null)
    setNAiLoading(false)
    setNExtractStatus('')
    setNShowForm(false)
    setNShowExtracted(false)
    setNExtractedItems([])
    setNExtractionResult(null)
    setQualityMetrics(null)
    setExtractedResult(null)
    setNAiCount(0)
    setNForm({ ...emptyFak, magazyn_id: magazyny[0]?.id || '' })
    setNFormErr({})
    setNPositions([])
    setNContractorValue(null)
    setNExtractionLogId(null)
    setNShadowResult(null)
    setNPriceData({})
    setNCreateProductFor(null)
    setNNewProductForm({ nazwa: '', jednostka: 'szt', typ: 'towar', kategoria_id: '' })
    setNNewProductSaving(false)
    setNNewProductDupeWarning(null)
    setNContractorNipWarning(null)
    setNDraftZeroPriceConfirmed(false)
    setShowNModal(true)
  }

  async function analyzePositionPriceById(key, towarId, cena) {
    const towarNazwa = towary.find(t => t.id === towarId)?.nazwa || ''
    setNPriceData(d => ({ ...d, [key]: { loading: true } }))
    try {
      const history = await getPriceHistoryCached(towarId, supabase)
      const analyzed = analyzePriceHistory(history)
      const kontrahentNazwa =
        kontrahenci.find(k => k.id === (nForm.kontrahent_id || nContractorValue?.existingId))?.nazwa ||
        nContractorValue?.candidate?.nazwa || ''
      const alerts = cena > 0 ? generatePriceAlerts({ cena_netto: cena }, analyzed, kontrahentNazwa) : []
      setNPriceData(d => ({
        ...d,
        [key]: { loading: false, towarNazwa, matchScore: 1.0, history: analyzed, alerts },
      }))
    } catch (err) {
      console.error('analyzePositionPriceById:', err)
      setNPriceData(d => ({ ...d, [key]: { error: 'Błąd pobierania historii cen' } }))
    }
  }

  async function analyzePositionPrice(pos) {
    if (!pos.nazwa.trim()) return
    const match = findBestMatch(pos.nazwa, towary)
    if (!match) {
      setNPriceData(d => ({ ...d, [pos._key]: { error: 'Nie znaleziono pasującego towaru w bazie' } }))
      return
    }
    await analyzePositionPriceById(pos._key, match.product.id, Number(pos.cena_netto))
  }

  function goToManualForm() {
    setNPositions([mkPos({ magazyn_id: magazyny[0]?.id || '' })])
    setNShowExtracted(false)
    setNShowForm(true)
  }

  function updateExtractedItem(idx, field, value) {
    setNExtractedItems(items => items.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  function toggleSkipExtracted(idx) {
    setNExtractedItems(items => items.map((item, i) => i === idx ? { ...item, skipped: !item.skipped } : item))
  }

  function markItemAsService(idx) {
    setNExtractedItems(items => items.map((item, i) => i === idx
      ? { ...item, itemType: 'service_item', shouldAffectInventory: false, matchedProductId: null, matchedProductNazwa: null, matchScore: 0 }
      : item
    ))
  }

  function markItemAsInventory(idx) {
    setNExtractedItems(items => items.map((item, i) => i === idx
      ? { ...item, itemType: 'inventory_item', shouldAffectInventory: true }
      : item
    ))
  }

  function openCreateProductFor(idx) {
    const item = nExtractedItems[idx]
    if (!item) return
    setNNewProductForm({
      nazwa: item.rawName || item.nazwa || '',
      jednostka: item.jednostka || item.unit || 'szt',
      typ: 'towar',
      kategoria_id: '',
    })
    setNNewProductDupeWarning(null)
    setNCreateProductFor(idx)
  }

  async function handleSaveNewProduct() {
    const form = nNewProductForm
    if (!form.nazwa.trim()) { addToast('Podaj nazwę towaru', 'error'); return }
    setNNewProductSaving(true)
    try {
      if (!nNewProductDupeWarning) {
        const { data: dupes } = await supabase.from('towary')
          .select('id, nazwa')
          .ilike('nazwa', `%${form.nazwa.trim().slice(0, 20)}%`)
          .eq('aktywny', true)
          .limit(3)
        if (dupes?.length > 0) {
          setNNewProductDupeWarning(dupes.map(d => d.nazwa).join(', '))
          setNNewProductSaving(false)
          return
        }
      }
      const { data: created, error } = await supabase.from('towary').insert([{
        nazwa: form.nazwa.trim(),
        jednostka: form.jednostka || 'szt',
        typ: form.typ || 'towar',
        kategoria_id: form.kategoria_id || null,
        aktywny: true,
        ...wsData(),
      }]).select('id, nazwa, jednostka, typ').single()
      if (error) throw error

      const _createdIdx = nCreateProductFor
      setNExtractedItems(items => items.map((item, i) => i === _createdIdx
        ? { ...item, matchedProductId: created.id, matchedProductNazwa: created.nazwa, matchScore: null, matchingSource: 'manual_created_from_invoice' }
        : item
      ))
      setTowary(prev => [...prev, created])
      addToast(`Utworzono towar i przypisano go do pozycji. Magazyn zwiększy się dopiero po zatwierdzeniu faktury.`, 'success')
      // Learn alias for newly created product
      if (workspaceId && _createdIdx !== null) {
        const _rawName = nExtractedItems[_createdIdx]?.rawName
        if (_rawName) upsertAlias(workspaceId, _rawName, created.id, supabase).catch(() => {})
      }
      setNCreateProductFor(null)
    } catch (err) {
      addToast(`Błąd tworzenia towaru: ${err.message}`, 'error')
    }
    setNNewProductSaving(false)
  }

  function commitExtractedItems() {
    const defaultMag = nForm.magazyn_id || magazyny[0]?.id || ''
    const active = nExtractedItems.filter(item => !item.skipped)

    const candidatePositions = active.map(item => {
      const mapped = mapParsedPozycjaToFormPozycja(item, defaultMag)
      return mkPos({ ...mapped, typ: '' })
    })

    const { readyToSave, blocked } = preparePositionsForInvoiceSave(candidatePositions, towary)

    if (blocked.length > 0) {
      blocked.forEach(({ position, errors }) => {
        addToast(`Pominięto "${(position.nazwa || '').slice(0, 40)}": ${errors[0]}`, 'info')
      })
    }

    if (readyToSave.length === 0) {
      addToast('Brak gotowych pozycji do zapisania. Uzupełnij ceny i dopasowania.', 'error')
      return
    }

    const supplierNip = nExtractionResult?.fields?.kontrahent_nip
    const supplierId = nForm.kontrahent_id
    for (const item of active) {
      if (!item.matchedProductId || !item.rawName) continue
      if ((item.matchScore ?? 0) < 0.85) continue
      const price = item.unitPriceNet ?? item.cenaNetto ?? 0
      rememberProductAlias(item.rawName, item.matchedProductId)
      if (supplierNip) rememberSupplierItemName(supplierNip, item.rawName, item.matchedProductId)
      if (price > 0 && supplierId) rememberTypicalPrice(item.matchedProductId, supplierId, price)
    }

    setNPositions(readyToSave)
    setNShowExtracted(false)
    setNShowForm(true)

    const initData = {}
    readyToSave.forEach(pos => {
      if (pos._towarId) initData[pos._key] = { loading: true }
    })
    if (Object.keys(initData).length > 0) {
      setNPriceData(initData)
      readyToSave.forEach(pos => {
        if (pos._towarId) {
          analyzePositionPriceById(pos._key, pos._towarId, Number(pos.cena_netto))
        }
      })
    }
  }

  function commitDraftExtractedItems() {
    const defaultMag = nForm.magazyn_id || magazyny[0]?.id || ''
    const active = nExtractedItems.filter(item => !item.skipped)

    const draftCandidates = active.filter(item => {
      const s = getAssignmentStatus(item, towary)
      return s === 'needs_review' || s === 'needs_product' || s === 'needs_price' || s === 'service_cost'
    })

    if (draftCandidates.length === 0) {
      addToast('Brak pozycji do dodania jako robocze.', 'info')
      return
    }

    const hasZeroPrice = draftCandidates.some(i => !((i.unitPriceNet ?? 0) > 0))
    if (hasZeroPrice && !nDraftZeroPriceConfirmed) {
      addToast('Część pozycji ma cenę 0. Zaznacz potwierdzenie przed dodaniem.', 'error')
      return
    }

    const candidatePositions = draftCandidates.map(item => {
      const mapped = mapParsedPozycjaToFormPozycja(item, defaultMag)
      return mkPos({ ...mapped, typ: '', shouldAffectInventory: false, _isDraft: true, invoiceLineStatus: 'review_required' })
    })

    const { draftLines, blocked } = preparePositionsForInvoiceDraft(candidatePositions)

    if (blocked.length > 0) {
      blocked.forEach(({ position, errors }) => {
        addToast(`Pominięto "${(position.nazwa || '').slice(0, 40)}": ${errors[0]}`, 'info')
      })
    }

    if (draftLines.length === 0) {
      addToast('Brak pozycji spełniających minimalne wymagania (nazwa, nie-metadata).', 'error')
      return
    }

    setNPositions(prev => [...prev, ...draftLines])
    setNShowExtracted(false)
    setNShowForm(true)
    addToast(`Dodano ${draftLines.length} pozycji roboczych do weryfikacji. Nie wpłyną na magazyn.`, 'info')
  }

  async function savePriceAlertsForFaktura(fak) {
    const pozFaktury = pozycje[fak.id] || []
    if (!pozFaktury.length) return
    const kontrahentNazwa = kontrahenci.find(k => k.id === fak.kontrahent_id)?.nazwa || ''
    const toInsert = []

    for (const poz of pozFaktury) {
      if (!poz.towar_id) continue
      try {
        const history = await getPriceHistoryCached(poz.towar_id, supabase)
        const analyzed = analyzePriceHistory(history)
        if (!analyzed) continue
        const prAlerts = generatePriceAlerts({ cena_netto: Number(poz.cena_netto) }, analyzed, kontrahentNazwa)
        for (const alert of prAlerts) {
          toInsert.push({
            towar_id: poz.towar_id,
            faktura_id: fak.id,
            kontrahent_id: fak.kontrahent_id || null,
            typ: alert.type,
            severity: alert.severity,
            title: alert.title,
            description: alert.description,
            cena_aktualna: Number(poz.cena_netto),
            cena_referencyjna: analyzed.ostatniaCena ?? null,
            roznica_procent: analyzed.ostatniaCena
              ? ((Number(poz.cena_netto) - analyzed.ostatniaCena) / analyzed.ostatniaCena * 100)
              : null,
            ...wsData(),
          })
        }
      } catch (err) {
        console.error('savePriceAlertsForFaktura poz:', err)
      }
    }

    if (!toInsert.length) return
    const { error } = await supabase.from('alerty_cenowe_faktury').insert(toInsert)
    if (error) console.error('savePriceAlertsForFaktura insert:', error)
    else addToast(`Zapisano ${toInsert.length} alertów cenowych`, 'info')
  }

  async function handleReadAI() {
    if (!nFile) return
    setNAiLoading(true)
    setNExtractStatus('Analizuję plik PDF…')

    const _extractionStartMs = Date.now()

    try {
      const { extractFromFile } = await import('../utils/invoiceExtractor')
      setNExtractStatus('Odczytuję tekst z dokumentu…')

      const result = await extractFromFile(nFile)
      result._fileName = nFile.name

      const _processingMs = Date.now() - _extractionStartMs
      const _logStatus = result.confidence >= 85 ? 'success'
        : result.confidence >= 60 ? 'partial'
        : result.confidence > 0 ? 'review_needed'
        : 'failed'
      logExtraction({
        fileName: nFile.name,
        supplierName: result.fields?.kontrahent_nazwa || null,
        supplierNip: result.fields?.kontrahent_nip || null,
        extractorVersion: '2.0',
        status: _logStatus,
        confidenceTotal: result.confidence / 100,
        processingTimeMs: _processingMs,
        metadata: {
          documentType: result.documentType,
          itemCount: result.fields?.pozycje?.length ?? 0,
          warningsCount: result.warnings?.length ?? 0,
          source: result.source,
        },
      }).then(logId => {
        if (!logId) return
        setNExtractionLogId(logId)
        if (result.confidence < 60) {
          addToReviewQueue({
            extractionLogId: logId,
            reason: `Niska pewność ekstrakcji (${result.confidence}%) — ${nFile.name}`,
            priority: result.confidence < 40 ? 'high' : 'normal',
          }).catch(() => {})
        }
      }).catch(() => {})

      if (result.source === 'pdf_text') {
        setNExtractStatus('Znaleziono tekst w PDF — sprawdź dane')

        if (result.fields.numer) setNForm(f => ({ ...f, numer: result.fields.numer }))
        if (result.fields.data_zakupu) setNForm(f => ({ ...f, data_zakupu: result.fields.data_zakupu }))

        setNContractorNipWarning(null)
        try {
          const pdfCandidate = prepareContractorFromInvoice(result)
          if (pdfCandidate) {
            const { valid: contractorValid, nipOk, warnings: contractorWarnings } = validateContractorFromPdf(pdfCandidate)

            if (!nipOk && nipOk !== null) setNContractorNipWarning(`NIP ${pdfCandidate.nip} — niepoprawna suma kontrolna`)

            const learnedMapping = findSupplierContractorMapping(pdfCandidate.nazwa, pdfCandidate.nip)
            const learnedContractor = learnedMapping ? kontrahenci.find(k => k.id === learnedMapping.contractorId) : null

            if (learnedContractor) {
              handleContractorChange({ existingId: learnedContractor.id, candidate: null, matchStatus: 'learned_history' })
              addToast(`Dopasowano kontrahenta z historii: ${learnedContractor.nazwa}`, 'info')
              if (contractorWarnings.length > 0 && nipOk === false) {
                addToast(`NIP kontrahenta ma niepoprawną sumę kontrolną — sprawdź ręcznie.`, 'warning')
              }
            } else if (!contractorValid) {
              addToast('Nie udało się pewnie odczytać nazwy kontrahenta — wybierz ręcznie.', 'warning')
            } else {
              if (contractorWarnings.length > 0 && nipOk === false) {
                addToast(`NIP kontrahenta ma niepoprawną sumę kontrolną — sprawdź ręcznie.`, 'warning')
              }

              const matchResult = findMatchingContractor(pdfCandidate, kontrahenci)
              if (matchResult.match) {
                const byNip = matchResult.matchedBy === 'nip'
                const isLow = matchResult.confidence === 'low' || matchResult.confidence === 'fuzzy'
                const status = byNip ? 'matched_nip' : isLow ? 'low_confidence' : 'matched_name'
                handleContractorChange({ existingId: matchResult.match.id, candidate: null, matchStatus: status })
                if (byNip && nipOk !== false) {
                  addToast(`Dopasowano kontrahenta po NIP: ${matchResult.match.nazwa}`, 'success')
                } else if (isLow) {
                  addToast(`Słabe dopasowanie kontrahenta: „${matchResult.match.nazwa}" — sprawdź ręcznie.`, 'warning')
                } else {
                  addToast(`Dopasowano kontrahenta po nazwie: ${matchResult.match.nazwa} — sprawdź NIP.`, 'warning')
                }
              } else if (matchResult.suggestions?.length > 0) {
                handleContractorChange({ existingId: null, candidate: pdfCandidate, matchStatus: 'new_from_pdf' })
                const hint = pdfCandidate.nazwa || pdfCandidate.nip
                addToast(`Znaleziono kilka możliwych kontrahentów dla: ${hint} — wybierz ręcznie.`, 'warning')
              } else {
                handleContractorChange({ existingId: null, candidate: pdfCandidate, matchStatus: 'new_from_pdf' })
                const hint = pdfCandidate.nazwa || pdfCandidate.nip
                addToast(`Wykryto kontrahenta z PDF: ${hint}. Zostanie utworzony przy zapisie.`, 'info')
              }
            }
          } else {
            addToast('Nie udało się pewnie odczytać kontrahenta — wybierz ręcznie.', 'warning')
          }
        } catch (contractorErr) {
          console.warn('[Faktury] contractor detection failed (non-critical):', contractorErr?.message)
          addToast('Nie udało się odczytać kontrahenta — wybierz ręcznie.', 'warning')
        }

        setNAiCount(1)
        setNExtractionResult(result)
        setQualityMetrics(calculateInvoiceQualityMetrics(result))
        setExtractedResult(result)

        setNExtractStatus('Dopasowuję pozycje do towarów…')
        const rawItems = result.fields.pozycje || []
        if (rawItems.length > 0) {
          const supplierNip = result.fields.kontrahent_nip
          const matched = rawItems.map(item => {
            if (item.itemType === 'service_item' || item.shouldAffectInventory === false) {
              return { ...item, matchedProductId: null, matchedProductNazwa: null, matchScore: 0, skipped: false }
            }
            const aliasId = findProductByAlias(item.rawName)
            const supplierAliasId = supplierNip ? getSupplierItemMapping(supplierNip, item.rawName) : null
            const knownId = aliasId || supplierAliasId
            if (knownId) {
              const knownProduct = towary.find(t => t.id === knownId)
              if (knownProduct && knownProduct.nazwa && knownProduct.nazwa.length >= 2) {
                return { ...item, matchedProductId: knownId, matchedProductNazwa: knownProduct.nazwa, matchScore: 1.0, skipped: false }
              }
            }
            let bestScore = 0
            let bestProduct = null
            for (const towar of towary) {
              if (!towar.nazwa || towar.nazwa.trim().length < 2) continue
              const { score } = advancedSimilarity(item.rawName, towar)
              if (score > bestScore) { bestScore = score; bestProduct = towar }
            }
            const autoMatch = bestScore >= 0.85
            const hasSuggestion = !autoMatch && bestScore >= 0.65
            return {
              ...item,
              matchedProductId: autoMatch ? (bestProduct?.id ?? null) : null,
              matchedProductNazwa: autoMatch ? (bestProduct?.nazwa ?? null) : null,
              matchScore: bestScore,
              _suggestedProductId: hasSuggestion ? (bestProduct?.id ?? null) : null,
              _suggestedProductNazwa: hasSuggestion ? (bestProduct?.nazwa ?? null) : null,
              skipped: false,
            }
          })

          // ── Alias enrichment — one batch query, cache-first, zero N+1 ────────
          if (workspaceId) {
            try {
              const aliasMap = await lookupAliasesForItems(
                workspaceId,
                matched.map(i => i.rawName).filter(Boolean),
                supabase
              )
              if (aliasMap.size > 0) {
                for (let _ai = 0; _ai < matched.length; _ai++) {
                  const _hit = aliasMap.get(matched[_ai].rawName)
                  if (!_hit) continue
                  const _prod = towary.find(t => t.id === _hit.productId)
                  if (!_prod) continue
                  matched[_ai] = {
                    ...matched[_ai],
                    matchedProductId: _hit.productId,
                    matchedProductNazwa: _prod.nazwa,
                    matchScore: 1.0,
                    matchingSource: 'alias_learned',
                    aliasUsageCount: _hit.usageCount,
                  }
                }
              }
            } catch (_aliasErr) {
              console.warn('[handleReadAI] alias lookup (non-critical):', _aliasErr?.message)
            }
          }

          const modelCfg = getInvoiceModelConfig()
          let shadowData = null
          if (modelCfg.mode !== 'off') {
            try {
              shadowData = runShadowModelOnResult(
                { ...result, fields: { ...result.fields, pozycje: matched } },
                towary,
                modelCfg
              )
              setNShadowResult(shadowData)
            } catch { /* non-critical */ }
          }

          const enriched = shadowData
            ? matched.map((item, idx) => {
                const s = shadowData.itemSuggestions?.[idx]
                if (!s) return item
                const modelScore = s.modelScore
                const modelBestId = s.bestCandidate?.product?.id ?? null
                const matchDisagreement =
                  item.shouldAffectInventory !== false &&
                  item.matchedProductId && modelBestId &&
                  item.matchedProductId !== modelBestId &&
                  modelScore >= modelCfg.thresholds.productReviewMatch
                return {
                  ...item,
                  _modelScore: modelScore,
                  _modelLabel: s.bestCandidate?.confidenceLabel ?? null,
                  _modelCandidatesCount: s.topCandidates.filter(c => c.score >= modelCfg.thresholds.productReviewMatch).length,
                  _matchDisagreement: matchDisagreement,
                  _topCandidates: s.topCandidates
                    .slice(0, 3)
                    .filter(c => c.score > 0.25)
                    .map(c => ({ id: c.product.id, nazwa: c.product.nazwa, score: c.score })),
                  _modelItemType: s.modelItemType !== 'unknown' ? s.modelItemType : null,
                }
              })
            : matched
          const withConfidence = enriched.map(item => {
            try {
              const cr = calculateItemConfidence(item, item._topCandidates || [])
              return {
                ...item,
                confidence: cr.confidence,
                confidenceLevel: cr.level,
                confidenceReasons: cr.reasons,
                confidenceBlockers: cr.blockers,
                autoApproved: cr.autoApproved,
              }
            } catch {
              return item
            }
          })
          setNExtractedItems(withConfidence)
          setNShowExtracted(true)
          result.warnings.forEach(w => addToast(w, 'warning'))
          if (result.confidence >= 40) {
            const needsMatch = enriched.filter(i => !i.skipped && i.itemType !== 'service_item' && !i.matchedProductId).length
            if (needsMatch > 0) {
              addToast(
                `Odczytano ${enriched.length} pozycji, ${needsMatch} wymaga dopasowania towaru — żadna nie trafi do magazynu bez wyboru.`,
                'warning'
              )
            } else {
              addToast(
                `Odczytano dane (pewność: ${result.confidence}%). Sprawdź pozycje przed zatwierdzeniem.`,
                'success'
              )
            }
          }
          return
        }
      } else {
        setNExtractStatus('Wypełnij dane ręcznie')
      }

      result.warnings.forEach(w => addToast(w, 'info'))
      if (result.confidence >= 40) {
        addToast(
          `Odczytano dane (pewność: ${result.confidence}%). Sprawdź przed zatwierdzeniem.`,
          'success'
        )
      }
      setNShowForm(true)
    } catch {
      setNExtractStatus('Nie udało się odczytać — wypełnij ręcznie')
      addToast('Błąd odczytu pliku. Wypełnij formularz ręcznie.', 'error')
      setNShowForm(true)
    } finally {
      setNAiLoading(false)
    }
  }

  function addNPos() {
    setNPositions(ps => [...ps, mkPos({ magazyn_id: magazyny[0]?.id || '' })])
  }

  function removeNPos(idx) {
    setNPositions(ps => ps.filter((_, i) => i !== idx))
  }

  function updateNPos(idx, field, value) {
    setNPositions(ps => ps.map((p, i) => i === idx ? { ...p, [field]: value } : p))
  }

  async function handleSaveNew() {
    const hasContractor = nForm.kontrahent_id || nContractorValue?.candidate?.nazwa?.trim()
    const e = {}
    if (!nForm.numer.trim()) e.numer = true
    if (!nForm.data_zakupu) e.data_zakupu = true
    if (!hasContractor) e.kontrahent_id = true
    if (!nForm.magazyn_id) e.magazyn_id = true
    setNFormErr(e)
    if (Object.keys(e).length > 0) return

    setNSaving(true)
    try {
      const { data: dupCheck } = await supabase.from('faktury').select('id').eq('numer', nForm.numer.trim()).maybeSingle()
      if (dupCheck) { addToast('Faktura o tym numerze już istnieje', 'error'); setNSaving(false); return }

      let fakturaKontrahentId = nForm.kontrahent_id || null
      if (!fakturaKontrahentId && nContractorValue?.candidate?.nazwa?.trim()) {
        try {
          const result = await ensureContractorForInvoice({
            selectedContractorId: null,
            candidateContractor: nContractorValue.candidate,
            contractors: kontrahenci,
            wsDataFn: wsData,
          })
          fakturaKontrahentId = result.id
          if (result.created) {
            setKontrahenci(prev => [...prev, result.contractor])
            addToast(`Kontrahent „${result.contractor.nazwa}" został utworzony`, 'success')
          } else if (result.reusedExisting) {
            addToast(`Użyto istniejącego kontrahenta (duplikat NIP)`, 'info')
          }
        } catch (contractorErr) {
          addToast(`Błąd tworzenia kontrahenta: ${contractorErr.message}`, 'error')
          setNSaving(false)
          return
        }
      }

      if (!fakturaKontrahentId) {
        addToast('Wybierz lub utwórz kontrahenta', 'error')
        setNSaving(false)
        return
      }

      try {
        const resolvedContractor = kontrahenci.find(k => k.id === fakturaKontrahentId)
        const detectedName = extractedResult?.fields?.kontrahent_nazwa || nContractorValue?.candidate?.nazwa
        const detectedNip = extractedResult?.fields?.kontrahent_nip
        if (fakturaKontrahentId && (detectedName || detectedNip)) {
          rememberSupplierContractorMapping(detectedName, detectedNip, fakturaKontrahentId, resolvedContractor?.nazwa)
        }
      } catch { /* non-critical */ }

      let plik_url = null
      if (nFile) {
        const path = `${Date.now()}-${nFile.name.replace(/[^a-z0-9._-]/gi, '_')}`
        const { data: up, error: upErr } = await supabase.storage
          .from('faktury-pliki').upload(path, nFile, { upsert: false })
        if (upErr) { console.error(upErr); addToast(`Upload: ${upErr.message}`, 'error') }
        else { const { data: u } = supabase.storage.from('faktury-pliki').getPublicUrl(up.path); plik_url = u.publicUrl }
      }

      const { data: fakData, error: fakErr } = await supabase.from('faktury').insert([{
        numer: nForm.numer.trim(),
        kontrahent_id: fakturaKontrahentId,
        data_zakupu: nForm.data_zakupu,
        typ: nForm.typ,
        magazyn_id: nForm.magazyn_id || null,
        notatki: nForm.notatki || null,
        plik_url,
        status: 'robocza',
        ...wsData(),
      }]).select().single()
      if (fakErr) throw fakErr

      let pozSaveErrors = 0
      let pozSaveTotal = 0
      let pozSkipped = 0
      for (const poz of nPositions) {
        const rawItemName = (poz.nazwa || poz.rawName || '').trim()
        if (!rawItemName || (rawItemName.length < 2 && !poz._towarId)) {
          console.warn('[faktury] empty_invoice_item_skipped:', rawItemName || '(empty)')
          pozSkipped++
          continue
        }

        let towarId = poz._towarId || null

        if (!towarId && !poz._isDraft && poz.shouldAffectInventory !== false && poz.typ?.trim()) {
          const { data: found } = await supabase.from('towary')
            .select('id').ilike('typ', poz.typ.trim()).eq('aktywny', true).limit(1).maybeSingle()
          if (found) towarId = found.id
        }

        if (!towarId && !poz._isDraft && poz.shouldAffectInventory !== false) {
          console.warn('[faktury] Pominięto pozycję bez towaru:', poz.nazwa)
          continue
        }

        pozSaveTotal++
        const insertPayload = mapPositionToInsertPayload(
          { ...poz, _towarId: towarId },
          fakData.id,
          wsData
        )
        let { error: pozInsertErr } = await supabase.from('pozycje_faktury').insert([insertPayload])
        if (pozInsertErr && (
          pozInsertErr.code === '42703' ||
          pozInsertErr.message?.includes('raw_name') ||
          pozInsertErr.message?.includes('jednostka') ||
          pozInsertErr.message?.includes('schema cache')
        )) {
          // eslint-disable-next-line no-unused-vars
          const { raw_name: _rn, jednostka: _jed, ...corePayload } = insertPayload
          ;({ error: pozInsertErr } = await supabase.from('pozycje_faktury').insert([corePayload]))
        }
        if (pozInsertErr) {
          console.error('Błąd zapisu pozycji:', pozInsertErr)
          pozSaveErrors++
        }
      }

      const fakNumerSaved = nForm.numer.trim()
      if (pozSkipped > 0) {
        console.info(`[faktury] ${pozSkipped} pozycji pominięto jako puste (empty_invoice_item_skipped)`)
      }
      if (pozSaveErrors > 0 && pozSaveErrors === pozSaveTotal) {
        addToast(`Faktura ${fakNumerSaved} zapisana, ale nie udało się zapisać żadnej pozycji. Sprawdź schemat bazy danych.`, 'error')
      } else if (pozSaveErrors > 0) {
        addToast(`Faktura ${fakNumerSaved} zapisana. Nie udało się zapisać ${pozSaveErrors} z ${pozSaveTotal} pozycji.`, 'error')
      } else {
        addToast(`Faktura ${fakNumerSaved} zapisana jako robocza — zatwierdź aby zaktualizować stany`, 'success')
      }

      // Fire-and-forget: learn aliases for all confirmed positions with a product match
      if (workspaceId) {
        nPositions
          .filter(p => (p.rawName || p.nazwa) && p._towarId)
          .forEach(p => upsertAlias(workspaceId, p.rawName || p.nazwa, p._towarId, supabase).catch(() => {}))
      }

      if (extractedResult && extractedResult.source !== 'manual') {
        try {
          const kontrahentNazwa =
            kontrahenci.find(k => k.id === fakturaKontrahentId)?.nazwa ||
            nContractorValue?.candidate?.nazwa ||
            null
          const approvedResult = {
            ...extractedResult,
            fields: {
              ...extractedResult.fields,
              numer: nForm.numer.trim(),
              data_zakupu: nForm.data_zakupu,
              kontrahent_nazwa: kontrahentNazwa || extractedResult.fields?.kontrahent_nazwa,
            },
          }
          saveCorrectionEvent(extractedResult, approvedResult, nExtractionLogId)
        } catch { /* non-critical */ }
      }

      setShowNModal(false)
      fetchData()
    } catch (err) {
      console.error(err)
      addToast(err.message, 'error')
    }
    setNSaving(false)
  }

  async function handleDevDeleteTestInvoices() {
    if (!import.meta.env.DEV) return
    const testFaktury = faktury.filter(f => /^(TEST|DEV)/i.test(f.numer || ''))
    if (testFaktury.length === 0) { addToast('Brak faktur testowych (numer zaczyna się od TEST lub DEV)', 'info'); return }
    const ids = testFaktury.map(f => f.id)
    await supabase.from('ruchy_magazynowe').delete().in('faktura_id', ids)
    await supabase.from('pozycje_faktury').delete().in('faktura_id', ids)
    const { error } = await supabase.from('faktury').delete().in('id', ids)
    if (error) { addToast(`Błąd usuwania: ${error.message}`, 'error'); return }
    addToast(`Usunięto ${ids.length} faktur testowych`, 'success')
    fetchData()
  }

  // ── Thin wrappers for component prop interfaces ───────────────

  function handleFakFormFieldChange(field, value) {
    setFakForm(f => ({ ...f, [field]: value }))
  }

  function handlePozFieldChange(field, value) {
    setPozForm(f => ({ ...f, [field]: value }))
  }

  function handlePozTowarChange(towarId) {
    const t = towary.find(x => x.id === towarId)
    setPozForm(f => ({ ...f, towar_id: towarId, _jednostka: t?.jednostka || '' }))
  }

  function handleEditPozFieldChange(field, value) {
    setEditPozForm(f => ({ ...f, [field]: value }))
  }

  function handleEditPozTowarChange(towarId) {
    const t = towary.find(x => x.id === towarId)
    setEditPozForm(f => ({ ...f, towar_id: towarId, is_service: !towarId }))
    if (t) setEditPozNewTowarForm(v => ({ ...v, nazwa: t.nazwa }))
  }

  function handleEditPozNewTowarFieldChange(field, value) {
    setEditPozNewTowarForm(f => ({ ...f, [field]: value }))
  }

  function handleExtractedProductMatch(idx, towarId, rawName = '') {
    const towarNazwa = towarId ? towary.find(t => t.id === towarId)?.nazwa ?? null : null
    setNExtractedItems(items => items.map((it, i) => i === idx
      ? { ...it, matchedProductId: towarId, matchedProductNazwa: towarNazwa, matchScore: towarId ? 1.0 : 0, matchingSource: towarId ? 'manual_selected' : null }
      : it
    ))
    if (towarId && rawName && workspaceId) {
      upsertAlias(workspaceId, rawName, towarId, supabase).catch(() => {})
    }
  }

  function handleExtractedCandidateSelect(idx, towarId, towarNazwa, score, rawName = '') {
    setNExtractedItems(items => items.map((it, i) => i === idx
      ? { ...it, matchedProductId: towarId, matchedProductNazwa: towarNazwa, matchScore: score, matchingSource: 'manual_selected' }
      : it
    ))
    if (towarId && rawName && workspaceId) {
      upsertAlias(workspaceId, rawName, towarId, supabase).catch(() => {})
    }
  }

  function handleNewProductFormFieldChange(field, value) {
    setNNewProductForm(f => ({ ...f, [field]: value }))
  }

  function handleCloseCreateProduct() {
    setNCreateProductFor(null)
    setNNewProductDupeWarning(null)
  }

  // ─────────────────────────────────────────────────────────────

  if (loading) return <Spinner />

  const canSaveNew = nForm.numer.trim() && nForm.data_zakupu &&
    (nForm.kontrahent_id || nContractorValue?.candidate?.nazwa?.trim()) &&
    nForm.magazyn_id

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3 page-header">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Faktury</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>{faktury.length} faktur</p>
        </div>
        <div className="flex items-center gap-2">
          {import.meta.env.DEV && (
            <button
              onClick={handleDevDeleteTestInvoices}
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium"
              style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fca5a5' }}
              title="Usuwa faktury których numer zaczyna się od TEST lub DEV"
            >
              <Trash2 size={13} /> DEV: usuń testowe
            </button>
          )}
          <button
            onClick={openNewModal}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white page-header-btn"
            style={{ background: '#3b82f6' }}
          >
            <Plus size={16} /> Nowa faktura
          </button>
        </div>
      </div>

      <InvoiceList
        faktury={faktury}
        pozycje={pozycje}
        expanded={expanded}
        towary={towary}
        magazyny={magazyny}
        onToggleExpand={fakId => setExpanded(expanded === fakId ? null : fakId)}
        onZatwierdz={handleZatwierdz}
        onCofnij={handleCofnij}
        onDeleteFak={handleDeleteFak}
        onEditFak={openEditFak}
        onAddPoz={openAddPoz}
        onEditPoz={openEditPoz}
        onDeletePoz={handleDeletePoz}
      />

      {/* ════════════════════════════════════════════════════════════
          NEW AI INVOICE MODAL
          ════════════════════════════════════════════════════════════ */}
      {showNModal && (
        <Modal
          title="Nowa faktura"
          onClose={() => setShowNModal(false)}
          maxWidth={nShowForm ? 'min(1100px, calc(100vw - 48px))' : nShowExtracted ? 'min(900px, calc(100vw - 48px))' : 560}
        >
          {!nShowForm && !nShowExtracted ? (
            /* Phase 1: Upload zone */
            <InvoiceUpload
              file={nFile}
              onFileSelect={f => { setNFile(f); setNAiCount(0) }}
              onClear={() => setNFile(null)}
              onAnalyze={handleReadAI}
              analyzing={nAiLoading}
              analyzed={nAiCount > 0}
              statusText={nExtractStatus}
              onSkipToManual={goToManualForm}
            />
          ) : nShowExtracted && !nShowForm ? (
            /* Phase 1.5: Extracted items review */
            <InvoiceVerificationPanel
              extractedItems={nExtractedItems}
              towary={towary}
              extractionResult={nExtractionResult}
              qualityMetrics={qualityMetrics}
              contractorValue={nContractorValue}
              contractorNipWarning={nContractorNipWarning}
              shadowResult={nShadowResult}
              draftZeroPriceConfirmed={nDraftZeroPriceConfirmed}
              createProductFor={nCreateProductFor}
              newProductForm={nNewProductForm}
              newProductSaving={nNewProductSaving}
              newProductDupeWarning={nNewProductDupeWarning}
              onExtractedItemChange={updateExtractedItem}
              onProductMatch={handleExtractedProductMatch}
              onCandidateSelect={handleExtractedCandidateSelect}
              onToggleSkip={toggleSkipExtracted}
              onMarkService={markItemAsService}
              onMarkInventory={markItemAsInventory}
              onOpenCreateProduct={openCreateProductFor}
              onCloseCreateProduct={handleCloseCreateProduct}
              onDraftZeroPriceConfirmedChange={setNDraftZeroPriceConfirmed}
              onNewProductFormFieldChange={handleNewProductFormFieldChange}
              onSaveNewProduct={handleSaveNewProduct}
              onGoToManualForm={goToManualForm}
              onCommitExtracted={commitExtractedItems}
              onCommitDraftExtracted={commitDraftExtractedItems}
            />
          ) : (
            /* Phase 2: Form + positions */
            <div style={{ paddingRight: 2 }}>
              {nAiCount > 0 && (
                <div className="rounded-lg px-4 py-3 mb-3 text-sm font-medium flex items-center gap-2"
                  style={{ background: '#052e16', color: '#86efac', border: '1px solid #166534' }}>
                  <Bot size={15} />
                  Odczytano dane z dokumentu — sprawdź i uzupełnij pola
                </div>
              )}

              {qualityMetrics && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600 }}>📊 Jakość odczytu:</span>
                    <span style={{ padding: '1px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: getQualityBadge(qualityMetrics).bg, color: getQualityBadge(qualityMetrics).color }}>
                      {getQualityBadge(qualityMetrics).label}
                    </span>
                    <span style={{ color: qualityMetrics.confidence >= 85 ? '#16a34a' : qualityMetrics.confidence >= 60 ? '#d97706' : '#dc2626', fontWeight: 500 }}>
                      {qualityMetrics.confidence}%
                    </span>
                    <span style={{ color: '#64748b' }}>· {qualityMetrics.itemCount} poz. ({qualityMetrics.inventoryItemCount}T {qualityMetrics.serviceItemCount}U)</span>
                    {!qualityMetrics.mathValid && <span style={{ color: '#dc2626', fontWeight: 500 }}>· ❌ Sprawdź matematykę</span>}
                    {qualityMetrics.warningsCount > 0 && <span style={{ color: '#d97706' }}>· ⚠ {qualityMetrics.warningsCount} ostrzeżeń</span>}
                    {nContractorValue?.matchStatus === 'matched_nip' && <span style={{ color: '#16a34a' }}>· ✓ Kontrahent (NIP)</span>}
                    {nContractorValue?.matchStatus === 'matched_name' && <span style={{ color: '#16a34a' }}>· ✓ Kontrahent</span>}
                    {nContractorValue?.matchStatus === 'learned_history' && <span style={{ color: '#16a34a' }}>· ♻ Kontrahent (historia)</span>}
                    {nContractorValue?.matchStatus === 'low_confidence' && <span style={{ color: '#d97706' }}>· ⚠ Sprawdź kontrahenta</span>}
                    {nContractorValue?.matchStatus === 'new_from_pdf' && <span style={{ color: '#1d4ed8' }}>· + Nowy kontrahent (PDF)</span>}
                  </div>
                </div>
              )}

              <div className="faktura-new-grid" style={{ display: 'grid', gridTemplateColumns: nFile ? '1fr 260px' : '1fr', gap: 24, alignItems: 'start' }}>

                <div className="space-y-4 min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                    Dane faktury — sprawdź i zatwierdź
                  </p>

                  <div className="grid grid-cols-2 gap-3 modal-2col">
                    <div>
                      <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Numer *</label>
                      <input
                        style={IS(nFormErr.numer)}
                        value={nForm.numer}
                        onChange={e => setNForm(f => ({ ...f, numer: e.target.value }))}
                        placeholder="np. FV/2025/001"
                      />
                      {nFormErr.numer && <p className="text-xs mt-1" style={{ color: '#dc2626' }}>Pole wymagane</p>}
                    </div>
                    <div>
                      <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Data *</label>
                      <input
                        type="date"
                        style={IS(nFormErr.data_zakupu)}
                        value={nForm.data_zakupu}
                        onChange={e => setNForm(f => ({ ...f, data_zakupu: e.target.value }))}
                      />
                      {nFormErr.data_zakupu && <p className="text-xs mt-1" style={{ color: '#dc2626' }}>Pole wymagane</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 modal-2col">
                    <div>
                      <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Kontrahent *</label>
                      <ContractorCombobox
                        contractors={kontrahenci}
                        value={nContractorValue}
                        onChange={handleContractorChange}
                        hasError={!!nFormErr.kontrahent_id}
                      />
                      {nFormErr.kontrahent_id && <p className="text-xs mt-1" style={{ color: '#dc2626' }}>Wybierz lub wpisz kontrahenta</p>}
                    </div>
                    <div>
                      <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Typ dokumentu</label>
                      <select
                        style={IS()}
                        value={nForm.typ}
                        onChange={e => setNForm(f => ({ ...f, typ: e.target.value }))}
                      >
                        <option value="zakup">Faktura zakupu</option>
                        <option value="sprzedaz">Faktura sprzedaży</option>
                        <option value="wz">WZ</option>
                        <option value="paragon">Paragon</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Magazyn docelowy *</label>
                    <select style={IS(nFormErr.magazyn_id)} value={nForm.magazyn_id} onChange={e => setNForm(f => ({ ...f, magazyn_id: e.target.value }))}>
                      <option value="">— wybierz —</option>
                      {magazyny.map(m => <option key={m.id} value={m.id}>{m.nazwa}</option>)}
                    </select>
                    {nFormErr.magazyn_id && <p className="text-xs mt-1" style={{ color: '#dc2626' }}>Pole wymagane</p>}
                  </div>

                  <div>
                    <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Notatki</label>
                    <textarea
                      style={{ ...IS(), resize: 'vertical', minHeight: 52 }}
                      value={nForm.notatki}
                      onChange={e => setNForm(f => ({ ...f, notatki: e.target.value }))}
                      placeholder="Opcjonalne notatki..."
                    />
                  </div>

                  {/* Positions */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                        Pozycje ({nPositions.length})
                      </p>
                      <button
                        type="button"
                        onClick={addNPos}
                        className="flex items-center gap-1 text-xs rounded-lg px-2.5 py-1 font-medium"
                        style={{ background: 'var(--table-sub)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
                      >
                        <Plus size={11} /> Dodaj pozycję
                      </button>
                    </div>

                    <div className="space-y-2" style={{ maxHeight: 320, overflowY: 'auto', paddingRight: 2 }}>
                      {nPositions.length === 0 && (
                        <p className="text-sm text-center py-6" style={{ color: 'var(--muted)' }}>
                          Brak pozycji — dodaj ręcznie lub odczytaj przez AI
                        </p>
                      )}
                      {nPositions.map((p, idx) => (
                        <div
                          key={p._key}
                          className="rounded-lg p-3 space-y-2"
                          style={{ background: 'var(--table-sub)', border: '1px solid var(--border)' }}
                        >
                          <div className="flex gap-2">
                            <input
                              placeholder="Nazwa towaru"
                              value={p.nazwa}
                              onChange={e => updateNPos(idx, 'nazwa', e.target.value)}
                              style={{ ...IS(), flex: 1, fontSize: 13 }}
                            />
                            <button
                              type="button"
                              onClick={() => removeNPos(idx)}
                              className="p-1.5 rounded flex-shrink-0"
                              style={{ color: '#dc2626' }}
                              title="Usuń pozycję"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                          <div className="grid gap-2 modal-4col" style={{ gridTemplateColumns: '2fr 1fr 1fr 1.3fr' }}>
                            <input
                              placeholder="Typ / kategoria"
                              value={p.typ}
                              onChange={e => updateNPos(idx, 'typ', e.target.value)}
                              style={{ ...IS(), fontSize: 12 }}
                              title="Typ używany do dopasowania istniejącego towaru"
                            />
                            <input
                              type="number"
                              min="0"
                              step="0.001"
                              placeholder="Ilość"
                              value={p.ilosc}
                              onChange={e => updateNPos(idx, 'ilosc', e.target.value)}
                              style={{ ...IS(), fontSize: 12 }}
                            />
                            <input
                              placeholder="j.m."
                              value={p.jednostka}
                              onChange={e => updateNPos(idx, 'jednostka', e.target.value)}
                              style={{ ...IS(), fontSize: 12 }}
                            />
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Cena netto"
                              value={p.cena_netto}
                              onChange={e => updateNPos(idx, 'cena_netto', e.target.value)}
                              style={{ ...IS(), fontSize: 12 }}
                            />
                          </div>
                          <select
                            value={p.magazyn_id}
                            onChange={e => updateNPos(idx, 'magazyn_id', e.target.value)}
                            style={{ ...IS(), fontSize: 12 }}
                          >
                            <option value="">— wybierz magazyn —</option>
                            {magazyny.map(m => <option key={m.id} value={m.id}>{m.nazwa}</option>)}
                          </select>

                          {/* Price analysis */}
                          {(() => {
                            const pd = nPriceData[p._key]
                            return (
                              <>
                                <button
                                  type="button"
                                  onClick={() => analyzePositionPrice(p)}
                                  disabled={pd?.loading}
                                  className="flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1.5 font-medium"
                                  style={{ background: 'var(--table-sub)', color: '#3b82f6', border: '1px solid var(--border)', width: 'fit-content' }}
                                >
                                  <TrendingUp size={11} />
                                  {pd?.loading ? 'Sprawdzam…' : 'Sprawdź cenę'}
                                </button>
                                {pd && !pd.loading && !pd.error && (
                                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
                                    <div style={{ fontWeight: 600, marginBottom: 6, color: '#374151' }}>
                                      📊 Analiza ceny — {pd.towarNazwa}
                                      {pd.matchScore < 1 && (
                                        <span style={{ fontWeight: 400, color: '#94a3b8', marginLeft: 6 }}>
                                          (dopasowanie {Math.round(pd.matchScore * 100)}%)
                                        </span>
                                      )}
                                    </div>
                                    {pd.history ? (
                                      <>
                                        <div style={{ color: '#6b7280' }}>Ostatnia cena: <strong>{pd.history.ostatniaCena?.toFixed(2)} zł</strong></div>
                                        <div style={{ color: '#6b7280' }}>Średnia: <strong>{pd.history.sredniaCena?.toFixed(2)} zł</strong></div>
                                        <div style={{ color: '#6b7280' }}>Zakres: {pd.history.najnizszaCena?.toFixed(2)} – {pd.history.najwyzszaCena?.toFixed(2)} zł</div>
                                        {pd.history.najlepszyDostawca && (
                                          <div style={{ color: '#059669', marginTop: 4 }}>
                                            Najlepszy dostawca: <strong>{pd.history.najlepszyDostawca.nazwa}</strong> ({pd.history.najlepszyDostawca.sredniaCena.toFixed(2)} zł, {pd.history.najlepszyDostawca.liczbaZakupow} zakupów)
                                          </div>
                                        )}
                                        {pd.alerts.map((alert, i) => (
                                          <div key={i} style={{
                                            marginTop: 6, padding: '4px 8px', borderRadius: 4,
                                            background: alert.severity === 'high' ? '#fef2f2' : alert.severity === 'medium' ? '#fffbeb' : '#f0fdf4',
                                            color: alert.severity === 'high' ? '#dc2626' : alert.severity === 'medium' ? '#d97706' : '#16a34a',
                                            fontWeight: 500,
                                          }}>
                                            {alert.title}: {alert.description}
                                          </div>
                                        ))}
                                        {pd.alerts.length === 0 && (
                                          <div style={{ color: '#16a34a', marginTop: 4, fontWeight: 500 }}>✓ Cena w normie</div>
                                        )}
                                      </>
                                    ) : (
                                      <div style={{ color: '#94a3b8' }}>Brak historii zakupów dla tego towaru.</div>
                                    )}
                                  </div>
                                )}
                                {pd?.error && (
                                  <div style={{ color: '#94a3b8', fontSize: 11 }}>{pd.error}</div>
                                )}
                              </>
                            )
                          })()}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="invoice-form-actions flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowNModal(false)}
                      className="flex-1 rounded-lg py-2.5 text-sm font-medium"
                      style={{ background: 'var(--table-sub)', color: 'var(--text-2)' }}
                    >
                      Anuluj
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveNew}
                      disabled={nSaving || !canSaveNew}
                      className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white"
                      style={{
                        background: canSaveNew ? '#3b82f6' : '#6b7280',
                        opacity: nSaving ? 0.7 : 1,
                        cursor: canSaveNew ? 'pointer' : 'not-allowed',
                      }}
                    >
                      {nSaving ? 'Zapisywanie...' : '✅ Zatwierdź i zapisz'}
                    </button>
                  </div>
                </div>

                {nFile && (
                  <div className="flex-shrink-0">
                    <InvoiceUploader
                      file={nFile}
                      onFileSelect={f => { setNFile(f); setNAiCount(0) }}
                      onClear={() => setNFile(null)}
                      onAnalyze={handleReadAI}
                      analyzing={nAiLoading}
                      analyzed={nAiCount > 0}
                      statusText={nExtractStatus}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </Modal>
      )}

      <InvoiceEditorModal
        show={showFakModal}
        onClose={() => setShowFakModal(false)}
        fakForm={fakForm}
        onFieldChange={handleFakFormFieldChange}
        fakErrors={fakErrors}
        selectedFile={selectedFile}
        onFileSelect={setSelectedFile}
        onFileClear={() => setSelectedFile(null)}
        fileRef={fileRef}
        editFak={editFak}
        onSave={handleSaveFak}
        saving={saving}
        uploading={uploading}
        kontrahenci={kontrahenci}
        magazyny={magazyny}
      />

      <InvoicePositionModal
        show={showPozModal}
        onClose={() => { setShowPozModal(false); setPozForm(emptyPoz) }}
        pozForm={pozForm}
        onFieldChange={handlePozFieldChange}
        onTowarChange={handlePozTowarChange}
        pozErrors={pozErrors}
        towary={towary}
        magazyny={magazyny}
        onSave={handleSavePoz}
        saving={savingPoz}
      />

      <InvoiceEditPositionModal
        show={showEditPozModal}
        onClose={() => { setShowEditPozModal(false); setEditPozTarget(null); setEditPozFak(null) }}
        editPozTarget={editPozTarget}
        editPozFak={editPozFak}
        editPozForm={editPozForm}
        onFieldChange={handleEditPozFieldChange}
        onTowarChange={handleEditPozTowarChange}
        editPozErrors={editPozErrors}
        editPozShowCreate={editPozShowCreate}
        onToggleShowCreate={() => setEditPozShowCreate(v => !v)}
        editPozNewTowarForm={editPozNewTowarForm}
        onNewTowarFieldChange={handleEditPozNewTowarFieldChange}
        editPozNewTowarSaving={editPozNewTowarSaving}
        onSave={handleSaveEditPoz}
        saving={editPozSaving}
        onCreateTowar={handleCreateTowarInEditModal}
        towary={towary}
        magazyny={magazyny}
      />

      <InvoiceDeleteRollbackModal
        show={showCofnijDeleteModal}
        onClose={() => { setShowCofnijDeleteModal(false); setCofnijDeleteFak(null); setCofnijDeleteConfirmed(false) }}
        fak={cofnijDeleteFak}
        pozycje={pozycje}
        ruchyCount={cofnijDeleteRuchyCount}
        confirmed={cofnijDeleteConfirmed}
        onConfirmedChange={setCofnijDeleteConfirmed}
        deleting={cofnijDeleting}
        onDelete={doDeleteWithRollback}
      />

      <InvoiceApproveModal
        show={showZatwierdzModal}
        onClose={() => { setShowZatwierdzModal(false); setZatwierdzFak(null) }}
        fak={zatwierdzFak}
        pozycje={pozycje}
        towary={towary}
        magazyny={magazyny}
        onApprove={doZatwierdz}
      />

      {import.meta.env.DEV && <InvoiceLearningDebugPanel />}
    </div>
  )
}
