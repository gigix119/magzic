import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useToast } from '../context/ToastContext'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import Spinner from '../components/Spinner'
import { Plus, AlertTriangle, TrendingDown, Bell, Percent, Trash2, Zap, Clock, Lightbulb } from 'lucide-react'

const IS = (err) => ({
  background: 'var(--input-bg)',
  border: `1px solid ${err ? '#ef4444' : 'var(--border)'}`,
  borderRadius: 8, color: 'var(--text)',
  padding: '8px 12px', fontSize: 14, width: '100%', outline: 'none',
})

const emptyForm = { towar_id: '', prog_procentowy: '', aktywny: true }

const SEV_CONFIG = {
  critical: { label: 'Krytyczny', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.3)', color: '#dc2626', badgeVariant: 'red' },
  high:     { label: 'Wysoki',    bg: 'rgba(234,88,12,0.08)',  border: 'rgba(234,88,12,0.3)',  color: '#ea580c', badgeVariant: 'red' },
  medium:   { label: 'Średni',    bg: 'rgba(234,179,8,0.08)', border: 'rgba(234,179,8,0.3)',  color: '#ca8a04', badgeVariant: 'yellow' },
  low:      { label: 'Niski',     bg: 'rgba(100,116,139,0.08)',border: 'rgba(100,116,139,0.3)',color: '#64748b', badgeVariant: 'zinc' },
}

const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3 }

