import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'
import { useToast } from '../../context/ToastContext'
import { useWorkspace } from '../../context/WorkspaceContext'
import Modal from '../../components/Modal'
import Spinner from '../../components/Spinner'
import { Plus, Trash2, Pencil, Zap, Sparkles } from 'lucide-react'

const inputStyle = {
  background: 'var(--input-bg)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-control)',
  color: 'var(--text)',
  padding: '10px 12px',
  fontSize: 16,
  width: '100%',
  outline: 'none',
  minHeight: 44,
  boxSizing: 'border-box',
}

function stripPl(s) {
  return (s || '').toLowerCase()
    .replace(/ą/g, 'a').replace(/ć/g, 'c').replace(/ę/g, 'e').replace(/ł/g, 'l')
    .replace(/ń/g, 'n').replace(/ó/g, 'o').replace(/ś/g, 's').replace(/ź/g, 'z').replace(/ż/g, 'z')
}

const CORE_TEMPLATE = [
  { symbol: '!', keyword: 'zmiana', label: 'Zmiana' },
  { symbol: '+', keyword: 'przyjazd', label: 'Przyjazd' },
  { symbol: '-', keyword: 'wyjazd', label: 'Wyjazd' },
]

const REGIONAL_TEMPLATE = [
  { targetKeyword: 'polwysep', label: 'Półwysep', symbols: ['hel', 'jas', 'jur'] },
  { targetKeyword: 'mechelinki', label: 'Mechelinki', symbols: ['mech'] },
  { targetKeyword: 'zagranica', label: 'Zagranica', symbols: ['wł', 'puck'] },
]

