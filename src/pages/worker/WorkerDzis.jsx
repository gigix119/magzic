import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useWorkspace } from '../../context/WorkspaceContext'
import Spinner from '../../components/Spinner'
import { sortWorkerTasks } from '../../utils/workerTasks'
import { RefreshCw, MapPin, Users, Package, CheckSquare, CalendarDays, ArrowRight } from 'lucide-react'

function isoToday() { return new Date().toISOString().split('T')[0] }

const PRIORITY_BORDER = { pilny: 'var(--c-critical)', normalny: 'var(--c-action)', niski: 'var(--muted)' }
const PRIORYTET_TYP_BADGE = {
  zmiana:   { emoji: '🔴', label: 'ZMIANA',   bg: 'rgba(225,29,72,0.1)', text: 'var(--c-critical)' },
  przyjazd: { emoji: '🟡', label: 'PRZYJAZD', bg: 'rgba(217,119,6,0.1)', text: '#9a3412' },
  wyjazd:   { emoji: '🔵', label: 'WYJAZD',   bg: 'rgba(37,99,235,0.1)', text: '#1e40af' },
}

function StatTile({ icon: Icon, value, label, color }) {
  return (
    <div className="flex-1 rounded-xl py-3 px-2 text-center" style={{ background: 'var(--c-surface)', border: '1px solid var(--border)' }}>
      <Icon size={18} style={{ color, margin: '0 auto 4px' }} />
      <p className="num font-bold" style={{ fontSize: 20, color: 'var(--text)' }}>{value}</p>
      <p className="text-xs" style={{ color: 'var(--text-2)' }}>{label}</p>
    </div>
  )
}

function ProgressBar({ value, total, color }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden', marginTop: 4 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.3s' }} />
    </div>
  )
}

