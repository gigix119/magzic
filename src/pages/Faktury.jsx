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
import Badge from '../components/Badge'
import Spinner from '../components/Spinner'
import InvoiceUploader from '../components/InvoiceUploader'
import { zatwierdźFakturę, cofnijDoRoboczej } from '../utils/magazyn'
import { getPriceHistoryCached, analyzePriceHistory, generatePriceAlerts } from '../utils/priceIntelligence'
import { findBestMatch, advancedSimilarity } from '../utils/productNormalizer'
import { findProductByAlias, rememberProductAlias, rememberSupplierItemName, rememberTypicalPrice, getSupplierItemMapping } from '../utils/invoiceLearning'
import { isInvoiceAiAvailable } from '../utils/invoiceAiAdapter'
import { calculateInvoiceQualityMetrics, getQualityBadge, shouldRequireManualReview, getQualityWarnings } from '../utils/invoiceQualityMetrics'
import { saveCorrectionEvent } from '../utils/invoiceCorrectionTracker'
import { logExtraction, addToReviewQueue } from '../utils/modelLogger'
import InvoiceLearningDebugPanel from '../components/InvoiceLearningDebugPanel'
import { getInvoiceModelConfig } from '../utils/invoiceModelConfig'
import { rankProductCandidates, runShadowModelOnResult } from '../utils/invoiceScoringEngine'
import { getAssignmentStatus, isReadyToSave, preparePositionsForInvoiceSave, preparePositionsForInvoiceDraft, recalculateInvoiceLineStatus } from '../utils/invoicePositionValidator'
import { mapParsedPozycjaToFormPozycja } from '../utils/invoiceLineMapper'
import { findMatchingContractor, prepareContractorFromInvoice } from '../utils/contractorMatcher'
import { ensureContractorForInvoice } from '../utils/contractorService'
import ContractorCombobox from '../components/ContractorCombobox'
import {
  Plus, FileText, ChevronDown, ChevronUp, Trash2, Pencil,
  Upload, Download, File, Image, Table2, X, Bot, CheckCircle2, TrendingUp, AlertTriangle,
} from 'lucide-react'

const IS = (err) => ({
  background: 'var(--input-bg)',
  border: `1px solid ${err ? '#ef4444' : 'var(--border)'}`,
  borderRadius: 8, color: 'var(--text)',
  padding: '8px 12px', fontSize: 14, width: '100%', outline: 'none',
})

const emptyFak = {
  numer: '',
  kontrahent_id: '',
  data_zakupu: new Date().toISOString().slice(0, 10),
  typ: 'zakup',
  magazyn_id: '',
  notatki: '',
}
const emptyPoz = { towar_id: '', ilosc: '', cena_netto: '', vat_procent: 23, magazyn_id: '' }

const AI_TYP_MAP = {
  'faktura': 'zakup', 'faktura vat': 'zakup', 'faktura zakupu': 'zakup', 'zakup': 'zakup',
  'faktura sprzedaży': 'sprzedaz', 'sprzedaż': 'sprzedaz', 'sprzedaz': 'sprzedaz',
  'wz': 'wz', 'dokument wz': 'wz',
  'paragon': 'paragon', 'paragon fiskalny': 'paragon',
}

let _posKey = 0
function mkPos(defaults = {}) {
  return { _key: ++_posKey, nazwa: '', typ: '', ilosc: 1, jednostka: 'szt', cena_netto: 0, magazyn_id: '', ...defaults }
}

function fileIcon(url) {
  if (!url) return null
  const ext = url.split('?')[0].split('.').pop().toLowerCase()
  if (ext === 'pdf') return <File size={14} style={{ color: '#f87171' }} />
  if (ext === 'csv') return <Table2 size={14} style={{ color: '#4ade80' }} />
  return <Image size={14} style={{ color: '#60a5fa' }} />
}

function typBadge(typ) {
  const map = { zakup: ['blue', 'Zakup'], sprzedaz: ['green', 'Sprzedaż'], wz: ['yellow', 'WZ'], paragon: ['zinc', 'Paragon'] }
  const [v, l] = map[typ] || ['zinc', typ]
  return <Badge variant={v}>{l}</Badge>
}

