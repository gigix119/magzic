import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { useToast } from '../context/ToastContext'
import { useTheme } from '../context/ThemeContext'
import { BUSINESS_CATEGORIES, getCategoryById, getSubcategoriesFor } from '../config/businessTypes'
import Modal from '../components/Modal'
import Spinner from '../components/Spinner'
import { getAllSettings } from '../utils/workspaceSettings'

const TABS = [
  { id: 'profil',        icon: '👤', label: 'Profil',        short: 'Profil'   },
  { id: 'firma',         icon: '🏢', label: 'Firma i branża', short: 'Firma'    },
  { id: 'magazyn',       icon: '📦', label: 'Magazyn',        short: 'Magazyn'  },
  { id: 'powiadomienia', icon: '🔔', label: 'Powiadomienia',  short: 'Alerty'   },
  { id: 'wyglad',        icon: '🎨', label: 'Wygląd',         short: 'Wygląd'   },
]

const IS = (err) => ({
  background: 'var(--input-bg)',
  border: `1px solid ${err ? '#ef4444' : 'var(--border)'}`,
  borderRadius: 8,
  color: 'var(--text)',
  padding: '10px 12px',
  fontSize: 16,
  width: '100%',
  outline: 'none',
  minHeight: 48,
  boxSizing: 'border-box',
})

const IS_READONLY = () => ({
  ...IS(),
  background: 'var(--table-sub)',
  color: 'var(--muted)',
  cursor: 'not-allowed',
})

function SectionTitle({ children }) {
  return <p className="font-semibold text-sm mb-3" style={{ color: 'var(--text)' }}>{children}</p>
}

function SectionLabel({ children }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider mb-2 mt-6" style={{ color: 'var(--muted)' }}>
      {children}
    </p>
  )
}

function Label({ children }) {
  return <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>{children}</label>
}

function Hint({ children }) {
  return <p className="text-xs mt-1.5" style={{ color: 'var(--muted)', lineHeight: 1.4 }}>{children}</p>
}

