import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { useToast } from '../context/ToastContext'
import { BUSINESS_CATEGORIES, getCategoryById, getSubcategoriesFor } from '../config/businessTypes'
import Modal from '../components/Modal'
import Spinner from '../components/Spinner'

const TABS = ['Profil', 'Firma i branża', 'Zgody i prywatność']

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

function Label({ children }) {
  return <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>{children}</label>
}

function Toggle({ checked, onChange, label }) {
  return (
    <div className="flex items-center justify-between" style={{ minHeight: 48 }}>
      <span className="text-sm" style={{ color: 'var(--text)' }}>{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className="relative flex-shrink-0"
        style={{
          width: 44, height: 24, borderRadius: 12,
          background: checked ? '#3b82f6' : 'var(--border)',
          transition: 'background 0.2s',
          border: 'none', cursor: 'pointer',
        }}
      >
        <span style={{
          position: 'absolute', top: 3, left: checked ? 23 : 3,
          width: 18, height: 18, borderRadius: '50%', background: '#fff',
          transition: 'left 0.2s',
        }} />
      </button>
    </div>
  )
}

// ─── Tab 1: Profil ──────────────────────────────────────────────────────────

function TabProfil({ user }) {
  const { addToast } = useToast()
  const [form, setForm] = useState({ first_name: '', last_name: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resettingPwd, setResettingPwd] = useState(false)

  useEffect(() => {
    async function fetchProfile() {
      if (!user?.id) return
      const { data } = await supabase.from('profiles').select('first_name, last_name').eq('id', user.id).maybeSingle()
      if (data) setForm({ first_name: data.first_name || '', last_name: data.last_name || '' })
      setLoading(false)
    }
    fetchProfile()
  }, [user])

  async function handleSave(ev) {
    ev.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      first_name: form.first_name.trim() || null,
      last_name: form.last_name.trim() || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    if (error) { addToast(error.message, 'error') }
    else { addToast('Profil zaktualizowany', 'success') }
    setSaving(false)
  }

  async function handlePasswordReset() {
    if (!user?.email) return
    setResettingPwd(true)
    const { error } = await supabase.auth.resetPasswordForEmail(user.email)
    if (error) { addToast(error.message, 'error') }
    else { addToast('Link do zmiany hasła wysłany na email', 'success') }
    setResettingPwd(false)
  }

  if (loading) return <Spinner />

  return (
    <form onSubmit={handleSave} className="space-y-4" style={{ maxWidth: 480 }}>
      <div>
        <Label>Imię</Label>
        <input style={IS()} value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} placeholder="Jan" />
      </div>
      <div>
        <Label>Nazwisko</Label>
        <input style={IS()} value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} placeholder="Kowalski" />
      </div>
      <div>
        <Label>E-mail (nie edytowalny)</Label>
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
        {saving ? 'Zapisywanie…' : 'Zapisz zmiany'}
      </button>
    </form>
  )
}

// ─── Tab 2: Firma i branża ───────────────────────────────────────────────────

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
    if (error) { addToast(error.message, 'error') }
    else { addToast('Dane firmy zapisane', 'success') }
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
      {/* Dane firmy */}
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

      {/* Branża */}
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

      {/* Niebezpieczna strefa */}
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

      {/* Category picker modal */}
      {showCategoryPicker && (
        <Modal title="Zmień branżę" onClose={() => setShowCategoryPicker(false)} maxWidth={600}>
          <div className="space-y-4">
            {!pickerCat || BUSINESS_CATEGORIES.find(c => c.id === pickerCat.id) ? (
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
            ) : null}
          </div>
        </Modal>
      )}

      {/* Delete account modal */}
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

// ─── Tab 3: Zgody i prywatność ───────────────────────────────────────────────