function statusBadge(status) {
  if (status === 'zatwierdzona') return <Badge variant="green">Zatwierdzona</Badge>
  if (status === 'anulowana') return <Badge variant="red">Anulowana</Badge>
  return <Badge variant="zinc">Robocza</Badge>
}

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

  useEffect(() => { fetchData() }, [workspaceId])

  function totalNetto(fakId) {
    return (pozycje[fakId] || []).reduce((s, p) => s + Number(p.ilosc) * Number(p.cena_netto), 0)
  }

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
    if (!window.confirm(`Usunąć fakturę "${fak.numer}"? Usunie też wszystkie pozycje.`)) return
    const { error } = await supabase.from('faktury').delete().eq('id', fak.id)
    if (error) { console.error(error); addToast(error.message, 'error') }
    else { addToast('Faktura usunięta', 'success'); fetchData() }
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

  function getPosBadge(poz, fak) {
    if (!poz.towar_id) return { label: 'Robocza', bg: '#fef3c7', color: '#92400e', border: '#fcd34d' }
    const status = recalculateInvoiceLineStatus(poz, { towary, fakturaDefaultMagazynId: fak?.magazyn_id || null })
    if (status.inventoryImpactStatus === 'ready') return { label: 'Gotowa', bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' }
    if (status.inventoryImpactStatus === 'blocked') return { label: 'Niekompletna', bg: '#fef3c7', color: '#92400e', border: '#fcd34d' }
    if (status.inventoryImpactStatus === 'none') return { label: 'Koszt', bg: '#f0f9ff', color: '#0369a1', border: '#bae6fd' }
    return { label: 'Robocza', bg: '#fef3c7', color: '#92400e', border: '#fcd34d' }
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
    // Keep nForm.kontrahent_id in sync for existing-contractor case
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

  function commitExtractedItems() {
    const defaultMag = nForm.magazyn_id || magazyny[0]?.id || ''
    const active = nExtractedItems.filter(item => !item.skipped)

    // Build candidate positions for validation — use mapper to enforce score threshold
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

    // Learning — remember confirmed product mappings for ready positions (score >= 0.85 only)
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

    // Auto-analyze prices for matched positions
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

    // Take items that are NOT already ready (those go via commitExtractedItems)
    const draftCandidates = active.filter(item => {
      const s = getAssignmentStatus(item, towary)
      return s === 'needs_review' || s === 'needs_product' || s === 'needs_price' || s === 'service_cost'
    })

    if (draftCandidates.length === 0) {
      addToast('Brak pozycji do dodania jako robocze.', 'info')
      return
    }

    // Check for zero-price items requiring explicit confirmation
    const hasZeroPrice = draftCandidates.some(i => !((i.unitPriceNet ?? 0) > 0))
    if (hasZeroPrice && !nDraftZeroPriceConfirmed) {
      addToast('Część pozycji ma cenę 0. Zaznacz potwierdzenie przed dodaniem.', 'error')
      return
    }

    // Use mapper to normalize fields — _towarId only set when score >= 0.85, preventing "towar a" bug
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

      // Fire-and-forget extraction log to Supabase
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

        // Fill header fields
        if (result.fields.numer) setNForm(f => ({ ...f, numer: result.fields.numer }))
        if (result.fields.data_zakupu) setNForm(f => ({ ...f, data_zakupu: result.fields.data_zakupu }))

        // Contractor detection & matching from loaded list (no extra network call)
        const pdfCandidate = prepareContractorFromInvoice(result)
        if (pdfCandidate) {
          const matchResult = findMatchingContractor(pdfCandidate, kontrahenci)
          if (matchResult.match) {
            const status = matchResult.matchedBy === 'nip' ? 'matched_nip' : 'matched_name'
            handleContractorChange({ existingId: matchResult.match.id, candidate: null, matchStatus: status })
            addToast(`Dopasowano kontrahenta: ${matchResult.match.nazwa}`, 'success')
          } else {
            handleContractorChange({ existingId: null, candidate: pdfCandidate, matchStatus: 'new_from_pdf' })
            const hint = pdfCandidate.nazwa || pdfCandidate.nip
            addToast(`Wykryto kontrahenta z PDF: ${hint}. Zostanie utworzony przy zapisie.`, 'info')
          }
        }

        setNAiCount(1)
        setNExtractionResult(result)
        setQualityMetrics(calculateInvoiceQualityMetrics(result))
        setExtractedResult(result)

        // Use structurally-parsed items (already in result.fields.pozycje)
        setNExtractStatus('Dopasowuję pozycje do towarów…')
        const rawItems = result.fields.pozycje || []
        if (rawItems.length > 0) {
          const supplierNip = result.fields.kontrahent_nip
          const matched = rawItems.map(item => {
            // Service items don't get matched to warehouse products (Etap 5)
            if (item.itemType === 'service_item' || item.shouldAffectInventory === false) {
              return { ...item, matchedProductId: null, matchedProductNazwa: null, matchScore: 0, skipped: false }
            }
            // Check learning alias first
            const aliasId = findProductByAlias(item.rawName)
            const supplierAliasId = supplierNip ? getSupplierItemMapping(supplierNip, item.rawName) : null
            const knownId = aliasId || supplierAliasId
            if (knownId) {
              const knownProduct = towary.find(t => t.id === knownId)
              if (knownProduct && knownProduct.nazwa && knownProduct.nazwa.length >= 2) {
                return { ...item, matchedProductId: knownId, matchedProductNazwa: knownProduct.nazwa, matchScore: 1.0, skipped: false }
              }
            }
            // Advanced similarity with diacritics + tech params
            let bestScore = 0
            let bestProduct = null
            for (const towar of towary) {
              const { score } = advancedSimilarity(item.rawName, towar)
              if (score > bestScore) { bestScore = score; bestProduct = towar }
            }
            // Threshold 0.85 for auto-match; 0.65–0.84 = suggestion only; <0.65 = no match
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
          // Shadow model: run once on full extraction result for rich suggestions
          // Provides product candidates, item-type classification, and doc-type scores.
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
          setNExtractedItems(enriched)
          setNShowExtracted(true)
          result.warnings.forEach(w => addToast(w, 'info'))
          if (result.confidence >= 40) {
            addToast(
              `Odczytano dane (pewność: ${result.confidence}%). Sprawdź pozycje przed zatwierdzeniem.`,
              'success'
            )
          }
          return // exit — Phase 1.5 takes over
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

      // 0. Resolve / create contractor
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

      // 1. Upload file to storage
      let plik_url = null
      if (nFile) {
        const path = `${Date.now()}-${nFile.name.replace(/[^a-z0-9._-]/gi, '_')}`
        const { data: up, error: upErr } = await supabase.storage
          .from('faktury-pliki').upload(path, nFile, { upsert: false })
        if (upErr) { console.error(upErr); addToast(`Upload: ${upErr.message}`, 'error') }
        else { const { data: u } = supabase.storage.from('faktury-pliki').getPublicUrl(up.path); plik_url = u.publicUrl }
      }

      // 2. Insert faktura as 'robocza' (stock updated only on approval)
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

      // 3. Process each position (no stock updates — those happen on approval)
      for (const poz of nPositions) {
        if (!poz.nazwa.trim()) continue

        // Use explicit match from extraction
        let towarId = poz._towarId || null

        // For non-draft positions: try to find by typ (manual form only)
        if (!towarId && !poz._isDraft && poz.shouldAffectInventory !== false && poz.typ?.trim()) {
          const { data: found } = await supabase.from('towary')
            .select('id').ilike('typ', poz.typ.trim()).eq('aktywny', true).limit(1).maybeSingle()
          if (found) towarId = found.id
        }

        // Draft / service / review lines → insert with towar_id=null (no auto-create)
        // Non-draft without towar → skip (do not auto-create, rule: NIE twórz towarów automatycznie)
        if (!towarId && !poz._isDraft && poz.shouldAffectInventory !== false) {
          console.warn('[faktury] Pominięto pozycję bez towaru:', poz.nazwa)
          continue
        }

        // Insert position (towar_id may be null for draft/service lines)
        // raw_name: store PDF name for display in draft lines (requires rawname_migration.sql)
        const insertPayload = {
          faktura_id: fakData.id,
          towar_id: towarId || null,
          magazyn_id: poz.magazyn_id || null,
          ilosc: Number(poz.ilosc) || 0,
          cena_netto: Number(poz.cena_netto) || 0,
          vat_procent: Number(poz.vat_procent) || 23,
          raw_name: poz.rawName || poz.raw_name || poz.nazwa || null,
          ...wsData(),
        }
        let { error: pozInsertErr } = await supabase.from('pozycje_faktury').insert([insertPayload])
        // Fallback: if raw_name column does not exist yet (migration not run), retry without it
        if (pozInsertErr?.code === '42703') {
          const { raw_name: _rn, ...payloadWithoutRawName } = insertPayload
          ;({ error: pozInsertErr } = await supabase.from('pozycje_faktury').insert([payloadWithoutRawName]))
        }
        if (pozInsertErr) {
          console.error('Błąd zapisu pozycji:', pozInsertErr)
          addToast(`Błąd zapisu pozycji "${poz.nazwa}": ${pozInsertErr.message}`, 'error')
        }
      }

      addToast(`Faktura ${nForm.numer.trim()} zapisana jako robocza — zatwierdź aby zaktualizować stany`, 'success')

      // Correction tracking — diff what parser extracted vs what user approved
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

  // DEV-only: delete the last N test invoices (numer starts with TEST or DEV)
  async function handleDevDeleteTestInvoices() {
    if (!import.meta.env.DEV) return
    const testFaktury = faktury.filter(f => /^(TEST|DEV)/i.test(f.numer || ''))
    if (testFaktury.length === 0) { addToast('Brak faktur testowych (numer zaczyna się od TEST lub DEV)', 'info'); return }
    const ids = testFaktury.map(f => f.id)
    const { error } = await supabase.from('faktury').delete().in('id', ids)
    if (error) { addToast(`Błąd usuwania: ${error.message}`, 'error'); return }
    addToast(`Usunięto ${ids.length} faktur testowych`, 'success')
    fetchData()
  }

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

      {/* Faktury list */}
      <div className="space-y-2">
        {faktury.length === 0 ? (
          <div className="text-center py-16 rounded-xl" style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
            <FileText size={40} className="mx-auto mb-3 opacity-30" />
            <p>Brak faktur</p>
          </div>
        ) : (
          faktury.map(fak => {
            const isOpen = expanded === fak.id
            const poz = pozycje[fak.id] || []
            const total = totalNetto(fak.id)
            return (
              <div key={fak.id} className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-3 px-5 py-4 faktura-card-row" style={{ background: isOpen ? 'var(--table-odd)' : 'transparent' }}>
                  <button className="flex-1 flex items-center gap-3 text-left min-w-0" onClick={() => setExpanded(isOpen ? null : fak.id)}>
                    <div className="rounded-lg flex items-center justify-center flex-shrink-0" style={{ width: 38, height: 38, background: 'rgba(59,130,246,0.1)' }}>
                      <FileText size={16} style={{ color: '#3b82f6' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold" style={{ color: 'var(--text)', fontFamily: 'DM Mono, monospace', fontSize: 13 }}>{fak.numer}</span>
                        {typBadge(fak.typ)}
                        {statusBadge(fak.status)}
                        {fak.plik_url && <span className="flex items-center gap-1" title="Załączony plik">{fileIcon(fak.plik_url)}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs" style={{ color: 'var(--text-2)' }}>{fak.kontrahenci?.nazwa || '—'}</span>
                        <span style={{ color: 'var(--muted)' }}>·</span>
                        <span className="text-xs" style={{ color: 'var(--text-2)' }}>{fak.data_zakupu}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 mr-2">
                      <p className="font-medium text-sm" style={{ color: 'var(--text)', fontFamily: 'DM Mono, monospace' }}>
                        {total.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł
                      </p>
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>{poz.length} poz.</p>
                    </div>
                    {isOpen ? <ChevronUp size={16} style={{ color: 'var(--muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--muted)' }} />}
                  </button>

                  <div className="flex items-center gap-1 flex-shrink-0 faktura-row-actions">
                    {fak.status === 'robocza' && (
                      <>
                        <button onClick={() => handleZatwierdz(fak)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white" style={{ background: '#22c55e', minHeight: 36 }} title="Zatwierdź fakturę">
                          <CheckCircle2 size={12} /> Zatwierdź
                        </button>
                        <button onClick={() => openAddPoz(fak)} className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'var(--table-sub)', color: 'var(--text-2)', border: '1px solid var(--border)', minHeight: 36 }} title="Dodaj pozycję">
                          <Plus size={12} /> Dodaj poz.
                        </button>
                        {fak.plik_url && (
                          <a href={fak.plik_url} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg flex items-center justify-center" style={{ color: '#3b82f6', minHeight: 36, minWidth: 36 }} title="Pobierz plik">
                            <Download size={13} />
                          </a>
                        )}
                        <button onClick={() => openEditFak(fak)} className="p-1.5 rounded-lg table-action-btn" style={{ color: 'var(--text-2)' }} title="Edytuj"><Pencil size={13} /></button>
                        <button onClick={() => handleDeleteFak(fak)} className="p-1.5 rounded-lg table-action-btn" style={{ color: '#dc2626' }} title="Usuń"><Trash2 size={13} /></button>
                      </>
                    )}
                    {fak.status === 'zatwierdzona' && (
                      <>
                        <button
                          onClick={() => setExpanded(isOpen ? null : fak.id)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                          style={{ background: 'var(--table-sub)', color: 'var(--text-2)', border: '1px solid var(--border)', minHeight: 36 }}
                        >
                          {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />} Pozycje
                        </button>
                        <button
                          onClick={() => handleCofnij(fak)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                          style={{ background: 'rgba(245,158,11,0.08)', color: '#d97706', border: '1px solid #fcd34d', minHeight: 36 }}
                          title="Cofnij do roboczej i odwróć stany magazynowe"
                        >
                          Cofnij
                        </button>
                      </>
                    )}
                    {fak.status === 'anulowana' && (
                      <>
                        {fak.plik_url && (
                          <a href={fak.plik_url} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg flex items-center justify-center" style={{ color: '#3b82f6', minHeight: 36, minWidth: 36 }} title="Pobierz plik">
                            <Download size={13} />
                          </a>
                        )}
                        <button onClick={() => handleDeleteFak(fak)} className="p-1.5 rounded-lg table-action-btn" style={{ color: '#dc2626' }} title="Usuń"><Trash2 size={13} /></button>
                      </>
                    )}
                  </div>
                </div>

                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--border)' }}>
                    {poz.length > 0 ? (
                      <div className="table-scroll-x">
                      <table className="w-full text-sm" style={{ minWidth: 480 }}>
                        <thead>
                          <tr style={{ background: 'var(--table-sub)' }}>
                            <th className="text-left px-5 py-2.5 font-medium" style={{ color: 'var(--muted)', fontSize: 12 }}>Towar</th>
                            <th className="text-right px-5 py-2.5 font-medium" style={{ color: 'var(--muted)', fontSize: 12 }}>Ilość</th>
                            <th className="text-right px-4 py-2.5 font-medium hidden sm:table-cell" style={{ color: 'var(--muted)', fontSize: 12 }}>Jednostka</th>
                            <th className="text-right px-5 py-2.5 font-medium" style={{ color: 'var(--muted)', fontSize: 12 }}>Cena netto</th>
                            <th className="text-right px-4 py-2.5 font-medium hidden sm:table-cell" style={{ color: 'var(--muted)', fontSize: 12 }}>VAT%</th>
                            <th className="text-right px-5 py-2.5 font-medium" style={{ color: 'var(--muted)', fontSize: 12 }}>Suma netto</th>
                            <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell" style={{ color: 'var(--muted)', fontSize: 12 }}>Status</th>
                            <th className="px-3 py-2.5" />
                          </tr>
                        </thead>
                        <tbody>
                          {poz.map(p => {
                            const badge = getPosBadge(p, fak)
                            return (
                            <tr key={p.id} className="table-row" style={{ borderTop: '1px solid var(--border)' }}>
                              <td className="px-5 py-3" style={{ color: 'var(--text)' }}>
                                {(() => {
                                  // Guard: treat product names shorter than 2 chars (e.g. "a") as unassigned
                                  const productName = (p.towary?.nazwa?.length >= 2) ? p.towary.nazwa : null
                                  const displayNazwa = productName || p.raw_name || p.rawName || p.nazwa || null
                                  if (!displayNazwa) {
                                    return <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>(brak towaru)</span>
                                  }
                                  return (
                                    <div>
                                      <div style={{ fontWeight: 500, fontSize: 13 }}>{displayNazwa}</div>
                                      {productName && (p.raw_name || p.rawName) && productName !== (p.raw_name || p.rawName) && (
                                        <div style={{ fontSize: 10, color: 'var(--text-2)' }}>PDF: {p.raw_name || p.rawName}</div>
                                      )}
                                      {(p.indeks || p.sku) && (
                                        <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-2)', marginTop: 1 }}>{p.indeks || p.sku}</div>
                                      )}
                                    </div>
                                  )
                                })()}
                              </td>
                              <td className="px-5 py-3 text-right" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-2)' }}>{p.ilosc}</td>
                              <td className="px-4 py-3 text-right hidden sm:table-cell" style={{ color: 'var(--text-2)' }}>
                                {(p.towary?.nazwa?.length >= 2 ? p.towary?.jednostka : null) || '—'}
                              </td>
                              <td className="px-5 py-3 text-right" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-2)' }}>{Number(p.cena_netto).toFixed(2)} zł</td>
                              <td className="px-4 py-3 text-right hidden sm:table-cell" style={{ color: 'var(--text-2)' }}>{p.vat_procent ?? 23}%</td>
                              <td className="px-5 py-3 text-right font-medium" style={{ fontFamily: 'DM Mono, monospace', color: '#3b82f6' }}>{(Number(p.ilosc) * Number(p.cena_netto)).toFixed(2)} zł</td>
                              <td className="px-4 py-3 hidden sm:table-cell">
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
                                  {badge.label}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-right">
                                {fak.status === 'robocza' && (
                                  <div className="flex gap-1 justify-end">
                                    <button onClick={() => openEditPoz(p, fak)} className="p-1 rounded" style={{ color: 'var(--text-2)' }} title="Edytuj pozycję"><Pencil size={12} /></button>
                                    <button onClick={() => handleDeletePoz(p)} className="p-1 rounded" style={{ color: '#dc2626' }} title="Usuń pozycję"><Trash2 size={12} /></button>
                                  </div>
                                )}
                              </td>
                            </tr>
                            )
                          })}
                        </tbody>
                        <tfoot>
                          <tr style={{ borderTop: '1px solid var(--border)' }}>
                            <td colSpan={6} className="px-5 py-3 text-right text-sm font-medium" style={{ color: 'var(--text-2)' }}>Razem netto:</td>
                            <td className="px-5 py-3 text-right font-semibold" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text)' }}>{total.toFixed(2)} zł</td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                      </div>
                    ) : (
                      <p className="text-sm text-center py-4" style={{ color: 'var(--muted)' }}>Brak pozycji</p>
                    )}

                    <div className="px-5 py-3" style={{ borderTop: '1px solid var(--border)' }}>
                      <button onClick={() => openAddPoz(fak)} className="flex items-center gap-1.5 text-xs rounded-lg px-3 py-1.5 font-medium" style={{ background: 'var(--table-sub)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                        <Plus size={12} /> Dodaj pozycję
                      </button>
                    </div>

                    {fak.notatki && (
                      <div className="px-5 py-3 text-sm" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-2)' }}>
                        <span className="font-medium" style={{ color: 'var(--muted)' }}>Notatki: </span>{fak.notatki}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════
          NEW AI INVOICE MODAL
          ════════════════════════════════════════════════════════════ */}
      {showNModal && (
        <Modal
          title="Nowa faktura"
          onClose={() => setShowNModal(false)}
          maxWidth={nShowForm ? 940 : nShowExtracted ? 800 : 560}
        >
          {!nShowForm && !nShowExtracted ? (
            /* Phase 1: Upload zone */
            <div className="space-y-4">
              <InvoiceUploader
                file={nFile}
                onFileSelect={f => { setNFile(f); setNAiCount(0) }}
                onClear={() => setNFile(null)}
                onAnalyze={handleReadAI}
                analyzing={nAiLoading}
                analyzed={nAiCount > 0}
                statusText={nExtractStatus}
              />
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={goToManualForm}
                  className="text-xs"
                  style={{ color: 'var(--muted)' }}
                >
                  Pomiń — wypełnij ręcznie
                </button>
              </div>
            </div>
          ) : nShowExtracted && !nShowForm ? (
            /* Phase 1.5: Extracted items review */
            <div>
              {/* Source badge + AI availability */}
              {nExtractionResult && (
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    background: nExtractionResult.source === 'pdf_text_ai' ? '#eff6ff' : '#f0fdf4',
                    color: nExtractionResult.source === 'pdf_text_ai' ? '#1d4ed8' : '#15803d',
                    border: `1px solid ${nExtractionResult.source === 'pdf_text_ai' ? '#bfdbfe' : '#bbf7d0'}`,
                    borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 600,
                  }}>
                    {nExtractionResult.source === 'pdf_text_ai' ? '🤖 Odczyt lokalny + AI' :
                     nExtractionResult.source === 'pdf_text' ? '📄 Odczyt lokalny' :
                     '✍️ Wymaga ręcznej weryfikacji'}
                  </span>
                  {!isInvoiceAiAvailable() && nExtractionResult.source !== 'pdf_text_ai' && (
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>AI premium nie jest skonfigurowane</span>
                  )}
                </div>
              )}
              {/* Document type banner */}
              {nExtractionResult?.documentType === 'inventory_purchase_invoice' && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', marginBottom: 10, fontSize: 13, color: '#166534' }}>
                  <strong>Faktura zakupowa magazynowa</strong> — po zatwierdzeniu pozycje oznaczone jako <strong>Towar</strong> mogą zwiększyć stany magazynowe.
                </div>
              )}
              {nExtractionResult?.documentType && ['telecom_invoice','utility_invoice','service_cost_invoice'].includes(nExtractionResult.documentType) && (
                <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 14px', marginBottom: 10, fontSize: 13, color: '#92400e' }}>
                  <strong>Faktura usługowa/kosztowa</strong> — pozycje nie zwiększą stanów magazynowych. Zostaną zapisane jako koszty.
                </div>
              )}
              {nExtractionResult?.documentType === 'unknown' && nExtractedItems.some(i => i.itemType === 'inventory_item') && nExtractedItems.some(i => i.itemType === 'service_item') && (
                <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '10px 14px', marginBottom: 10, fontSize: 13, color: '#0369a1' }}>
                  <strong>Faktura mieszana</strong> — tylko pozycje oznaczone jako <strong>Towar</strong> wpłyną na magazyn.
                </div>
              )}
              {nExtractionResult?.debug?.ksefComarchDetected && (
                <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 8, padding: '10px 14px', marginBottom: 10, fontSize: 13, color: '#78350f' }}>
                  <strong>Wykryto dokument KSeF/Comarch</strong> — pominięto metadane systemowe (Uwagi/Remarks, Nr wiersza itp.), które nie są pozycjami faktury.
                  {nExtractionResult.debug.ksefMetadataBlocked > 0 && (
                    <span> Zablokowano {nExtractionResult.debug.ksefMetadataBlocked} linie metadanych.</span>
                  )}
                </div>
              )}
              {/* Quality metrics panel */}
              {qualityMetrics && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 16px', marginBottom: 12, fontSize: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>📊 Jakość odczytu</span>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: getQualityBadge(qualityMetrics).bg, color: getQualityBadge(qualityMetrics).color }}>
                      {getQualityBadge(qualityMetrics).label}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    <div>
                      <div style={{ color: '#64748b' }}>Źródło</div>
                      <div style={{ fontWeight: 500 }}>
                        {qualityMetrics.source === 'pdf_text' ? '📄 Lokalny' : qualityMetrics.source?.includes('ai') ? '🤖 AI' : '✍️ Ręczny'}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#64748b' }}>Pewność</div>
                      <div style={{ fontWeight: 500, color: qualityMetrics.confidence >= 85 ? '#16a34a' : qualityMetrics.confidence >= 60 ? '#d97706' : '#dc2626' }}>
                        {qualityMetrics.confidence}%
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#64748b' }}>Typ dokumentu</div>
                      <div style={{ fontWeight: 500 }}>
                        {qualityMetrics.documentType === 'inventory_purchase_invoice' ? '🏭 Zakupowy'
                          : qualityMetrics.documentType?.includes('telecom') ? '📱 Telecom'
                          : qualityMetrics.documentType?.includes('service') ? '🔧 Usługowy'
                          : qualityMetrics.documentType?.includes('utility') ? '⚡ Media'
                          : '❓ Nieznany'}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#64748b' }}>Pozycje</div>
                      <div style={{ fontWeight: 500 }}>{qualityMetrics.itemCount} ({qualityMetrics.inventoryItemCount} towarów, {qualityMetrics.serviceItemCount} usług)</div>
                    </div>
                    <div>
                      <div style={{ color: '#64748b' }}>Matematyka</div>
                      <div style={{ fontWeight: 500, color: qualityMetrics.mathValid ? '#16a34a' : '#dc2626' }}>
                        {qualityMetrics.mathValid ? '✅ OK' : '❌ Sprawdź'}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#64748b' }}>Ostrzeżenia</div>
                      <div style={{ fontWeight: 500, color: qualityMetrics.warningsCount === 0 ? '#16a34a' : '#d97706' }}>
                        {qualityMetrics.warningsCount}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#64748b' }}>Kontrahent</div>
                      <div style={{ fontWeight: 500,
                        color: nContractorValue?.matchStatus === 'matched_nip' || nContractorValue?.matchStatus === 'matched_name' ? '#16a34a'
                          : nContractorValue?.matchStatus === 'new_from_pdf' ? '#1d4ed8'
                          : '#d97706' }}>
                        {nContractorValue?.matchStatus === 'matched_nip' ? '✓ NIP'
                          : nContractorValue?.matchStatus === 'matched_name' ? '✓ Nazwa'
                          : nContractorValue?.matchStatus === 'new_from_pdf' ? '+ Nowy (PDF)'
                          : nContractorValue?.matchStatus === 'new_manual' ? '+ Nowy'
                          : '— brak'}
                      </div>
                    </div>
                  </div>
                  {qualityMetrics.errorsCount > 0 && (
                    <div style={{ marginTop: 8, padding: '6px 10px', background: '#fef2f2', borderRadius: 4, color: '#991b1b', fontSize: 11 }}>
                      ❌ {qualityMetrics.errorsCount} błędów — wymagane ręczne uzupełnienie
                    </div>
                  )}
                  {qualityMetrics.supplierTemplate && (
                    <div style={{ marginTop: 8, padding: '6px 10px', background: '#f0fdf4', borderRadius: 4, color: '#166534', fontSize: 11 }}>
                      Wykryto dostawcę: <strong>{qualityMetrics.supplierTemplate.name}</strong>
                      {' '}(match: {qualityMetrics.supplierTemplate.matchedBy})
                      — zastosowano reguły specyficzne dla tego dostawcy
                    </div>
                  )}
                  {shouldRequireManualReview(qualityMetrics) && (() => {
                    const warnings = getQualityWarnings(qualityMetrics)
                    return (
                      <div style={{ marginTop: 8, padding: '8px 10px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 4, fontSize: 11, color: '#9a3412' }}>
                        <strong>⚠ Sprawdź dane przed zatwierdzeniem.</strong> System nie zapisze zmian automatycznie.
                        {warnings.length > 0 && (
                          <ul style={{ margin: '4px 0 0 16px' }}>
                            {warnings.map((w, i) => <li key={i}>{w}</li>)}
                          </ul>
                        )}
                      </div>
                    )
                  })()}
                  {nShadowResult?.documentScores && (
                    <div style={{ marginTop: 8, fontSize: 11, color: '#475569', borderTop: '1px solid #e2e8f0', paddingTop: 6, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, color: '#64748b' }}>Ocena modelu:</span>
                      <span title="Sygnały magazynowe">🏭 {Math.round((nShadowResult.documentScores.inventoryScore ?? 0) * 100)}%</span>
                      <span title="Sygnały usługowe">🔧 {Math.round((nShadowResult.documentScores.serviceScore ?? 0) * 100)}%</span>
                      {(nShadowResult.documentScores.telecomScore ?? 0) > 0.1 && (
                        <span title="Sygnały telecom">📱 {Math.round(nShadowResult.documentScores.telecomScore * 100)}%</span>
                      )}
                      {(nShadowResult.documentScores.utilityScore ?? 0) > 0.1 && (
                        <span title="Sygnały media">⚡ {Math.round(nShadowResult.documentScores.utilityScore * 100)}%</span>
                      )}
                    </div>
                  )}
                  <div style={{ marginTop: 8, fontSize: 11, color: '#94a3b8', borderTop: '1px solid #e2e8f0', paddingTop: 6 }}>
                    System przygotował propozycję. Sprawdź dane przed zatwierdzeniem.
                  </div>
                </div>
              )}
              {nExtractionResult?.validation && (() => {
                const v = nExtractionResult.validation
                const isError = v.suggestedAction === 'manual_required'
                const isWarn = v.suggestedAction === 'review_required'
                const bg = isError ? '#1a0000' : isWarn ? '#1a1200' : '#001a00'
                const fg = isError ? '#f87171' : isWarn ? '#fbbf24' : '#86efac'
                const border = isError ? '#7f1d1d' : isWarn ? '#78350f' : '#166534'
                const label = isError ? '⚠ Wymagane ręczne uzupełnienie' : isWarn ? '⚡ Weryfikacja zalecana' : '✓ Dane odczytane'
                const msgs = [...v.errors.slice(0, 2), ...v.warnings.slice(0, 2)]
                return (
                  <div className="rounded-lg px-4 py-3 mb-3 text-xs" style={{ background: bg, color: fg, border: `1px solid ${border}` }}>
                    <div className="flex items-center gap-2 font-semibold text-sm">
                      <span>{label}</span>
                      <span className="ml-auto opacity-70">Pewność: {nExtractionResult.confidence}%</span>
                    </div>
                    {msgs.length > 0 && (
                      <ul className="mt-1 space-y-0.5 opacity-85">
                        {msgs.map((m, i) => <li key={i}>· {m}</li>)}
                      </ul>
                    )}
                  </div>
                )
              })()}
              {(() => {
                const statuses = nExtractedItems.map(i => getAssignmentStatus(i, towary))
                const readyCount = statuses.filter(s => isReadyToSave(s)).length
                const serviceCostCount = statuses.filter(s => s === 'service_cost').length
                const reviewCount = statuses.filter(s => s === 'needs_review' || s === 'needs_product' || s === 'needs_price').length
                const ignoredCount = statuses.filter(s => s === 'ignored').length
                const draftableCount = reviewCount + (statuses.filter(s => s === 'service_cost').length - (isReadyToSave('service_cost') ? statuses.filter(s => s === 'service_cost').length : 0))
                return (
                  <div className="mb-3">
                    <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                      Znaleziono <strong>{nExtractedItems.length}</strong> pozycji —{' '}
                      <span style={{ color: '#16a34a' }}>gotowe do magazynu: {readyCount}</span>
                      {reviewCount > 0 && <span style={{ color: '#d97706' }}>, do weryfikacji: {reviewCount}</span>}
                      {serviceCostCount > 0 && <span style={{ color: '#7c3aed' }}>, koszty/usługi: {serviceCostCount}</span>}
                      {ignoredCount > 0 && <span style={{ color: 'var(--muted)' }}>, odrzucone metadane: {ignoredCount}</span>}
                    </p>
                    {(reviewCount > 0 || draftableCount > 0) && (
                      <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                        Pozycje do weryfikacji możesz dodać do faktury jako robocze. Nie zwiększą stanów magazynowych, dopóki nie wybierzesz towaru i magazynu.
                      </p>
                    )}
                  </div>
                )
              })()}
              <div className="table-scroll-x" style={{ maxHeight: 360, overflowY: 'auto' }}>
                <table className="w-full text-sm" style={{ minWidth: 580 }}>
                  <thead>
                    <tr style={{ background: 'var(--table-sub)', position: 'sticky', top: 0 }}>
                      <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--muted)', fontSize: 11 }}>Odczytana nazwa</th>
                      <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--muted)', fontSize: 11 }}>Towar w bazie</th>
                      <th className="text-right px-3 py-2 font-medium" style={{ color: 'var(--muted)', fontSize: 11 }}>Ilość</th>
                      <th className="text-right px-3 py-2 font-medium" style={{ color: 'var(--muted)', fontSize: 11 }}>Cena</th>
                      <th className="text-center px-3 py-2 font-medium" style={{ color: 'var(--muted)', fontSize: 11 }}>Pewność</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {nExtractedItems.map((item, idx) => {
                      const assignStatus = getAssignmentStatus(item, towary)
                      const borderColor = assignStatus === 'ready' || assignStatus === 'service_cost' ? '#16a34a'
                        : assignStatus === 'needs_review' ? '#d97706'
                        : assignStatus === 'needs_price' || assignStatus === 'needs_product' ? '#ef4444'
                        : '#94a3b8'
                      const statusLabel = {
                        ready: { text: '✓ gotowa', bg: '#dcfce7', color: '#166534' },
                        service_cost: { text: '✓ usługa', bg: '#f0fdf4', color: '#166534' },
                        needs_review: { text: '⚠ sprawdź', bg: '#fef9c3', color: '#854d0e' },
                        needs_price: { text: '✗ brak ceny', bg: '#fee2e2', color: '#991b1b' },
                        needs_product: { text: '✗ brak towaru', bg: '#fee2e2', color: '#991b1b' },
                        ignored: { text: '– pominięta', bg: '#f3f4f6', color: '#6b7280' },
                      }[assignStatus] || { text: assignStatus, bg: '#f3f4f6', color: '#6b7280' }
                      return (
                        <tr
                          key={idx}
                          style={{
                            opacity: item.skipped ? 0.35 : 1,
                            borderTop: '1px solid var(--border)',
                            borderLeft: `3px solid ${borderColor}`,
                          }}
                        >
                          <td className="px-3 py-2 text-xs" style={{ color: 'var(--text)' }}>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span>{item.rawName}</span>
                              {item.itemType === 'inventory_item' && (
                                <span style={{ background: '#dcfce7', color: '#166534', borderRadius: 4, padding: '1px 5px', fontSize: 10, fontWeight: 600 }}>Towar</span>
                              )}
                              {item.itemType === 'service_item' && (
                                <span style={{ background: '#fed7aa', color: '#9a3412', borderRadius: 4, padding: '1px 5px', fontSize: 10, fontWeight: 600 }}>Usługa</span>
                              )}
                              {item.itemType === 'cost_item' && (
                                <span style={{ background: '#fce7f3', color: '#9d174d', borderRadius: 4, padding: '1px 5px', fontSize: 10, fontWeight: 600 }}>Koszt</span>
                              )}
                              {(item.itemType === 'unknown' || !item.itemType) && (
                                <span style={{ background: '#f3f4f6', color: '#6b7280', borderRadius: 4, padding: '1px 5px', fontSize: 10 }}>Sprawdź</span>
                              )}
                              {item.shouldAffectInventory === true && (
                                <span style={{ background: '#dbeafe', color: '#1e40af', borderRadius: 4, padding: '1px 5px', fontSize: 10 }}>↑ Magazyn</span>
                              )}
                              {item.warnings?.length > 0 && (
                                <span title={item.warnings.join('; ')} style={{ background: '#fff7ed', color: '#c2410c', borderRadius: 4, padding: '1px 5px', fontSize: 10, cursor: 'help' }}>⚠ {item.warnings.length}</span>
                              )}
                              {item._modelLabel && item.shouldAffectInventory !== false && (
                                <span
                                  title={`Model lokalny: ${item._modelLabel}${item._modelCandidatesCount > 0 ? `, ${item._modelCandidatesCount} kandydatów` : ''}`}
                                  style={{
                                    background: item._modelLabel === 'strong' ? '#dcfce7' : item._modelLabel === 'review' ? '#fef9c3' : '#f3f4f6',
                                    color: item._modelLabel === 'strong' ? '#166534' : item._modelLabel === 'review' ? '#854d0e' : '#6b7280',
                                    borderRadius: 4, padding: '1px 5px', fontSize: 10, cursor: 'help',
                                  }}
                                >
                                  M:{item._modelLabel}
                                </span>
                              )}
                              {item._matchDisagreement && (
                                <span
                                  title="Parser i model nie są zgodne — sprawdź dopasowanie ręcznie."
                                  style={{ background: '#fef2f2', color: '#dc2626', borderRadius: 4, padding: '1px 5px', fontSize: 10, cursor: 'help' }}
                                >
                                  ⚡ niezgodność
                                </span>
                              )}
                              {item._modelItemType && item._modelItemType !== item.itemType && item.itemType && item.itemType !== 'unknown' && (
                                <span
                                  title={`Model klasyfikuje jako: ${item._modelItemType}`}
                                  style={{ background: '#fef3c7', color: '#92400e', borderRadius: 4, padding: '1px 5px', fontSize: 10, cursor: 'help' }}
                                >
                                  M:{item._modelItemType === 'service_item' ? 'usługa?' : item._modelItemType === 'inventory_item' ? 'towar?' : item._modelItemType}
                                </span>
                              )}
                              {!item.skipped && (
                                <span style={{ background: statusLabel.bg, color: statusLabel.color, borderRadius: 4, padding: '1px 5px', fontSize: 10, fontWeight: 600 }}>
                                  {statusLabel.text}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={item.matchedProductId || ''}
                              onChange={e => {
                                const val = e.target.value || null
                                setNExtractedItems(items => items.map((it, i) => i === idx
                                  ? { ...it, matchedProductId: val, matchedProductNazwa: towary.find(t => t.id === val)?.nazwa ?? null, matchScore: val ? 1.0 : 0 }
                                  : it
                                ))
                              }}
                              style={{ ...IS(), fontSize: 11, padding: '4px 8px' }}
                            >
                              <option value="">{item.shouldAffectInventory === false ? '— koszt / nie dotyczy —' : '— brak dopasowania —'}</option>
                              {towary.map(t => (
                                <option key={t.id} value={t.id}>{t.nazwa}</option>
                              ))}
                            </select>
                            {!item.matchedProductId && item._suggestedProductId && (
                              <div style={{ fontSize: 10, color: '#d97706', marginTop: 2 }}>
                                Sugestia: <button
                                  type="button"
                                  onClick={() => setNExtractedItems(items => items.map((it, i) => i === idx
                                    ? { ...it, matchedProductId: item._suggestedProductId, matchedProductNazwa: item._suggestedProductNazwa, matchScore: 1.0 }
                                    : it
                                  ))}
                                  style={{ color: '#d97706', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, padding: 0 }}
                                >
                                  {item._suggestedProductNazwa}
                                </button>
                              </div>
                            )}
                            {!item.matchedProductId && item._topCandidates?.length > 0 && (
                              <div style={{ fontSize: 10, marginTop: 3, lineHeight: 1.6 }}>
                                <span style={{ color: 'var(--muted)' }}>Model: </span>
                                {item._topCandidates.map(c => (
                                  <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => setNExtractedItems(items => items.map((it, i) => i === idx
                                      ? { ...it, matchedProductId: c.id, matchedProductNazwa: c.nazwa, matchScore: c.score }
                                      : it
                                    ))}
                                    title={`Pewność modelu: ${Math.round(c.score * 100)}%`}
                                    style={{
                                      color: c.score >= 0.7 ? '#6366f1' : '#94a3b8',
                                      textDecoration: 'underline', fontSize: 10,
                                      background: 'none', border: 'none', cursor: 'pointer',
                                      padding: '0 6px 0 0',
                                    }}
                                  >
                                    {c.nazwa} ({Math.round(c.score * 100)}%)
                                  </button>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              step="0.001"
                              value={item.quantity}
                              onChange={e => updateExtractedItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                              style={{ ...IS(), fontSize: 11, padding: '4px 8px', width: 72, textAlign: 'right' }}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unitPriceNet}
                              onChange={e => updateExtractedItem(idx, 'unitPriceNet', parseFloat(e.target.value) || 0)}
                              style={{ ...IS(assignStatus === 'needs_price'), fontSize: 11, padding: '4px 8px', width: 80, textAlign: 'right' }}
                            />
                            {assignStatus === 'needs_price' && (
                              <div style={{ fontSize: 10, color: '#dc2626', marginTop: 2 }}>Uzupełnij cenę</div>
                            )}
                            {item.recoveredAmount && (
                              <div style={{ fontSize: 10, color: '#d97706', marginTop: 2 }}>Cena odzyskana heurystycznie</div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center text-xs font-medium" style={{ color: borderColor }}>
                            {item.matchScore > 0 ? `${Math.round(item.matchScore * 100)}%` : '—'}
                          </td>
                          <td className="px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => toggleSkipExtracted(idx)}
                              className="text-xs px-2 py-1 rounded"
                              style={{ background: 'var(--table-sub)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
                            >
                              {item.skipped ? 'Przywróć' : 'Pomiń'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {/* Zero-price draft confirmation */}
              {(() => {
                const active = nExtractedItems.filter(i => !i.skipped)
                const draftStatuses = active.filter(i => {
                  const s = getAssignmentStatus(i, towary)
                  return s === 'needs_review' || s === 'needs_product' || s === 'needs_price' || s === 'service_cost'
                })
                const hasZeroPrice = draftStatuses.some(i => !((i.unitPriceNet ?? 0) > 0))
                if (!hasZeroPrice) return null
                return (
                  <div style={{ marginTop: 8, padding: '8px 12px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 6, fontSize: 12, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <input
                      type="checkbox"
                      id="draftZeroConfirm"
                      checked={nDraftZeroPriceConfirmed}
                      onChange={e => setNDraftZeroPriceConfirmed(e.target.checked)}
                      style={{ marginTop: 2, flexShrink: 0 }}
                    />
                    <label htmlFor="draftZeroConfirm" style={{ color: '#92400e', cursor: 'pointer' }}>
                      Rozumiem, że pozycje bez ceny zostaną dodane jako robocze i nie wpłyną na magazyn.
                    </label>
                  </div>
                )
              })()}
              <div className="flex gap-2 mt-3 flex-wrap">
                <button
                  type="button"
                  onClick={goToManualForm}
                  className="rounded-lg py-2 px-3 text-sm font-medium"
                  style={{ background: 'var(--table-sub)', color: 'var(--text-2)', flexShrink: 0 }}
                >
                  Pomiń pozycje
                </button>
                {(() => {
                  const statuses = nExtractedItems.map(i => getAssignmentStatus(i, towary))
                  const readyCount = statuses.filter(s => isReadyToSave(s)).length
                  const draftCount = statuses.filter(s => s === 'needs_review' || s === 'needs_product' || s === 'needs_price').length
                  const active = nExtractedItems.filter(i => !i.skipped)
                  const hasZeroPrice = active.some(i => {
                    const s = getAssignmentStatus(i, towary)
                    return (s === 'needs_review' || s === 'needs_product' || s === 'needs_price') && !((i.unitPriceNet ?? 0) > 0)
                  })
                  const draftDisabled = draftCount === 0 || (hasZeroPrice && !nDraftZeroPriceConfirmed)
                  return (
                    <>
                      {draftCount > 0 && (
                        <button
                          type="button"
                          onClick={commitDraftExtractedItems}
                          disabled={draftDisabled}
                          className="rounded-lg py-2 px-3 text-sm font-semibold"
                          style={{
                            background: draftDisabled ? '#f1f5f9' : '#fef9c3',
                            color: draftDisabled ? '#94a3b8' : '#78350f',
                            border: `1px solid ${draftDisabled ? '#e2e8f0' : '#fde047'}`,
                            cursor: draftDisabled ? 'not-allowed' : 'pointer',
                            flexShrink: 0,
                          }}
                        >
                          Dodaj {draftCount} roboczych do weryfikacji
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={commitExtractedItems}
                        disabled={readyCount === 0}
                        className="flex-1 rounded-lg py-2 text-sm font-semibold text-white"
                        style={{ background: readyCount > 0 ? '#3b82f6' : '#94a3b8', cursor: readyCount > 0 ? 'pointer' : 'not-allowed', minWidth: 140 }}
                      >
                        {readyCount > 0
                          ? `Dodaj ${readyCount} gotowych →`
                          : 'Brak gotowych pozycji'}
                      </button>
                    </>
                  )
                })()}
              </div>
              {import.meta.env.DEV && nExtractedItems.length > 0 && nExtractionResult && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed #e2e8f0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const { buildGoldenSampleFromApprovedInvoice } = await import('../utils/invoiceDatasetBuilder')
                        const { saveGoldenSample } = await import('../utils/invoiceGoldenSamples')
                        const sampleName = window.prompt('Nazwa golden sample:', `${nExtractionResult.fields?.kontrahent_nazwa || 'Faktura'} ${new Date().toLocaleDateString('pl-PL')}`)
                        if (sampleName === null) return
                        const sample = buildGoldenSampleFromApprovedInvoice(
                          nExtractionResult,
                          nExtractedItems.filter(i => !i.skipped),
                          { name: sampleName }
                        )
                        const result = saveGoldenSample(sample)
                        if (result.success) alert(`Golden sample "${sampleName}" zapisany (DEV).`)
                        else alert('Błąd: ' + result.error)
                      } catch (e) {
                        alert('Błąd: ' + String(e))
                      }
                    }}
                    style={{
                      padding: '5px 12px', background: '#059669', color: '#fff',
                      border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 500,
                    }}
                  >
                    [DEV] Zapisz jako golden sample
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const { buildInvoiceDebugExport, downloadInvoiceDebugJson } = await import('../utils/invoiceDebugExport')
                        const debugData = buildInvoiceDebugExport(nExtractionResult)
                        downloadInvoiceDebugJson(debugData, nExtractionResult._fileName || 'faktura')
                      } catch (e) {
                        alert('Błąd eksportu: ' + String(e))
                      }
                    }}
                    style={{
                      padding: '5px 12px', background: '#2563eb', color: '#fff',
                      border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 500,
                    }}
                  >
                    [DEV] Eksportuj debug odczytu
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Phase 2: Form + positions */
            <div style={{ maxHeight: 'calc(90vh - 130px)', overflowY: 'auto', paddingRight: 2 }}>
              {/* AI success banner */}
              {nAiCount > 0 && (
                <div className="rounded-lg px-4 py-3 mb-3 text-sm font-medium flex items-center gap-2"
                  style={{ background: '#052e16', color: '#86efac', border: '1px solid #166534' }}>
                  <Bot size={15} />
                  Odczytano dane z dokumentu — sprawdź i uzupełnij pola
                </div>
              )}

              {/* Quality metrics summary in form phase */}
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
                    {nContractorValue?.matchStatus === 'new_from_pdf' && <span style={{ color: '#1d4ed8' }}>· + Nowy kontrahent (PDF)</span>}
                  </div>
                </div>
              )}

              <div className="faktura-new-grid" style={{ display: 'grid', gridTemplateColumns: nFile ? '1fr 260px' : '1fr', gap: 24, alignItems: 'start' }}>

                {/* Left column: form + positions */}
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

                          {/* ── Analiza ceny ── */}
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

                  {/* Action buttons — sticky na dole na mobile */}
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

                {/* Right column: file preview + re-read option */}
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

      {/* ════════════════════════════════════════════════════════════
          EDIT FAKTURA MODAL
          ════════════════════════════════════════════════════════════ */}
      {showFakModal && (
        <Modal title="Edytuj fakturę" onClose={() => setShowFakModal(false)} maxWidth={620}>
          <form onSubmit={handleSaveFak} className="space-y-4">
            <div className="grid grid-cols-2 gap-3 modal-2col">
              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Numer *</label>
                <input style={IS(fakErrors.numer)} value={fakForm.numer} onChange={e => setFakForm(f => ({ ...f, numer: e.target.value }))} placeholder="np. FV/2025/001" />
                {fakErrors.numer && <p className="text-xs mt-1" style={{ color: '#dc2626' }}>Pole wymagane</p>}
              </div>
              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Data *</label>
                <input type="date" style={IS(fakErrors.data_zakupu)} value={fakForm.data_zakupu} onChange={e => setFakForm(f => ({ ...f, data_zakupu: e.target.value }))} />
                {fakErrors.data_zakupu && <p className="text-xs mt-1" style={{ color: '#dc2626' }}>Pole wymagane</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 modal-2col">
              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Kontrahent</label>
                <select style={IS()} value={fakForm.kontrahent_id} onChange={e => setFakForm(f => ({ ...f, kontrahent_id: e.target.value }))}>
                  <option value="">— wybierz —</option>
                  {kontrahenci.map(k => <option key={k.id} value={k.id}>{k.nazwa}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Typ dokumentu</label>
                <select style={IS()} value={fakForm.typ} onChange={e => setFakForm(f => ({ ...f, typ: e.target.value }))}>
                  <option value="zakup">Faktura zakupu</option>
                  <option value="sprzedaz">Faktura sprzedaży</option>
                  <option value="wz">WZ</option>
                  <option value="paragon">Paragon</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Magazyn docelowy</label>
              <select style={IS()} value={fakForm.magazyn_id} onChange={e => setFakForm(f => ({ ...f, magazyn_id: e.target.value }))}>
                <option value="">— wybierz —</option>
                {magazyny.map(m => <option key={m.id} value={m.id}>{m.nazwa}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Załącznik (PDF, CSV, JPG, PNG, WEBP)</label>
              <div
                className="rounded-lg px-4 py-3 flex items-center gap-3 cursor-pointer"
                style={{ border: '1px dashed var(--border)', background: 'var(--table-sub)' }}
                onClick={() => fileRef.current?.click()}
              >
                <Upload size={16} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                <span className="text-sm flex-1 truncate" style={{ color: selectedFile ? 'var(--text)' : 'var(--muted)' }}>
                  {selectedFile ? selectedFile.name : editFak?.plik_url ? 'Kliknij aby zmienić plik' : 'Kliknij aby wybrać plik'}
                </span>
                {selectedFile && (
                  <button type="button" onClick={e => { e.stopPropagation(); setSelectedFile(null) }} style={{ color: 'var(--muted)' }}>
                    <X size={14} />
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" className="hidden" accept=".pdf,.csv,.jpg,.jpeg,.png,.webp" onChange={e => setSelectedFile(e.target.files[0] || null)} />
              {editFak?.plik_url && !selectedFile && (
                <a href={editFak.plik_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs mt-1.5" style={{ color: '#3b82f6' }}>
                  <Download size={12} /> Aktualny plik
                </a>
              )}
            </div>
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Notatki</label>
              <textarea style={{ ...IS(), resize: 'vertical', minHeight: 60 }} value={fakForm.notatki} onChange={e => setFakForm(f => ({ ...f, notatki: e.target.value }))} placeholder="Opcjonalne notatki..." />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowFakModal(false)} className="flex-1 rounded-lg py-2 text-sm font-medium" style={{ background: 'var(--table-sub)', color: 'var(--text-2)' }}>Anuluj</button>
              <button type="submit" disabled={saving || uploading} className="flex-1 rounded-lg py-2 text-sm font-medium text-white" style={{ background: '#3b82f6', opacity: (saving || uploading) ? 0.7 : 1 }}>
                {uploading ? 'Wysyłanie pliku...' : saving ? 'Zapisywanie...' : 'Zapisz zmiany'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ════════════════════════════════════════════════════════════
          ADD POSITION MODAL (existing invoice)
          ════════════════════════════════════════════════════════════ */}
      {showPozModal && (() => {
        const _t = towary.find(t => t.id === pozForm.towar_id)
        const _net = Number(pozForm.ilosc || 0) * Number(pozForm.cena_netto || 0)
        const _vat = _net * Number(pozForm.vat_procent || 0) / 100
        const _brutto = _net + _vat
        return (
          <Modal title="Dodaj pozycję do faktury" onClose={() => { setShowPozModal(false); setPozForm(emptyPoz) }} maxWidth={480}>
            <form onSubmit={handleSavePoz} className="space-y-4">
              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Towar *</label>
                <select
                  style={IS(pozErrors.towar_id)}
                  value={pozForm.towar_id}
                  onChange={e => {
                    const t = towary.find(x => x.id === e.target.value)
                    setPozForm(f => ({ ...f, towar_id: e.target.value, _jednostka: t?.jednostka || '' }))
                  }}
                >
                  <option value="">— wybierz towar —</option>
                  {towary.map(t => <option key={t.id} value={t.id}>{t.nazwa} ({t.jednostka || 'szt'})</option>)}
                </select>
                {pozErrors.towar_id && <p className="text-xs mt-1" style={{ color: '#dc2626' }}>Wybierz towar</p>}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Ilość *</label>
                  <input type="number" min="0.01" step="0.001" style={IS(pozErrors.ilosc)} value={pozForm.ilosc} onChange={e => setPozForm(f => ({ ...f, ilosc: e.target.value }))} placeholder="0" />
                  {pozErrors.ilosc && <p className="text-xs mt-1" style={{ color: '#dc2626' }}>Pole wymagane</p>}
                </div>
                <div>
                  <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Jednostka</label>
                  <div
                    className="rounded-lg px-3 py-2 text-sm"
                    style={{ background: 'var(--table-sub)', border: '1px solid var(--border)', color: _t ? 'var(--text)' : 'var(--muted)', minHeight: 37 }}
                  >
                    {_t?.jednostka || (pozForm.towar_id ? '—' : 'wybierz towar')}
                  </div>
                </div>
                <div>
                  <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>VAT %</label>
                  <select style={IS()} value={pozForm.vat_procent} onChange={e => setPozForm(f => ({ ...f, vat_procent: e.target.value }))}>
                    <option value={23}>23%</option>
                    <option value={8}>8%</option>
                    <option value={5}>5%</option>
                    <option value={0}>0%</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Cena netto za jednostkę (zł) *</label>
                <input type="number" min="0" step="0.01" style={IS(pozErrors.cena_netto)} value={pozForm.cena_netto} onChange={e => setPozForm(f => ({ ...f, cena_netto: e.target.value }))} placeholder="0.00" />
                {pozErrors.cena_netto && <p className="text-xs mt-1" style={{ color: '#dc2626' }}>Pole wymagane</p>}
              </div>

              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Magazyn docelowy (dla towarów)</label>
                <select
                  style={IS()}
                  value={pozForm.magazyn_id}
                  onChange={e => setPozForm(f => ({ ...f, magazyn_id: e.target.value }))}
                >
                  <option value="">— brak (usługa / koszt) —</option>
                  {magazyny.map(m => <option key={m.id} value={m.id}>{m.nazwa}</option>)}
                </select>
              </div>

              {(Number(pozForm.ilosc) > 0 || Number(pozForm.cena_netto) > 0) && (
                <div className="rounded-lg px-4 py-3 space-y-1" style={{ background: 'var(--table-sub)', border: '1px solid var(--border)' }}>
                  <div className="flex justify-between text-xs" style={{ color: 'var(--text-2)' }}>
                    <span>Suma netto</span>
                    <span style={{ fontFamily: 'DM Mono, monospace' }}>{_net.toFixed(2)} zł</span>
                  </div>
                  <div className="flex justify-between text-xs" style={{ color: 'var(--text-2)' }}>
                    <span>VAT ({pozForm.vat_procent}%)</span>
                    <span style={{ fontFamily: 'DM Mono, monospace' }}>{_vat.toFixed(2)} zł</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold" style={{ color: 'var(--text)', borderTop: '1px solid var(--border)', paddingTop: 6, marginTop: 4 }}>
                    <span>Suma brutto</span>
                    <span style={{ fontFamily: 'DM Mono, monospace', color: '#3b82f6' }}>{_brutto.toFixed(2)} zł</span>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowPozModal(false); setPozForm(emptyPoz) }} className="flex-1 rounded-lg py-2 text-sm font-medium" style={{ background: 'var(--table-sub)', color: 'var(--text-2)' }}>Anuluj</button>
                <button type="submit" disabled={savingPoz} className="flex-1 rounded-lg py-2 text-sm font-medium text-white" style={{ background: '#3b82f6', opacity: savingPoz ? 0.7 : 1 }}>
                  {savingPoz ? 'Zapisywanie...' : 'Dodaj pozycję'}
                </button>
              </div>
            </form>
          </Modal>
        )
      })()}

      {/* ════════════════════════════════════════════════════════════
          EDIT POSITION MODAL
          ════════════════════════════════════════════════════════════ */}
      {showEditPozModal && editPozTarget && (() => {
        const _t = towary.find(t => t.id === editPozForm.towar_id)
        const _net = Number(editPozForm.ilosc || 0) * Number(editPozForm.cena_netto || 0)
        const _vat = _net * Number(editPozForm.vat_procent || 0) / 100
        const _brutto = _net + _vat
        const lineStatus = recalculateInvoiceLineStatus(
          { ...editPozTarget, towar_id: editPozForm.towar_id || null, magazyn_id: editPozForm.magazyn_id || null, cena_netto: editPozForm.cena_netto, ilosc: editPozForm.ilosc },
          { towary, fakturaDefaultMagazynId: editPozFak?.magazyn_id || null }
        )
        return (
          <Modal
            title="Edytuj pozycję"
            onClose={() => { setShowEditPozModal(false); setEditPozTarget(null); setEditPozFak(null) }}
            maxWidth={520}
          >
            <div className="space-y-4">
              {/* Status preview */}
              {lineStatus.inventoryImpactStatus === 'ready' && (
                <div className="rounded-lg px-3 py-2 flex items-center gap-2 text-xs" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534' }}>
                  <CheckCircle2 size={13} /> Pozycja gotowa do magazynu
                </div>
              )}
              {lineStatus.inventoryImpactStatus === 'blocked' && lineStatus.errors.length > 0 && (
                <div className="rounded-lg px-3 py-2 text-xs" style={{ background: '#fef3c7', border: '1px solid #fcd34d', color: '#92400e' }}>
                  <div className="flex items-center gap-2 font-semibold mb-1"><AlertTriangle size={13} /> Niekompletna — brakuje:</div>
                  {lineStatus.errors.map((e, i) => <div key={i}>· {e}</div>)}
                </div>
              )}
              {lineStatus.inventoryImpactStatus === 'none' && (
                <div className="rounded-lg px-3 py-2 text-xs" style={{ background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0369a1' }}>
                  Pozycja bez wpływu na magazyn (usługa/koszt lub brak towaru)
                </div>
              )}

              {/* Towar */}
              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>
                  Towar {!editPozForm.is_service && <span style={{ color: '#dc2626' }}>*</span>}
                </label>
                <select
                  style={IS(editPozErrors.towar_id)}
                  value={editPozForm.towar_id}
                  onChange={e => {
                    const t = towary.find(x => x.id === e.target.value)
                    setEditPozForm(f => ({ ...f, towar_id: e.target.value, is_service: !e.target.value }))
                    if (t) setEditPozNewTowarForm(v => ({ ...v, nazwa: t.nazwa }))
                  }}
                >
                  <option value="">— brak towaru (usługa / koszt) —</option>
                  {towary.map(t => <option key={t.id} value={t.id}>{t.nazwa} ({t.jednostka || 'szt'})</option>)}
                </select>
                {editPozErrors.towar_id && <p className="text-xs mt-1" style={{ color: '#dc2626' }}>{editPozErrors.towar_id}</p>}
                {!editPozForm.towar_id && (
                  <button
                    type="button"
                    onClick={() => setEditPozShowCreate(v => !v)}
                    className="text-xs mt-1.5 underline"
                    style={{ color: '#3b82f6' }}
                  >
                    {editPozShowCreate ? '▲ Ukryj formularz' : '+ Utwórz towar z tej pozycji'}
                  </button>
                )}
              </div>

              {/* Create towar inline */}
              {editPozShowCreate && !editPozForm.towar_id && (
                <div className="rounded-lg p-3 space-y-3" style={{ background: 'var(--table-sub)', border: '1px solid var(--border)' }}>
                  <p className="text-xs font-semibold" style={{ color: 'var(--text-2)' }}>Nowy towar</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--text-2)' }}>Nazwa *</label>
                      <input
                        style={IS()}
                        value={editPozNewTowarForm.nazwa}
                        onChange={e => setEditPozNewTowarForm(f => ({ ...f, nazwa: e.target.value }))}
                        placeholder="Nazwa towaru"
                      />
                    </div>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--text-2)' }}>Typ / SKU</label>
                      <input
                        style={IS()}
                        value={editPozNewTowarForm.typ}
                        onChange={e => setEditPozNewTowarForm(f => ({ ...f, typ: e.target.value }))}
                        placeholder="Typ (opcjonalnie)"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--text-2)' }}>Jednostka</label>
                    <select style={IS()} value={editPozNewTowarForm.jednostka} onChange={e => setEditPozNewTowarForm(f => ({ ...f, jednostka: e.target.value }))}>
                      <option value="szt">szt</option>
                      <option value="kg">kg</option>
                      <option value="l">l</option>
                      <option value="m">m</option>
                      <option value="m2">m²</option>
                      <option value="opak">opak</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    disabled={editPozNewTowarSaving}
                    onClick={handleCreateTowarInEditModal}
                    className="w-full rounded-lg py-2 text-xs font-medium text-white"
                    style={{ background: '#3b82f6', opacity: editPozNewTowarSaving ? 0.7 : 1 }}
                  >
                    {editPozNewTowarSaving ? 'Tworzenie...' : 'Utwórz i przypisz towar'}
                  </button>
                </div>
              )}

              {/* Qty, unit, VAT */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Ilość *</label>
                  <input
                    type="number" min="0.001" step="0.001"
                    style={IS(editPozErrors.ilosc)}
                    value={editPozForm.ilosc}
                    onChange={e => setEditPozForm(f => ({ ...f, ilosc: e.target.value }))}
                    placeholder="0"
                  />
                  {editPozErrors.ilosc && <p className="text-xs mt-1" style={{ color: '#dc2626' }}>{editPozErrors.ilosc}</p>}
                </div>
                <div>
                  <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Jednostka</label>
                  <div className="rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--table-sub)', border: '1px solid var(--border)', color: _t ? 'var(--text)' : 'var(--muted)', minHeight: 37 }}>
                    {_t?.jednostka || '—'}
                  </div>
                </div>
                <div>
                  <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>VAT %</label>
                  <select style={IS()} value={editPozForm.vat_procent} onChange={e => setEditPozForm(f => ({ ...f, vat_procent: e.target.value }))}>
                    <option value={23}>23%</option>
                    <option value={8}>8%</option>
                    <option value={5}>5%</option>
                    <option value={0}>0%</option>
                  </select>
                </div>
              </div>

              {/* Price */}
              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Cena netto za jednostkę (zł) *</label>
                <input
                  type="number" min="0" step="0.01"
                  style={IS(editPozErrors.cena_netto)}
                  value={editPozForm.cena_netto}
                  onChange={e => setEditPozForm(f => ({ ...f, cena_netto: e.target.value }))}
                  placeholder="0.00"
                />
                {editPozErrors.cena_netto && <p className="text-xs mt-1" style={{ color: '#dc2626' }}>{editPozErrors.cena_netto}</p>}
              </div>

              {/* Warehouse */}
              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Magazyn docelowy</label>
                <select
                  style={IS()}
                  value={editPozForm.magazyn_id}
                  onChange={e => setEditPozForm(f => ({ ...f, magazyn_id: e.target.value }))}
                >
                  <option value="">— brak (usługa / koszt) —</option>
                  {magazyny.map(m => <option key={m.id} value={m.id}>{m.nazwa}</option>)}
                </select>
              </div>

              {/* Summary */}
              {(Number(editPozForm.ilosc) > 0 || Number(editPozForm.cena_netto) > 0) && (
                <div className="rounded-lg px-4 py-3 space-y-1" style={{ background: 'var(--table-sub)', border: '1px solid var(--border)' }}>
                  <div className="flex justify-between text-xs" style={{ color: 'var(--text-2)' }}>
                    <span>Suma netto</span>
                    <span style={{ fontFamily: 'DM Mono, monospace' }}>{_net.toFixed(2)} zł</span>
                  </div>
                  <div className="flex justify-between text-xs" style={{ color: 'var(--text-2)' }}>
                    <span>VAT ({editPozForm.vat_procent}%)</span>
                    <span style={{ fontFamily: 'DM Mono, monospace' }}>{_vat.toFixed(2)} zł</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold" style={{ color: 'var(--text)', borderTop: '1px solid var(--border)', paddingTop: 6, marginTop: 4 }}>
                    <span>Suma brutto</span>
                    <span style={{ fontFamily: 'DM Mono, monospace', color: '#3b82f6' }}>{_brutto.toFixed(2)} zł</span>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowEditPozModal(false); setEditPozTarget(null); setEditPozFak(null) }}
                  className="flex-1 rounded-lg py-2 text-sm font-medium"
                  style={{ background: 'var(--table-sub)', color: 'var(--text-2)' }}
                >
                  Anuluj
                </button>
                <button
                  type="button"
                  disabled={editPozSaving}
                  onClick={handleSaveEditPoz}
                  className="flex-1 rounded-lg py-2 text-sm font-semibold text-white"
                  style={{ background: '#3b82f6', opacity: editPozSaving ? 0.7 : 1 }}
                >
                  {editPozSaving ? 'Zapisywanie...' : 'Zapisz zmiany'}
                </button>
              </div>
            </div>
          </Modal>
        )
      })()}

      {/* ════════════════════════════════════════════════════════════
          ZATWIERDZENIE — MODAL POTWIERDZENIA
          ════════════════════════════════════════════════════════════ */}
      {showZatwierdzModal && zatwierdzFak && (() => {
        const poz = pozycje[zatwierdzFak.id] || []
        const ctx = { towary, fakturaDefaultMagazynId: zatwierdzFak.magazyn_id || null }
        const withTowar = poz.filter(p => p.towar_id)
        const bezTowaru = poz.filter(p => !p.towar_id)
        const readyTowar = withTowar.filter(p => recalculateInvoiceLineStatus(p, ctx).inventoryImpactStatus === 'ready')
        const blockedTowar = withTowar.filter(p => recalculateInvoiceLineStatus(p, ctx).inventoryImpactStatus === 'blocked')
        const mag = magazyny.find(m => m.id === zatwierdzFak.magazyn_id)
        return (
          <Modal
            title={`Zatwierdź fakturę ${zatwierdzFak.numer}`}
            onClose={() => { setShowZatwierdzModal(false); setZatwierdzFak(null) }}
            maxWidth={520}
          >
            <div className="space-y-4">
              <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                Zatwierdzenie zaktualizuje stany magazynowe dla pozycji towarowych z kompletymi danymi.
              </p>

              {readyTowar.length > 0 && (
                <div className="rounded-lg p-3 space-y-1.5" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                  <p className="text-xs font-semibold" style={{ color: '#166534' }}>
                    ✅ Do przyjęcia na magazyn ({readyTowar.length} poz.):
                  </p>
                  {readyTowar.map(p => {
                    const m = magazyny.find(x => x.id === (p.magazyn_id || zatwierdzFak.magazyn_id))
                    return (
                      <div key={p.id} className="text-xs" style={{ color: '#166534' }}>
                        · {p.towary?.nazwa || '—'} × {p.ilosc} {p.towary?.jednostka || 'szt.'} → {m?.nazwa || mag?.nazwa || '?'}
                      </div>
                    )
                  })}
                </div>
              )}

              {blockedTowar.length > 0 && (
                <div className="rounded-lg p-3" style={{ background: '#fef3c7', border: '1px solid #fcd34d' }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: '#92400e' }}>
                    ⚠ {blockedTowar.length} poz. z towarem ale niekompletne — nie trafią do magazynu:
                  </p>
                  {blockedTowar.map(p => {
                    const s = recalculateInvoiceLineStatus(p, ctx)
                    return (
                      <div key={p.id} className="text-xs mt-0.5" style={{ color: '#92400e' }}>
                        · {p.towary?.nazwa || '—'} — {s.errors.join(', ')}
                      </div>
                    )
                  })}
                </div>
              )}

              {bezTowaru.length > 0 && (
                <div className="rounded-lg p-3" style={{ background: '#fef3c7', border: '1px solid #fcd34d' }}>
                  <p className="text-xs font-semibold" style={{ color: '#92400e' }}>
                    ⚠ {bezTowaru.length} poz. robocze (bez towaru) — nie trafią do magazynu
                  </p>
                  {bezTowaru.map(p => (
                    <div key={p.id} className="text-xs mt-0.5" style={{ color: '#92400e' }}>
                      · {p.towary?.nazwa || '(brak nazwy)'} × {p.ilosc}
                    </div>
                  ))}
                </div>
              )}

              {readyTowar.length === 0 && (
                <div className="rounded-lg p-3" style={{ background: '#fef2f2', border: '1px solid #fca5a5' }}>
                  <p className="text-xs" style={{ color: '#991b1b' }}>
                    ❌ Brak gotowych pozycji towarowych — żadna pozycja nie trafi do magazynu. Faktura zostanie oznaczona jako zatwierdzona.
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowZatwierdzModal(false); setZatwierdzFak(null) }}
                  className="flex-1 rounded-lg py-2 text-sm font-medium"
                  style={{ background: 'var(--table-sub)', color: 'var(--text-2)' }}
                >
                  Anuluj
                </button>
                <button
                  type="button"
                  onClick={doZatwierdz}
                  className="flex-1 rounded-lg py-2 text-sm font-semibold text-white"
                  style={{ background: '#22c55e' }}
                >
                  Zatwierdź fakturę
                </button>
              </div>
            </div>
          </Modal>
        )
      })()}

      {/* Dev panel — visible in development mode only */}
      {import.meta.env.DEV && <InvoiceLearningDebugPanel />}
    </div>
  )
}