export default function Alerty() {
  const { addToast } = useToast()
  const [allAlerts, setAllAlerts] = useState([])
  const [alertyCenowe, setAlertyCenowe] = useState([])
  const [towary, setTowary] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [form, setForm] = useState(emptyForm)

  async function fetchData() {
    const ago30 = new Date(Date.now() - 30 * 86400000).toISOString()
    const ago7  = new Date(Date.now() -  7 * 86400000).toISOString()

    const [{ data: t, error: e1 }, { data: stanyRaw }, { data: ac }, { data: ruchy30 }] = await Promise.all([
      supabase.from('towary').select('id, nazwa, jednostka, stan_minimalny, kategorie(nazwa)').eq('aktywny', true).order('nazwa'),
      supabase.from('stany_magazynowe').select('towar_id, ilosc'),
      supabase.from('alerty_cenowe').select('*, towary(nazwa)').order('id'),
      supabase.from('ruchy_magazynowe').select('towar_id, ilosc, typ, created_at')
        .in('typ', ['issue', 'transfer'])
        .gte('created_at', ago30),
    ])
    if (e1) { console.error(e1); addToast(e1.message, 'error') }
    setTowary(t || [])
    setAlertyCenowe(ac || [])

    const stanMap = {}
    for (const s of stanyRaw || []) stanMap[s.towar_id] = (stanMap[s.towar_id] || 0) + Number(s.ilosc)

    // outflow last 30d and 7d per towar
    const out30 = {}
    const out7  = {}
    for (const r of ruchy30 || []) {
      out30[r.towar_id] = (out30[r.towar_id] || 0) + Number(r.ilosc)
      if (r.created_at >= ago7) out7[r.towar_id] = (out7[r.towar_id] || 0) + Number(r.ilosc)
    }

    const alerts = []

    for (const item of t || []) {
      const stan = stanMap[item.id] || 0
      const min  = item.stan_minimalny

      // 1. Brak stanu (critical)
      if (min != null && stan === 0) {
        alerts.push({ id: `brak-${item.id}`, severity: 'critical', type: 'brak_stanu', towar: item, stan, icon: 'alert' })
        continue
      }

      // 2. Poniżej minimum (high)
      if (min != null && stan > 0 && stan < min) {
        alerts.push({ id: `ponizej-${item.id}`, severity: 'high', type: 'ponizej_minimum', towar: item, stan, min, icon: 'trend' })
        continue
      }

      // 3. Blisko minimum (medium) — within 20% above min
      if (min != null && stan >= min && stan <= min * 1.2) {
        alerts.push({ id: `blisko-${item.id}`, severity: 'medium', type: 'blisko_minimum', towar: item, stan, min, icon: 'trend' })
        continue
      }

      // 4. Szybkie zużycie (medium) — 7d outflow >= 50% of current stock (and stock > 0)
      if (stan > 0 && out7[item.id] && out7[item.id] >= stan * 0.5) {
        alerts.push({ id: `szybkie-${item.id}`, severity: 'medium', type: 'szybkie_zuzycie', towar: item, stan, outflow7: out7[item.id], icon: 'zap' })
        continue
      }

      // 5. Brak ruchu (low) — has stock but no outflow in 30 days
      if (stan > 0 && !out30[item.id]) {
        alerts.push({ id: `brak-ruchu-${item.id}`, severity: 'low', type: 'brak_ruchu', towar: item, stan, icon: 'clock' })
      }
    }

    alerts.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity])
    setAllAlerts(alerts)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  function validate() {
    const e = {}
    if (!form.towar_id) e.towar_id = true
    if (!form.prog_procentowy || Number(form.prog_procentowy) <= 0) e.prog = true
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSaveAlert(ev) {
    ev.preventDefault()
    if (!validate()) return
    setSaving(true)
    const { error } = await supabase.from('alerty_cenowe').insert([{
      towar_id: form.towar_id,
      prog_procentowy: Number(form.prog_procentowy),
      aktywny: form.aktywny,
    }])
    if (error) { console.error(error); addToast(error.message, 'error') }
    else { addToast('Alert cenowy dodany', 'success'); setShowModal(false); setForm(emptyForm); fetchData() }
    setSaving(false)
  }

  async function toggleAlert(id, current) {
    const { error } = await supabase.from('alerty_cenowe').update({ aktywny: !current }).eq('id', id)
    if (error) { console.error(error); addToast(error.message, 'error') }
    else { addToast(`Alert ${current ? 'wyłączony' : 'włączony'}`, 'success'); fetchData() }
  }

  async function handleDeleteAlert(id) {
    if (!window.confirm('Usunąć alert cenowy?')) return
    const { error } = await supabase.from('alerty_cenowe').delete().eq('id', id)
    if (error) { console.error(error); addToast(error.message, 'error') }
    else { addToast('Alert usunięty', 'success'); fetchData() }
  }

  function alertMessage(a) {
    if (a.type === 'brak_stanu') return `Stan: 0 ${a.towar.jednostka || 'szt.'} — brak towaru`
    if (a.type === 'ponizej_minimum') return `Stan: ${a.stan} / min. ${a.min} ${a.towar.jednostka || 'szt.'}`
    if (a.type === 'blisko_minimum') return `Stan: ${a.stan} / min. ${a.min} (blisko progu)`
    if (a.type === 'szybkie_zuzycie') return `Zużyto ${a.outflow7} ${a.towar.jednostka || 'szt.'} w ostatnich 7 dniach`
    if (a.type === 'brak_ruchu') return `Stan: ${a.stan} ${a.towar.jednostka || 'szt.'} — brak ruchu od 30 dni`
    return ''
  }

  function alertTypeLabel(type) {
    if (type === 'brak_stanu') return 'Brak stanu'
    if (type === 'ponizej_minimum') return 'Poniżej minimum'
    if (type === 'blisko_minimum') return 'Blisko minimum'
    if (type === 'szybkie_zuzycie') return 'Szybkie zużycie'
    if (type === 'brak_ruchu') return 'Brak ruchu'
    return type
  }

  function AlertIcon({ type, size = 14 }) {
    if (type === 'brak_stanu' || type === 'ponizej_minimum') return <AlertTriangle size={size} />
    if (type === 'szybkie_zuzycie') return <Zap size={size} />
    if (type === 'brak_ruchu') return <Clock size={size} />
    return <TrendingDown size={size} />
  }

  if (loading) return <Spinner />

  const critCount    = allAlerts.filter(a => a.severity === 'critical').length
  const highCount    = allAlerts.filter(a => a.severity === 'high').length
  const mediumCount  = allAlerts.filter(a => a.severity === 'medium').length
  const lowCount     = allAlerts.filter(a => a.severity === 'low').length
  const topAlerts    = allAlerts.filter(a => a.severity === 'critical' || a.severity === 'high').slice(0, 5)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Alerty</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>Monitorowanie stanów i cen</p>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-3 mb-6">
        {allAlerts.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg px-4 py-3" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
            <span className="text-sm font-medium" style={{ color: '#16a34a' }}>Wszystkie stany OK</span>
          </div>
        ) : (
          <>
            {critCount > 0 && (
              <div className="flex items-center gap-2 rounded-lg px-4 py-3" style={{ background: SEV_CONFIG.critical.bg, border: `1px solid ${SEV_CONFIG.critical.border}` }}>
                <AlertTriangle size={15} style={{ color: SEV_CONFIG.critical.color }} />
                <span className="text-sm font-medium" style={{ color: SEV_CONFIG.critical.color }}>{critCount} krytycznych</span>
              </div>
            )}
            {highCount > 0 && (
              <div className="flex items-center gap-2 rounded-lg px-4 py-3" style={{ background: SEV_CONFIG.high.bg, border: `1px solid ${SEV_CONFIG.high.border}` }}>
                <TrendingDown size={15} style={{ color: SEV_CONFIG.high.color }} />
                <span className="text-sm font-medium" style={{ color: SEV_CONFIG.high.color }}>{highCount} wysokich</span>
              </div>
            )}
            {mediumCount > 0 && (
              <div className="flex items-center gap-2 rounded-lg px-4 py-3" style={{ background: SEV_CONFIG.medium.bg, border: `1px solid ${SEV_CONFIG.medium.border}` }}>
                <Zap size={15} style={{ color: SEV_CONFIG.medium.color }} />
                <span className="text-sm font-medium" style={{ color: SEV_CONFIG.medium.color }}>{mediumCount} średnich</span>
              </div>
            )}
            {lowCount > 0 && (
              <div className="flex items-center gap-2 rounded-lg px-4 py-3" style={{ background: SEV_CONFIG.low.bg, border: `1px solid ${SEV_CONFIG.low.border}` }}>
                <Clock size={15} style={{ color: SEV_CONFIG.low.color }} />
                <span className="text-sm font-medium" style={{ color: SEV_CONFIG.low.color }}>{lowCount} informacyjnych</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Smart Insights */}
      {topAlerts.length > 0 && (
        <div className="rounded-xl overflow-hidden mb-6" style={{ border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 px-5 py-3" style={{ background: 'var(--table-head)', borderBottom: '1px solid var(--border)' }}>
            <Lightbulb size={16} style={{ color: '#f59e0b' }} />
            <h2 className="font-medium" style={{ fontSize: 14, color: 'var(--text)' }}>Smart Insights — wymagają uwagi</h2>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {topAlerts.map(a => {
              const cfg = SEV_CONFIG[a.severity]
              return (
                <div key={a.id} className="flex items-start gap-3 px-5 py-3" style={{ background: cfg.bg }}>
                  <div style={{ color: cfg.color, marginTop: 1, flexShrink: 0 }}>
                    <AlertIcon type={a.type} size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{a.towar.nazwa}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>{alertMessage(a)}</p>
                  </div>
                  <Badge variant={cfg.badgeVariant}>{SEV_CONFIG[a.severity].label}</Badge>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* All alerts table */}
      <div className="rounded-xl overflow-hidden mb-6" style={{ border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 px-5 py-3" style={{ background: 'var(--table-head)', borderBottom: '1px solid var(--border)' }}>
          <AlertTriangle size={16} style={{ color: '#ca8a04' }} />
          <h2 className="font-medium" style={{ fontSize: 14, color: 'var(--text)' }}>Alerty stanów magazynowych</h2>
          {allAlerts.length > 0 && <Badge variant="yellow">{allAlerts.length}</Badge>}
        </div>

        {allAlerts.length === 0 ? (
          <div className="text-center py-10" style={{ background: 'var(--table-even)', color: 'var(--muted)' }}>
            <p className="text-sm">Brak aktywnych alertów</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--table-sub)' }}>
                <th className="text-left px-5 py-2.5 font-medium" style={{ color: 'var(--muted)', fontSize: 12 }}>Towar</th>
                <th className="text-left px-5 py-2.5 font-medium hidden sm:table-cell" style={{ color: 'var(--muted)', fontSize: 12 }}>Kategoria</th>
                <th className="text-left px-5 py-2.5 font-medium" style={{ color: 'var(--muted)', fontSize: 12 }}>Typ</th>
                <th className="text-left px-5 py-2.5 font-medium" style={{ color: 'var(--muted)', fontSize: 12 }}>Szczegóły</th>
                <th className="text-center px-5 py-2.5 font-medium" style={{ color: 'var(--muted)', fontSize: 12 }}>Priorytet</th>
              </tr>
            </thead>
            <tbody>
              {allAlerts.map((a, idx) => {
                const cfg = SEV_CONFIG[a.severity]
                return (
                  <tr key={a.id} className="table-row" style={{ background: idx % 2 === 0 ? 'var(--table-even)' : 'var(--table-odd)', borderTop: '1px solid var(--border)' }}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span style={{ color: cfg.color, flexShrink: 0 }}><AlertIcon type={a.type} size={14} /></span>
                        <span className="font-medium" style={{ color: 'var(--text)' }}>{a.towar.nazwa}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 hidden sm:table-cell text-xs" style={{ color: 'var(--text-2)' }}>{a.towar.kategorie?.nazwa || '—'}</td>
                    <td className="px-5 py-3 text-xs" style={{ color: cfg.color }}>{alertTypeLabel(a.type)}</td>
                    <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-2)' }}>{alertMessage(a)}</td>
                    <td className="px-5 py-3 text-center">
                      <Badge variant={cfg.badgeVariant}>{cfg.label}</Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Alerty cenowe */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between px-5 py-3" style={{ background: 'var(--table-head)', borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2">
            <Bell size={16} style={{ color: '#9333ea' }} />
            <h2 className="font-medium" style={{ fontSize: 14, color: 'var(--text)' }}>Alerty cenowe</h2>
            {alertyCenowe.length > 0 && <Badge variant="purple">{alertyCenowe.length}</Badge>}
          </div>
          <button
            onClick={() => { setForm(emptyForm); setErrors({}); setShowModal(true) }}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white"
            style={{ background: '#3b82f6' }}
          >
            <Plus size={12} /> Nowy alert
          </button>
        </div>

        {alertyCenowe.length === 0 ? (
          <div className="text-center py-10" style={{ background: 'var(--table-even)', color: 'var(--muted)' }}>
            <p className="text-sm">Brak alertów cenowych</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--table-sub)' }}>
                <th className="text-left px-5 py-2.5 font-medium" style={{ color: 'var(--muted)', fontSize: 12 }}>Towar</th>
                <th className="text-right px-5 py-2.5 font-medium" style={{ color: 'var(--muted)', fontSize: 12 }}>Próg %</th>
                <th className="text-center px-5 py-2.5 font-medium" style={{ color: 'var(--muted)', fontSize: 12 }}>Status</th>
                <th className="text-center px-5 py-2.5 font-medium" style={{ color: 'var(--muted)', fontSize: 12 }}>Akcja</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {alertyCenowe.map((alert, idx) => (
                <tr key={alert.id} className="table-row" style={{ background: idx % 2 === 0 ? 'var(--table-even)' : 'var(--table-odd)', borderTop: '1px solid var(--border)' }}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Percent size={14} style={{ color: '#9333ea' }} />
                      <span style={{ color: 'var(--text)' }}>{alert.towary?.nazwa || '—'}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right font-semibold" style={{ fontFamily: 'DM Mono, monospace', color: '#9333ea' }}>{alert.prog_procentowy}%</td>
                  <td className="px-5 py-3 text-center">
                    <Badge variant={alert.aktywny ? 'green' : 'zinc'}>{alert.aktywny ? 'Aktywny' : 'Wyłączony'}</Badge>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <button onClick={() => toggleAlert(alert.id, alert.aktywny)} className="text-xs px-3 py-1 rounded-md" style={{ background: 'var(--table-sub)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                      {alert.aktywny ? 'Wyłącz' : 'Włącz'}
                    </button>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <button onClick={() => handleDeleteAlert(alert.id)} className="p-1.5 rounded-lg" style={{ color: '#dc2626' }} title="Usuń"><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <Modal title="Nowy alert cenowy" onClose={() => setShowModal(false)}>
          <form onSubmit={handleSaveAlert} className="space-y-4">
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Towar *</label>
              <select style={IS(errors.towar_id)} value={form.towar_id} onChange={e => setForm(f => ({ ...f, towar_id: e.target.value }))}>
                <option value="">— wybierz towar —</option>
                {towary.map(t => <option key={t.id} value={t.id}>{t.nazwa}</option>)}
              </select>
              {errors.towar_id && <p className="text-xs mt-1" style={{ color: '#dc2626' }}>Wybierz towar</p>}
            </div>
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Próg procentowy zmiany ceny *</label>
              <input type="number" min="1" max="100" style={IS(errors.prog)} value={form.prog_procentowy} onChange={e => setForm(f => ({ ...f, prog_procentowy: e.target.value }))} placeholder="np. 20 (alert gdy cena wzrośnie o 20%)" />
              {errors.prog && <p className="text-xs mt-1" style={{ color: '#dc2626' }}>Pole wymagane (wartość &gt; 0)</p>}
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="al_a" checked={form.aktywny} onChange={e => setForm(f => ({ ...f, aktywny: e.target.checked }))} style={{ accentColor: '#3b82f6' }} />
              <label htmlFor="al_a" className="text-sm" style={{ color: 'var(--text-2)' }}>Aktywny od razu</label>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 rounded-lg py-2 text-sm font-medium" style={{ background: 'var(--table-sub)', color: 'var(--text-2)' }}>Anuluj</button>
              <button type="submit" disabled={saving} className="flex-1 rounded-lg py-2 text-sm font-medium text-white" style={{ background: '#3b82f6', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Zapisywanie...' : 'Dodaj alert'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