function TabZgody({ user }) {
  const { addToast } = useToast()
  const [consents, setConsents] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [marketing, setMarketing] = useState(false)
  const [cookies, setCookies] = useState(false)

  useEffect(() => {
    async function fetchConsents() {
      if (!user?.id) return
      const { data } = await supabase.from('user_consents').select('*').eq('user_id', user.id).maybeSingle()
      if (data) {
        setConsents(data)
        setMarketing(data.marketing_consent || false)
        setCookies(data.cookies_consent || false)
      }
      setLoading(false)
    }
    fetchConsents()
  }, [user])

  function fmtDatetime(ts) {
    if (!ts) return 'Nie zaakceptowano'
    const d = new Date(ts)
    return d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
  }

  async function handleSave() {
    if (!user?.id) return
    setSaving(true)
    const { error } = await supabase.from('user_consents').upsert({
      user_id: user.id,
      marketing_consent: marketing,
      cookies_consent: cookies,
    }, { onConflict: 'user_id' })
    if (error) { addToast(error.message, 'error') }
    else { addToast('Zgody zapisane', 'success') }
    setSaving(false)
  }

  if (loading) return <Spinner />

  return (
    <div className="space-y-6" style={{ maxWidth: 480 }}>
      {/* Readonly consent info */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        {[
          { label: 'Regulamin zaakceptowany', value: fmtDatetime(consents?.accepted_terms_at) },
          { label: 'Wersja regulaminu', value: consents?.terms_version || '—' },
          { label: 'Polityka prywatności zaakceptowana', value: fmtDatetime(consents?.accepted_privacy_at) },
          { label: 'Wersja polityki', value: consents?.privacy_policy_version || '—' },
        ].map((row, i) => (
          <div
            key={row.label}
            className="flex items-start justify-between px-4 py-3"
            style={{
              borderBottom: i < 3 ? '1px solid var(--border)' : 'none',
              background: i % 2 === 0 ? 'var(--card)' : 'var(--table-even)',
            }}
          >
            <span className="text-xs" style={{ color: 'var(--muted)', flex: '0 0 auto', marginRight: 8, paddingTop: 2 }}>{row.label}</span>
            <span className="text-sm text-right" style={{ color: 'var(--text)' }}>{row.value}</span>
          </div>
        ))}
      </div>

      {/* Editable consents */}
      <div className="rounded-xl px-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <Toggle checked={marketing} onChange={setMarketing} label="Zgoda marketingowa" />
        <div style={{ borderTop: '1px solid var(--border)' }}>
          <Toggle checked={cookies} onChange={setCookies} label="Zgoda na cookies" />
        </div>
      </div>

      {/* Links */}
      <div className="flex gap-4 flex-wrap">
        <a href="/regulamin" target="_blank" rel="noopener noreferrer" className="text-sm" style={{ color: '#2563eb' }}>
          Przeczytaj Regulamin →
        </a>
        <a href="/polityka-prywatnosci" target="_blank" rel="noopener noreferrer" className="text-sm" style={{ color: '#2563eb' }}>
          Przeczytaj Politykę Prywatności →
        </a>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-lg text-sm font-medium text-white"
        style={{ background: '#3b82f6', minHeight: 48, opacity: saving ? 0.7 : 1 }}
      >
        {saving ? 'Zapisywanie…' : 'Zapisz zgody'}
      </button>
    </div>
  )
}

// ─── Main Ustawienia page ────────────────────────────────────────────────────

export default function Ustawienia() {
  const { user } = useAuth()
  const { workspaceId, refreshWorkspace } = useWorkspace()
  const [activeTab, setActiveTab] = useState(0)

  return (
    <div>
      <h1 className="text-xl font-semibold mb-5" style={{ color: 'var(--text)' }}>⚙️ Ustawienia</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className="rounded-lg px-4 text-sm font-medium flex-shrink-0 transition-colors"
            style={{
              minHeight: 40,
              background: activeTab === i ? '#3b82f6' : 'var(--card)',
              color: activeTab === i ? '#fff' : 'var(--text-2)',
              border: `1px solid ${activeTab === i ? '#3b82f6' : 'var(--border)'}`,
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 0 && <TabProfil user={user} />}
      {activeTab === 1 && <TabFirma user={user} workspaceId={workspaceId} refreshWorkspace={refreshWorkspace} />}
      {activeTab === 2 && <TabZgody user={user} />}
    </div>
  )
}