function Toggle({ checked, onChange, label, description, disabled }) {
  return (
    <div className="flex items-center justify-between" style={{ minHeight: 52, gap: 12, padding: '2px 0' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="text-sm" style={{ color: disabled ? 'var(--muted)' : 'var(--text)' }}>{label}</p>
        {description && <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        role="switch"
        aria-checked={checked}
        style={{
          width: 44, height: 24, borderRadius: 12, flexShrink: 0,
          background: checked && !disabled ? '#3b82f6' : 'var(--border)',
          transition: 'background 0.2s', border: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          position: 'relative', minWidth: 44,
        }}
      >
        <span style={{
          position: 'absolute', top: 3,
          left: checked && !disabled ? 23 : 3,
          width: 18, height: 18, borderRadius: '50%',
          background: '#fff', transition: 'left 0.2s', display: 'block',
        }} />
      </button>
    </div>
  )
}

// ─── Tab 1: Profil ────────────────────────────────────────────────────────────

function TabProfil({ user }) {
  const { addToast } = useToast()
  const [form, setForm] = useState({ first_name: '', last_name: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resettingPwd, setResettingPwd] = useState(false)
  const [marketing, setMarketing] = useState(false)
  const [savingConsent, setSavingConsent] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    Promise.all([
      supabase.from('profiles').select('first_name, last_name').eq('id', user.id).maybeSingle(),
      supabase.from('user_consents').select('marketing_consent').eq('user_id', user.id).maybeSingle(),
    ]).then(([{ data: prof }, { data: consent }]) => {
      if (prof) setForm({ first_name: prof.first_name || '', last_name: prof.last_name || '' })
      if (consent) setMarketing(consent.marketing_consent || false)
      setLoading(false)
    })
  }, [user?.id])

  async function handleSave(ev) {
    ev.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      first_name: form.first_name.trim() || null,
      last_name: form.last_name.trim() || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    if (error) addToast(error.message, 'error')
    else addToast('Profil zaktualizowany', 'success')
    setSaving(false)
  }

  async function handlePasswordReset() {
    if (!user?.email) return
    setResettingPwd(true)
    const { error } = await supabase.auth.resetPasswordForEmail(user.email)
    if (error) addToast(error.message, 'error')
    else addToast('Link do zmiany hasła wysłany na email', 'success')
    setResettingPwd(false)
  }

  async function handleMarketingToggle(val) {
    setMarketing(val)
    setSavingConsent(true)
    await supabase.from('user_consents').upsert(
      { user_id: user.id, marketing_consent: val },
      { onConflict: 'user_id' }
    )
    setSavingConsent(false)
  }

  if (loading) return <Spinner />

  return (
    <div style={{ maxWidth: 480 }}>
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <Label>Imię</Label>
          <input style={IS()} value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} placeholder="Jan" />
        </div>
        <div>
          <Label>Nazwisko</Label>
          <input style={IS()} value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} placeholder="Kowalski" />
        </div>
        <div>
          <Label>E-mail</Label>
          <input style={IS_READONLY()} value={user?.email || ''} readOnly />
        </div>
        <div className="rounded-lg px-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between" style={{ minHeight: 52 }}>
            <span className="text-sm" style={{ color: 'var(--text)' }}>Hasło</span>
            <button
              type="button"
              onClick={handlePasswordReset}
              disabled={resettingPwd}
              className="text-sm font-medium"
              style={{ color: '#3b82f6', opacity: resettingPwd ? 0.6 : 1 }}
            >
              {resettingPwd ? 'Wysyłam…' : 'Zmień hasło →'}
            </button>
          </div>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg text-sm font-medium text-white"
          style={{ background: '#3b82f6', minHeight: 48, opacity: saving ? 0.7 : 1 }}
        >
          {saving ? 'Zapisywanie…' : 'Zapisz profil'}
        </button>
      </form>

      {/* Dokumenty i konto */}
      <div className="mt-8" style={{ borderTop: '1px solid var(--border)', paddingTop: 24 }}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--muted)' }}>
          Dokumenty i konto
        </p>
        <div className="flex gap-5 mb-4">
          <a href="/regulamin" target="_blank" rel="noopener noreferrer" className="text-sm" style={{ color: '#2563eb' }}>
            Regulamin →
          </a>
          <a href="/polityka-prywatnosci" target="_blank" rel="noopener noreferrer" className="text-sm" style={{ color: '#2563eb' }}>
            Polityka prywatności →
          </a>
        </div>
        <div className="rounded-lg px-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <Toggle
            checked={marketing}
            onChange={handleMarketingToggle}
            label="Zgoda marketingowa"
            description={savingConsent ? 'Zapisuję…' : 'Informacje o nowościach i promocjach'}
          />
        </div>
        <div className="text-center mt-5">
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            style={{ color: 'var(--muted)', fontSize: 12, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Usuń konto
          </button>
        </div>
      </div>

      {showDeleteModal && (
        <Modal title="Usuń konto" onClose={() => setShowDeleteModal(false)} maxWidth={440}>
          <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--text-2)' }}>
              Usunięcie konta jest nieodwracalne. Skontaktuj się z nami:{' '}
              <a href="mailto:kontakt@magzic.com" style={{ color: '#2563eb' }}>kontakt@magzic.com</a>
            </p>
            <button
              type="button"
              onClick={() => setShowDeleteModal(false)}
              className="w-full rounded-lg text-sm font-medium"
              style={{ background: 'var(--table-sub)', color: 'var(--text-2)', minHeight: 48 }}
            >
              Zamknij
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab 2: Firma i branża ────────────────────────────────────────────────────

function TabFirma({ user, workspaceId, refreshWorkspace }) {
  const { addToast } = useToast()
  const [ws, setWs] = useState(null)
  const [loading, setLoading] = useState(true)
  const [savingFirma, setSavingFirma] = useState(false)
  const [firmaForm, setFirmaForm] = useState({ company_name: '', nip: '' })
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)
  const [pickerCat, setPickerCat] = useState(null)
  const [pickerSub, setPickerSub] = useState('')
  const [savingCategory, setSavingCategory] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  useEffect(() => {
    async function fetchWs() {
      if (!workspaceId) return
      const { data } = await supabase.from('workspaces').select('*').eq('id', workspaceId).single()
      if (data) {
        setWs(data)
        setFirmaForm({ company_name: data.company_name || '', nip: data.nip || '' })
      }
      setLoading(false)
    }
    fetchWs()
  }, [workspaceId])

  async function handleSaveFirma(ev) {
    ev.preventDefault()
    setSavingFirma(true)
    const { error } = await supabase.from('workspaces').update({
      company_name: firmaForm.company_name.trim() || null,
      nip: firmaForm.nip.trim() || null,
    }).eq('id', workspaceId)
    if (error) addToast(error.message, 'error')
    else addToast('Dane firmy zapisane', 'success')
    setSavingFirma(false)
  }

  async function handleSaveCategory() {
    if (!pickerCat) return
    setSavingCategory(true)
    const { error } = await supabase.from('workspaces').update({
      business_category: pickerCat.id,
      business_subcategory: pickerSub || null,
    }).eq('id', workspaceId)
    if (error) { addToast(error.message, 'error') }
    else {
      setWs(w => ({ ...w, business_category: pickerCat.id, business_subcategory: pickerSub || null }))
      setShowCategoryPicker(false)
      await refreshWorkspace()
      addToast('Branża zmieniona — alerty i asystent zostały dostosowane', 'success')
    }
    setSavingCategory(false)
  }

  function openPicker() {
    const currentCat = getCategoryById(ws?.business_category || 'general')
    setPickerCat(currentCat)
    setPickerSub(ws?.business_subcategory || '')
    setShowCategoryPicker(true)
  }

  if (loading) return <Spinner />

  const currentCat = getCategoryById(ws?.business_category || 'general')
  const currentSub = ws?.business_subcategory
    ? (getSubcategoriesFor(ws.business_category || 'general').find(s => s.id === ws.business_subcategory)?.label || ws.business_subcategory)
    : null

  return (
    <div className="space-y-6" style={{ maxWidth: 480 }}>
      <form onSubmit={handleSaveFirma} className="space-y-4">
        <SectionTitle>Dane firmy</SectionTitle>
        <div>
          <Label>Nazwa firmy / magazynu</Label>
          <input
            style={IS()}
            value={firmaForm.company_name}
            onChange={e => setFirmaForm(f => ({ ...f, company_name: e.target.value }))}
            placeholder="np. Sklep ABC"
          />
        </div>
        <div>
          <Label>NIP</Label>
          <input
            style={IS()}
            value={firmaForm.nip}
            onChange={e => setFirmaForm(f => ({ ...f, nip: e.target.value }))}
            placeholder="np. 1234567890"
          />
        </div>
        <button
          type="submit"
          disabled={savingFirma}
          className="w-full rounded-lg text-sm font-medium text-white"
          style={{ background: '#3b82f6', minHeight: 48, opacity: savingFirma ? 0.7 : 1 }}
        >
          {savingFirma ? 'Zapisywanie…' : 'Zapisz dane firmy'}
        </button>
      </form>

      <div>
        <SectionTitle>Branża</SectionTitle>
        <div className="rounded-xl px-4 py-3 mb-3" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          {ws?.custom_category_name ? (
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                Twoja kategoria: {ws.custom_category_name}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                bazuje na: {getCategoryById(ws.custom_category_base_type || 'general').label}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                Aktualna branża: {currentCat.icon} {currentCat.label}
              </p>
              {currentSub && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{currentSub}</p>
              )}
            </div>
          )}
        </div>
        <button
          onClick={openPicker}
          className="w-full rounded-lg text-sm font-medium"
          style={{ border: '1px solid var(--border)', color: 'var(--text)', minHeight: 48, background: 'var(--card)' }}
        >
          Zmień branżę
        </button>
      </div>

      <div className="rounded-xl p-4 space-y-3" style={{ border: '2px solid #fecaca' }}>
        <p className="text-sm font-semibold" style={{ color: '#dc2626' }}>Niebezpieczna strefa</p>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>Usunięcie konta jest nieodwracalne i spowoduje trwałe usunięcie wszystkich danych.</p>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="rounded-lg text-sm font-medium"
          style={{ border: '1px solid #dc2626', color: '#dc2626', minHeight: 44, padding: '0 16px', background: 'transparent' }}
        >
          Usuń konto
        </button>
      </div>

      {showCategoryPicker && (
        <Modal title="Zmień branżę" onClose={() => setShowCategoryPicker(false)} maxWidth={600}>
          <div className="space-y-4">
            <>
              <div className="grid grid-cols-2 gap-2" style={{ maxHeight: 340, overflowY: 'auto' }}>
                {BUSINESS_CATEGORIES.map(cat => {
                  const active = pickerCat?.id === cat.id
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => { setPickerCat(cat); setPickerSub('') }}
                      className="rounded-xl p-3 text-left transition-colors"
                      style={{
                        background: active ? 'rgba(59,130,246,0.1)' : 'var(--card)',
                        border: `2px solid ${active ? '#3b82f6' : 'var(--border)'}`,
                      }}
                    >
                      <div className="text-lg mb-0.5">{cat.icon}</div>
                      <p className="text-xs font-medium" style={{ color: active ? '#2563eb' : 'var(--text)' }}>{cat.label}</p>
                    </button>
                  )
                })}
              </div>

              {pickerCat && getSubcategoriesFor(pickerCat.id).length > 0 && (
                <div>
                  <Label>Podkategoria (opcjonalnie)</Label>
                  <select
                    style={{ ...IS(), cursor: 'pointer' }}
                    value={pickerSub}
                    onChange={e => setPickerSub(e.target.value)}
                  >
                    <option value="">— wybierz podkategorię —</option>
                    {getSubcategoriesFor(pickerCat.id).map(s => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCategoryPicker(false)}
                  className="flex-1 rounded-lg text-sm"
                  style={{ background: 'var(--table-sub)', color: 'var(--text-2)', minHeight: 48 }}
                >
                  Anuluj
                </button>
                <button
                  type="button"
                  onClick={handleSaveCategory}
                  disabled={savingCategory || !pickerCat}
                  className="flex-1 rounded-lg text-sm font-medium text-white"
                  style={{ background: '#3b82f6', minHeight: 48, opacity: (savingCategory || !pickerCat) ? 0.7 : 1 }}
                >
                  {savingCategory ? 'Zapisuję…' : 'Zapisz branżę'}
                </button>
              </div>
            </>
          </div>
        </Modal>
      )}

      {showDeleteModal && (
        <Modal title="Usuń konto" onClose={() => setShowDeleteModal(false)} maxWidth={440}>
          <div className="space-y-4">
            <div className="rounded-lg px-4 py-3" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
              <p className="text-sm font-medium" style={{ color: '#dc2626' }}>
                Czy na pewno chcesz usunąć konto? Wszystkie dane zostaną trwale usunięte.
              </p>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-2)' }}>
              Aby usunąć konto, skontaktuj się z nami:{' '}
              <a href="mailto:kontakt@magzic.com" style={{ color: '#2563eb' }}>kontakt@magzic.com</a>
            </p>
            <button
              type="button"
              onClick={() => setShowDeleteModal(false)}
              className="w-full rounded-lg text-sm font-medium"
              style={{ background: 'var(--table-sub)', color: 'var(--text-2)', minHeight: 48 }}
            >
              Zamknij
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab 3: Magazyn ───────────────────────────────────────────────────────────

function TabMagazyn({ workspace, workspaceId, refreshWorkspace }) {
  const { addToast } = useToast()
  const [saving, setSaving] = useState(false)

  const initForm = (ws) => {
    const s = getAllSettings(ws)
    return {
      default_unit: s.default_unit,
      price_display: s.price_display,
      default_vat_rate: String(s.default_vat_rate),
      currency: s.currency,
      low_stock_threshold: String(s.low_stock_threshold),
      dead_stock_days: String(s.dead_stock_days),
      alert_price_change_percent: String(s.alert_price_change_percent),
    }
  }

  const [form, setForm] = useState(() => initForm(workspace))

  useEffect(() => { setForm(initForm(workspace)) }, [workspace?.id])

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }

  async function handleSave(ev) {
    ev.preventDefault()
    setSaving(true)
    const newSettings = {
      ...(workspace?.settings || {}),
      default_unit: form.default_unit,
      price_display: form.price_display,
      default_vat_rate: Number(form.default_vat_rate),
      currency: form.currency,
      low_stock_threshold: Number(form.low_stock_threshold),
      dead_stock_days: Number(form.dead_stock_days),
      alert_price_change_percent: Number(form.alert_price_change_percent),
    }
    const { error } = await supabase.from('workspaces').update({ settings: newSettings }).eq('id', workspaceId)
    if (error) addToast(error.message, 'error')
    else {
      await refreshWorkspace()
      addToast('Ustawienia magazynu zapisane', 'success')
    }
    setSaving(false)
  }

  return (
    <form onSubmit={handleSave} style={{ maxWidth: 480 }}>
      <SectionLabel>Jednostki i ceny</SectionLabel>
      <div className="space-y-4">
        <div>
          <Label>Domyślna jednostka</Label>
          <select style={{ ...IS(), cursor: 'pointer' }} value={form.default_unit} onChange={e => set('default_unit', e.target.value)}>
            {['szt.', 'kg', 'l', 'm', 'opak.', 'kpl.', 'm²', 'm³', 'para'].map(u => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
        <div>
          <Label>Wyświetlanie cen</Label>
          <select style={{ ...IS(), cursor: 'pointer' }} value={form.price_display} onChange={e => set('price_display', e.target.value)}>
            <option value="netto">Netto</option>
            <option value="brutto">Brutto</option>
          </select>
        </div>
        <div>
          <Label>Domyślna stawka VAT</Label>
          <select style={{ ...IS(), cursor: 'pointer' }} value={form.default_vat_rate} onChange={e => set('default_vat_rate', e.target.value)}>
            <option value="23">23%</option>
            <option value="8">8%</option>
            <option value="5">5%</option>
            <option value="0">0% / ZW</option>
          </select>
        </div>
        <div>
          <Label>Waluta</Label>
          <select style={{ ...IS(), cursor: 'pointer' }} value={form.currency} onChange={e => set('currency', e.target.value)}>
            <option value="PLN">PLN</option>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
            <option value="GBP">GBP</option>
          </select>
        </div>
      </div>

      <SectionLabel>Stany magazynowe</SectionLabel>
      <div className="space-y-4">
        <div>
          <Label>Próg niskiego stanu</Label>
          <input
            type="number"
            inputMode="numeric"
            min="1" max="1000"
            style={IS()}
            value={form.low_stock_threshold}
            onChange={e => set('low_stock_threshold', e.target.value)}
          />
          <Hint>Produkty z mniejszym stanem będą oznaczone jako "niski stan"</Hint>
        </div>
        <div>
          <Label>Martwy towar po (dni bez ruchu)</Label>
          <input
            type="number"
            inputMode="numeric"
            min="7" max="365"
            style={IS()}
            value={form.dead_stock_days}
            onChange={e => set('dead_stock_days', e.target.value)}
          />
          <Hint>Produkty bez aktywności będą oznaczone jako zalegające</Hint>
        </div>
        <div>
          <Label>Alert cenowy powyżej (%)</Label>
          <input
            type="number"
            inputMode="numeric"
            min="1" max="100"
            style={IS()}
            value={form.alert_price_change_percent}
            onChange={e => set('alert_price_change_percent', e.target.value)}
          />
          <Hint>Powiadomienie o zmianie ceny zakupu przekraczającej ten próg</Hint>
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-lg text-sm font-medium text-white mt-6"
        style={{ background: '#3b82f6', minHeight: 48, opacity: saving ? 0.7 : 1 }}
      >
        {saving ? 'Zapisywanie…' : '💾 Zapisz ustawienia magazynu'}
      </button>
    </form>
  )
}

// ─── Tab 4: Powiadomienia ─────────────────────────────────────────────────────

function TabPowiadomienia({ workspace, workspaceId, refreshWorkspace }) {
  const { addToast } = useToast()
  const [saving, setSaving] = useState(false)

  const initForm = (ws) => {
    const s = getAllSettings(ws)
    return {
      briefing_on_dashboard: s.briefing_on_dashboard,
      weekly_report_on_dashboard: s.weekly_report_on_dashboard,
      alert_low_stock: s.alert_low_stock,
      alert_price_changes: s.alert_price_changes,
      alert_dead_stock: s.alert_dead_stock,
      alert_invoice_review: s.alert_invoice_review,
    }
  }

  const [form, setForm] = useState(() => initForm(workspace))
  useEffect(() => { setForm(initForm(workspace)) }, [workspace?.id])

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }

  async function handleSave() {
    setSaving(true)
    const newSettings = { ...(workspace?.settings || {}), ...form }
    const { error } = await supabase.from('workspaces').update({ settings: newSettings }).eq('id', workspaceId)
    if (error) addToast(error.message, 'error')
    else {
      await refreshWorkspace()
      addToast('Powiadomienia zapisane', 'success')
    }
    setSaving(false)
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <SectionLabel>Dashboard</SectionLabel>
      <div className="rounded-xl px-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <Toggle
          checked={form.briefing_on_dashboard}
          onChange={v => set('briefing_on_dashboard', v)}
          label="Briefing dnia"
          description={'Sekcja „Co musisz dziś zrobić?”'}
        />
        <div style={{ borderTop: '1px solid var(--border)' }}>
          <Toggle
            checked={form.weekly_report_on_dashboard}
            onChange={v => set('weekly_report_on_dashboard', v)}
            label="Raport tygodniowy"
            description="Podsumowanie tygodnia w skrócie"
          />
        </div>
      </div>

      <SectionLabel>Alerty</SectionLabel>
      <div className="rounded-xl px-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <Toggle checked={form.alert_low_stock} onChange={v => set('alert_low_stock', v)} label="Niskie stany magazynowe" />
        <div style={{ borderTop: '1px solid var(--border)' }}>
          <Toggle checked={form.alert_price_changes} onChange={v => set('alert_price_changes', v)} label="Zmiany cen zakupu" />
        </div>
        <div style={{ borderTop: '1px solid var(--border)' }}>
          <Toggle checked={form.alert_dead_stock} onChange={v => set('alert_dead_stock', v)} label="Martwy towar" />
        </div>
        <div style={{ borderTop: '1px solid var(--border)' }}>
          <Toggle checked={form.alert_invoice_review} onChange={v => set('alert_invoice_review', v)} label="Faktury do weryfikacji" />
        </div>
      </div>

      <SectionLabel>📧 Powiadomienia e-mail</SectionLabel>
      <div className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Powiadomienia e-mail będą dostępne wkrótce. Otrzymasz podsumowanie tygodnia i alerty na swoją skrzynkę.
        </p>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-lg text-sm font-medium text-white mt-6"
        style={{ background: '#3b82f6', minHeight: 48, opacity: saving ? 0.7 : 1 }}
      >
        {saving ? 'Zapisywanie…' : '💾 Zapisz powiadomienia'}
      </button>
    </div>
  )
}

// ─── Tab 5: Wygląd ────────────────────────────────────────────────────────────

function TabWyglad({ workspace, workspaceId, refreshWorkspace }) {
  const { addToast } = useToast()
  const { theme, toggleTheme } = useTheme()
  const [saving, setSaving] = useState(false)

  const initForm = (ws) => {
    const s = getAllSettings(ws)
    return {
      show_stat_cards: s.show_stat_cards,
      show_chart: s.show_chart,
      show_attention_list: s.show_attention_list,
    }
  }

  const [form, setForm] = useState(() => initForm(workspace))
  useEffect(() => { setForm(initForm(workspace)) }, [workspace?.id])

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }

  async function handleSave() {
    setSaving(true)
    const newSettings = { ...(workspace?.settings || {}), ...form }
    const { error } = await supabase.from('workspaces').update({ settings: newSettings }).eq('id', workspaceId)
    if (error) addToast(error.message, 'error')
    else {
      await refreshWorkspace()
      addToast('Wygląd zapisany', 'success')
    }
    setSaving(false)
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <SectionLabel>Motyw</SectionLabel>
      <div className="rounded-xl px-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <Toggle
          checked={theme === 'dark'}
          onChange={toggleTheme}
          label="Tryb ciemny"
        />
      </div>

      <SectionLabel>Sekcje na dashboardzie</SectionLabel>
      <div className="rounded-xl px-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <Toggle
          checked={form.show_stat_cards}
          onChange={v => set('show_stat_cards', v)}
          label="Karty statystyk"
          description="Towary, Magazyny, Kontrahenci, Faktury"
        />
        <div style={{ borderTop: '1px solid var(--border)' }}>
          <Toggle
            checked={form.show_chart}
            onChange={v => set('show_chart', v)}
            label="Wykres stanów magazynowych"
            description="Top 8 towarów"
          />
        </div>
        <div style={{ borderTop: '1px solid var(--border)' }}>
          <Toggle
            checked={form.show_attention_list}
            onChange={v => set('show_attention_list', v)}
            label='Lista "Wymagają uwagi"'
            description="Produkty krytyczne"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-lg text-sm font-medium text-white mt-6"
        style={{ background: '#3b82f6', minHeight: 48, opacity: saving ? 0.7 : 1 }}
      >
        {saving ? 'Zapisywanie…' : '💾 Zapisz wygląd'}
      </button>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Ustawienia() {
  const { user } = useAuth()
  const { workspaceId, workspace, refreshWorkspace } = useWorkspace()
  const [activeTab, setActiveTab] = useState(0)

  return (
    <div>
      <h1 className="text-xl font-semibold mb-5" style={{ color: 'var(--text)' }}>⚙️ Ustawienia</h1>

      {/* Tab nav — horizontal scroll, no wrap */}
      <div
        className="flex gap-2 mb-6 overflow-x-auto pb-1"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {TABS.map((tab, i) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(i)}
            className="flex items-center gap-1.5 rounded-lg text-sm font-medium flex-shrink-0 transition-colors"
            style={{
              minHeight: 44,
              padding: '0 14px',
              background: activeTab === i ? '#3b82f6' : 'var(--card)',
              color: activeTab === i ? '#fff' : 'var(--text-2)',
              border: `1px solid ${activeTab === i ? '#3b82f6' : 'var(--border)'}`,
            }}
          >
            <span>{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden">{tab.short}</span>
          </button>
        ))}
      </div>

      {activeTab === 0 && <TabProfil user={user} />}
      {activeTab === 1 && <TabFirma user={user} workspaceId={workspaceId} refreshWorkspace={refreshWorkspace} />}
      {activeTab === 2 && <TabMagazyn workspace={workspace} workspaceId={workspaceId} refreshWorkspace={refreshWorkspace} />}
      {activeTab === 3 && <TabPowiadomienia workspace={workspace} workspaceId={workspaceId} refreshWorkspace={refreshWorkspace} />}
      {activeTab === 4 && <TabWyglad workspace={workspace} workspaceId={workspaceId} refreshWorkspace={refreshWorkspace} />}
    </div>
  )
}
