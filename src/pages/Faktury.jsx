/**
 * WYMAGANE jednorazowe uruchomienie w Supabase SQL Editor:
 *   ALTER TABLE faktury ADD COLUMN IF NOT EXISTS plik_url text;
 *
 * Oraz w Supabase Storage: utwórz bucket "faktury-pliki" (publiczny).
 */
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { useToast } from '../context/ToastContext'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import Spinner from '../components/Spinner'
import InvoiceUploader from '../components/InvoiceUploader'
import { zatwierdźFakturę } from '../utils/magazyn'
import { getPriceHistoryCached, analyzePriceHistory, generatePriceAlerts } from '../utils/priceIntelligence'
import { findBestMatch, advancedSimilarity } from '../utils/productNormalizer'
import { findProductByAlias, rememberProductAlias, rememberSupplierItemName, rememberTypicalPrice, getSupplierItemMapping } from '../utils/invoiceLearning'
import {
  Plus, FileText, ChevronDown, ChevronUp, Trash2, Pencil,
  Upload, Download, File, Image, Table2, X, Bot, CheckCircle2, TrendingUp,
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
const emptyPoz = { towar_id: '', ilosc: '', cena_netto: '', vat_procent: 23 }

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
  const [nKontrahentHint, setNKontrahentHint] = useState('')
  const [nPriceData, setNPriceData] = useState({})
  const [nExtractedItems, setNExtractedItems] = useState([])
  const [nShowExtracted, setNShowExtracted] = useState(false)
  const [nExtractionResult, setNExtractionResult] = useState(null)

  // ─────────────────────────────────────────────────────────────

  async function fetchData() {
    const [{ data: f, error: e1 }, { data: k }, { data: t }, { data: m }, { data: p }] = await Promise.all([
      supabase.from('faktury').select('*, kontrahenci(nazwa)').order('data_zakupu', { ascending: false }),
      supabase.from('kontrahenci').select('id, nazwa').eq('aktywny', true).order('nazwa'),
      supabase.from('towary').select('id, nazwa, typ, jednostka').eq('aktywny', true).order('nazwa'),
      supabase.from('magazyny').select('id, nazwa').eq('aktywny', true).order('nazwa'),
      supabase.from('pozycje_faktury').select('*, towary(nazwa, jednostka), magazyny(nazwa)'),
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

  useEffect(() => { fetchData() }, [])

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
  function openAddPoz(fakId) {
    setTargetFakId(fakId)
    setPozForm(emptyPoz)
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
      ilosc: Number(pozForm.ilosc),
      cena_netto: Number(pozForm.cena_netto),
      vat_procent: Number(pozForm.vat_procent) || 23,
    }])
    if (error) { console.error(error); addToast(error.message, 'error'); setSavingPoz(false); return }

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

  async function handleZatwierdz(fak) {
    if (fak.status === 'zatwierdzona') { addToast('Faktura już zatwierdzona', 'error'); return }
    const pozFaktury = pozycje[fak.id] || []
    if (pozFaktury.length === 0) { addToast('Dodaj najpierw pozycje do faktury', 'error'); return }
    if (!fak.magazyn_id) { addToast('Wybierz magazyn docelowy', 'error'); return }
    const mag = magazyny.find(m => m.id === fak.magazyn_id)
    const result = await zatwierdźFakturę(fak.id)
    if (result.success) {
      addToast(`Faktura ${fak.numer} zatwierdzona — zaktualizowano ${result.zaktualizowane?.length || 0} pozycji w ${mag?.nazwa || 'magazynie'}`, 'success')
      fetchData()
      savePriceAlertsForFaktura(fak).catch(err => console.error('savePriceAlerts:', err))
    } else {
      addToast(result.error || 'Błąd zatwierdzenia', 'error')
    }
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
    setNAiCount(0)
    setNForm({ ...emptyFak, magazyn_id: magazyny[0]?.id || '' })
    setNFormErr({})
    setNPositions([])
    setNKontrahentHint('')
    setNPriceData({})
    setShowNModal(true)
  }

  async function analyzePositionPriceById(key, towarId, cena) {
    const towarNazwa = towary.find(t => t.id === towarId)?.nazwa || ''
    setNPriceData(d => ({ ...d, [key]: { loading: true } }))
    try {
      const history = await getPriceHistoryCached(towarId, supabase)
      const analyzed = analyzePriceHistory(history)
      const kontrahentNazwa = kontrahenci.find(k => k.id === nForm.kontrahent_id)?.nazwa || ''
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

    // Learning — remember confirmed product mappings
    const supplierNip = nExtractionResult?.fields?.kontrahent_nip
    const supplierId = nForm.kontrahent_id
    for (const item of active) {
      if (!item.matchedProductId || !item.rawName) continue
      rememberProductAlias(item.rawName, item.matchedProductId)
      if (supplierNip) rememberSupplierItemName(supplierNip, item.rawName, item.matchedProductId)
      const price = item.unitPriceNet ?? item.cenaNetto ?? 0
      if (price > 0 && supplierId) rememberTypicalPrice(item.matchedProductId, supplierId, price)
    }

    const newPositions = active.map(item => mkPos({
      nazwa: item.rawName,
      typ: '',
      ilosc: item.quantity,
      jednostka: item.unit,
      cena_netto: item.unitPriceNet,
      magazyn_id: defaultMag,
      _towarId: item.matchedProductId || null,
    }))
    setNPositions(newPositions)
    setNShowExtracted(false)
    setNShowForm(true)

    // Auto-analyze prices for matched positions
    const initData = {}
    newPositions.forEach((pos, i) => {
      if (active[i]?.matchedProductId) initData[pos._key] = { loading: true }
    })
    if (Object.keys(initData).length > 0) {
      setNPriceData(initData)
      newPositions.forEach((pos, i) => {
        const item = active[i]
        if (item?.matchedProductId) {
          analyzePositionPriceById(pos._key, item.matchedProductId, Number(item.unitPriceNet))
        }
      })
    }
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

    try {
      const { extractFromFile } = await import('../utils/invoiceExtractor')
      setNExtractStatus('Odczytuję tekst z dokumentu…')

      const result = await extractFromFile(nFile)

      if (result.source === 'pdf_text') {
        setNExtractStatus('Znaleziono tekst w PDF — sprawdź dane')

        // Fill header fields
        if (result.fields.numer) setNForm(f => ({ ...f, numer: result.fields.numer }))
        if (result.fields.data_zakupu) setNForm(f => ({ ...f, data_zakupu: result.fields.data_zakupu }))

        // NIP → lookup kontrahent via Supabase
        if (result.fields.kontrahent_nip) {
          const nip = result.fields.kontrahent_nip.replace(/\D/g, '')
          const { data: matchKontrahent } = await supabase
            .from('kontrahenci')
            .select('id, nazwa')
            .eq('nip', nip)
            .maybeSingle()
          if (matchKontrahent) {
            setNForm(f => ({ ...f, kontrahent_id: matchKontrahent.id }))
            addToast(`Dopasowano kontrahenta: ${matchKontrahent.nazwa}`, 'success')
          } else {
            addToast(`NIP ${result.fields.kontrahent_nip} — nie znaleziono kontrahenta. Wybierz ręcznie.`, 'info')
          }
        }

        setNAiCount(1)
        setNExtractionResult(result)

        // Use structurally-parsed items (already in result.fields.pozycje)
        setNExtractStatus('Dopasowuję pozycje do towarów…')
        const rawItems = result.fields.pozycje || []
        if (rawItems.length > 0) {
          const supplierNip = result.fields.kontrahent_nip
          const matched = rawItems.map(item => {
            // Check learning alias first
            const aliasId = findProductByAlias(item.rawName)
            const supplierAliasId = supplierNip ? getSupplierItemMapping(supplierNip, item.rawName) : null
            const knownId = aliasId || supplierAliasId
            if (knownId) {
              const knownProduct = towary.find(t => t.id === knownId)
              return { ...item, matchedProductId: knownId, matchedProductNazwa: knownProduct?.nazwa ?? null, matchScore: 1.0, skipped: false }
            }
            // Advanced similarity with diacritics + tech params
            let bestScore = 0
            let bestProduct = null
            for (const towar of towary) {
              const { score } = advancedSimilarity(item.rawName, towar)
              if (score > bestScore) { bestScore = score; bestProduct = towar }
            }
            return {
              ...item,
              matchedProductId: bestScore >= 0.5 ? (bestProduct?.id ?? null) : null,
              matchedProductNazwa: bestScore >= 0.5 ? (bestProduct?.nazwa ?? null) : null,
              matchScore: bestScore,
              skipped: false,
            }
          })
          setNExtractedItems(matched)
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
    const e = {}
    if (!nForm.numer.trim()) e.numer = true
    if (!nForm.data_zakupu) e.data_zakupu = true
    if (!nForm.kontrahent_id) e.kontrahent_id = true
    if (!nForm.magazyn_id) e.magazyn_id = true
    setNFormErr(e)
    if (Object.keys(e).length > 0) return

    setNSaving(true)
    try {
      const { data: dupCheck } = await supabase.from('faktury').select('id').eq('numer', nForm.numer.trim()).maybeSingle()
      if (dupCheck) { addToast('Faktura o tym numerze już istnieje', 'error'); setNSaving(false); return }

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
        kontrahent_id: nForm.kontrahent_id || null,
        data_zakupu: nForm.data_zakupu,
        typ: nForm.typ,
        magazyn_id: nForm.magazyn_id || null,
        notatki: nForm.notatki || null,
        plik_url,
        status: 'robocza',
      }]).select().single()
      if (fakErr) throw fakErr

      // 3. Process each position (no stock updates — those happen on approval)
      for (const poz of nPositions) {
        if (!poz.nazwa.trim()) continue

        // Use explicit match from extraction, or fall back to search by typ
        let towarId = poz._towarId || null
        if (!towarId && poz.typ.trim()) {
          const { data: found } = await supabase.from('towary')
            .select('id').ilike('typ', poz.typ.trim()).eq('aktywny', true).limit(1).maybeSingle()
          if (found) towarId = found.id
        }

        // If no match, create new towar
        if (!towarId) {
          const { data: newT, error: tErr } = await supabase.from('towary').insert([{
            nazwa: poz.nazwa.trim(),
            typ: poz.typ.trim() || null,
            jednostka: poz.jednostka || null,
            aktywny: true,
          }]).select('id').single()
          if (tErr) { console.error('Błąd tworzenia towaru:', tErr); continue }
          towarId = newT.id
        }

        // Insert position
        await supabase.from('pozycje_faktury').insert([{
          faktura_id: fakData.id,
          towar_id: towarId,
          magazyn_id: poz.magazyn_id || null,
          ilosc: Number(poz.ilosc) || 0,
          cena_netto: Number(poz.cena_netto) || 0,
          vat_procent: 23,
        }])
      }

      addToast(`Faktura ${nForm.numer.trim()} zapisana jako robocza — zatwierdź aby zaktualizować stany`, 'success')
      setShowNModal(false)
      fetchData()
    } catch (err) {
      console.error(err)
      addToast(err.message, 'error')
    }
    setNSaving(false)
  }

  if (loading) return <Spinner />

  const canSaveNew = nForm.numer.trim() && nForm.data_zakupu && nForm.kontrahent_id && nForm.magazyn_id

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3 page-header">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Faktury</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>{faktury.length} faktur</p>
        </div>
        <button
          onClick={openNewModal}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white page-header-btn"
          style={{ background: '#3b82f6' }}
        >
          <Plus size={16} /> Nowa faktura
        </button>
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
                <div className="flex items-center gap-3 px-5 py-4" style={{ background: isOpen ? 'var(--table-odd)' : 'transparent' }}>
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

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {fak.status === 'robocza' && (
                      <>
                        <button onClick={() => handleZatwierdz(fak)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white" style={{ background: '#22c55e' }} title="Zatwierdź fakturę">
                          <CheckCircle2 size={12} /> Zatwierdź
                        </button>
                        <button onClick={() => openAddPoz(fak.id)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'var(--table-sub)', color: 'var(--text-2)', border: '1px solid var(--border)' }} title="Dodaj pozycję">
                          <Plus size={12} /> Dodaj poz.
                        </button>
                        {fak.plik_url && (
                          <a href={fak.plik_url} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg flex items-center" style={{ color: '#3b82f6' }} title="Pobierz plik">
                            <Download size={13} />
                          </a>
                        )}
                        <button onClick={() => openEditFak(fak)} className="p-1.5 rounded-lg" style={{ color: 'var(--text-2)' }} title="Edytuj"><Pencil size={13} /></button>
                        <button onClick={() => handleDeleteFak(fak)} className="p-1.5 rounded-lg" style={{ color: '#dc2626' }} title="Usuń"><Trash2 size={13} /></button>
                      </>
                    )}
                    {fak.status === 'zatwierdzona' && (
                      <button
                        onClick={() => setExpanded(isOpen ? null : fak.id)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                        style={{ background: 'var(--table-sub)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
                      >
                        {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />} Zobacz pozycje
                      </button>
                    )}
                    {fak.status === 'anulowana' && (
                      <>
                        {fak.plik_url && (
                          <a href={fak.plik_url} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg flex items-center" style={{ color: '#3b82f6' }} title="Pobierz plik">
                            <Download size={13} />
                          </a>
                        )}
                        <button onClick={() => handleDeleteFak(fak)} className="p-1.5 rounded-lg" style={{ color: '#dc2626' }} title="Usuń"><Trash2 size={13} /></button>
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
                            <th className="px-3 py-2.5" />
                          </tr>
                        </thead>
                        <tbody>
                          {poz.map(p => (
                            <tr key={p.id} className="table-row" style={{ borderTop: '1px solid var(--border)' }}>
                              <td className="px-5 py-3" style={{ color: 'var(--text)' }}>{p.towary?.nazwa || '—'}</td>
                              <td className="px-5 py-3 text-right" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-2)' }}>{p.ilosc}</td>
                              <td className="px-4 py-3 text-right hidden sm:table-cell" style={{ color: 'var(--text-2)' }}>{p.towary?.jednostka || '—'}</td>
                              <td className="px-5 py-3 text-right" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-2)' }}>{Number(p.cena_netto).toFixed(2)} zł</td>
                              <td className="px-4 py-3 text-right hidden sm:table-cell" style={{ color: 'var(--text-2)' }}>{p.vat_procent ?? 23}%</td>
                              <td className="px-5 py-3 text-right font-medium" style={{ fontFamily: 'DM Mono, monospace', color: '#3b82f6' }}>{(Number(p.ilosc) * Number(p.cena_netto)).toFixed(2)} zł</td>
                              <td className="px-3 py-3 text-right">
                                {fak.status === 'robocza' && (
                                  <button onClick={() => handleDeletePoz(p)} className="p-1 rounded" style={{ color: '#dc2626' }} title="Usuń pozycję"><Trash2 size={12} /></button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ borderTop: '1px solid var(--border)' }}>
                            <td colSpan={5} className="px-5 py-3 text-right text-sm font-medium" style={{ color: 'var(--text-2)' }}>Razem netto:</td>
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
                      <button onClick={() => openAddPoz(fak.id)} className="flex items-center gap-1.5 text-xs rounded-lg px-3 py-1.5 font-medium" style={{ background: 'var(--table-sub)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
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
              <p className="text-sm font-medium mb-3" style={{ color: 'var(--text)' }}>
                Znaleziono <strong>{nExtractedItems.filter(i => !i.skipped).length}</strong> pozycji w dokumencie — sprawdź dopasowania i zatwierdź
              </p>
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
                      const borderColor = item.matchScore >= 0.8 ? '#16a34a' : item.matchScore >= 0.5 ? '#d97706' : '#ef4444'
                      return (
                        <tr
                          key={idx}
                          style={{
                            opacity: item.skipped ? 0.35 : 1,
                            borderTop: '1px solid var(--border)',
                            borderLeft: `3px solid ${borderColor}`,
                          }}
                        >
                          <td className="px-3 py-2 text-xs" style={{ color: 'var(--text)' }}>{item.rawName}</td>
                          <td className="px-3 py-2">
                            <select
                              value={item.matchedProductId || ''}
                              onChange={e => updateExtractedItem(idx, 'matchedProductId', e.target.value || null)}
                              style={{ ...IS(), fontSize: 11, padding: '4px 8px' }}
                            >
                              <option value="">— brak dopasowania —</option>
                              {towary.map(t => (
                                <option key={t.id} value={t.id}>{t.nazwa}</option>
                              ))}
                            </select>
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
                              style={{ ...IS(), fontSize: 11, padding: '4px 8px', width: 80, textAlign: 'right' }}
                            />
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
              <div className="flex gap-3 mt-4">
                <button
                  type="button"
                  onClick={goToManualForm}
                  className="rounded-lg py-2 px-4 text-sm font-medium"
                  style={{ background: 'var(--table-sub)', color: 'var(--text-2)' }}
                >
                  Pomiń pozycje — tylko dane faktury
                </button>
                <button
                  type="button"
                  onClick={commitExtractedItems}
                  className="flex-1 rounded-lg py-2 text-sm font-semibold text-white"
                  style={{ background: '#3b82f6' }}
                >
                  Dodaj {nExtractedItems.filter(i => !i.skipped).length} pozycji do faktury →
                </button>
              </div>
            </div>
          ) : (
            /* Phase 2: Form + positions */
            <div style={{ maxHeight: 'calc(90vh - 130px)', overflowY: 'auto', paddingRight: 2 }}>
              {/* AI success banner */}
              {nAiCount > 0 && (
                <div className="rounded-lg px-4 py-3 mb-5 text-sm font-medium flex items-center gap-2"
                  style={{ background: '#052e16', color: '#86efac', border: '1px solid #166534' }}>
                  <Bot size={15} />
                  Odczytano dane z dokumentu — sprawdź i uzupełnij pola
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
                      <select
                        style={IS(nFormErr.kontrahent_id)}
                        value={nForm.kontrahent_id}
                        onChange={e => setNForm(f => ({ ...f, kontrahent_id: e.target.value }))}
                      >
                        <option value="">— wybierz —</option>
                        {kontrahenci.map(k => <option key={k.id} value={k.id}>{k.nazwa}</option>)}
                      </select>
                      {nFormErr.kontrahent_id && <p className="text-xs mt-1" style={{ color: '#dc2626' }}>Pole wymagane</p>}
                      {nKontrahentHint && !nForm.kontrahent_id && (
                        <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                          AI wykryło: {nKontrahentHint}
                        </p>
                      )}
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

                  {/* Action buttons */}
                  <div className="flex gap-3 pt-2">
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
    </div>
  )
}