export default function AutomationModal({ tablicaId, lists, onClose }) {
  const { addToast } = useToast()
  const { wsData } = useWorkspace()

  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [slowo, setSlowo] = useState('')
  const [listaId, setListaId] = useState(lists[0]?.id || '')
  const [saving, setSaving] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false)
  const [templatePicks, setTemplatePicks] = useState({ '!': '', '+': '', '-': '' })
  const [applyingTemplate, setApplyingTemplate] = useState(false)

  async function fetchRules() {
    const { data, error } = await supabase
      .from('reguly_tablic')
      .select('*')
      .eq('tablica_id', tablicaId)
      .order('pozycja')
    if (error) addToast(error.message, 'error')
    setRules(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchRules() }, [tablicaId])

  function listName(id) {
    return lists.find(l => l.id === id)?.nazwa || '?'
  }

  function findListId(keyword) {
    return lists.find(l => stripPl(l.nazwa).includes(keyword))?.id || ''
  }

  function openAddForm() {
    setEditingId(null)
    setSlowo('')
    setListaId(lists[0]?.id || '')
    setConfirmDeleteId(null)
    setFormOpen(true)
  }

  function openEditForm(rule) {
    setEditingId(rule.id)
    setSlowo(rule.slowo_kluczowe)
    setListaId(rule.lista_docelowa_id)
    setConfirmDeleteId(null)
    setFormOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const keyword = slowo.trim()
    if (!keyword || !listaId) return
    setSaving(true)
    if (editingId) {
      const { error } = await supabase
        .from('reguly_tablic')
        .update({ slowo_kluczowe: keyword, lista_docelowa_id: listaId })
        .eq('id', editingId)
      if (error) addToast(error.message, 'error')
    } else {
      const nextPos = rules.length ? Math.max(...rules.map(r => r.pozycja)) + 1 : 0
      const { error } = await supabase
        .from('reguly_tablic')
        .insert([{ tablica_id: tablicaId, slowo_kluczowe: keyword, lista_docelowa_id: listaId, pozycja: nextPos, ...wsData() }])
      if (error) addToast(error.message, 'error')
    }
    setSaving(false)
    setFormOpen(false)
    fetchRules()
  }

  async function toggleAktywna(rule) {
    setRules(prev => prev.map(r => (r.id === rule.id ? { ...r, aktywna: !r.aktywna } : r)))
    const { error } = await supabase.from('reguly_tablic').update({ aktywna: !rule.aktywna }).eq('id', rule.id)
    if (error) { addToast(error.message, 'error'); fetchRules() }
  }

  async function deleteRule(ruleId) {
    setConfirmDeleteId(null)
    setRules(prev => prev.filter(r => r.id !== ruleId))
    const { error } = await supabase.from('reguly_tablic').delete().eq('id', ruleId)
    if (error) { addToast(error.message, 'error'); fetchRules() }
  }

  function nextPozycja(count) {
    return rules.length ? Math.max(...rules.map(r => r.pozycja)) + 1 + count : count
  }

  async function insertTemplateRules(rows) {
    const existingSymbols = new Set(rules.map(r => r.slowo_kluczowe))
    const toInsert = rows.filter(r => !existingSymbols.has(r.slowo_kluczowe))
    if (toInsert.length === 0) {
      addToast('Te reguły już istnieją', 'info')
      return
    }
    setApplyingTemplate(true)
    const { error } = await supabase.from('reguly_tablic').insert(
      toInsert.map((r, i) => ({
        tablica_id: tablicaId,
        slowo_kluczowe: r.slowo_kluczowe,
        lista_docelowa_id: r.lista_docelowa_id,
        pozycja: nextPozycja(i),
        ...wsData(),
      }))
    )
    if (error) addToast(error.message, 'error')
    else addToast('Dodano reguły', 'success')
    setApplyingTemplate(false)
    fetchRules()
  }

  function handleBlueApartClick() {
    const picks = {}
    CORE_TEMPLATE.forEach(t => { picks[t.symbol] = findListId(t.keyword) })
    if (CORE_TEMPLATE.every(t => picks[t.symbol])) {
      insertTemplateRules(CORE_TEMPLATE.map(t => ({ slowo_kluczowe: t.symbol, lista_docelowa_id: picks[t.symbol] })))
    } else {
      setTemplatePicks(picks)
      setTemplatePickerOpen(true)
    }
  }

  async function applyTemplatePicks() {
    if (!CORE_TEMPLATE.every(t => templatePicks[t.symbol])) return
    await insertTemplateRules(CORE_TEMPLATE.map(t => ({ slowo_kluczowe: t.symbol, lista_docelowa_id: templatePicks[t.symbol] })))
    setTemplatePickerOpen(false)
  }

  const regionalMatches = REGIONAL_TEMPLATE
    .map(t => ({ ...t, listaId: findListId(t.targetKeyword) }))
    .filter(t => t.listaId)

  function handleRegionalClick() {
    const rows = regionalMatches.flatMap(t => t.symbols.map(symbol => ({ slowo_kluczowe: symbol, lista_docelowa_id: t.listaId })))
    insertTemplateRules(rows)
  }

  return (
    <Modal title="Automatyzacja" onClose={onClose} maxWidth={480}>
      <div className="space-y-3">
        <p className="text-xs" style={{ color: 'var(--text-2)' }}>
          Gdy tytuł nowej (lub edytowanej) karty zawiera słowo kluczowe, karta automatycznie trafia na początek wybranej listy.
        </p>

        {loading ? (
          <Spinner />
        ) : rules.length === 0 && !formOpen ? (
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>Brak reguł na tej tablicy.</p>
        ) : (
          <div className="space-y-2">
            {rules.map(rule => (
              <div
                key={rule.id}
                className="flex items-center gap-2 rounded-lg p-2.5"
                style={{ background: 'var(--hover-bg)', opacity: rule.aktywna ? 1 : 0.5 }}
              >
                <Zap size={14} style={{ color: 'var(--c-action)', flexShrink: 0 }} />
                <p className="text-sm flex-1" style={{ color: 'var(--text)' }}>
                  Gdy nazwa karty zawiera „<strong>{rule.slowo_kluczowe}</strong>" → przenieś na początek listy <strong>{listName(rule.lista_docelowa_id)}</strong>
                </p>
                <button
                  onClick={() => toggleAktywna(rule)}
                  title={rule.aktywna ? 'Wyłącz' : 'Włącz'}
                  className="rounded-full transition-colors flex-shrink-0"
                  style={{ width: 36, height: 20, background: rule.aktywna ? 'var(--c-action)' : 'var(--border)', position: 'relative' }}
                >
                  <span style={{
                    position: 'absolute', top: 2, left: rule.aktywna ? 18 : 2,
                    width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.15s',
                  }} />
                </button>
                {confirmDeleteId === rule.id ? (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => deleteRule(rule.id)} className="rounded-lg px-2 py-1 text-xs font-medium text-white" style={{ background: 'var(--c-critical)' }}>Usuń</button>
                    <button onClick={() => setConfirmDeleteId(null)} className="rounded-lg px-2 py-1 text-xs font-medium" style={{ background: 'var(--table-sub)', color: 'var(--text-2)' }}>Anuluj</button>
                  </div>
                ) : (
                  <>
                    <button onClick={() => openEditForm(rule)} className="p-1 rounded flex-shrink-0" style={{ color: 'var(--muted)' }}>
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => setConfirmDeleteId(rule.id)} className="p-1 rounded flex-shrink-0" style={{ color: 'var(--c-critical)' }}>
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {!formOpen && !templatePickerOpen && (
          <div className="flex flex-col gap-2">
            <button
              onClick={handleBlueApartClick}
              disabled={applyingTemplate}
              className="flex items-center gap-1.5 w-full px-3 py-2.5 rounded-[var(--radius-card)] text-sm font-medium"
              style={{ background: 'var(--c-action-subtle)', color: 'var(--c-action)', minHeight: 44, opacity: applyingTemplate ? 0.6 : 1 }}
            >
              <Sparkles size={15} /> Dodaj gotowe reguły (Zmiana / Przyjazd / Wyjazd)
            </button>
            {regionalMatches.length > 0 && (
              <button
                onClick={handleRegionalClick}
                disabled={applyingTemplate}
                className="flex items-center gap-1.5 w-full px-3 py-2.5 rounded-[var(--radius-card)] text-sm font-medium"
                style={{ background: 'var(--hover-bg)', color: 'var(--text-2)', minHeight: 44, opacity: applyingTemplate ? 0.6 : 1 }}
              >
                <Sparkles size={15} /> Dodaj reguły regionalne ({regionalMatches.map(t => t.label).join(' / ')})
              </button>
            )}
          </div>
        )}

        {templatePickerOpen && (
          <div className="flex flex-col gap-3 rounded-lg p-3" style={{ border: '1px solid var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--text-2)' }}>
              Ta tablica nie ma list Zmiana/Przyjazd/Wyjazd — utwórz je albo wybierz listy docelowe niżej.
            </p>
            {CORE_TEMPLATE.map(t => (
              <div key={t.symbol}>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>
                  „{t.symbol}" → {t.label}
                </label>
                <select
                  style={inputStyle}
                  value={templatePicks[t.symbol]}
                  onChange={e => setTemplatePicks(prev => ({ ...prev, [t.symbol]: e.target.value }))}
                >
                  <option value="">— wybierz listę —</option>
                  {lists.map(l => <option key={l.id} value={l.id}>{l.nazwa}</option>)}
                </select>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={applyTemplatePicks}
                disabled={applyingTemplate || !CORE_TEMPLATE.every(t => templatePicks[t.symbol])}
                className="flex-1 rounded-[var(--radius-control)] text-sm font-medium text-white"
                style={{ background: 'var(--c-action)', minHeight: 40, opacity: applyingTemplate || !CORE_TEMPLATE.every(t => templatePicks[t.symbol]) ? 0.6 : 1 }}
              >
                Zastosuj
              </button>
              <button type="button" onClick={() => setTemplatePickerOpen(false)} className="px-3 text-sm" style={{ color: 'var(--muted)' }}>
                Anuluj
              </button>
            </div>
          </div>
        )}

        {formOpen ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg p-3" style={{ border: '1px solid var(--border)' }}>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Słowo kluczowe (w tytule karty)</label>
              <input autoFocus style={inputStyle} value={slowo} onChange={e => setSlowo(e.target.value)} placeholder="np. hel" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Przenieś do listy</label>
              <select style={inputStyle} value={listaId} onChange={e => setListaId(e.target.value)}>
                {lists.map(l => <option key={l.id} value={l.id}>{l.nazwa}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={saving || !slowo.trim() || !listaId}
                className="flex-1 rounded-[var(--radius-control)] text-sm font-medium text-white"
                style={{ background: 'var(--c-action)', minHeight: 40, opacity: saving ? 0.6 : 1 }}
              >
                {editingId ? 'Zapisz regułę' : 'Dodaj regułę'}
              </button>
              <button type="button" onClick={() => setFormOpen(false)} className="px-3 text-sm" style={{ color: 'var(--muted)' }}>
                Anuluj
              </button>
            </div>
          </form>
        ) : !templatePickerOpen && (
          <button
            onClick={openAddForm}
            disabled={lists.length === 0}
            className="flex items-center gap-1.5 w-full px-3 py-2.5 rounded-[var(--radius-card)] text-sm font-medium"
            style={{ background: 'var(--hover-bg)', color: 'var(--text-2)', minHeight: 44, opacity: lists.length === 0 ? 0.5 : 1 }}
          >
            <Plus size={15} /> Dodaj regułę
          </button>
        )}
      </div>
    </Modal>
  )
}