export default function WorkerDzis() {
  const navigate = useNavigate()
  const { workspaceId, wsQuery, addWsFilter } = useWorkspace()

  const [items, setItems] = useState([])
  const [pozMap, setPozMap] = useState({})
  const [checklistMap, setChecklistMap] = useState({})
  const [rezMap, setRezMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(null)

  async function fetchData() {
    if (!workspaceId) { setLoading(false); return }
    setLoading(true)
    const today = isoToday()

    const { data: zl } = await addWsFilter(
      wsQuery('zlecenia').select('*')
    ).eq('data_realizacji', today)

    const all = zl || []
    setItems(all)

    const ids = all.map(z => z.id)
    if (ids.length > 0) {
      const [{ data: poz }, { data: cl }, { data: rez }] = await Promise.all([
        supabase.from('zlecenia_pozycje').select('zlecenie_id, wydano').in('zlecenie_id', ids),
        supabase.from('checklist_items').select('zlecenie_id, checked').in('zlecenie_id', ids),
        supabase.from('rezerwacje').select('przygotowanie_id, liczba_gosci, checkin_at, checkout_at, lokale(nazwa, adres, lokalizacja)').in('przygotowanie_id', ids),
      ])

      const pMap = {}
      for (const p of poz || []) {
        if (!pMap[p.zlecenie_id]) pMap[p.zlecenie_id] = { total: 0, wydano: 0 }
        pMap[p.zlecenie_id].total++
        if (p.wydano) pMap[p.zlecenie_id].wydano++
      }
      setPozMap(pMap)

      const cMap = {}
      for (const c of cl || []) {
        if (!cMap[c.zlecenie_id]) cMap[c.zlecenie_id] = { total: 0, checked: 0 }
        cMap[c.zlecenie_id].total++
        if (c.checked) cMap[c.zlecenie_id].checked++
      }
      setChecklistMap(cMap)

      const rMap = {}
      for (const r of rez || []) {
        if (r.przygotowanie_id) rMap[r.przygotowanie_id] = r
      }
      setRezMap(rMap)
    } else {
      setPozMap({}); setChecklistMap({}); setRezMap({})
    }
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData() }, [workspaceId])

  async function handleStart(item) {
    if (item.status === 'nowe') {
      setStarting(item.id)
      await supabase.from('zlecenia').update({ status: 'w_realizacji', updated_at: new Date().toISOString() }).eq('id', item.id)
      setStarting(null)
    }
    navigate(`/pracownik/zadanie/${item.id}`)
  }

  if (loading) return <Spinner />

  const doZrobienia = items.filter(i => i.status === 'nowe').length
  const wTrakcie = items.filter(i => i.status === 'w_realizacji').length
  const gotowe = items.filter(i => i.status === 'gotowe').length

  const todoList = sortWorkerTasks(items.filter(i => i.status === 'nowe' || i.status === 'w_realizacji'))
  const dateLabel = new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-bold capitalize" style={{ fontSize: 20, color: 'var(--text)' }}>
          Dziś, {dateLabel}
        </h1>
        <button
          onClick={fetchData}
          className="flex items-center justify-center rounded-lg flex-shrink-0"
          style={{ minWidth: 44, minHeight: 44, color: 'var(--text-2)' }}
          aria-label="Odśwież"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      <div className="flex gap-2 mb-5">
        <StatTile icon={Package} value={doZrobienia} label="Do zrob." color="var(--c-action)" />
        <StatTile icon={CalendarDays} value={wTrakcie} label="W trakc." color="var(--c-attention)" />
        <StatTile icon={CheckSquare} value={gotowe} label="Gotowe" color="var(--c-success)" />
      </div>

      {todoList.length === 0 ? (
        <div className="text-center py-16 rounded-xl" style={{ background: 'var(--c-surface)', border: '1px solid var(--border)' }}>
          <CheckSquare size={40} className="mx-auto mb-3" style={{ color: 'var(--c-success)', opacity: 0.5 }} />
          <p className="font-medium mb-1" style={{ color: 'var(--text)' }}>Wszystko na dziś gotowe! 🎉</p>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Brak zaplanowanych zadań na dziś.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {todoList.map(item => {
            const poz = pozMap[item.id] || { total: 0, wydano: 0 }
            const cl = checklistMap[item.id] || { total: 0, checked: 0 }
            const rez = rezMap[item.id]
            const address = rez?.lokale?.adres || rez?.lokale?.lokalizacja || null
            const isPilny = item.priorytet === 'pilny'
            const isStarting = starting === item.id

            return (
              <div
                key={item.id}
                className="rounded-xl overflow-hidden"
                style={{ background: 'var(--c-surface)', borderLeft: `4px solid ${PRIORITY_BORDER[item.priorytet] || PRIORITY_BORDER.normalny}`, border: '1px solid var(--border)', borderLeftWidth: 4 }}
              >
                <div className="p-4">
                  {item.priorytet_typ && PRIORYTET_TYP_BADGE[item.priorytet_typ] ? (
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold mb-2" style={{ background: PRIORYTET_TYP_BADGE[item.priorytet_typ].bg, color: PRIORYTET_TYP_BADGE[item.priorytet_typ].text }}>
                      {PRIORYTET_TYP_BADGE[item.priorytet_typ].emoji} {PRIORYTET_TYP_BADGE[item.priorytet_typ].label}
                    </span>
                  ) : isPilny && (
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold mb-2" style={{ background: 'rgba(225,29,72,0.1)', color: 'var(--c-critical)' }}>
                      🔴 PILNE
                    </span>
                  )}
                  <p className="font-semibold" style={{ fontSize: 16, color: 'var(--text)' }}>{item.nazwa}</p>

                  {address && (
                    <p className="flex items-center gap-1.5 text-sm mt-1.5" style={{ color: 'var(--text-2)' }}>
                      <MapPin size={13} /> {address}
                    </p>
                  )}

                  {rez && (
                    <p className="flex items-center gap-1.5 text-sm mt-1" style={{ color: 'var(--text-2)' }}>
                      <Users size={13} /> {rez.liczba_gosci ?? '—'} osoby
                      {rez.checkin_at && <> · check-in {new Date(rez.checkin_at).toLocaleDateString('pl-PL')}</>}
                    </p>
                  )}

                  {poz.total > 0 && (
                    <div className="mt-3">
                      <p className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-2)' }}>
                        <Package size={12} /> {poz.total} materiałów · {poz.wydano}/{poz.total} wydano
                      </p>
                      <ProgressBar value={poz.wydano} total={poz.total} color={poz.wydano === poz.total ? 'var(--c-success)' : 'var(--c-action)'} />
                    </div>
                  )}

                  {cl.total > 0 && (
                    <div className="mt-2">
                      <p className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-2)' }}>
                        <CheckSquare size={12} /> {cl.checked}/{cl.total} checklista
                      </p>
                      <ProgressBar value={cl.checked} total={cl.total} color={cl.checked === cl.total ? 'var(--c-success)' : 'var(--c-action)'} />
                    </div>
                  )}

                  <button
                    onClick={() => handleStart(item)}
                    disabled={isStarting}
                    className="w-full flex items-center justify-center gap-2 rounded-lg text-sm font-semibold text-white mt-4"
                    style={{ background: 'var(--c-action)', minHeight: 48, opacity: isStarting ? 0.7 : 1 }}
                  >
                    {item.status === 'w_realizacji' ? 'Kontynuuj' : 'Rozpocznij'} <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
